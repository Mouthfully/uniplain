-- THE TRAIL, PROVED APPEND-ONLY FROM A REAL `authenticated` SESSION.
--
-- The property this table exists for is that the party an entry is evidence ABOUT cannot change it.
-- That is a grant, not a policy, and a grant can only be proved from the principal: an UPDATE
-- refused by a missing policy and one refused by a missing privilege look identical from the
-- owner's console, and only one of them survives somebody adding a permissive policy later.
--
-- Fixture identifiers are unique to this suite and the inserts carry no `on conflict`, for the
-- reason written out in `17_organisation_members.sql`.

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

insert into auth.users (id, email) values
  ('21000000-0000-4000-8000-00000000000a', 'sec-alice@test.test'),
  ('21000000-0000-4000-8000-00000000000f', 'sec-mallory@test.test');

insert into public.organisations (id, name, slug) values
  ('21100000-0000-4000-8000-00000000000a', 'Sec Org A', 'security-events-org-a'),
  ('21100000-0000-4000-8000-00000000000b', 'Sec Org B', 'security-events-org-b');

insert into public.members (id, organisation_id, user_id, role) values
  ('21200000-0000-4000-8000-00000000000a', '21100000-0000-4000-8000-00000000000a',
   '21000000-0000-4000-8000-00000000000a', 'owner'),
  ('21200000-0000-4000-8000-00000000000f', '21100000-0000-4000-8000-00000000000b',
   '21000000-0000-4000-8000-00000000000f', 'owner');

-- ---------------------------------------------------------------------------------------------
-- 1. RECORDING, AND THE ACTOR COMING FROM THE SESSION.
-- ---------------------------------------------------------------------------------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '21000000-0000-4000-8000-00000000000a', true);

  do $$
  declare v_id bigint;
  begin
    v_id := public.record_security_event(
      '21100000-0000-4000-8000-00000000000a', 'credential_sealed', null, 'conn-1', 'woocommerce');
    perform app_test.check('an event can be recorded', v_id is not null);
  exception when others then
    perform app_test.check('an event can be recorded', false, format('%s / %s', sqlstate, sqlerrm));
  end $$;

  select app_test.check('the actor is the session, not the caller',
    (select count(*) from public.security_events
      where actor = '21000000-0000-4000-8000-00000000000a') = 1);

  select app_test.check('a blank detail is stored as null rather than an empty string',
    (select count(*) from public.security_events where detail = '') = 0);
commit;

-- ---------------------------------------------------------------------------------------------
-- 2. APPEND-ONLY. THE WHOLE POINT.
-- ---------------------------------------------------------------------------------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '21000000-0000-4000-8000-00000000000a', true);

  do $$
  begin
    update public.security_events set detail = 'nothing to see here'
     where organisation_id = '21100000-0000-4000-8000-00000000000a';
    perform app_test.check('an owner cannot edit the trail', false, 'the update succeeded');
  exception when insufficient_privilege then
    perform app_test.check('an owner cannot edit the trail', true, 'refused with 42501');
  when others then
    perform app_test.check('an owner cannot edit the trail', false,
      format('wrong error: %s / %s', sqlstate, sqlerrm));
  end $$;

  do $$
  begin
    delete from public.security_events
     where organisation_id = '21100000-0000-4000-8000-00000000000a';
    perform app_test.check('an owner cannot delete from the trail', false, 'the delete succeeded');
  exception when insufficient_privilege then
    perform app_test.check('an owner cannot delete from the trail', true, 'refused with 42501');
  when others then
    perform app_test.check('an owner cannot delete from the trail', false,
      format('wrong error: %s / %s', sqlstate, sqlerrm));
  end $$;

  do $$
  begin
    insert into public.security_events (organisation_id, event)
    values ('21100000-0000-4000-8000-00000000000a', 'api_key_created');
    perform app_test.check('an owner cannot forge an entry directly', false, 'the insert succeeded');
  exception when insufficient_privilege then
    perform app_test.check('an owner cannot forge an entry directly', true, 'refused with 42501');
  when others then
    perform app_test.check('an owner cannot forge an entry directly', false,
      format('wrong error: %s / %s', sqlstate, sqlerrm));
  end $$;

  -- AND THE THING THEY MUST STILL DO: read their own. A trail nobody can read is a trail that
  -- fails every security review it was built for.
  select app_test.check('a member reads their own organisation''s trail',
    (select count(*) from public.security_events
      where organisation_id = '21100000-0000-4000-8000-00000000000a') >= 1);
commit;

-- ---------------------------------------------------------------------------------------------
-- 3. TENANCY.
-- ---------------------------------------------------------------------------------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '21000000-0000-4000-8000-00000000000f', true);

  select app_test.check('another organisation reads none of this trail',
    (select count(*) from public.security_events
      where organisation_id = '21100000-0000-4000-8000-00000000000a') = 0);

  do $$
  begin
    perform public.record_security_event(
      '21100000-0000-4000-8000-00000000000a', 'member_removed', null, 'x', 'y');
    perform app_test.check('another organisation cannot write into this trail', false,
      'the insert succeeded');
  exception when insufficient_privilege then
    perform app_test.check('another organisation cannot write into this trail', true,
      'refused with 42501');
  when others then
    perform app_test.check('another organisation cannot write into this trail', false,
      format('wrong error: %s / %s', sqlstate, sqlerrm));
  end $$;
commit;

-- ---------------------------------------------------------------------------------------------
-- 4. THE ACLs THEMSELVES.
-- ---------------------------------------------------------------------------------------------
do $$
begin
  perform app_test.check('anon holds no SELECT on security_events',
    not has_table_privilege('anon', 'public.security_events', 'SELECT'));
  perform app_test.check('authenticated holds no INSERT on security_events',
    not has_table_privilege('authenticated', 'public.security_events', 'INSERT'));
  perform app_test.check('authenticated holds no UPDATE on security_events',
    not has_table_privilege('authenticated', 'public.security_events', 'UPDATE'));
  perform app_test.check('authenticated holds no DELETE on security_events',
    not has_table_privilege('authenticated', 'public.security_events', 'DELETE'));
  perform app_test.check(
    'anon holds no EXECUTE on record_security_event ITSELF',
    not has_function_privilege('anon',
      'public.record_security_event(uuid, app.security_event, uuid, text, text)', 'EXECUTE'));
  perform app_test.check(
    'PUBLIC holds no EXECUTE on record_security_event',
    not has_function_privilege('public',
      'public.record_security_event(uuid, app.security_event, uuid, text, text)', 'EXECUTE'));
end $$;

-- ---------------------------------------------------------------------------------------------
-- 5. THE CLAIM STAYS WITHHELD, AND THIS IS THE TRIPWIRE ON TURNING IT ON.
--
-- `CLAIMS`' `audit-log` entry says "Every query, export and API key is logged". This table records
-- security ACTS and captures no reads at all -- a tenant's reads go through PostgREST and would
-- need database-level statement logging. Somebody will eventually see a table called
-- `security_events` and conclude the capability has shipped. The detail below is what they will
-- read when they look.
-- ---------------------------------------------------------------------------------------------
do $$
begin
  perform app_test.check(
    'no read is recorded by this trail, so the audit-log claim stays withheld',
    not exists (
      select 1 from pg_enum e
        join pg_type t on t.oid = e.enumtypid
       where t.typname = 'security_event'
         and e.enumlabel like '%read%'),
    'adding a read event here does not make "every query is logged" true');
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
  if v_failed > 0 then raise exception 'security events: % assertion(s) failed', v_failed; end if;
  if v_total < 15 then
    raise exception 'security events: only % assertion(s) ran; expected at least 15', v_total;
  end if;
end $$;
