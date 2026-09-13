-- A DATA-SUBJECT REQUEST, PROVED FROM A REAL `authenticated` SESSION.
--
-- The properties that matter here are all REFUSALS, and every one of them is the kind that passes
-- silently if it is asserted from the owner's console instead of from the principal it exists for.
-- So every block below sets `role authenticated` and a `request.jwt.claim.sub`, exactly as GoTrue
-- would, and the assertions are about what that session CANNOT do.
--
-- The four that would hurt most if they regressed:
--   1. a tenant resolving their own request -- the record is worthless if the subject can close it
--   2. a member of another organisation reading or filing against this one
--   3. somebody other than the subject withdrawing the subject's request
--   4. `anon` reaching any of it
--
-- Fixture identifiers are unique to this suite and the inserts carry no `on conflict`, for the
-- reason written out in `17_organisation_members.sql`: the suites share one database, and a
-- silently substituted fixture row is a green test that checked somebody else's data.

\o /dev/null

create schema if not exists app_test;
create table if not exists app_test.results (
  id serial primary key, name text not null, passed boolean not null, detail text
);

create or replace function app_test.check(p_name text, p_passed boolean, p_detail text default null)
returns void language sql as $$
  insert into app_test.results (name, passed, detail) values (p_name, coalesce(p_passed, false), p_detail);
$$;
truncate app_test.results;

-- Two organisations. ALICE and BOB are in the first; MALLORY is in the second, which is how the
-- cross-tenant assertions get a principal who is genuinely signed in rather than merely absent.
insert into auth.users (id, email) values
  ('20000000-0000-4000-8000-00000000000a', 'dr-alice@test.test'),
  ('20000000-0000-4000-8000-00000000000b', 'dr-bob@test.test'),
  ('20000000-0000-4000-8000-00000000000f', 'dr-mallory@test.test');

insert into public.organisations (id, name, slug) values
  ('20100000-0000-4000-8000-00000000000a', 'Requests Org A', 'data-requests-org-a'),
  ('20100000-0000-4000-8000-00000000000b', 'Requests Org B', 'data-requests-org-b');

insert into public.members (id, organisation_id, user_id, role) values
  ('20200000-0000-4000-8000-00000000000a', '20100000-0000-4000-8000-00000000000a',
   '20000000-0000-4000-8000-00000000000a', 'owner'),
  ('20200000-0000-4000-8000-00000000000b', '20100000-0000-4000-8000-00000000000a',
   '20000000-0000-4000-8000-00000000000b', 'viewer'),
  ('20200000-0000-4000-8000-00000000000f', '20100000-0000-4000-8000-00000000000b',
   '20000000-0000-4000-8000-00000000000f', 'owner');

-- ---------------------------------------------------------------------------------------------
-- 1. FILING, AND THE FACT THAT A VIEWER MAY DO IT.
--
-- Deliberately not gated on `is_org_admin`. A data-subject right belongs to the person, not to
-- their seniority in somebody's account, and a viewer who could not ask to be forgotten would be
-- the feature failing exactly the people it is for.
-- ---------------------------------------------------------------------------------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-00000000000b', true);

  do $$
  declare v public.data_requests;
  begin
    v := public.file_data_request('20100000-0000-4000-8000-00000000000a', 'erasure', 'Please delete my account.');
    perform app_test.check('a viewer can file a request', v.id is not null);
    perform app_test.check('the request opens in the open state', v.state = 'open', v.state::text);
    perform app_test.check('the subject is taken from the session, not the caller',
      v.requested_by = '20000000-0000-4000-8000-00000000000b', coalesce(v.requested_by::text, 'null'));
    perform app_test.check('nothing is resolved on arrival', v.resolution_note is null);
  exception when others then
    perform app_test.check('a viewer can file a request', false, format('%s / %s', sqlstate, sqlerrm));
  end $$;

  do $$
  begin
    perform public.file_data_request('20100000-0000-4000-8000-00000000000a', 'access', '   ');
    perform app_test.check('a blank note is refused rather than stored as empty', false, 'it was accepted');
  exception when others then
    perform app_test.check('a blank note is refused rather than stored as empty', sqlstate = '22023',
      format('%s / %s', sqlstate, sqlerrm));
  end $$;
commit;

-- ---------------------------------------------------------------------------------------------
-- 2. THE TENANCY DECISION IS THE DATABASE'S.
-- ---------------------------------------------------------------------------------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-00000000000f', true);

  do $$
  begin
    perform public.file_data_request('20100000-0000-4000-8000-00000000000a', 'erasure', 'not mine');
    perform app_test.check('a member of another organisation cannot file against this one', false,
      'the insert succeeded');
  exception when insufficient_privilege then
    perform app_test.check('a member of another organisation cannot file against this one', true,
      'refused with 42501');
  when others then
    perform app_test.check('a member of another organisation cannot file against this one', false,
      format('wrong error: %s / %s', sqlstate, sqlerrm));
  end $$;

  select app_test.check(
    'a member of another organisation reads none of its requests',
    (select count(*) from public.data_requests
      where organisation_id = '20100000-0000-4000-8000-00000000000a') = 0);
commit;

-- ---------------------------------------------------------------------------------------------
-- 3. A TENANT CANNOT RESOLVE, EDIT OR DELETE A REQUEST. THE POINT OF THE WHOLE TABLE.
--
-- `authenticated` holds SELECT and nothing else. These four assertions are about the GRANT, which
-- is why they must run as the principal: an UPDATE refused by a missing policy and one refused by
-- a missing privilege look identical from the owner's console, and only one of them survives
-- somebody adding a permissive policy later.
-- ---------------------------------------------------------------------------------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-00000000000a', true);

  do $$
  begin
    update public.data_requests set state = 'fulfilled'
     where organisation_id = '20100000-0000-4000-8000-00000000000a';
    perform app_test.check('an owner cannot resolve their own request', false, 'the update succeeded');
  exception when insufficient_privilege then
    perform app_test.check('an owner cannot resolve their own request', true, 'refused with 42501');
  when others then
    perform app_test.check('an owner cannot resolve their own request', false,
      format('wrong error: %s / %s', sqlstate, sqlerrm));
  end $$;

  do $$
  begin
    update public.data_requests set resolution_note = 'done, honest'
     where organisation_id = '20100000-0000-4000-8000-00000000000a';
    perform app_test.check('an owner cannot write a resolution note', false, 'the update succeeded');
  exception when insufficient_privilege then
    perform app_test.check('an owner cannot write a resolution note', true, 'refused with 42501');
  when others then
    perform app_test.check('an owner cannot write a resolution note', false,
      format('wrong error: %s / %s', sqlstate, sqlerrm));
  end $$;

  do $$
  begin
    delete from public.data_requests where organisation_id = '20100000-0000-4000-8000-00000000000a';
    perform app_test.check('an owner cannot delete the record of a request', false, 'the delete succeeded');
  exception when insufficient_privilege then
    perform app_test.check('an owner cannot delete the record of a request', true, 'refused with 42501');
  when others then
    perform app_test.check('an owner cannot delete the record of a request', false,
      format('wrong error: %s / %s', sqlstate, sqlerrm));
  end $$;

  -- AND THE THING THEY MUST STILL BE ABLE TO DO. A table nobody can read would pass every refusal
  -- above and would make the screen it exists for render nothing.
  select app_test.check('a member reads their own organisation''s requests',
    (select count(*) from public.data_requests
      where organisation_id = '20100000-0000-4000-8000-00000000000a') >= 1);
commit;

-- ---------------------------------------------------------------------------------------------
-- 4. WITHDRAWAL BELONGS TO THE SUBJECT AND NOBODY ELSE.
-- ---------------------------------------------------------------------------------------------
begin;
  set local role authenticated;
  -- ALICE is an OWNER of the organisation; the request is BOB's. Seniority is not standing.
  select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-00000000000a', true);

  do $$
  declare v_id uuid;
  begin
    select id into v_id from public.data_requests
     where organisation_id = '20100000-0000-4000-8000-00000000000a'
       and requested_by = '20000000-0000-4000-8000-00000000000b'
     limit 1;
    perform public.withdraw_data_request(v_id);
    perform app_test.check('an owner cannot withdraw somebody else''s request', false, 'it was withdrawn');
  exception when others then
    perform app_test.check('an owner cannot withdraw somebody else''s request', sqlstate = 'P0002',
      format('%s / %s', sqlstate, sqlerrm));
  end $$;
commit;

begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-00000000000b', true);

  do $$
  declare v_id uuid; v public.data_requests;
  begin
    select id into v_id from public.data_requests
     where requested_by = '20000000-0000-4000-8000-00000000000b' and state = 'open' limit 1;
    v := public.withdraw_data_request(v_id);
    perform app_test.check('the subject can withdraw their own request', v.state = 'withdrawn', v.state::text);
  exception when others then
    perform app_test.check('the subject can withdraw their own request', false,
      format('%s / %s', sqlstate, sqlerrm));
  end $$;

  do $$
  declare v_id uuid;
  begin
    select id into v_id from public.data_requests
     where requested_by = '20000000-0000-4000-8000-00000000000b' and state = 'withdrawn' limit 1;
    perform public.withdraw_data_request(v_id);
    perform app_test.check('a withdrawn request cannot be withdrawn twice', false, 'it succeeded again');
  exception when others then
    perform app_test.check('a withdrawn request cannot be withdrawn twice', sqlstate = 'P0002',
      format('%s / %s', sqlstate, sqlerrm));
  end $$;
commit;

-- ---------------------------------------------------------------------------------------------
-- 5. `anon` HOLDS NOTHING, ON THE TABLE OR ON THE FUNCTIONS THEMSELVES.
--
-- Asserted against the ACL rather than by calling, which is the correction `13_scheduler...` had
-- to make: the wrappers are SECURITY INVOKER, so a `check_refused` on a call can be satisfied by
-- an INNER grant's refusal while `anon` still holds EXECUTE on the thing it called.
-- ---------------------------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select unnest(array[
    'public.file_data_request(uuid, app.data_request_kind, text)',
    'public.withdraw_data_request(uuid)',
    'app.data_request_deadline()'
  ]) as sig
  loop
    perform app_test.check(
      format('anon holds no EXECUTE on %s ITSELF', r.sig),
      not has_function_privilege('anon', r.sig, 'EXECUTE'), r.sig);
    perform app_test.check(
      format('PUBLIC holds no EXECUTE on %s', r.sig),
      not has_function_privilege('public', r.sig, 'EXECUTE'), r.sig);
  end loop;
end $$;

do $$
begin
  perform app_test.check('anon holds no SELECT on data_requests',
    not has_table_privilege('anon', 'public.data_requests', 'SELECT'));
  perform app_test.check('authenticated holds no UPDATE on data_requests',
    not has_table_privilege('authenticated', 'public.data_requests', 'UPDATE'));
  perform app_test.check('authenticated holds no DELETE on data_requests',
    not has_table_privilege('authenticated', 'public.data_requests', 'DELETE'));
  perform app_test.check('authenticated holds no INSERT on data_requests',
    not has_table_privilege('authenticated', 'public.data_requests', 'INSERT'));
end $$;

-- ---------------------------------------------------------------------------------------------
-- 6. THE DEADLINE IS ABSENT, AND MUST STAY ABSENT UNTIL A LAWYER FILLS IT IN.
--
-- This test is the tripwire on a well-meaning edit. Somebody will eventually type `interval '30
-- days'` into `app.data_request_deadline()` because it reads like a missing value, and that number
-- would be rendered next to a customer's own request as a promise the company is then measured
-- against. If the period is ever genuinely established, this assertion is what has to be deleted
-- in the same change -- which is the point: it cannot happen by accident.
-- ---------------------------------------------------------------------------------------------
do $$
begin
  perform app_test.check('no statutory period is invented',
    (select app.data_request_deadline()) is null,
    coalesce((select app.data_request_deadline())::text, 'null'));
end $$;

-- ---------------------------------------------------------------------------------------------
-- 7. FILING A REQUEST LEAVES A TRAIL, AND THE TRAIL DOES NOT REPEAT THE PERSON'S WORDS.
--
-- `record_security_event` had no caller when it shipped, which is the failure this repository has
-- now made twice with other modules. This asserts the wire exists, in the same transaction, and
-- that `detail` carries the KIND rather than the subject's free text -- the trail is readable by
-- every member of the organisation, and copying a subject's note into it would publish to their
-- colleagues the very thing they asked to be private about.
-- ---------------------------------------------------------------------------------------------
select app_test.check('filing a request records a security event',
  (select count(*) from public.security_events
    where event = 'data_request_filed'
      and organisation_id = '20100000-0000-4000-8000-00000000000a') >= 1);

select app_test.check('the trail records the kind, not the subject''s words',
  not exists (select 1 from public.security_events
               where event = 'data_request_filed' and detail ilike '%delete my account%'));

\o

select name, 'FAIL' as result, detail from app_test.results where not passed order by id;
select count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed,
       count(*) as total
  from app_test.results;

-- The floor, for the reason 06_jwt_claims.sql gives: a suite that stopped running looks exactly
-- like a suite that passed. Every block above is inside `begin; ... commit;` or a `do $$`, so a
-- statement error would abort the transaction and silently skip its assertions rather than fail.
do $$
declare v_failed integer; v_total integer;
begin
  select count(*) filter (where not passed), count(*) into v_failed, v_total from app_test.results;
  if v_failed > 0 then raise exception 'data requests: % assertion(s) failed', v_failed; end if;
  if v_total < 26 then
    raise exception 'data requests: only % assertion(s) ran; expected at least 26', v_total;
  end if;
end $$;
