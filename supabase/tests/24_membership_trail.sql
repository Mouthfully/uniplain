-- THE MEMBERSHIP HALF OF THE SECURITY TRAIL.
--
-- `20260913001200` declared eight event types and `20260913001300` wired one, naming the failure it
-- was fixing: "an audit trail nothing writes to is the same object". This suite is what stops the
-- two membership events from becoming that again -- and what proves the three ways the trigger
-- could take something else down with it.
--
-- Fixture identifiers are unique to this suite and the inserts carry no `on conflict` clause, for
-- the reason `17_organisation_members.sql` sets out: the suites share one database, and a silently
-- substituted fixture row is a green test that checked somebody else's data.

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

insert into auth.users (id, email) values
  ('23000000-0000-4000-8000-00000000000a', 'trail-owner@test.test'),
  ('23000000-0000-4000-8000-00000000000b', 'trail-admin@test.test'),
  ('23000000-0000-4000-8000-00000000000c', 'trail-viewer@test.test'),
  ('23000000-0000-4000-8000-00000000000d', 'trail-doomed-owner@test.test');

insert into public.organisations (id, name, slug) values
  ('23100000-0000-4000-8000-00000000000a', 'Trail Org', 'trail-org-suite'),
  ('23100000-0000-4000-8000-00000000000d', 'Doomed Trail', 'doomed-trail-suite');

insert into public.members (id, organisation_id, user_id, role) values
  ('23200000-0000-4000-8000-00000000000a', '23100000-0000-4000-8000-00000000000a',
   '23000000-0000-4000-8000-00000000000a', 'owner'),
  ('23200000-0000-4000-8000-00000000000b', '23100000-0000-4000-8000-00000000000a',
   '23000000-0000-4000-8000-00000000000b', 'admin'),
  ('23200000-0000-4000-8000-00000000000c', '23100000-0000-4000-8000-00000000000a',
   '23000000-0000-4000-8000-00000000000c', 'viewer'),
  ('23200000-0000-4000-8000-00000000000d', '23100000-0000-4000-8000-00000000000d',
   '23000000-0000-4000-8000-00000000000d', 'owner');

-- ---------------------------------------------------------------------------------------------
-- 1. A ROLE CHANGE IS RECORDED, WITH THE ROLES AND THE ACTOR.
-- ---------------------------------------------------------------------------------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '23000000-0000-4000-8000-00000000000a', true);

  update public.members set role = 'analyst'
   where id = '23200000-0000-4000-8000-00000000000c';
commit;

do $$
declare v_event record;
begin
  select * into v_event from public.security_events
   where subject_id = '23200000-0000-4000-8000-00000000000c'
   order by id desc limit 1;

  perform app_test.check('a role change files an event', v_event.id is not null);
  perform app_test.check('and it is a member_role_changed',
    v_event.event = 'member_role_changed', coalesce(v_event.event::text, '(none)'));
  perform app_test.check('and it names both roles rather than only the new one',
    v_event.detail = 'viewer -> analyst', coalesce(v_event.detail, '(none)'));
  perform app_test.check('and it records who did it',
    v_event.actor = '23000000-0000-4000-8000-00000000000a', coalesce(v_event.actor::text, '(null)'));
  -- A role change belongs to no workspace, and inventing one would make every query that groups by
  -- workspace quietly wrong. The column's own comment says so.
  perform app_test.check('and it claims no workspace', v_event.workspace_id is null);
end $$;

-- ---------------------------------------------------------------------------------------------
-- 2. AN UPDATE THAT CHANGES NO ROLE FILES NOTHING.
--
-- `accept_invitation` touches `updated_at` on a member who is already there. Recording every UPDATE
-- would file an event each time somebody re-accepted an invitation -- noise in the one table that
-- has to stay readable after an incident.
-- ---------------------------------------------------------------------------------------------
do $$
declare v_before bigint; v_after bigint;
begin
  select count(*) into v_before from public.security_events;
  update public.members set updated_at = now()
   where id = '23200000-0000-4000-8000-00000000000c';
  select count(*) into v_after from public.security_events;
  perform app_test.check('an update that changes no role files nothing',
    v_after = v_before, format('%s -> %s', v_before, v_after));
end $$;

-- ---------------------------------------------------------------------------------------------
-- 3. A REMOVAL IS RECORDED, AND THE EVENT OUTLIVES THE MEMBER.
--
-- This is the whole point of `subject_id` being TEXT rather than a foreign key: a key would cascade
-- the record away at the one moment it matters most.
-- ---------------------------------------------------------------------------------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '23000000-0000-4000-8000-00000000000a', true);

  delete from public.members where id = '23200000-0000-4000-8000-00000000000c';
commit;

do $$
declare v_event record;
begin
  select * into v_event from public.security_events
   where subject_id = '23200000-0000-4000-8000-00000000000c' and event = 'member_removed'
   order by id desc limit 1;

  perform app_test.check('a removal files an event', v_event.id is not null);
  perform app_test.check('and it says what the person could do when they were removed',
    v_event.detail = 'role at removal: analyst', coalesce(v_event.detail, '(none)'));
  perform app_test.check(
    'and the event outlives the member row -- subject_id is text, not a foreign key',
    not exists (select 1 from public.members where id = '23200000-0000-4000-8000-00000000000c')
    and v_event.id is not null);
end $$;

-- ---------------------------------------------------------------------------------------------
-- 4. THE TRAIL IS EVIDENCE, SO ITS SUBJECT CANNOT EDIT IT.
-- ---------------------------------------------------------------------------------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '23000000-0000-4000-8000-00000000000b', true);

  do $$
  begin
    update public.security_events set detail = 'nothing to see here'
     where organisation_id = '23100000-0000-4000-8000-00000000000a';
    perform app_test.check('an admin cannot rewrite the trail', false, 'the update succeeded');
  exception when insufficient_privilege then
    perform app_test.check('an admin cannot rewrite the trail', true, 'refused');
  when others then
    perform app_test.check('an admin cannot rewrite the trail', true, sqlstate);
  end $$;

  do $$
  begin
    delete from public.security_events
     where organisation_id = '23100000-0000-4000-8000-00000000000a';
    perform app_test.check('an admin cannot delete from the trail', false, 'the delete succeeded');
  exception when insufficient_privilege then
    perform app_test.check('an admin cannot delete from the trail', true, 'refused');
  when others then
    perform app_test.check('an admin cannot delete from the trail', true, sqlstate);
  end $$;
commit;

-- ---------------------------------------------------------------------------------------------
-- 5. THE ERASURE ESCAPE HATCH.
--
-- An organisation being erased cascades into its members, and the organisation row may already be
-- gone when this trigger fires -- so an unguarded insert would fail the foreign key and take the
-- erasure down with it, turning "delete my data" into an error. There is nothing to record anyway:
-- the account and every event about it go in the same statement.
-- ---------------------------------------------------------------------------------------------
do $$
begin
  delete from public.organisations where id = '23100000-0000-4000-8000-00000000000d';
  perform app_test.check(
    'erasing an organisation still works -- the trail does not trap the cascade',
    not exists (select 1 from public.organisations
                 where id = '23100000-0000-4000-8000-00000000000d')
    and not exists (select 1 from public.members
                     where id = '23200000-0000-4000-8000-00000000000d'));
exception when others then
  perform app_test.check(
    'erasing an organisation still works -- the trail does not trap the cascade',
    false, format('%s / %s', sqlstate, sqlerrm));
end $$;

-- ---------------------------------------------------------------------------------------------
-- 6. THE WRITER IS NOT AN API.
-- ---------------------------------------------------------------------------------------------
do $$
begin
  perform app_test.check('anon cannot execute the membership trail writer',
    not has_function_privilege('anon', 'app.record_membership_event()', 'EXECUTE'));
  perform app_test.check('authenticated cannot execute the membership trail writer',
    not has_function_privilege('authenticated', 'app.record_membership_event()', 'EXECUTE'));
end $$;

\o

select name, 'FAIL' as result, detail from app_test.results where not passed order by id;
select count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed,
       count(*) as total
  from app_test.results;

do $$
declare v_failed integer; v_total integer;
begin
  select count(*) filter (where not passed), count(*) into v_failed, v_total from app_test.results;
  if v_failed > 0 then raise exception 'membership trail: % assertion(s) failed', v_failed; end if;
  if v_total < 14 then
    raise exception 'membership trail: only % assertion(s) ran; expected at least 14', v_total;
  end if;
end $$;
