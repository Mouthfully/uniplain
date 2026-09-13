-- ================================================================================================
-- THE BREACH REGISTER. GDPR Art. 33(5), PDPA s.37(4), and the 72 hours that is actually statutory.
--
-- `security_events` records acts this application performs. It is the raw material an incident
-- assessment reads, and it is NOT a breach record: it has no notion of who was affected, what the
-- likely consequences are, or whether anybody was told. Art. 33(5) asks for something else --
-- "the controller shall document any personal data breaches, comprising the facts relating to the
-- personal data breach, its effects and the remedial action taken" -- and says that documentation
-- must let the supervisory authority verify compliance. A trail of events does not do that. This
-- table is that documentation.
--
-- SEVENTY-TWO HOURS IS NOT INVENTED HERE, WHICH IS WHY IT MAY BE ENCODED. `app.data_request_deadline`
-- returns NULL, on the rule that a statutory period nobody established must not be written down as
-- though it were one. This is the other case. GDPR Art. 33(1) says the controller shall notify the
-- supervisory authority "not later than 72 hours after having become aware of it", and PDPA s.37(4)
-- sets the same 72 hours to the PDPC. The period is in both statutes, so encoding it is recording a
-- fact rather than guessing one -- and the distinction between these two functions is the whole of
-- the rule, which is why they sit one migration apart and say so.
--
-- THE DEADLINE APPLIES TO ONE ROLE AND NOT THE OTHER, AND COLLAPSING THEM WOULD BE THE DEFECT.
-- This company is controller of its own account records and PROCESSOR of the platform data it reads
-- on a customer's behalf -- the split `PROCESSING_ACTIVITIES` already draws. Art. 33(1)'s 72 hours
-- binds a CONTROLLER. A processor's duty is Art. 33(2): notify the controller "without undue delay",
-- with no fixed clock. So `app.breach_notification_deadline` returns a timestamp for a controller
-- breach and NULL for a processor one -- and NULL here means "no fixed statutory deadline", not
-- "no obligation". A single 72-hour countdown shown against a processor breach would be a deadline
-- the law does not set, displayed to whoever is handling an incident at the worst possible moment.
--
-- INCOMPLETE RECORDS ARE LEGAL AND MUST STAY WRITABLE. Art. 33(4) is explicit: "Where, and in so
-- far as, it is not possible to provide the information at the same time, the information may be
-- provided in phases without undue further delay." So the Art. 33(3) fields are NULLABLE and there
-- is no CHECK demanding them. A constraint requiring a complete record would make the register
-- unusable in the first hours of an incident, which is exactly when it has to be started, and would
-- push whoever is handling it into guessing values to get the insert to succeed. Instead
-- `app.breach_record_gaps` reports what is missing, so a record can be honest about being partial
-- rather than either false or absent.
--
-- COUNTS ARE NULLABLE INTEGERS AND NULL IS NOT ZERO. Art. 33(3)(a) asks for the "approximate
-- number" of data subjects and records. Before that is established the answer is unknown, and
-- writing 0 would report a breach affecting nobody -- the repository's founding example of a wrong
-- number that looks right, in the one document a regulator reads after an incident.
--
-- NO TENANT COLUMN AND NO TENANT ACCESS. This is the company's own regulatory documentation, not
-- customer data. It carries FORCE row level security with NO POLICY FOR ANY COMMAND, which denies
-- it to every role RLS applies to, including `authenticated`. It is reached by `service_role`,
-- which RLS does not apply to -- the same shape `waitlist` uses and for the same reason. A customer
-- is told about a breach by the notification, not by reading the register.
-- ================================================================================================

create type app.breach_role as enum ('controller', 'processor');

create table public.breach_records (
  id                      uuid primary key default gen_random_uuid(),

  -- Which hat this company was wearing. Decides whether a statutory deadline exists at all.
  role                    app.breach_role not null,

  -- Art. 33(1): the clock runs from "having become aware", not from the breach itself, and not from
  -- when the row was written. Those three differ and only this one is the one the Article names.
  became_aware_at         timestamptz not null,

  -- Art. 33(3)(a): the nature of the breach, and the categories of data subjects and records.
  nature                  text check (nature is null or length(btrim(nature)) between 20 and 4000),
  categories_of_subjects  text check (categories_of_subjects is null or length(btrim(categories_of_subjects)) between 10 and 2000),
  categories_of_records   text check (categories_of_records is null or length(btrim(categories_of_records)) between 10 and 2000),

  -- Art. 33(3)(a), approximate numbers. NULLABLE ON PURPOSE: see the header. Non-negative where
  -- given, because a negative count is not an approximation of anything.
  approximate_subjects    integer check (approximate_subjects is null or approximate_subjects >= 0),
  approximate_records     integer check (approximate_records is null or approximate_records >= 0),

  -- Art. 33(3)(b): the contact point. `brand.dataProtectionOfficer` is null, so this is a named
  -- person or address rather than a role nobody holds.
  contact_point           text check (contact_point is null or length(btrim(contact_point)) between 5 and 500),

  -- Art. 33(3)(c) and (d).
  likely_consequences     text check (likely_consequences is null or length(btrim(likely_consequences)) between 20 and 4000),
  measures_taken          text check (measures_taken is null or length(btrim(measures_taken)) between 20 and 4000),

  -- What was actually done, and when. NULL means not done; there is no boolean, because a boolean
  -- would record that a notification happened without recording when, and the when is the only part
  -- a regulator checks against the 72 hours.
  notified_authority_at   timestamptz,
  notified_subjects_at    timestamptz,   -- Art. 34, where the risk is high
  notified_customer_at    timestamptz,   -- Art. 33(2), where this company is the processor

  -- Art. 33(1) allows a controller not to notify where the breach is "unlikely to result in a risk".
  -- Recording that decision is part of the documentation: a register showing no notification and no
  -- reason is indistinguishable from one showing a missed deadline.
  no_risk_reason          text check (no_risk_reason is null or length(btrim(no_risk_reason)) between 20 and 4000),

  recorded_at             timestamptz not null default now()
);

comment on table public.breach_records is
  'GDPR Art. 33(5) / PDPA s.37(4) documentation of personal data breaches. Company regulatory '
  'records, not customer data: no tenant column, FORCE RLS with no policy, reachable by '
  'service_role only. Art. 33(3) fields are nullable because Art. 33(4) permits reporting in '
  'phases; app.breach_record_gaps reports what is still missing.';

comment on column public.breach_records.became_aware_at is
  'When this company became aware, which is what Art. 33(1) starts the 72 hours from -- not when '
  'the breach occurred and not when this row was written.';

comment on column public.breach_records.approximate_subjects is
  'Art. 33(3)(a) approximate number of data subjects. NULL means not yet established. It is not 0: '
  'a register reporting a breach affecting nobody is worse than one reporting that it does not '
  'know yet.';

alter table public.breach_records enable row level security;
-- FORCE, not merely ENABLE. Without it the table owner bypasses its own policies, and migrations
-- and every SECURITY DEFINER function are the owner. `15_force_rls.sql` asserts both settings for
-- every table in `public`, read from the catalogue.
alter table public.breach_records force row level security;

-- NO POLICY FOR ANY COMMAND. With RLS enabled that denies every command to every role RLS applies
-- to. Nothing here is a customer's to read: a customer learns about a breach from the notification.
revoke all on public.breach_records from anon, authenticated;

-- ------------------------------------------------------------------------------------------------
-- The deadline, where one exists.
-- ------------------------------------------------------------------------------------------------
create or replace function app.breach_notification_deadline(
  p_became_aware_at timestamptz,
  p_role app.breach_role
)
returns timestamptz
language sql
immutable
as $$
  -- Art. 33(1) binds the CONTROLLER to 72 hours from awareness; PDPA s.37(4) sets the same period.
  -- Art. 33(2) binds a PROCESSOR to "without undue delay" and names no period, so there is nothing
  -- truthful to return -- and NULL is the repository's way of saying so rather than inventing one.
  select case
    when p_role = 'controller' then p_became_aware_at + interval '72 hours'
    else null
  end;
$$;

comment on function app.breach_notification_deadline(timestamptz, app.breach_role) is
  'GDPR Art. 33(1) / PDPA s.37(4): 72 hours from awareness for a controller. NULL for a processor, '
  'whose duty under Art. 33(2) is without undue delay with no period stated -- NULL means no fixed '
  'statutory deadline, never no obligation.';

-- A NEW FUNCTION IS EXECUTE-ABLE BY PUBLIC BY DEFAULT and `alter default privileges` cannot revoke
-- it. `public` is named FIRST because revoking from the named roles alone leaves the grant standing
-- through PUBLIC. This has gone wrong in this schema before.
revoke all on function app.breach_notification_deadline(timestamptz, app.breach_role)
  from public, anon, authenticated;

-- ------------------------------------------------------------------------------------------------
-- What a record is still missing, so it can be honest about being partial.
-- ------------------------------------------------------------------------------------------------
create or replace function app.breach_record_gaps(p_id uuid)
returns text[]
language sql
stable
as $$
  -- Art. 33(4) permits phased reporting, so a partial record is lawful and must be writable. What
  -- must not happen is a partial record that LOOKS complete, which is why the gaps are computed
  -- from the columns rather than tracked in a status field somebody has to remember to update.
  select coalesce(
    array_remove(array[
      case when b.nature is null                 then 'nature (Art. 33(3)(a))' end,
      case when b.categories_of_subjects is null then 'categories of data subjects (Art. 33(3)(a))' end,
      case when b.categories_of_records is null  then 'categories of records (Art. 33(3)(a))' end,
      case when b.approximate_subjects is null   then 'approximate number of data subjects (Art. 33(3)(a))' end,
      case when b.approximate_records is null    then 'approximate number of records (Art. 33(3)(a))' end,
      case when b.contact_point is null          then 'contact point (Art. 33(3)(b))' end,
      case when b.likely_consequences is null    then 'likely consequences (Art. 33(3)(c))' end,
      case when b.measures_taken is null         then 'measures taken or proposed (Art. 33(3)(d))' end,
      -- Not a field of Art. 33(3), but the one a register is most often silently missing: a
      -- controller breach that was neither notified nor recorded as low-risk reads identically to
      -- one nobody got round to.
      case when b.role = 'controller'
             and b.notified_authority_at is null
             and b.no_risk_reason is null        then 'notification to the authority, or a recorded reason none was required (Art. 33(1))' end,
      case when b.role = 'processor'
             and b.notified_customer_at is null  then 'notification to the customer as controller (Art. 33(2))' end
    ], null),
    array[]::text[]
  )
  from public.breach_records b
  where b.id = p_id;
$$;

comment on function app.breach_record_gaps(uuid) is
  'The Art. 33(3) elements this record does not yet carry. Art. 33(4) allows phased reporting, so a '
  'partial record is lawful -- what must not exist is a partial record that looks complete.';

revoke all on function app.breach_record_gaps(uuid) from public, anon, authenticated;
