-- ================================================================================================
-- A DATA-SUBJECT REQUEST, RECORDED -- AND DELIBERATELY NOT FULFILLED BY THIS PRODUCT.
--
-- WHY THIS EXISTS AT ALL, AND WHY NOW. `/privacy` tells every data subject that a request to see,
-- correct, export or delete their data goes to the contact address. AGENTS.md records, verified
-- over DNS-over-HTTPS rather than assumed, that the brand domain answers NODATA for both MX and
-- TXT: the zone exists and holds no mail exchanger. THE ONE PUBLISHED INTAKE FOR A STATUTORY RIGHT
-- IS AN ADDRESS THAT BOUNCES. So this is not a compliance nicety layered on a working channel; it
-- is the first channel that works at all, and that is the whole argument for building it before
-- the erasure machinery it will eventually drive.
--
-- WHAT IT REFUSES TO BE. It does not delete anything, and it must not grow a button that claims to.
-- That is not timidity, it is what the grants say: `20260908000700_rls.sql` withholds DELETE from
-- `organisations`, `workspaces`, `invitations` and `api_keys` on purpose -- "a hard delete of an
-- organisation destroys the audit log and the Meta client-list record along with it" -- and no code
-- in this repository can delete an `auth.users` row at all. `deleteWorkspacePayloads` exists in
-- `packages/payloads` for the R2 half and has no non-test caller. A product that offered erasure
-- today would be claiming a capability every one of those facts denies.
--
-- The erasure itself, when it is built, is nearly one statement: `delete from public.organisations`
-- reaches thirteen of the sixteen tables in `public` by cascade. Not reached, each for its own
-- reason: `waitlist` (no foreign key either way -- a different data subject and a different
-- request), `ambient_readings` (Air4Thai station data, no tenant column, not personal data) and
-- `auth.users` (the reference points INTO members, not outward). Recorded here so the next person
-- does not go looking for a table-by-table script that was never needed.
--
-- NO DEADLINE IS INVENTED. `app.data_request_deadline()` returns NULL, and the screen renders "no
-- period is published" rather than a date. A statutory period is exactly the kind of fact
-- CLAUDE.md names as not-to-be-invented, alongside an endpoint and a rate limit, and a date shown
-- to a customer is a promise the company would then be measured against. The function body is one
-- line for a Thai-qualified lawyer to fill in; until then the honest answer is that there isn't one
-- published, which is also true.
-- ================================================================================================

-- What a person can ask for. The five PDPA rights that produce different work, named in the
-- product's own vocabulary rather than by section number -- a section number in an enum is a
-- citation nothing checks, and `check-claim-sources` exists because those rot.
create type app.data_request_kind as enum (
  'erasure',
  'access',
  'rectification',
  'objection',
  'portability'
);

-- Where a request has got to. `withdrawn` is separate from `refused` because a person changing
-- their mind and a company declining are different facts about the same row, and collapsing them
-- would make the second unreportable.
create type app.data_request_state as enum (
  'open',
  'acknowledged',
  'fulfilled',
  'refused',
  'withdrawn'
);

create table public.data_requests (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations (id) on delete cascade,
  kind             app.data_request_kind not null,
  state            app.data_request_state not null default 'open',

  -- WHO ASKED, AS A TOMBSTONE. `on delete set null` rather than cascade: if the person's auth row
  -- is later removed, the REQUEST must survive -- it is the evidence that the obligation was
  -- received and what was done about it. A request that vanished with its requester would destroy
  -- the record of the erasure at the moment the erasure happened.
  requested_by     uuid references auth.users (id) on delete set null,

  -- What the person said, bounded. Free text from a data subject, so it is the one column here
  -- that can hold anything; the bound stops a pasted document and the comment stops anyone
  -- treating it as structured.
  subject_note     text check (subject_note is null or length(subject_note) between 1 and 4000),

  -- What was done, and by whom. Written ONLY by the definer functions below -- `authenticated`
  -- holds no UPDATE privilege on this table at any point, so a tenant cannot resolve their own
  -- request, which is the property that makes the record worth anything.
  resolution_note  text check (resolution_note is null or length(resolution_note) between 1 and 4000),
  resolved_by      uuid references auth.users (id) on delete set null,

  requested_at     timestamptz not null default now(),
  state_changed_at timestamptz not null default now(),

  -- A row may not be both withdrawn by its subject and resolved by the company.
  constraint data_requests_withdrawn_is_unresolved check (
    state <> 'withdrawn' or resolution_note is null
  )
);

comment on table public.data_requests is
  'Data-subject requests. Recorded and tracked; NOT fulfilled by any code here. The product holds '
  'no privilege that could perform an erasure -- see the header of 20260913000700_data_requests.sql.';

create index data_requests_org_idx on public.data_requests (organisation_id, requested_at desc);

-- Open requests, for whoever is working the queue. Partial, because the queue is the only thing
-- anyone scans and it is a small fraction of the table once the product has been running a while.
create index data_requests_open_idx on public.data_requests (requested_at)
  where state in ('open', 'acknowledged');

-- FORCE, not merely ENABLE. Without FORCE the table owner bypasses its own policies, and every
-- migration and every SECURITY DEFINER function IS the owner. Three tables shipped with ENABLE
-- alone in this schema; `15_force_rls.sql` reads the catalogue and asserts both settings for every
-- table in `public`, which is why that gap cannot reappear silently.
alter table public.data_requests enable row level security;
alter table public.data_requests force row level security;

revoke all on public.data_requests from public, anon, authenticated;

-- SELECT ONLY, AND NOTHING ELSE, FOR A TENANT.
--
-- A member of the organisation may read their organisation's requests: a person who asked to be
-- forgotten is entitled to see that the asking was recorded, and a surface that showed nothing
-- would be indistinguishable from one that dropped the request.
--
-- There is deliberately NO insert policy and NO insert grant. Filing goes through
-- `public.file_data_request` so the row's `requested_by` is the session's own user rather than
-- whatever the caller typed -- the same reason the OAuth callback takes the workspace from the
-- redeemed row and not from the body.
grant select on public.data_requests to authenticated;

create policy data_requests_select on public.data_requests
  for select
  to authenticated
  using (app.is_org_member(organisation_id));

-- ------------------------------------------------------------------------------------------------
-- FILING A REQUEST.
--
-- SECURITY DEFINER because the table has no insert grant for anyone. The definer reaches a FORCED
-- table through NO insert policy, on the strength of the owner's BYPASSRLS -- which is the
-- mechanism `15_force_rls.sql` demonstrates. A permissive insert policy would have been one line
-- and would have applied to `authenticated` too, which is exactly what CLAUDE.md forbids.
-- ------------------------------------------------------------------------------------------------
create or replace function public.file_data_request(
  p_organisation_id uuid,
  p_kind app.data_request_kind,
  p_subject_note text default null
)
returns public.data_requests
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.data_requests;
begin
  -- THE TENANCY DECISION IS THE DATABASE'S, and it is made here rather than trusted from the
  -- caller. A definer function that skipped this would let any signed-in person file a request
  -- against any organisation, which is a cross-tenant write dressed as a privacy feature.
  if not app.is_org_member(p_organisation_id) then
    raise exception 'file_data_request: not a member of that organisation'
      using errcode = '42501';
  end if;

  if p_subject_note is not null and length(btrim(p_subject_note)) = 0 then
    -- Refused rather than stored as an empty string: "" and NULL would then mean the same thing
    -- and neither would mean "the person wrote nothing", which is the only useful reading.
    raise exception 'file_data_request: a note must say something or be omitted'
      using errcode = '22023';
  end if;

  insert into public.data_requests (organisation_id, kind, requested_by, subject_note)
  values (p_organisation_id, p_kind, app.current_user_id(), nullif(btrim(p_subject_note), ''))
  returning * into v_row;

  return v_row;
end;
$$;

-- ------------------------------------------------------------------------------------------------
-- WITHDRAWING ONE.
--
-- The subject may withdraw their own request and nobody else's -- not an admin's, not another
-- member's. A withdrawal by somebody other than the person who asked is a company closing a
-- request and calling it the customer's decision, which is the one state transition that must not
-- be available to the wrong hands.
-- ------------------------------------------------------------------------------------------------
create or replace function public.withdraw_data_request(p_id uuid)
returns public.data_requests
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.data_requests;
begin
  update public.data_requests
     set state = 'withdrawn',
         state_changed_at = now()
   where id = p_id
     and requested_by = app.current_user_id()
     and state in ('open', 'acknowledged')
  returning * into v_row;

  if v_row.id is null then
    -- ONE ANSWER FOR FOUR CASES, on purpose: no such request, somebody else's request, one already
    -- resolved, one already withdrawn. Distinguishing them here would let a signed-in person probe
    -- for the existence of other people's requests by id.
    raise exception 'withdraw_data_request: no open request of yours with that id'
      using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

-- ------------------------------------------------------------------------------------------------
-- THE STATUTORY CLOCK, WHICH THIS REPOSITORY DOES NOT KNOW.
--
-- Returns NULL, and every caller must render the absence rather than substitute a number. PDPA
-- s.30-36 govern these rights and the period that applies to each is a question for a
-- Thai-qualified lawyer -- AGENTS.md books it under "Needs a human, not code" alongside the s.40
-- processor agreement and the s.28 transfer instruments.
--
-- A plausible interval typed here would be the exact failure this repository is built to refuse: a
-- number that looks right, rendered next to a customer's own request, which the company would then
-- be measured against by a regulator who knows the real one. `coalesce(deadline, '30 days')` is a
-- guess wearing the costume of a fact, and `20260912000400`'s rule applies to a statutory period
-- exactly as it applies to a timezone.
-- ------------------------------------------------------------------------------------------------
create or replace function app.data_request_deadline()
returns interval
language sql
immutable
as $$ select null::interval $$;

comment on function app.data_request_deadline() is
  'NULL until a Thai-qualified lawyer sets the PDPA s.30-36 response period. Callers must render '
  'the absence -- never a default.';

-- A NEW FUNCTION IS EXECUTE-ABLE BY PUBLIC BY DEFAULT, and `alter default privileges` cannot
-- revoke it. This has already gone wrong once in this schema, which is why every migration adding
-- one carries these lines. `public` is named FIRST: revoking from `authenticated` while PUBLIC
-- still holds the grant changes nothing at all.
revoke all on function public.file_data_request(uuid, app.data_request_kind, text)
  from public, anon, authenticated;
revoke all on function public.withdraw_data_request(uuid) from public, anon, authenticated;
revoke all on function app.data_request_deadline() from public, anon, authenticated;

grant execute on function public.file_data_request(uuid, app.data_request_kind, text)
  to authenticated;
grant execute on function public.withdraw_data_request(uuid) to authenticated;
grant execute on function app.data_request_deadline() to authenticated;
