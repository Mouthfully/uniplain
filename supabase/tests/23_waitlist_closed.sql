-- THE COLLECTION PATH THAT OUTLIVED ITS PURPOSE, PROVED CLOSED -- AND PROVED NON-DESTRUCTIVE.
--
-- Two properties, and the second matters as much as the first.
--
-- `public.join_waitlist` was executable by `anon`, which is the internet. The grant was right when
-- it was written and wrong the moment the waiting list was removed, and nothing noticed because the
-- justification for it lived in a comment. `_processing/activities.ts` meanwhile publishes "COLLECTION
-- HAS ENDED." at `/processing`, addressed to a regulator -- so the schema was falsifying a published
-- compliance artefact.
--
-- THE SECOND PROPERTY IS THAT NOTHING WAS DELETED. Addresses already submitted belong to real
-- people who may have been promised something, and discarding them is a founder's decision, not a
-- migration's. A "fix" that closed the path by dropping the table would pass any assertion about
-- collection and would be the more serious act. So this file asserts the rows survive, which is the
-- assertion that would go red if someone later "tidied up" by dropping what they found unused.
--
-- Asserted through `has_function_privilege` against the ROLES rather than by reading a revoke: a
-- grant can arrive from `PUBLIC`, from a role membership, or from a `create or replace` restoring
-- the default, and only the effective privilege accounts for all three.

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

-- A row that predates the closure, standing in for the real sign-ups the founder has not decided
-- about. Written as the owner, because the way in is closed and that is the point.
insert into public.waitlist (email, source)
values ('someone.who.signed.up@example.test', 'pre-launch home page')
on conflict (email) do nothing;

do $$
declare v_oid oid;
begin
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'join_waitlist';

  perform app_test.check('the function still exists, rather than having been dropped',
    v_oid is not null,
    'keeping it is what makes reopening a waiting list a deliberate grant rather than a rewrite');

  if v_oid is null then return; end if;

  -- THE ASSERTION THIS FILE IS FOR.
  perform app_test.check('anon cannot execute join_waitlist',
    not has_function_privilege('anon', v_oid, 'EXECUTE'),
    'the anon key ships in browsers, so an anon grant here is a write path open to the internet');

  perform app_test.check('authenticated cannot execute join_waitlist',
    not has_function_privilege('authenticated', v_oid, 'EXECUTE'),
    'a signed-in customer has no more business adding to a closed waiting list than a stranger');

  -- PUBLIC IS THE ONE THAT COMES BACK. A new function is EXECUTE-able by PUBLIC by default and
  -- `alter default privileges` cannot revoke it, so a later `create or replace` of this function
  -- restores the grant to every role at once -- including the two above, whose direct revokes would
  -- still be in place and would still read as correct. This has gone wrong in this schema before.
  perform app_test.check('PUBLIC cannot execute join_waitlist',
    not (coalesce(
      (select array_to_string(p.proacl, ',') from pg_proc p where p.oid = v_oid), ''
    ) like '%=X/%' and coalesce(
      (select array_to_string(p.proacl, ',') from pg_proc p where p.oid = v_oid), ''
    ) ~ '(^|,)=X/'),
    'a create-or-replace downstream restores the PUBLIC default and silently reopens this');
end $$;

-- ---------------------------------------------------------------------------------------------
-- The table itself: still closed to every tenant role, and still holding what it held.
-- ---------------------------------------------------------------------------------------------
do $$
declare v_priv text; v_rows integer;
begin
  foreach v_priv in array array['SELECT','INSERT','UPDATE','DELETE']
  loop
    perform app_test.check(
      format('anon holds no %s on public.waitlist', v_priv),
      not has_table_privilege('anon', 'public.waitlist', v_priv));
    perform app_test.check(
      format('authenticated holds no %s on public.waitlist', v_priv),
      not has_table_privilege('authenticated', 'public.waitlist', v_priv));
  end loop;

  -- NOT DESTROYED. Closing collection and deciding retention are separate acts, and this is the
  -- assertion that stops the first from quietly performing the second.
  select count(*) into v_rows from public.waitlist;
  perform app_test.check('rows already collected still exist',
    v_rows > 0,
    'closing the path must not delete what was already given -- that is the founder''s decision');

  -- Still FORCE, so the owner does not bypass its own absent policies.
  perform app_test.check('waitlist is still FORCE row level security',
    (select relforcerowsecurity and relrowsecurity
       from pg_class where oid = 'public.waitlist'::regclass));
end $$;

-- ---------------------------------------------------------------------------------------------
-- THE CONTRACT, WHERE THE NEXT PERSON READS IT.
--
-- The comments were rewritten by the same migration that revoked the grant, because the old ones
-- said the function was "Anon-executable by design". A stale comment is how this defect survived
-- the first time; leaving one in place while fixing the grant would set it up to happen again.
-- ---------------------------------------------------------------------------------------------
do $$
begin
  perform app_test.check('the function comment no longer advertises anon execution',
    (select d.description from pg_description d
       join pg_proc p on p.oid = d.objoid
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'join_waitlist' and d.objsubid = 0)
    not ilike '%anon-executable by design%');

  perform app_test.check('the table comment records that it is closed to new writes',
    (select d.description from pg_description d
      where d.objoid = 'public.waitlist'::regclass and d.objsubid = 0)
    ilike '%closed to new writes%');
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
  if v_failed > 0 then raise exception 'waitlist closed: % assertion(s) failed', v_failed; end if;
  if v_total < 14 then
    raise exception 'waitlist closed: only % assertion(s) ran; expected at least 14', v_total;
  end if;
end $$;
