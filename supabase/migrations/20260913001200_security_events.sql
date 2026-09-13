-- ================================================================================================
-- A SECURITY EVENT TRAIL -- AND WHY IT IS NOT THE "AUDIT LOG" THE CLAIM TABLE DESCRIBES.
--
-- PDPA s.37(1) requires appropriate security measures, and s.37(4) requires a controller to assess
-- and notify a breach. `AGENTS.md` gap 8 records that neither is possible today for a plain reason:
-- no access-log table exists in any migration, so there is no way to answer "whose data was
-- reached, by whom, and when" -- which is the first question asked after an incident and the one a
-- B2B security review asks before there is one.
--
-- WHAT THIS RECORDS: security-relevant acts this application performs, each written at the moment
-- the act succeeds -- a credential sealed, a connection attached or revoked, a member's role
-- changed, an API key minted or revoked, a data-subject request filed.
--
-- WHAT IT DOES NOT RECORD, STATED SO NOBODY INFERS OTHERWISE: every read. A tenant's reads go
-- through PostgREST as `authenticated`, and capturing them would be database-level statement
-- logging rather than anything this schema can do. `CLAIMS`' `audit-log` entry says "Every query,
-- export and API key is logged", and THAT CLAIM STAYS WITHHELD. `surface:audit-log` is deliberately
-- absent from `AVAILABLE_CAPABILITIES` and this migration does not add it. Shipping a partial trail
-- and switching on a claim that says "every query" would be the precise failure the capability gate
-- exists to prevent -- and it would be made to a buyer's security reviewer, who is the worst
-- possible audience for a promise the code does not keep.
--
-- APPEND-ONLY, AND ENFORCED RATHER THAN INTENDED. `authenticated` gets SELECT and nothing else; the
-- only writer is a SECURITY DEFINER function; and there is no UPDATE or DELETE grant for any role,
-- so a trail cannot be edited by the party it is evidence about. A log its subject can rewrite is
-- not evidence, which is the same argument `data_requests` makes one table over.
-- ================================================================================================

create type app.security_event as enum (
  'connection_created',
  'connection_revoked',
  'credential_sealed',
  'api_key_created',
  'api_key_revoked',
  'member_role_changed',
  'member_removed',
  'data_request_filed'
);

create table public.security_events (
  id              bigint generated always as identity primary key,
  organisation_id uuid not null references public.organisations (id) on delete cascade,

  -- WHICH WORKSPACE, WHERE THERE IS ONE. Nullable because organisation-level acts -- a role change,
  -- a member removal -- belong to no workspace, and inventing one to fill the column would make
  -- every query that groups by workspace quietly wrong.
  workspace_id    uuid references public.workspaces (id) on delete set null,

  event           app.security_event not null,

  -- WHO DID IT, AS A TOMBSTONE. `on delete set null`: if the person's auth row is later removed the
  -- EVENT must survive. A trail that vanished with its actor would erase the record of exactly the
  -- acts an investigation is about.
  actor           uuid references auth.users (id) on delete set null,

  -- WHAT IT WAS DONE TO, as an opaque identifier rather than a foreign key. A foreign key would
  -- cascade the row away when the thing is deleted, which is the one moment the record matters
  -- most. Bounded, and never a credential: see the CHECK and the comment on `detail`.
  subject_id      text check (subject_id is null or length(subject_id) between 1 and 200),

  /*
   * A SHORT, NON-SECRET NOTE. Bounded hard at 200 characters because this column is the one a
   * future caller will be tempted to put a payload in, and a payload here would put platform data
   * -- or worse, a credential -- into a table every member of the organisation can read.
   */
  detail          text check (detail is null or length(detail) between 1 and 200),

  occurred_at     timestamptz not null default now()
);

comment on table public.security_events is
  'Append-only security event trail. NOT a complete access log: reads are not captured, and the '
  '`audit-log` claim stays withheld. See the header of 20260913001200_security_events.sql.';

create index security_events_org_idx on public.security_events (organisation_id, occurred_at desc);

alter table public.security_events enable row level security;
alter table public.security_events force row level security;

revoke all on public.security_events from public, anon, authenticated;

-- READ ONLY, FOR MEMBERS OF THE ORGANISATION THE EVENT BELONGS TO. A customer's own security review
-- is a reason to show them their trail; nobody else's is.
grant select on public.security_events to authenticated;

create policy security_events_select on public.security_events
  for select
  to authenticated
  using (app.is_org_member(organisation_id));

-- ------------------------------------------------------------------------------------------------
-- THE ONLY WRITER.
--
-- SECURITY DEFINER, reaching a FORCED table through no insert policy on the owner's BYPASSRLS --
-- the mechanism `15_force_rls.sql` demonstrates. A permissive insert policy would be one line and
-- would hand every `authenticated` session the ability to forge entries in the log that is evidence
-- about them.
-- ------------------------------------------------------------------------------------------------
create or replace function public.record_security_event(
  p_organisation_id uuid,
  p_event app.security_event,
  p_workspace_id uuid default null,
  p_subject_id text default null,
  p_detail text default null
)
returns bigint
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
begin
  if not app.is_org_member(p_organisation_id) then
    raise exception 'record_security_event: not a member of that organisation'
      using errcode = '42501';
  end if;

  insert into public.security_events
    (organisation_id, workspace_id, event, actor, subject_id, detail)
  values
    (p_organisation_id, p_workspace_id, p_event, app.current_user_id(),
     nullif(btrim(p_subject_id), ''), nullif(btrim(p_detail), ''))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function
  public.record_security_event(uuid, app.security_event, uuid, text, text)
  from public, anon, authenticated;

grant execute on function
  public.record_security_event(uuid, app.security_event, uuid, text, text)
  to authenticated;
