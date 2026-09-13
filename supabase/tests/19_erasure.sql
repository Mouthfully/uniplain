-- ERASURE, PROVED BY COUNTING WHAT SURVIVES RATHER THAN BY NAMING WHAT SHOULD NOT.
--
-- The function runs one `delete from public.organisations` and lets the schema's own cascading keys
-- do the rest. That is the right mechanism and it has a failure mode nothing else would catch: a
-- table added later with a foreign key that is NOT `on delete cascade` -- or with none at all --
-- keeps a customer's rows after they have been told the account was erased, and every test that
-- lists tables by name goes on passing, because nobody thought to add the new one to the list.
--
-- So section 3 does not check a list. It reads `information_schema` for every table in `public`
-- that has a column named `organisation_id` or `workspace_id`, and asserts that NOTHING anywhere
-- still refers to the erased organisation. A new table is covered on the day it is created,
-- exactly as `15_force_rls.sql` covers a new table for FORCE RLS. Do not convert either into a
-- list of names, which is precisely how the last gap survived.

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

-- Identifiers unique to this suite, and no `on conflict` clause -- 17_organisation_members.sql
-- records why: the suites share one database and a silently substituted fixture row is a green test
-- that checked somebody else's data.
insert into auth.users (id, email) values
  ('19000000-0000-4000-8000-00000000000a', 'erasure-owner@test.test'),
  ('19000000-0000-4000-8000-00000000000b', 'erasure-admin@test.test'),
  ('19000000-0000-4000-8000-00000000000c', 'erasure-neighbour@test.test');

insert into public.organisations (id, name, slug) values
  ('19100000-0000-4000-8000-00000000000a', 'Doomed Cafe', 'doomed-cafe-erasure-suite'),
  ('19100000-0000-4000-8000-00000000000b', 'Innocent Bystander', 'bystander-erasure-suite');

insert into public.members (id, organisation_id, user_id, role) values
  ('19200000-0000-4000-8000-00000000000a', '19100000-0000-4000-8000-00000000000a',
   '19000000-0000-4000-8000-00000000000a', 'owner'),
  ('19200000-0000-4000-8000-00000000000b', '19100000-0000-4000-8000-00000000000a',
   '19000000-0000-4000-8000-00000000000b', 'admin'),
  ('19200000-0000-4000-8000-00000000000c', '19100000-0000-4000-8000-00000000000b',
   '19000000-0000-4000-8000-00000000000c', 'owner');

insert into public.workspaces (id, organisation_id, name, slug) values
  ('19300000-0000-4000-8000-00000000000a', '19100000-0000-4000-8000-00000000000a', 'Doomed WS',
   'doomed-ws-erasure-suite'),
  ('19300000-0000-4000-8000-00000000000b', '19100000-0000-4000-8000-00000000000b', 'Bystander WS',
   'bystander-ws-erasure-suite');

-- One row in each of the tables a customer would care about, so the cascade has something to prove.
insert into public.invitations (organisation_id, email, role, token_hash, expires_at) values
  ('19100000-0000-4000-8000-00000000000a', 'pending@test.test', 'viewer',
   decode(repeat('19', 32), 'hex'), now() + interval '7 days');

insert into public.connections
  (id, workspace_id, provider, external_account_id, credential_lane,
   credential_ciphertext, credential_iv, wrapped_dek)
values
  ('19400000-0000-4000-8000-00000000000a', '19300000-0000-4000-8000-00000000000a', 'loyverse',
   'doomed-account', 'oauth', '\x00', '\x00', '\x00');

-- ---------------------------------------------------------------------------------------------
-- 1. THE ACL, IN BOTH DIRECTIONS.
-- ---------------------------------------------------------------------------------------------
do $$
begin
  perform app_test.check('anon cannot execute delete_organisation',
    not has_function_privilege('anon', 'public.delete_organisation(uuid, text)', 'EXECUTE'));
  perform app_test.check(
    'public cannot execute delete_organisation -- a new function is granted to PUBLIC by default',
    not has_function_privilege('public', 'public.delete_organisation(uuid, text)', 'EXECUTE'));
  perform app_test.check('authenticated CAN execute delete_organisation',
    has_function_privilege('authenticated', 'public.delete_organisation(uuid, text)', 'EXECUTE'));
end $$;

-- ---------------------------------------------------------------------------------------------
-- 2. EVERY WAY IT MUST REFUSE. Each of these is a customer's account surviving a mistake.
-- ---------------------------------------------------------------------------------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '19000000-0000-4000-8000-00000000000b', true);

  -- THE ERROR MESSAGE IS CHECKED, NOT JUST THE ERROR CLASS, AND A MUTATION IS WHY.
  --
  -- The first version of this caught `insufficient_privilege` and called it a pass. Replacing the
  -- owner check in the function with `app.is_org_admin` -- the exact mutation this assertion exists
  -- to catch -- left the suite GREEN, because the admin got past the function's own gate, reached
  -- the `delete`, and was stopped one layer down by `members_owner_changed_only_by_owner` from
  -- 20260913000600: the cascade into `public.members` tries to remove an OWNER row while the actor
  -- is an admin, and that trigger raises 42501 too.
  --
  -- Two different refusals, the same SQLSTATE, and a test that could not tell them apart. It is the
  -- same shape `18_membership_guards.sql` already had to disambiguate between the owner-count rule
  -- and the owner-roles rule -- and worth noting that the accident is a GOOD one: the membership
  -- trigger is a second, independent floor under this operation. It is just not the thing this
  -- assertion claims to be testing.
  do $$
  begin
    perform public.delete_organisation('19100000-0000-4000-8000-00000000000a', 'Doomed Cafe');
    perform app_test.check('an ADMIN cannot erase the organisation', false, 'it succeeded');
  exception when insufficient_privilege then
    perform app_test.check('an ADMIN cannot erase the organisation',
      sqlerrm like 'delete_organisation:%',
      case when sqlerrm like 'delete_organisation:%'
           then 'refused by the function''s own owner check'
           else format('refused, but by something else: %s', sqlerrm) end);
  when others then
    perform app_test.check('an ADMIN cannot erase the organisation', false,
      format('wrong error: %s / %s', sqlstate, sqlerrm));
  end $$;
commit;

begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '19000000-0000-4000-8000-00000000000c', true);

  do $$
  begin
    perform public.delete_organisation('19100000-0000-4000-8000-00000000000a', 'Doomed Cafe');
    perform app_test.check('an owner of ANOTHER organisation cannot erase this one', false,
      'it succeeded');
  exception when insufficient_privilege then
    perform app_test.check('an owner of ANOTHER organisation cannot erase this one',
      sqlerrm like 'delete_organisation:%', sqlerrm);
  when others then
    perform app_test.check('an owner of ANOTHER organisation cannot erase this one', false,
      format('wrong error: %s / %s', sqlstate, sqlerrm));
  end $$;
commit;

begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '19000000-0000-4000-8000-00000000000a', true);

  do $$
  begin
    perform public.delete_organisation('19100000-0000-4000-8000-00000000000a', 'doomed cafe');
    perform app_test.check('the confirmation is compared exactly, not case-folded', false,
      'a lower-cased name was accepted');
  exception when sqlstate '22023' then
    perform app_test.check('the confirmation is compared exactly, not case-folded', true,
      'refused with 22023');
  when others then
    perform app_test.check('the confirmation is compared exactly, not case-folded', false,
      format('wrong error: %s / %s', sqlstate, sqlerrm));
  end $$;

  do $$
  begin
    perform public.delete_organisation('19100000-0000-4000-8000-00000000000a', ' Doomed Cafe ');
    perform app_test.check('and not trimmed either', false, 'a padded name was accepted');
  exception when sqlstate '22023' then
    perform app_test.check('and not trimmed either', true, 'refused with 22023');
  when others then
    perform app_test.check('and not trimmed either', false,
      format('wrong error: %s / %s', sqlstate, sqlerrm));
  end $$;

  -- STILL THERE AFTER THREE REFUSALS. A refusal that half-erased would be the worst outcome of all.
  do $$
  begin
    perform app_test.check('nothing was erased by any of the refusals',
      exists (select 1 from public.organisations where id = '19100000-0000-4000-8000-00000000000a')
      and exists (select 1 from public.connections where id = '19400000-0000-4000-8000-00000000000a'));
  end $$;
commit;

-- A LIVE SUBSCRIPTION REFUSES, because erasing here tells the payment processor nothing and would
-- leave a customer charged for an account they were told had gone.
-- GUARDED WITH `where exists`, AND A MUTATION IS WHY.
--
-- Removing the confirmation check from the function makes the first refusal probe above ERASE the
-- organisation instead of refusing. The assertions notice -- "nothing was erased by any of the
-- refusals" records a FAIL -- but this insert then dies on a foreign key, psql stops, and the
-- suite never reaches the report. The run fails, which is right, with a message about
-- billing_customers, which tells the next person nothing about the check that actually broke.
--
-- A suite that dies before it can say what failed has thrown away the only thing it was for.
insert into public.billing_customers (organisation_id, stripe_customer_id)
select '19100000-0000-4000-8000-00000000000a', 'cus_erasure_suite'
 where exists (select 1 from public.organisations where id = '19100000-0000-4000-8000-00000000000a');
insert into public.subscriptions
  (organisation_id, stripe_subscription_id, stripe_price_id, plan, billing_interval, status,
   current_period_end, stripe_event_at)
select '19100000-0000-4000-8000-00000000000a', 'sub_erasure_suite', 'price_erasure_suite',
       'growth', 'month', 'active', now() + interval '20 days', now()
 where exists (select 1 from public.organisations where id = '19100000-0000-4000-8000-00000000000a');

begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '19000000-0000-4000-8000-00000000000a', true);

  do $$
  begin
    perform public.delete_organisation('19100000-0000-4000-8000-00000000000a', 'Doomed Cafe');
    perform app_test.check('a live subscription refuses the erasure', false, 'it succeeded');
  exception when check_violation then
    perform app_test.check('a live subscription refuses the erasure', true, 'refused with 23514');
  when others then
    perform app_test.check('a live subscription refuses the erasure', false,
      format('wrong error: %s / %s', sqlstate, sqlerrm));
  end $$;
commit;

update public.subscriptions set status = 'canceled'
 where organisation_id = '19100000-0000-4000-8000-00000000000a';

-- ---------------------------------------------------------------------------------------------
-- 3. THE ERASURE ITSELF, AND WHAT IT REACHES -- READ FROM THE CATALOGUE.
-- ---------------------------------------------------------------------------------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '19000000-0000-4000-8000-00000000000a', true);

  do $$
  declare v_id uuid;
  begin
    select deleted_organisation into v_id
      from public.delete_organisation('19100000-0000-4000-8000-00000000000a', 'Doomed Cafe');
    perform app_test.check('an owner with the exact name erases the organisation',
      v_id = '19100000-0000-4000-8000-00000000000a', coalesce(v_id::text, '(null)'));
  exception when others then
    perform app_test.check('an owner with the exact name erases the organisation', false,
      format('%s / %s', sqlstate, sqlerrm));
  end $$;
commit;

do $$
declare
  v_table   record;
  v_left    bigint;
  v_total   bigint := 0;
  v_checked integer := 0;
  v_worst   text := '';
begin
  -- EVERY TABLE IN `public` THAT NAMES AN ORGANISATION OR A WORKSPACE, from the catalogue. A table
  -- added tomorrow is covered the day it lands; a table added with a non-cascading key fails here
  -- rather than quietly keeping a customer's rows.
  for v_table in
    select c.relname as name,
           (select a.attname from pg_attribute a
             where a.attrelid = c.oid and a.attname = 'organisation_id' and a.attnum > 0) as org_col,
           (select a.attname from pg_attribute a
             where a.attrelid = c.oid and a.attname = 'workspace_id' and a.attnum > 0) as ws_col
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
  loop
    if v_table.org_col is not null then
      execute format(
        'select count(*) from public.%I where organisation_id = %L',
        v_table.name, '19100000-0000-4000-8000-00000000000a') into v_left;
    elsif v_table.ws_col is not null then
      execute format(
        'select count(*) from public.%I where workspace_id = %L',
        v_table.name, '19300000-0000-4000-8000-00000000000a') into v_left;
    else
      continue;
    end if;

    v_checked := v_checked + 1;
    v_total := v_total + v_left;
    if v_left > 0 then
      v_worst := v_worst || format('%s=%s ', v_table.name, v_left);
    end if;
  end loop;

  perform app_test.check(
    'no table in public still holds a row for the erased organisation or its workspace',
    v_total = 0, case when v_worst = '' then format('%s tables checked', v_checked) else v_worst end);

  -- THE VACUITY FLOOR. A loop that matched no tables would report zero survivors and prove nothing.
  perform app_test.check('and the sweep actually looked at the tables it claims to have',
    v_checked >= 8, format('%s tables carried an organisation_id or a workspace_id', v_checked));
end $$;

-- THE NEIGHBOUR IS UNTOUCHED. An erasure that took the wrong tenant with it is the failure this
-- whole schema exists to prevent, and it would look identical to a successful one.
do $$
begin
  perform app_test.check('the other organisation is untouched',
    exists (select 1 from public.organisations where id = '19100000-0000-4000-8000-00000000000b')
    and exists (select 1 from public.workspaces where id = '19300000-0000-4000-8000-00000000000b')
    and exists (select 1 from public.members where id = '19200000-0000-4000-8000-00000000000c'));
end $$;

-- AND WHAT DELIBERATELY SURVIVES. The cascade runs away from `auth.users`, so the sign-in record is
-- still there. That is a limit of this function, not a bug in it, and `/account` says so in words
-- -- but it must be ASSERTED, because the day it silently changes is the day the copy becomes
-- wrong in the other direction.
do $$
begin
  perform app_test.check(
    'the sign-in record survives -- the cascade runs away from auth.users, and the copy says so',
    exists (select 1 from auth.users where id = '19000000-0000-4000-8000-00000000000a'));
end $$;


-- ---------------------------------------------------------------------------------------------
-- 4. ALREADY CANCELLING IS ENOUGH, AND IT NEEDS AN ORGANISATION OF ITS OWN.
--
-- `cancel_at_period_end` leaves `status` at 'active' until the period runs out, so a refusal keyed
-- on status alone would tell somebody who had just pressed cancel to go and cancel. No further
-- charge is taken once Stripe holds that flag, which is the only thing the refusal is for.
--
-- A SEPARATE FIXTURE, BECAUSE THE ASSERTION HAS TO SURVIVE. The first version probed the main
-- organisation inside a transaction it rolled back -- and the `app_test.results` row rolled back
-- with it, exactly as in `18_membership_guards.sql`. The suite reported the same 14 assertions as
-- before and nothing said the new one had vanished. Then the second version was anchored to a
-- section heading copied from suite 18 that does not exist in this file, so it was never inserted
-- at all. THE FLOOR CAUGHT BOTH. An assertion count that has to be raised by hand is the only
-- thing standing between a suite and quietly testing less than it claims.
-- ---------------------------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('19000000-0000-4000-8000-00000000000f', 'erasure-cancelling@test.test');
insert into public.organisations (id, name, slug) values
  ('19100000-0000-4000-8000-00000000000f', 'Leaving Anyway', 'leaving-anyway-erasure-suite');
insert into public.members (id, organisation_id, user_id, role) values
  ('19200000-0000-4000-8000-00000000000f', '19100000-0000-4000-8000-00000000000f',
   '19000000-0000-4000-8000-00000000000f', 'owner');
insert into public.billing_customers (organisation_id, stripe_customer_id)
values ('19100000-0000-4000-8000-00000000000f', 'cus_leaving_anyway');
insert into public.subscriptions
  (organisation_id, stripe_subscription_id, stripe_price_id, plan, billing_interval, status,
   current_period_end, stripe_event_at, cancel_at_period_end)
values ('19100000-0000-4000-8000-00000000000f', 'sub_leaving_anyway', 'price_leaving_anyway',
        'growth', 'month', 'active', now() + interval '20 days', now(), true);

begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '19000000-0000-4000-8000-00000000000f', true);

  do $$
  begin
    perform public.delete_organisation('19100000-0000-4000-8000-00000000000f', 'Leaving Anyway');
    perform app_test.check(
      'a subscription already set to cancel does NOT refuse -- no further charge is coming', true);
  exception when check_violation then
    perform app_test.check(
      'a subscription already set to cancel does NOT refuse -- no further charge is coming',
      false, 'it refused a customer who had already cancelled');
  when others then
    perform app_test.check(
      'a subscription already set to cancel does NOT refuse -- no further charge is coming',
      false, format('%s / %s', sqlstate, sqlerrm));
  end $$;
commit;

do $$
begin
  perform app_test.check('and that organisation really is gone',
    not exists (select 1 from public.organisations where id = '19100000-0000-4000-8000-00000000000f')
    and not exists (select 1 from public.subscriptions
                     where organisation_id = '19100000-0000-4000-8000-00000000000f'));
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
  if v_failed > 0 then raise exception 'erasure: % assertion(s) failed', v_failed; end if;
  if v_total < 15 then
    raise exception 'erasure: only % assertion(s) ran; expected at least 15', v_total;
  end if;
end $$;
