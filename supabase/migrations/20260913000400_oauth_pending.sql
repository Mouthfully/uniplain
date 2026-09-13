-- THE PENDING AUTHORISATION: what has to survive the customer's detour to Google, Meta or Loyverse.
--
-- ============================================================================================
-- WHAT THIS IS FOR
-- ============================================================================================
--
-- `packages/oauth` has been complete and unreachable since it was written. `startAuthorization`
-- returns a `PendingAuthorization` -- a `state`, a PKCE `code_verifier`, a workspace, a provider, a
-- source list and a redirect URI -- and says, in its own type comment, "what the caller must
-- persist between the redirect out and the callback in". Nothing persisted it, so there was no
-- callback, so four of six providers (`ga4`, `google_ads`, `search_console`, `loyverse`) could not
-- be connected at all. This table is that persistence, and the two functions below are its only
-- door.
--
-- ============================================================================================
-- WHY A ROW IN POSTGRES AND NOT A SIGNED COOKIE, WHICH IS THE OBVIOUS ANSWER
-- ============================================================================================
--
-- REDEMPTION MUST BE SINGLE-SHOT, AND THAT IS THE ARGUMENT THAT DECIDES IT. `verifyCallback` in
-- `packages/oauth/src/flow.ts` checks the provider's error, then the state, then the age. Nothing
-- in it checks "has this already been spent", because nothing in a pure function can. A pending
-- record that can be replayed is a pending record that attaches a SECOND connection from ONE
-- authorisation -- the same grant, sealed twice, against two rows, one of which nobody asked for.
--
--     delete from public.oauth_authorizations where state = p_state ... returning *
--
-- is atomic single-use for free: the row is gone in the same statement that reads it, so a second
-- callback carrying the same code finds nothing. A cookie cannot express that without server state
-- to mark it spent -- at which point the cookie is decoration on top of the store it was meant to
-- replace.
--
-- TENANCY IS THEN DECIDED BY THE DATABASE RATHER THAN BY WORKER CODE, which is this schema's first
-- structural rule. The redeem function is SECURITY DEFINER -- it has to be, because the table below
-- grants nothing to anybody -- so the tenancy predicate is written out explicitly, and it is the
-- same function every policy in `20260908000700_rls.sql` calls:
--
--     where a.state = p_state and app.can_write_workspace(a.workspace_id)
--
-- Org B presenting org A's state gets zero rows, from Postgres. The `connections` insert that
-- follows is then adjudicated a SECOND time by the existing `connections_insert` policy, on the
-- customer's own forwarded token. Two database decisions, zero application-code decisions. A
-- Workers KV entry or a Durable Object would move that decision into a `===` in TypeScript.
--
-- ============================================================================================
-- WHAT CAN READ THE `code_verifier`, AND FOR HOW LONG
-- ============================================================================================
--
-- The table carries `revoke all ... from anon, authenticated` and has NO POLICY of any kind, so no
-- tenant token reaches it over PostgREST at all -- the two-layer posture `20260912000900` names and
-- `20260913000200` argues for at length. The only door is `redeem_oauth_authorization`, which
-- requires already knowing the 256-bit `state`, and which DESTROYS the row as it reads it. So the
-- verifier is readable exactly once, by a session that already holds the state and already passes
-- `app.can_write_workspace`.
--
-- It is readable by the table owner -- migrations, definer functions -- as every row in this schema
-- is. `20260913000200_force_rls.sql` already records that FORCE does not reach BYPASSRLS and that
-- every definer writer here rests on it; nothing in this file is a new bet.
--
-- THE VERIFIER IS IN BACKUPS AND IN POINT-IN-TIME RECOVERY for as long as those are kept, even
-- though the live row is gone within the hour. Stated rather than discovered: it is not a
-- credential on its own -- completing an exchange with it also needs the one-time authorisation
-- code and the client secret, which is a Worker secret and is not in this database -- but a
-- restored backup is a place a verifier exists after everyone has stopped thinking about it. The
-- mitigating design choice is the column list: nothing else in the row is personal data.
--
-- ============================================================================================
-- WHAT HAPPENS TO A RECORD NEVER REDEEMED, AND WHY THE HORIZON IS NOT THE TTL
-- ============================================================================================
--
-- `start_oauth_authorization` sweeps on every call: one `delete ... where created_at < now() - 1
-- hour` before its insert. No new cron, no new identity, no new role.
--
-- ONE HOUR IS DELIBERATELY NOT THE TEN-MINUTE TTL. `PENDING_TTL_MS` in `packages/oauth` stays the
-- single authority on expiry, inside `verifyCallback`. A second TTL written here would be two
-- constants that can disagree, and the one that wins would depend on which ran first. The SQL
-- horizon is GARBAGE COLLECTION and nothing else: a row between ten and sixty minutes old is still
-- deletable-and-returnable, `verifyCallback` then throws `expired`, and the row is gone either way.
-- A customer who abandons the flow, or whose Supabase session lapses during the detour, leaves a
-- row nobody can read that disappears within the hour.
--
-- THE SWEEP RIDES ON THE START CALL, so a deployment where nobody begins a flow for a month keeps
-- that month's abandoned rows. They are unreadable and tiny, and the alternative is a fourth cron
-- and an identity to run it -- a larger change than the thing it would tidy. Accepted deliberately;
-- if it ever matters, the fix is a scheduled call, not a second TTL constant.
--
-- ============================================================================================
-- ONE DIVERGENCE FROM THE ENTRY-POINT PATTERN, STATED RATHER THAN INHERITED
-- ============================================================================================
--
-- `20260912000800_scheduler_entry_point.sql` makes its `public.` wrappers SECURITY INVOKER over
-- `app.` definers, and argues that DEFINER there would widen the blast radius for no benefit. That
-- argument does not transfer, because there the caller is a machine role and here THE CALLER IS A
-- TENANT. An invoker wrapper would need `authenticated` to hold EXECUTE inside schema `app` -- the
-- boundary that whole file exists to keep tenants out of.
--
-- So these two functions live in `public` and are SECURITY DEFINER themselves. That is the
-- `public.join_waitlist` shape (`20260912000700`), not a new one: a definer function in `public`,
-- reachable by the role that is supposed to reach it and by nobody else, standing in front of a
-- table with no grant and no policy.

-- ---------------------------------------------------------------------------------------------
-- THE TABLE.
--
-- `state` IS THE PRIMARY KEY, looked up by equality. The lookup is not constant-time and does not
-- need to be: what a timing difference leaks is EXISTENCE, and existence costs 256 bits of
-- `createState` to guess. `verifyCallback` still runs its `timingSafeEqual` on the row that comes
-- back, because it remains the single authority on the ORDER of the checks -- provider error, then
-- state, then age -- and re-deriving that order at the call site is exactly how a `provider_denied`
-- message gets replaced by a state error for a customer who simply pressed Cancel.
--
-- `provider` IS `text` WITH A LENGTH BOUND AND NOT AN ENUM OR A CHECK LISTING THE THREE NAMES.
-- `packages/oauth/src/providers.ts` is the registry, and no guard in `scripts/` relates it to this
-- schema the way `check-providers.mjs` relates `ConnectionProvider` to `app.connection_provider`.
-- A hand-written `check (provider in ('google','meta','loyverse'))` would therefore be a SECOND
-- COPY OF A REGISTRY WITH NOTHING COMPARING THE TWO, and the failure it produces is the expensive
-- one: a provider added in TypeScript fails on the INSERT, in production, after the merchant has
-- already finished authorising. The narrowing happens where the registry actually lives -- the
-- Worker refuses an unknown provider before it writes, and refuses one again on the way back out.
--
-- WHAT IS NOT HERE IS THE POINT: no email, no subject id, no `external_account_id`. Checked against
-- `packages/payloads/src/redaction.ts`' by-key rule as the working agreement requires -- that module
-- removes identifiers BY KEY and is explicit that it does not inspect values, so a personal datum
-- inside a kept key is protected by nothing. There is no kept key here holding one: the account at
-- the provider is not known until after the exchange, and the person is known only as a Supabase
-- session that never lands in a column.
-- ---------------------------------------------------------------------------------------------
create table public.oauth_authorizations (
  -- base64url of 32 random bytes is 43 characters. Bounded rather than pinned at 43 so that a
  -- future `createState` with more entropy is not a schema change; bounded at all because this is
  -- the key of a table a caller supplies the key for.
  state         text primary key check (length(state) between 32 and 200),
  -- RFC 7636 requires 43-128 characters, and `createPkcePair` produces 86. Refusing outside that
  -- range here means a verifier that could never satisfy a token endpoint is refused before the
  -- customer is sent to a consent screen, rather than after they come back from one.
  code_verifier text not null check (length(code_verifier) between 43 and 128),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  provider      text not null check (length(provider) between 1 and 40),
  -- The sources this one grant is meant to serve. `scopesFor` reads it to decide what was asked
  -- for, and the callback reads it to decide which connector the connection is FOR. Bounded so a
  -- caller cannot make one row arbitrarily large.
  sources       text[] not null check (cardinality(sources) between 1 and 8),
  -- Stored because `exchangeCode` MUST present the same `redirect_uri` it authorised with -- every
  -- one of these providers compares them, and a mismatch is an opaque 400 at the token endpoint.
  -- Re-deriving it at callback time from a binding would agree right up until a deployment changed
  -- it mid-flow, which is a failure only the customer in the middle of the detour ever sees.
  redirect_uri  text not null check (length(redirect_uri) between 1 and 2000),
  -- WRITTEN BY THE FUNCTION AS `now()`, NOT SUPPLIED BY THE CALLER. See the function's own note:
  -- a caller-supplied `created_at` is a self-extending TTL.
  created_at    timestamptz not null default now()
);

comment on table public.oauth_authorizations is
  'One in-flight OAuth authorisation per row: the PKCE code_verifier and the CSRF state that must '
  'survive the customer''s detour to a consent screen. Written only through '
  'public.start_oauth_authorization and destroyed by public.redeem_oauth_authorization, which is a '
  'single-shot delete-returning. No grant and no policy for any role: redemption is single-use and '
  'tenancy is decided inside the functions by app.can_write_workspace().';

-- The sweep's index. `created_at` alone, because the sweep is the only query that does not go
-- through the primary key.
create index oauth_authorizations_created_at_idx
  on public.oauth_authorizations (created_at);

-- ENABLE *AND* FORCE. Without FORCE the table owner bypasses its own policies, and migrations and
-- every SECURITY DEFINER function are the owner -- `20260913000200_force_rls.sql` exists because
-- three tables shipped with ENABLE alone, and `supabase/tests/15_force_rls.sql` reads the catalogue
-- so a table missing either fails on the day it lands.
alter table public.oauth_authorizations enable row level security;
alter table public.oauth_authorizations force row level security;

-- NO POLICY AT ALL, for any command, and no grant -- the two-layer posture. With RLS enabled and
-- nothing granted, every role RLS applies to is denied every command, and the definer functions
-- below are the only way in. A permissive policy added later "to keep the writer working" would
-- apply to `authenticated` too, which is the mistake `20260913000200` records catching in its own
-- first draft.
revoke all on public.oauth_authorizations from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- START: persist one pending authorisation, and sweep the abandoned ones.
--
-- THE CLOCK IS NOT A PARAMETER, for `20260912000800`'s reason applied to a different mechanism. A
-- caller-supplied `p_now` here is not a testing seam, it is a self-extending expiry: write the row
-- with `created_at = now() + 1 day` and `verifyCallback`'s ten-minute window becomes a day and a
-- ten minutes, silently, for that one flow. A future clock would also make the sweep delete every
-- other in-flight authorisation in the table. The Worker has no legitimate use for a clock the
-- database does not already have.
--
-- THE ORDER OF THE THREE THINGS THIS DOES IS LOAD-BEARING:
--   1. shape checks on the arguments, so a null workspace is a named refusal and not a silent false
--      from `can_write_workspace`;
--   2. the tenancy check, so an unauthorised caller never causes a write of any kind -- including
--      the sweep, which is a write and would otherwise be reachable by anyone with a session;
--   3. the sweep, then the insert.
--
-- IT RETURNS `created_at` RATHER THAN `void`, and that is transport rather than taste: PostgREST
-- answers a `returns void` RPC with `204 No Content` and an empty body, which `callPostgrest` reads
-- as "the database answered with a body that is not JSON". `20260912000800` records the same trap.
-- The value is also the honest answer to "when does this expire from here", which the caller cannot
-- otherwise know now that it does not supply the clock.
-- ---------------------------------------------------------------------------------------------
create function public.start_oauth_authorization(
  p_state         text,
  p_code_verifier text,
  p_workspace_id  uuid,
  p_provider      text,
  p_sources       text[],
  p_redirect_uri  text
)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_now timestamptz := now();
begin
  if p_workspace_id is null then
    raise exception 'start_oauth_authorization: p_workspace_id is required'
      using errcode = '22023';
  end if;

  -- THE TENANCY DECISION, MADE HERE AND NOWHERE ELSE, and made before any write. Same function
  -- every policy in this schema calls, so "may this person attach a connection to this workspace"
  -- has exactly one answer in this database rather than one per call site.
  --
  -- A workspace that does not exist and one the caller may not write to are the SAME refusal,
  -- deliberately: distinguishing them would turn this function into an oracle for which workspace
  -- ids exist elsewhere, which is the rule `packages/store`'s connection read and
  -- `apps/api-edge/src/connect.ts` already hold to.
  if not app.can_write_workspace(p_workspace_id) then
    raise exception
      'start_oauth_authorization: this session may not start an authorisation for that workspace'
      using errcode = '42501';
  end if;

  if p_state is null or btrim(p_state) = '' then
    raise exception 'start_oauth_authorization: p_state is required' using errcode = '22023';
  end if;
  if p_code_verifier is null or btrim(p_code_verifier) = '' then
    raise exception 'start_oauth_authorization: p_code_verifier is required'
      using errcode = '22023';
  end if;
  if p_provider is null or btrim(p_provider) = '' then
    raise exception 'start_oauth_authorization: p_provider is required' using errcode = '22023';
  end if;
  if p_redirect_uri is null or btrim(p_redirect_uri) = '' then
    raise exception 'start_oauth_authorization: p_redirect_uri is required'
      using errcode = '22023';
  end if;
  if p_sources is null or cardinality(p_sources) = 0 then
    raise exception
      'start_oauth_authorization: p_sources must name at least one source. A grant serving no '
      'source asks a merchant for scopes nothing will read.'
      using errcode = '22023';
  end if;

  -- GARBAGE COLLECTION, NOT EXPIRY. See the header: `PENDING_TTL_MS` is the only authority on
  -- whether a pending authorisation is still good, and it lives in `verifyCallback`. A row between
  -- ten and sixty minutes old is still returned by the redeem below and still refused there.
  delete from public.oauth_authorizations where created_at < v_now - interval '1 hour';

  insert into public.oauth_authorizations
    (state, code_verifier, workspace_id, provider, sources, redirect_uri, created_at)
  values
    (p_state, p_code_verifier, p_workspace_id, p_provider, p_sources, p_redirect_uri, v_now);

  return v_now;
end;
$fn$;

-- ---------------------------------------------------------------------------------------------
-- REDEEM: read the pending authorisation and destroy it, in one statement.
--
-- THE `delete ... returning` IS THE SINGLE-USE GUARANTEE, and it is a property of the statement
-- rather than of anything the Worker remembers to do. Two callbacks racing with the same code both
-- reach this; one gets the row, the other gets nothing, and there is no window between the read and
-- the destroy in which both could win.
--
-- WRITTEN AS A CTE rather than `return query delete ... returning`, for a narrow reason worth
-- recording: the OUT parameters of a `returns table` function are PL/pgSQL variables with the same
-- names as the columns, and an unqualified reference inside the body resolves to the VARIABLE. The
-- CTE keeps every column reference behind an alias, which is the same precaution
-- `public.due_connections` takes and states.
--
-- ZERO ROWS IS THE ONLY ANSWER FOR EVERY REFUSAL: no such state, an already-redeemed state, and
-- another tenant's state are indistinguishable from here. That is deliberate for the reason above,
-- and it is why the caller must not translate "no row" into anything more specific than "this
-- authorisation cannot be completed".
-- ---------------------------------------------------------------------------------------------
create function public.redeem_oauth_authorization(p_state text)
returns table (
  state         text,
  code_verifier text,
  workspace_id  uuid,
  provider      text,
  sources       text[],
  redirect_uri  text,
  created_at    timestamptz
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $fn$
begin
  if p_state is null or btrim(p_state) = '' then
    raise exception 'redeem_oauth_authorization: p_state is required' using errcode = '22023';
  end if;

  return query
    with redeemed as (
      delete from public.oauth_authorizations a
       where a.state = p_state
         -- THE SECOND TENANCY DECISION. The row was written under this predicate; it is checked
         -- again on the way out because a workspace grant can be revoked during the detour, and a
         -- session that may no longer write to a workspace must not be able to attach a credential
         -- to it. `20260908000300_helpers.sql` chose a membership JOIN over a JWT claim for exactly
         -- this: the answer is current rather than a snapshot taken when the flow began.
         and app.can_write_workspace(a.workspace_id)
      returning a.state, a.code_verifier, a.workspace_id, a.provider, a.sources, a.redirect_uri,
                a.created_at
    )
    select r.state, r.code_verifier, r.workspace_id, r.provider, r.sources, r.redirect_uri,
           r.created_at
      from redeemed r;
end;
$fn$;

-- ---------------------------------------------------------------------------------------------
-- THE REVOKES, WHICH ARE THE WHOLE SECURITY PROPERTY OF THIS FILE.
--
-- PostgreSQL's BUILT-IN default ACL grants EXECUTE on a NEW function to PUBLIC, and `alter default
-- privileges` cannot take it back -- established by experiment in
-- `20260911000200_credits_need_the_key.sql` and recorded as a shipped incident in
-- `20260912000200_position.sql`. `anon` and `authenticated` are members of PUBLIC, so revoking from
-- them while PUBLIC still holds the grant changes nothing at all: `public` is named FIRST and the
-- other two are named for the reader.
--
-- Without these two lines `anon` could execute both. The anon key is public and ships in browsers,
-- so that would put on the internet: the ability to write rows into a tenant's workspace (refused
-- by `can_write_workspace`, but only after the shape checks and only because that call is there),
-- and -- far worse -- the ability to present a guessed state and be told whether it exists.
--
-- `supabase/tests/16_oauth_pending.sql` asserts these ACLs DIRECTLY rather than by execution,
-- because nothing else in the suite would notice their absence: `07_anon_grants.sql` enumerates the
-- ANON-executable surface, and a function wrongly left executable by PUBLIC is anon-executable and
-- would be caught there -- but a function wrongly NOT granted to `authenticated` presents as "the
-- whole connect flow 403s", which is silent in a test suite and loud only in production.
-- ---------------------------------------------------------------------------------------------
revoke all on function
  public.start_oauth_authorization(text, text, uuid, text, text[], text)
from public, anon, authenticated;

revoke all on function public.redeem_oauth_authorization(text) from public, anon, authenticated;

-- AND THEN GRANTED BACK TO `authenticated` ALONE. This is the one pair of functions in this schema
-- whose intended caller is a signed-in PERSON: the Worker forwards the customer's own Supabase
-- access token, exactly as `POST /v1/connections` does, and mints nothing. There is still no
-- service-role key in the Worker and no new identity anywhere in this change.
--
-- `service_role` also holds EXECUTE, from Supabase's own default privileges in
-- `00_supabase_shim.sql`, and is deliberately left alone for `20260912000800`'s reason: it is
-- BYPASSRLS and can already read this table directly, so reaching it through a function takes
-- nothing it did not have. What would be wrong is a COMMENT claiming otherwise.
grant execute on function
  public.start_oauth_authorization(text, text, uuid, text, text[], text)
to authenticated;

grant execute on function public.redeem_oauth_authorization(text) to authenticated;

comment on function public.start_oauth_authorization(text, text, uuid, text, text[], text) is
  'The only write path to public.oauth_authorizations. Takes no clock -- a caller-supplied '
  'created_at is a self-extending expiry -- and sweeps rows older than one hour before inserting. '
  'The one-hour horizon is garbage collection; PENDING_TTL_MS in packages/oauth remains the single '
  'authority on expiry. Of the tenant roles, executable by authenticated alone, and refused for a '
  'workspace the session may not write to.';

comment on function public.redeem_oauth_authorization(text) is
  'The only read path to public.oauth_authorizations, and it destroys the row as it reads it: one '
  'authorisation can attach exactly one connection. Returns zero rows for an unknown state, an '
  'already-redeemed state and another tenant''s state alike. Of the tenant roles, executable by '
  'authenticated alone.';
