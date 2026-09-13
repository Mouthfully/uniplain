-- THE ONE-WAY DOOR, AND THE TWO WAYS A MEMBERS SCREEN OPENS IT.
--
-- Every administrative policy in this schema is gated on `app.is_org_admin`. An organisation whose
-- last owner has been removed or demoted therefore cannot invite, promote, rename itself or grant a
-- workspace to anybody, from any account, ever again -- and there is no support tool that could
-- reach in. It is not a permission error a customer backs out of, so it must not be reachable.
--
-- `20260913000600_membership_guards.sql` closes it, and this suite asserts the closure from a real
-- `authenticated` session rather than from the owner's console, because a guard proved only as the
-- table owner has not met the principal it exists for.
--
-- Fixture identifiers are unique to this suite and the inserts carry no `on conflict` clause, for
-- the reason written out in `17_organisation_members.sql`: the suites share one database, and a
-- silently substituted fixture row is a green test that checked somebody else's data.

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

-- One organisation: an owner, a second owner, an admin and a viewer.
insert into auth.users (id, email) values
  ('18000000-0000-4000-8000-00000000000a', 'guards-owner@test.test'),
  ('18000000-0000-4000-8000-00000000000b', 'guards-owner-two@test.test'),
  ('18000000-0000-4000-8000-00000000000c', 'guards-admin@test.test'),
  ('18000000-0000-4000-8000-00000000000d', 'guards-viewer@test.test');

insert into public.organisations (id, name, slug) values
  ('18100000-0000-4000-8000-00000000000a', 'Guards Org', 'guards-org-suite');

insert into public.members (id, organisation_id, user_id, role) values
  ('18200000-0000-4000-8000-00000000000a', '18100000-0000-4000-8000-00000000000a',
   '18000000-0000-4000-8000-00000000000a', 'owner'),
  ('18200000-0000-4000-8000-00000000000c', '18100000-0000-4000-8000-00000000000a',
   '18000000-0000-4000-8000-00000000000c', 'admin'),
  ('18200000-0000-4000-8000-00000000000d', '18100000-0000-4000-8000-00000000000a',
   '18000000-0000-4000-8000-00000000000d', 'viewer');

-- ---------------------------------------------------------------------------------------------
-- 1. THE LAST OWNER CANNOT LEAVE, BY EITHER ROUTE.
-- ---------------------------------------------------------------------------------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-00000000000a', true);

  do $$
  begin
    delete from public.members where id = '18200000-0000-4000-8000-00000000000a';
    perform app_test.check('the last owner cannot delete themselves', false, 'the delete succeeded');
  exception when check_violation then
    perform app_test.check('the last owner cannot delete themselves', true, sqlerrm);
  when others then
    perform app_test.check('the last owner cannot delete themselves', false,
      format('wrong error: %s / %s', sqlstate, sqlerrm));
  end $$;

  do $$
  begin
    update public.members set role = 'admin' where id = '18200000-0000-4000-8000-00000000000a';
    perform app_test.check('the last owner cannot demote themselves', false, 'the update succeeded');
  exception when check_violation then
    perform app_test.check('the last owner cannot demote themselves', true, sqlerrm);
  when others then
    perform app_test.check('the last owner cannot demote themselves', false,
      format('wrong error: %s / %s', sqlstate, sqlerrm));
  end $$;
commit;

-- ---------------------------------------------------------------------------------------------
-- 2. AN ADMIN IS A DELEGATE, AND MAY NOT REMOVE THE PRINCIPAL.
--
-- This is the escalation shape an account takeover uses: compromise the weaker account, remove the
-- stronger one, keep the organisation. `is_org_admin` alone would allow it, which is exactly why
-- the rule is not written as a policy.
-- ---------------------------------------------------------------------------------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-00000000000c', true);

  do $$
  begin
    delete from public.members where id = '18200000-0000-4000-8000-00000000000a';
    perform app_test.check('an admin cannot remove an owner', false, 'the delete succeeded');
  exception when insufficient_privilege then
    perform app_test.check('an admin cannot remove an owner', true, 'refused with 42501');
  when check_violation then
    -- The owner-count rule would also have stopped THIS statement, because there is one owner. The
    -- point of the second rule is that it stops an admin removing an owner when there are two, and
    -- section 3 proves that. Reaching here means the roles rule did not fire first.
    perform app_test.check('an admin cannot remove an owner', false,
      'stopped by the owner count rather than by the roles rule');
  when others then
    perform app_test.check('an admin cannot remove an owner', false,
      format('wrong error: %s / %s', sqlstate, sqlerrm));
  end $$;

  -- AND THE THINGS AN ADMIN MAY STILL DO. A guard that quietly took ordinary administration away
  -- would present as "the members page is broken" and pass every test above.
  do $$
  begin
    update public.members set role = 'analyst' where id = '18200000-0000-4000-8000-00000000000d';
    perform app_test.check('an admin can still change a non-owner''s role', true);
  exception when others then
    perform app_test.check('an admin can still change a non-owner''s role', false, sqlerrm);
  end $$;

  do $$
  begin
    delete from public.members where id = '18200000-0000-4000-8000-00000000000d';
    perform app_test.check('an admin can still remove a non-owner', true);
  exception when others then
    perform app_test.check('an admin can still remove a non-owner', false, sqlerrm);
  end $$;
-- COMMIT, NOT ROLLBACK, AND THE FIRST DRAFT GOT THIS WRONG. `app_test.results` is an ordinary
-- table: rows written inside a transaction that rolls back go with it, so five assertions ran,
-- passed, and were then erased -- the suite reported 7 of 12 and the floor caught it. The fixture
-- is repaired explicitly below instead.
commit;

-- ---------------------------------------------------------------------------------------------
-- 3. WITH TWO OWNERS THE COUNT RULE IS SATISFIED, SO ONLY THE ROLES RULE IS LEFT TO SPEAK.
-- ---------------------------------------------------------------------------------------------
insert into public.members (id, organisation_id, user_id, role) values
  ('18200000-0000-4000-8000-00000000000b', '18100000-0000-4000-8000-00000000000a',
   '18000000-0000-4000-8000-00000000000b', 'owner');

begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-00000000000c', true);

  do $$
  begin
    update public.members set role = 'viewer' where id = '18200000-0000-4000-8000-00000000000b';
    perform app_test.check('an admin cannot demote an owner even when another owner remains',
      false, 'the update succeeded');
  exception when insufficient_privilege then
    perform app_test.check('an admin cannot demote an owner even when another owner remains',
      true, 'refused with 42501');
  when others then
    perform app_test.check('an admin cannot demote an owner even when another owner remains',
      false, format('wrong error: %s / %s', sqlstate, sqlerrm));
  end $$;
commit;

begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-00000000000a', true);

  do $$
  begin
    update public.members set role = 'admin' where id = '18200000-0000-4000-8000-00000000000b';
    perform app_test.check('an owner CAN demote another owner once a second owner exists', true);
  exception when others then
    perform app_test.check('an owner CAN demote another owner once a second owner exists',
      false, format('%s / %s', sqlstate, sqlerrm));
  end $$;
commit;

-- ---------------------------------------------------------------------------------------------
-- 4. THE ESCAPE HATCH STAYS OPEN. Refusing the cascade from a deleted organisation would make an
--    organisation undeletable, which is the same one-way door facing the other way -- and would
--    break "delete my data" outright, which is a PDPA s.33 right rather than a nicety.
-- ---------------------------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('18000000-0000-4000-8000-00000000000e', 'guards-doomed@test.test');
insert into public.organisations (id, name, slug) values
  ('18100000-0000-4000-8000-00000000000e', 'Doomed Org', 'doomed-org-suite');
insert into public.members (id, organisation_id, user_id, role) values
  ('18200000-0000-4000-8000-00000000000e', '18100000-0000-4000-8000-00000000000e',
   '18000000-0000-4000-8000-00000000000e', 'owner');

do $$
begin
  delete from public.organisations where id = '18100000-0000-4000-8000-00000000000e';
  perform app_test.check(
    'deleting an organisation still cascades to its members -- the owner rule does not trap it',
    not exists (select 1 from public.members
                 where organisation_id = '18100000-0000-4000-8000-00000000000e'));
exception when others then
  perform app_test.check(
    'deleting an organisation still cascades to its members -- the owner rule does not trap it',
    false, format('%s / %s', sqlstate, sqlerrm));
end $$;

-- ---------------------------------------------------------------------------------------------
-- 5. THE TRIGGER FUNCTIONS ARE NOT AN API. A trigger function takes no arguments and raises when
--    called directly -- but EXECUTE is still granted to PUBLIC on creation, and this schema has
--    been bitten by that default before.
-- ---------------------------------------------------------------------------------------------
do $$
begin
  perform app_test.check('anon cannot execute the owner-count trigger function',
    not has_function_privilege('anon', 'app.assert_organisation_keeps_an_owner()', 'EXECUTE'));
  perform app_test.check('authenticated cannot execute the owner-count trigger function',
    not has_function_privilege('authenticated', 'app.assert_organisation_keeps_an_owner()', 'EXECUTE'));
  perform app_test.check('anon cannot execute the owner-roles trigger function',
    not has_function_privilege('anon', 'app.assert_owner_changed_only_by_owner()', 'EXECUTE'));
  perform app_test.check('authenticated cannot execute the owner-roles trigger function',
    not has_function_privilege('authenticated', 'app.assert_owner_changed_only_by_owner()', 'EXECUTE'));
end $$;

\o

select name, 'FAIL' as result, detail from app_test.results where not passed order by id;
select count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed,
       count(*) as total
  from app_test.results;

-- The floor, for the reason 06_jwt_claims.sql gives: a suite that stopped running looks exactly
-- like a suite that passed.
do $$
declare v_failed integer; v_total integer;
begin
  select count(*) filter (where not passed), count(*) into v_failed, v_total from app_test.results;
  if v_failed > 0 then raise exception 'membership guards: % assertion(s) failed', v_failed; end if;
  if v_total < 12 then
    raise exception 'membership guards: only % assertion(s) ran; expected at least 12', v_total;
  end if;
end $$;
