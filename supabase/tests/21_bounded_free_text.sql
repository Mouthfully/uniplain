-- THE THREE FREE-TEXT COLUMNS, HELD TO THEIR BOUNDS.
--
-- Asserted as the OWNER rather than as a tenant, deliberately: a CHECK constraint binds every role
-- including the one that bypasses RLS, and proving it from a session that could also be stopped by
-- a policy would not distinguish the two.

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

insert into public.organisations (id, name, slug) values
  ('21100000-0000-4000-8000-00000000000a', 'Bounds Org', 'bounded-free-text-org');

do $$
begin
  insert into public.workspaces (id, organisation_id, name, slug, client_contact)
  values ('21300000-0000-4000-8000-00000000000a', '21100000-0000-4000-8000-00000000000a',
          'Bounds WS', 'bounded-ws', repeat('x', 201));
  perform app_test.check('a pasted document cannot land in client_contact', false, 'it was accepted');
exception when check_violation then
  perform app_test.check('a pasted document cannot land in client_contact', true, 'refused');
when others then
  perform app_test.check('a pasted document cannot land in client_contact', false,
    format('wrong error: %s / %s', sqlstate, sqlerrm));
end $$;

do $$
begin
  insert into public.workspaces (id, organisation_id, name, slug, client_name)
  values ('21300000-0000-4000-8000-00000000000b', '21100000-0000-4000-8000-00000000000a',
          'Bounds WS2', 'bounded-ws-2', repeat('y', 201));
  perform app_test.check('a pasted document cannot land in client_name', false, 'it was accepted');
exception when check_violation then
  perform app_test.check('a pasted document cannot land in client_name', true, 'refused');
when others then
  perform app_test.check('a pasted document cannot land in client_name', false,
    format('wrong error: %s / %s', sqlstate, sqlerrm));
end $$;

-- AND THE THINGS THAT MUST STILL BE ACCEPTED. A bound that rejected a real agency client name would
-- present as "the workspace screen is broken" and would pass every refusal above.
do $$
begin
  insert into public.workspaces (id, organisation_id, name, slug, client_name, client_contact)
  values ('21300000-0000-4000-8000-00000000000c', '21100000-0000-4000-8000-00000000000a',
          'Bounds WS3', 'bounded-ws-3', 'Somchai Retail Co., Ltd.', 'somchai@example.test');
  perform app_test.check('an ordinary client name and contact are still accepted', true);
exception when others then
  perform app_test.check('an ordinary client name and contact are still accepted', false,
    format('%s / %s', sqlstate, sqlerrm));
end $$;

do $$
begin
  perform app_test.check('the bound is a constraint, not a convention',
    (select count(*) from pg_constraint
      where conname in ('envelope_rows_entity_name_bounded',
                        'workspaces_client_name_bounded',
                        'workspaces_client_contact_bounded')) = 3);
  -- VALIDATED, not merely declared. A `not valid` constraint binds new rows and leaves existing
  -- ones unchecked, which is the state this migration passes through and must not stop in.
  perform app_test.check('every bound was validated against existing rows',
    (select count(*) from pg_constraint
      where conname in ('envelope_rows_entity_name_bounded',
                        'workspaces_client_name_bounded',
                        'workspaces_client_contact_bounded')
        and convalidated) = 3);
  -- The contract, where the next person will see it.
  perform app_test.check('each column says what it is for',
    (select count(*) from pg_description d
       join pg_attribute a on a.attrelid = d.objoid and a.attnum = d.objsubid
      where a.attname in ('entity_name', 'client_name', 'client_contact')
        and length(d.description) > 80) >= 3);
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
  if v_failed > 0 then raise exception 'bounded free text: % assertion(s) failed', v_failed; end if;
  if v_total < 6 then
    raise exception 'bounded free text: only % assertion(s) ran; expected at least 6', v_total;
  end if;
end $$;
