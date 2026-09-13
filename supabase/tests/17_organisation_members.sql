-- THE MEMBERSHIP READ, AND THE THREE WAYS IT COULD LEAK.
--
-- `20260913000500_organisation_members.sql` joins `auth.users` so a user-management screen can name
-- a colleague. That join is the only place in this schema where a tenant-facing call reaches the
-- authentication server's own table, and SECURITY DEFINER means the body runs with privileges the
-- caller does not have. Three things decide whether that is safe, and each is invisible until it
-- is exploited:
--
--   1. THE ACL. A new function is EXECUTE-able by PUBLIC by default, `anon` is a member of PUBLIC,
--      and `alter default privileges` cannot take it back. Deleting the revoke turns
--      `07_anon_grants.sql` red before this suite runs at all -- it holds a whitelist of the three
--      functions the internet may call -- and this suite asserts the same thing again in case that
--      whitelist is ever loosened. The other direction is asserted too, with the caveat written
--      beside it: the grant to `authenticated` cannot be mutation-proved, because Supabase's
--      default privileges hand it over regardless.
--
--   2. TENANCY IS THE FUNCTION'S OWN DECISION, not the caller's. There is no policy protecting
--      this read -- a definer function bypasses them -- so `app.is_org_member` in the body is the
--      entire boundary. Org B asking for org A must RAISE, not return empty: an empty set is
--      indistinguishable from an organisation with no members, and a screen built on that
--      difference tells a stranger "this account is empty" rather than "not yours".
--
--   3. WHAT COMES BACK. The user id must NOT: `members.id` is the handle a screen needs for both
--      naming and acting, and `auth.users.id` would be a second identifier for the same person
--      that a caller could accumulate and join against elsewhere. The column set is asserted
--      exactly, so widening it is a decision somebody has to make on purpose.

\o /dev/null

create schema if not exists app_test;
create table if not exists app_test.results (
  id serial primary key, name text not null, passed boolean not null, detail text
);
truncate app_test.results;

create or replace function app_test.check(p_name text, p_passed boolean, p_detail text default null)
returns void language sql as $$
  insert into app_test.results (name, passed, detail) values (p_name, coalesce(p_passed, false), p_detail);
$$;

-- ---------------------------------------------------------------------------------------------
-- Two organisations, three people. Bee is in org A only; Cat is in org B only; Ann admins org A.
--
-- EVERY IDENTIFIER HERE IS UNIQUE TO THIS SUITE, AND THE INSERTS DO NOT SAY `on conflict do
-- nothing`. The suites share one database -- `run-local.sh` drops it once and then runs all
-- seventeen in sequence -- so a fixture row is visible to every suite that follows. The first
-- version of this file reused `a1111111-…`, which `14_ambient.sql` had already inserted as
-- alice@ambient-a.test, and `on conflict (id) do nothing` kept that row: the membership then
-- joined to somebody else's address and the email assertion below failed with a name from another
-- suite. That was the lucky outcome. Had the collision landed on a row this suite only counts
-- rather than reads, it would have passed while testing nothing.
--
-- So the conflict clause is gone. A future collision is now a unique violation that stops the run
-- and names the constraint, rather than a silent substitution -- the same argument the rest of
-- this repository makes about `?? 0`: an absent thing must not quietly become a present one.
-- ---------------------------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('17000000-0000-4000-8000-00000000000a', 'members-ann@test.test'),
  ('17000000-0000-4000-8000-00000000000b', 'members-bee@test.test'),
  ('17000000-0000-4000-8000-00000000000c', 'members-cat@test.test');

insert into public.organisations (id, name, slug) values
  ('17100000-0000-4000-8000-00000000000a', 'Org A', 'org-a-members-suite'),
  ('17100000-0000-4000-8000-00000000000b', 'Org B', 'org-b-members-suite');

insert into public.members (id, organisation_id, user_id, role) values
  ('17200000-0000-4000-8000-000000000001', '17100000-0000-4000-8000-00000000000a',
   '17000000-0000-4000-8000-00000000000a', 'owner'),
  ('17200000-0000-4000-8000-000000000002', '17100000-0000-4000-8000-00000000000a',
   '17000000-0000-4000-8000-00000000000b', 'viewer'),
  ('17200000-0000-4000-8000-000000000003', '17100000-0000-4000-8000-00000000000b',
   '17000000-0000-4000-8000-00000000000c', 'owner');

-- ---------------------------------------------------------------------------------------------
-- 1. THE ACL, IN BOTH DIRECTIONS.
-- ---------------------------------------------------------------------------------------------
do $$
begin
  perform app_test.check(
    'anon cannot execute organisation_members',
    not has_function_privilege('anon', 'public.organisation_members(uuid)', 'EXECUTE')
  );
  perform app_test.check(
    'public cannot execute organisation_members -- a new function is granted to PUBLIC by default',
    not has_function_privilege('public', 'public.organisation_members(uuid)', 'EXECUTE')
  );
  -- THIS ASSERTS THE END STATE, NOT THE GRANT LINE, AND MUTATION IS HOW THAT WAS LEARNED.
  -- Deleting `grant execute … to authenticated` from the migration leaves this GREEN: a hosted
  -- project ships `alter default privileges in schema public grant all on functions to anon,
  -- authenticated, service_role`, which the shim models, so the privilege arrives whether the
  -- migration asks for it or not. The line is kept anyway -- the default is platform behaviour
  -- this repository does not own, and `20260911000100` has already revoked the tables half of it
  -- for `anon` -- but no test here can prove the line is load-bearing, because today it is not.
  -- What this DOES catch is a revoke written too wide: `revoke all … from public` takes the
  -- privilege from `authenticated` too if the grant is not re-issued after it.
  perform app_test.check(
    'authenticated CAN execute organisation_members',
    has_function_privilege('authenticated', 'public.organisation_members(uuid)', 'EXECUTE')
  );
end $$;

-- ---------------------------------------------------------------------------------------------
-- 2. THE SHAPE. Asserted exactly, so widening it is somebody's decision rather than a slip.
-- ---------------------------------------------------------------------------------------------
do $$
declare v_columns text;
begin
  select string_agg(p.name, ',' order by p.ordinality) into v_columns
    from unnest(
      (select proargnames from pg_proc where oid = 'public.organisation_members(uuid)'::regprocedure)
    ) with ordinality as p(name, ordinality)
   where p.name <> 'p_organisation_id';

  perform app_test.check(
    'organisation_members returns exactly member_id, email, role, created_at -- and NO user id',
    v_columns = 'member_id,email,role,created_at',
    coalesce(v_columns, '(none)')
  );
end $$;

-- ---------------------------------------------------------------------------------------------
-- 3. TENANCY. A member of org A sees org A, and asking for org B RAISES rather than returning
--    nothing -- see the header for why the difference matters.
-- ---------------------------------------------------------------------------------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '17000000-0000-4000-8000-00000000000a', true);

  do $$
  declare v_rows integer; v_emails text;
  begin
    select count(*), string_agg(email, ',' order by email)
      into v_rows, v_emails
      from public.organisation_members('17100000-0000-4000-8000-00000000000a');

    perform app_test.check('a member reads their own organisation''s membership', v_rows = 2,
      format('%s rows', v_rows));
    perform app_test.check('and the addresses joined from auth.users are the right ones',
      v_emails = 'members-ann@test.test,members-bee@test.test', coalesce(v_emails, '(none)'));
  end $$;

  do $$
  begin
    perform * from public.organisation_members('17100000-0000-4000-8000-00000000000b');
    perform app_test.check('asking for another organisation RAISES rather than returning empty',
      false, 'it returned instead of raising');
  exception
    when insufficient_privilege then
      perform app_test.check('asking for another organisation RAISES rather than returning empty', true,
        'refused with 42501');
    when others then
      perform app_test.check('asking for another organisation RAISES rather than returning empty',
        false, format('raised the wrong error: %s', sqlerrm));
  end $$;
commit;

-- ---------------------------------------------------------------------------------------------
-- 4. THE TABLE IT JOINS IS STILL SHUT. The function exists precisely so that no tenant role needs
--    a grant on auth.users, so the absence of that grant is the property worth asserting.
-- ---------------------------------------------------------------------------------------------
do $$
begin
  perform app_test.check(
    'authenticated still holds NO select on auth.users -- the function is why it does not need one',
    not has_table_privilege('authenticated', 'auth.users', 'SELECT')
  );
  perform app_test.check(
    'anon still holds NO select on auth.users',
    not has_table_privilege('anon', 'auth.users', 'SELECT')
  );
end $$;

\o

select name, 'FAIL' as result, detail from app_test.results where not passed order by id;
select count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed,
       count(*) as total
  from app_test.results;

-- The floor exists for the reason 06_jwt_claims.sql gives: a suite that stops running looks exactly
-- like a suite that passes. Nine assertions today.
do $$
declare v_failed integer; v_total integer;
begin
  select count(*) filter (where not passed), count(*) into v_failed, v_total from app_test.results;
  if v_failed > 0 then raise exception 'organisation members: % assertion(s) failed', v_failed; end if;
  if v_total < 9 then
    raise exception 'organisation members: only % assertion(s) ran; expected at least 9', v_total;
  end if;
end $$;
