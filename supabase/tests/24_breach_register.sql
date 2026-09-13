-- THE BREACH REGISTER, AND THE TWO PLACES IT COULD LIE.
--
-- A register can fail in exactly two ways that matter, and both of them look fine from outside:
--
--   1. IT REPORTS A DEADLINE THE LAW DOES NOT SET. Art. 33(1)'s 72 hours binds a CONTROLLER.
--      Art. 33(2) binds a processor to "without undue delay" and names no period. A single
--      countdown against every row would show a processor breach a deadline that does not exist,
--      to whoever is handling an incident, at the worst moment to be given a wrong number.
--
--   2. IT LOOKS COMPLETE WHILE IT IS NOT. Art. 33(4) permits phased reporting, so a partial record
--      is lawful and must be writable -- which means nothing stops one sitting there half-filled
--      and reading as finished. `app.breach_record_gaps` is what makes the difference visible, and
--      these assertions are what make it true.
--
-- Run as the OWNER, deliberately. The table has FORCE row level security and no policy for any
-- command, so no role RLS applies to can reach it at all; that is asserted separately below, from
-- the roles themselves.

\o /dev/null

create schema if not exists app_test;
create table if not exists app_test.results (
  id serial primary key, name text not null, passed boolean not null, detail text
);
create or replace function app_test.check(p_name text, p_passed boolean, p_detail text default null)
returns void language sql as $$
  insert into app_test.results (name, passed, detail) values (p_name, coalesce(p_passed, false), p_passed::text || coalesce(' -- ' || p_detail, ''));
$$;
truncate app_test.results;

-- ---------------------------------------------------------------------------------------------
-- The deadline exists for one role and not the other.
-- ---------------------------------------------------------------------------------------------
do $$
declare v_aware constant timestamptz := '2026-09-13T08:00:00Z';
begin
  perform app_test.check('a controller breach gets 72 hours from awareness',
    app.breach_notification_deadline(v_aware, 'controller') = v_aware + interval '72 hours',
    'Art. 33(1) and PDPA s.37(4) both set 72 hours');

  perform app_test.check('a processor breach gets NO deadline, because none is set in law',
    app.breach_notification_deadline(v_aware, 'processor') is null,
    'Art. 33(2) says without undue delay and names no period; NULL means no fixed deadline');

  -- THE CLOCK RUNS FROM AWARENESS, NOT FROM THE ROW. A deadline computed from `recorded_at` would
  -- silently extend itself every time somebody was slow to write the record down -- which is the
  -- direction that helps the company and hurts the data subject.
  perform app_test.check('the clock runs from awareness rather than from now()',
    app.breach_notification_deadline('2020-01-01T00:00:00Z', 'controller')
      = '2020-01-04T00:00:00Z'::timestamptz);
end $$;

-- ---------------------------------------------------------------------------------------------
-- A partial record is writable, and says it is partial.
-- ---------------------------------------------------------------------------------------------
insert into public.breach_records (id, role, became_aware_at)
values ('24100000-0000-4000-8000-00000000000a', 'controller', '2026-09-13T08:00:00Z');

do $$
declare v_gaps text[];
begin
  -- ART. 33(4) IS THE POINT. A register that refused this insert would be unusable in the first
  -- hours of an incident, which is exactly when it has to be started, and would push whoever is
  -- handling it into inventing values to make the insert succeed.
  perform app_test.check('a record can be opened knowing almost nothing',
    (select count(*) from public.breach_records
      where id = '24100000-0000-4000-8000-00000000000a') = 1);

  select app.breach_record_gaps('24100000-0000-4000-8000-00000000000a') into v_gaps;

  perform app_test.check('an almost-empty record reports every Art. 33(3) element as missing',
    cardinality(v_gaps) >= 8, format('gaps: %s', v_gaps));

  perform app_test.check('the gaps name the Article, not just the column',
    exists (select 1 from unnest(v_gaps) g where g like '%Art. 33(3)(a)%'));

  -- The one a register is most often silently missing.
  perform app_test.check('a controller breach with no notification and no reason is reported',
    exists (select 1 from unnest(v_gaps) g where g like '%Art. 33(1)%'),
    'neither notified nor recorded as low-risk reads identically to nobody getting round to it');
end $$;

-- Fill it in, the way Art. 33(4) expects.
update public.breach_records set
  nature = 'A connection credential was exposed in an error payload returned to one workspace.',
  categories_of_subjects = 'Account holders of one workspace',
  categories_of_records = 'One sealed platform credential and the workspace identifier',
  approximate_subjects = 3,
  approximate_records = 1,
  contact_point = 'the address published in the privacy notice',
  likely_consequences = 'Unauthorised read access to one connected advertising account, had the credential been usable.',
  measures_taken = 'The credential was revoked at the platform and re-sealed; the error payload path was changed to omit it.',
  notified_authority_at = '2026-09-14T09:00:00Z'
where id = '24100000-0000-4000-8000-00000000000a';

do $$
begin
  perform app_test.check('a completed record reports no gaps',
    cardinality(app.breach_record_gaps('24100000-0000-4000-8000-00000000000a')) = 0,
    format('gaps: %s', app.breach_record_gaps('24100000-0000-4000-8000-00000000000a')));
end $$;

-- ---------------------------------------------------------------------------------------------
-- NULL IS NOT ZERO, asserted rather than assumed.
-- ---------------------------------------------------------------------------------------------
insert into public.breach_records (id, role, became_aware_at, approximate_subjects)
values ('24100000-0000-4000-8000-00000000000b', 'processor', '2026-09-13T08:00:00Z', 0);

do $$
begin
  -- A breach known to affect nobody and a breach whose scope is unknown are different facts, and a
  -- register that cannot tell them apart is the founding example of this repository's one rule.
  perform app_test.check('zero affected subjects is storable and distinct from unknown',
    (select approximate_subjects from public.breach_records
      where id = '24100000-0000-4000-8000-00000000000b') = 0);

  perform app_test.check('a recorded zero is not reported as a gap',
    not exists (
      select 1 from unnest(app.breach_record_gaps('24100000-0000-4000-8000-00000000000b')) g
       where g like '%approximate number of data subjects%'));

  perform app_test.check('an unknown count IS reported as a gap',
    exists (
      select 1 from unnest(app.breach_record_gaps('24100000-0000-4000-8000-00000000000b')) g
       where g like '%approximate number of records%'));

  perform app_test.check('a processor breach is chased for the customer notification, not the authority',
    exists (select 1 from unnest(app.breach_record_gaps('24100000-0000-4000-8000-00000000000b')) g
             where g like '%Art. 33(2)%')
    and not exists (select 1 from unnest(app.breach_record_gaps('24100000-0000-4000-8000-00000000000b')) g
             where g like '%Art. 33(1)%'));

  perform app_test.check('a negative count is refused',
    not exists (select 1 from public.breach_records where approximate_subjects < 0));
end $$;

-- ---------------------------------------------------------------------------------------------
-- Nobody RLS applies to can reach any of it.
-- ---------------------------------------------------------------------------------------------
do $$
declare v_priv text; v_role text;
begin
  foreach v_role in array array['anon', 'authenticated']
  loop
    foreach v_priv in array array['SELECT','INSERT','UPDATE','DELETE']
    loop
      perform app_test.check(
        format('%s holds no %s on public.breach_records', v_role, v_priv),
        not has_table_privilege(v_role, 'public.breach_records', v_priv),
        'the register is company regulatory documentation, not customer data');
    end loop;
  end loop;

  perform app_test.check('breach_records is FORCE row level security',
    (select relforcerowsecurity and relrowsecurity
       from pg_class where oid = 'public.breach_records'::regclass),
    'without FORCE the owner bypasses its own policies, and every definer function is the owner');

  perform app_test.check('breach_records has no policy for any command',
    (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'breach_records') = 0);

  -- A NEW FUNCTION IS EXECUTE-ABLE BY PUBLIC BY DEFAULT. Both of these revoke from `public` first;
  -- checking the effective privilege is what catches a revoke that named only the two roles.
  foreach v_role in array array['anon', 'authenticated']
  loop
    perform app_test.check(
      format('%s cannot execute app.breach_notification_deadline', v_role),
      not has_function_privilege(v_role,
        'app.breach_notification_deadline(timestamptz, app.breach_role)', 'EXECUTE'));
    perform app_test.check(
      format('%s cannot execute app.breach_record_gaps', v_role),
      not has_function_privilege(v_role, 'app.breach_record_gaps(uuid)', 'EXECUTE'));
  end loop;
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
  if v_failed > 0 then raise exception 'breach register: % assertion(s) failed', v_failed; end if;
  if v_total < 22 then
    raise exception 'breach register: only % assertion(s) ran; expected at least 22', v_total;
  end if;
end $$;
