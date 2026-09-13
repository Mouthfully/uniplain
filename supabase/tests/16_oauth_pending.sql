-- THE PENDING AUTHORISATION STORE: the door, the lock, and the fact that the door closes behind you.
--
-- `20260913000400_oauth_pending.sql` adds one table and two SECURITY DEFINER functions so that the
-- OAuth half of connecting a platform account has somewhere to keep a PKCE `code_verifier` while
-- the customer is away at a consent screen. Four properties decide whether that is safe, and each
-- one of them is invisible until it is exploited:
--
--   1. THE ACL. A new function is EXECUTE-able by PUBLIC by default, `anon` is a member of PUBLIC,
--      and `alter default privileges` cannot take it back. `07_anon_grants.sql` enumerates the
--      anon-executable surface and would catch a missing revoke -- but nothing anywhere would catch
--      a MISSING GRANT to `authenticated`, which presents as "the whole connect flow 403s" and is
--      silent in a suite. Both directions are asserted here, on both functions, because the
--      migration's own comment says this is one of the two things it can get quietly wrong.
--
--   2. THE TABLE HAS NO DOOR OF ITS OWN. No grant, no policy, ENABLE plus FORCE. `15_force_rls.sql`
--      reads the catalogue and covers the two settings for every table including this one; what it
--      does not check is that no policy was added and no grant survives, which is what makes the
--      functions the ONLY way in.
--
--   3. TENANCY IS THE DATABASE'S DECISION. Org B presenting org A's state gets zero rows, from
--      Postgres, in the same shape `01_rls_isolation.sql` proves for every other table.
--
--   4. REDEMPTION IS SINGLE-SHOT. This is the property the whole storage decision was taken for: a
--      pending record that can be replayed attaches a second connection from one authorisation.
--      Asserted by redeeming twice and demanding the second answer be empty.
--
-- AND ONE MORE THAT IS EASY TO GET BACKWARDS: the one-hour sweep is GARBAGE COLLECTION, not the
-- ten-minute TTL. A thirty-minute-old row must SURVIVE the sweep, because `PENDING_TTL_MS` in
-- `packages/oauth` is the single authority on expiry and a second TTL in SQL would be two constants
-- that can disagree. A test that only proved "old rows are deleted" would pass just as happily
-- against a ten-minute horizon, which is the version of this file that would have been wrong.

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

/**
 * Run `p_sql` as `p_role` and assert it is REFUSED for want of privilege.
 *
 * `insufficient_privilege` specifically, and not "any error": a function that raised on its own
 * argument checks before the ACL was consulted would satisfy a looser helper while being executable
 * by the internet. Same helper and same reason as `13_scheduler_entry_point.sql`'s.
 */
create or replace function app_test.check_refused(p_name text, p_sql text, p_role text)
returns void language plpgsql as $$
begin
  execute format('set local role %I', p_role);
  execute p_sql;
  reset role;
  perform app_test.check(p_name, false, format('the call SUCCEEDED as %s: %s', p_role, p_sql));
exception
  when insufficient_privilege then
    reset role;
    perform app_test.check(p_name, true, 'denied: ' || sqlerrm);
  when others then
    reset role;
    perform app_test.check(p_name, false,
      format('refused, but not for want of privilege: %s', sqlerrm));
end;
$$;

grant usage on schema app_test to authenticated, anon;
grant all on app_test.results to authenticated, anon;
grant usage, select on all sequences in schema app_test to authenticated, anon;
grant execute on all functions in schema app_test to authenticated, anon;

-- ---------------------------------------------------------------------------------------------
-- Fixture. Two organisations that have nothing to do with each other, which is the shape the
-- cross-tenant assertions need: ALICE owns org A, CAROL owns org B, and neither is a member of the
-- other's organisation in any role.
-- ---------------------------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('b1000000-0000-4000-8000-000000000001', 'oauth-alice@test.test'),
  ('b1000000-0000-4000-8000-000000000002', 'oauth-carol@test.test')
on conflict do nothing;

insert into public.organisations (id, name, slug) values
  ('b1100000-0000-4000-8000-00000000000a', 'OAuth Org A', 'oauth-org-a'),
  ('b1100000-0000-4000-8000-00000000000b', 'OAuth Org B', 'oauth-org-b');

insert into public.workspaces (id, organisation_id, name, slug) values
  ('b1200000-0000-4000-8000-00000000000a', 'b1100000-0000-4000-8000-00000000000a',
   'OAuth Workspace A', 'oauth-workspace-a'),
  ('b1200000-0000-4000-8000-00000000000b', 'b1100000-0000-4000-8000-00000000000b',
   'OAuth Workspace B', 'oauth-workspace-b');

insert into public.members (id, organisation_id, user_id, role) values
  ('b1300000-0000-4000-8000-00000000000a', 'b1100000-0000-4000-8000-00000000000a',
   'b1000000-0000-4000-8000-000000000001', 'owner'),
  ('b1300000-0000-4000-8000-00000000000b', 'b1100000-0000-4000-8000-00000000000b',
   'b1000000-0000-4000-8000-000000000002', 'owner');

-- ---------------------------------------------------------------------------------------------
-- 1. THE ACL, ASSERTED IN BOTH DIRECTIONS ON BOTH FUNCTIONS.
--
-- The migration's own note says this is one of the two things it can get silently wrong, and that
-- nothing else in the suite would catch it. `07_anon_grants.sql` would catch a function left
-- executable by PUBLIC -- but only because it enumerates ANON, and only for the negative direction.
-- ---------------------------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select unnest(array[
      'public.start_oauth_authorization(text, text, uuid, text, text[], text)',
      'public.redeem_oauth_authorization(text)'
    ]) as sig
  loop
    perform app_test.check(
      format('authenticated may execute %s', r.sig),
      has_function_privilege('authenticated', r.sig, 'EXECUTE'),
      format('%s is granted to no tenant role, so every OAuth connect attempt 403s at the first '
             'round trip -- which is silent here and loud only in production', r.sig));

    perform app_test.check(
      format('anon may NOT execute %s', r.sig),
      not has_function_privilege('anon', r.sig, 'EXECUTE'),
      format('the anon key is public and ships in browsers. A new function is EXECUTE-able by '
             'PUBLIC by default and anon is a member of PUBLIC, so %s is callable by the internet '
             'unless its migration revokes it', r.sig));
  end loop;
end $$;

-- Enforcement, not only the ACL. `13_scheduler_entry_point.sql` draws this distinction: a privilege
-- check is not a proof that the privilege is enforced.
begin;
  select app_test.check_refused(
    'anon cannot actually call start_oauth_authorization',
    'select public.start_oauth_authorization(''s'', repeat(''v'', 64), '
      '''b1200000-0000-4000-8000-00000000000a''::uuid, ''google'', array[''ga4''], ''https://x/y'')',
    'anon');
  select app_test.check_refused(
    'anon cannot actually call redeem_oauth_authorization',
    'select * from public.redeem_oauth_authorization(''s'')',
    'anon');
commit;

-- ---------------------------------------------------------------------------------------------
-- 2. THE TABLE HAS NO DOOR OF ITS OWN.
--
-- Both layers: no privilege for any tenant role (the grant layer) and no policy of any kind (the
-- policy layer). Either one alone would be a table where the next person's "just add a policy so
-- the writer works" is one line away from reachable.
-- ---------------------------------------------------------------------------------------------
do $$
declare
  v_priv text;
  v_role text;
  v_count integer;
begin
  foreach v_role in array array['anon', 'authenticated']
  loop
    foreach v_priv in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']
    loop
      perform app_test.check(
        format('%s holds no %s on public.oauth_authorizations', v_role, v_priv),
        not has_table_privilege(v_role, 'public.oauth_authorizations'::regclass, v_priv),
        'the code_verifier is readable exactly once, through redeem_oauth_authorization, by a '
        'session that already holds the 256-bit state. A table privilege would make it readable '
        'over PostgREST by anyone with a session.');
    end loop;
  end loop;

  select count(*) into v_count
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'oauth_authorizations';

  perform app_test.check(
    'public.oauth_authorizations has NO policy of any kind -- the functions are the only way in',
    v_count = 0,
    format('%s policies found; a permissive one added to keep the definer writer working would '
           'apply to authenticated too', v_count));
end $$;

-- ---------------------------------------------------------------------------------------------
-- 3. THE CLOCK IS NOT A PARAMETER.
--
-- `to_regprocedure` resolves a signature or returns null. A `p_now` here would not be a testing
-- seam, it would be a self-extending expiry: write the row with `created_at = now() + 1 day` and
-- verifyCallback's ten-minute window becomes a day for that flow, silently. Asserted on the
-- SIGNATURE, because the moment one reappears the property is gone whatever the body does -- the
-- same reason `13_scheduler_entry_point.sql` gives.
-- ---------------------------------------------------------------------------------------------
select app_test.check('start_oauth_authorization takes no clock from the caller',
  to_regprocedure(
    'public.start_oauth_authorization(text, text, uuid, text, text[], text, timestamptz)') is null
  and to_regprocedure(
    'public.start_oauth_authorization(text, text, uuid, text, text[], text, timestamptz, timestamptz)')
      is null,
  'a caller-supplied created_at extends its own TTL and a future one sweeps every other in-flight '
  'authorisation in the table');

select app_test.check('redeem_oauth_authorization takes no clock from the caller',
  to_regprocedure('public.redeem_oauth_authorization(text, timestamptz)') is null,
  'the age check belongs to verifyCallback and PENDING_TTL_MS; a second one here would be two '
  'constants that can disagree');

-- ---------------------------------------------------------------------------------------------
-- 4. A TENANT MAY START ONLY FOR A WORKSPACE THEY MAY WRITE TO.
-- ---------------------------------------------------------------------------------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true);

  select app_test.check('alice can start an authorisation for her own workspace',
    (select public.start_oauth_authorization(
      'state-alice-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      repeat('v', 86),
      'b1200000-0000-4000-8000-00000000000a',
      'google',
      array['ga4'],
      'https://app.example.test/connections/callback') is not null));
commit;

-- Carol's workspace, from Alice's session. `can_write_workspace` is the whole decision, and it is
-- the same function every policy calls rather than a second opinion written for this path.
do $$
begin
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true);
    perform public.start_oauth_authorization(
      'state-alice-crosses-the-boundary-aaaaaaaaa',
      repeat('v', 86),
      'b1200000-0000-4000-8000-00000000000b',
      'google',
      array['ga4'],
      'https://app.example.test/connections/callback');
    reset role;
    perform app_test.check(
      'alice CANNOT start an authorisation for carol''s workspace', false,
      'POLICY BYPASS: the start succeeded across the organisation boundary');
  exception
    when insufficient_privilege then
      reset role;
      perform app_test.check(
        'alice CANNOT start an authorisation for carol''s workspace', true, 'denied: ' || sqlerrm);
    when others then
      reset role;
      perform app_test.check(
        'alice CANNOT start an authorisation for carol''s workspace', false,
        'refused, but not by the tenancy check: ' || sqlerrm);
  end;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 5. ANOTHER TENANT'S STATE IS ZERO ROWS, AND REDEMPTION IS SINGLE-SHOT.
--
-- The order matters: Carol goes FIRST, holding a state she should not be able to spend. If her
-- redeem returned the row, Alice's redeem below would find nothing and the single-use assertion
-- would pass for entirely the wrong reason -- a green suite over a stolen authorisation.
-- ---------------------------------------------------------------------------------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000002', true);

  select app_test.check(
    'carol redeeming alice''s state gets zero rows, decided by the database',
    (select count(*) = 0 from public.redeem_oauth_authorization(
      'state-alice-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')),
    'a state is a 256-bit secret, but the tenancy predicate is what stops a colleague-of-a-'
    'colleague or a leaked state attaching a credential to somebody else''s workspace');
commit;

begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true);

  select app_test.check(
    'alice redeems her own authorisation and gets the code_verifier back',
    (select code_verifier = repeat('v', 86)
       from public.redeem_oauth_authorization('state-alice-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')));

  -- THE PROPERTY THE WHOLE STORAGE DECISION WAS TAKEN FOR. A replayable pending record attaches a
  -- SECOND connection from ONE authorisation: the same grant, sealed twice, against two rows, one
  -- of which nobody asked for.
  select app_test.check(
    'the same state redeemed a second time is zero rows -- one authorisation, one connection',
    (select count(*) = 0 from public.redeem_oauth_authorization(
      'state-alice-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')),
    'the delete-returning is what makes this atomic; nothing in verifyCallback checks whether a '
    'pending record has already been spent');
commit;

select app_test.check('the redeemed row is gone from the table, not merely filtered',
  (select count(*) = 0 from public.oauth_authorizations
    where state = 'state-alice-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
  'read as the superuser, past every policy: a row that survived redemption is a verifier still '
  'sitting in the database and in tonight''s backup');

-- ---------------------------------------------------------------------------------------------
-- 6. THE SWEEP IS GARBAGE COLLECTION, NOT THE TTL.
--
-- Two rows are planted by the owner: one two hours old, one thirty minutes old. A start call must
-- remove the FIRST and leave the SECOND -- because `PENDING_TTL_MS` (ten minutes, in
-- `verifyCallback`) is the single authority on expiry, and the thirty-minute row must still be
-- REDEEMABLE so that the customer is told `expired` rather than being told nothing at all.
--
-- Asserting only the deletion would pass equally well against a ten-minute horizon in SQL, which is
-- precisely the second constant the migration refuses to introduce.
-- ---------------------------------------------------------------------------------------------
insert into public.oauth_authorizations
  (state, code_verifier, workspace_id, provider, sources, redirect_uri, created_at)
values
  ('state-abandoned-two-hours-ago-aaaaaaaaaaaa', repeat('w', 86),
   'b1200000-0000-4000-8000-00000000000a', 'google', array['ga4'],
   'https://app.example.test/connections/callback', now() - interval '2 hours'),
  ('state-half-an-hour-old-aaaaaaaaaaaaaaaaaaa', repeat('x', 86),
   'b1200000-0000-4000-8000-00000000000a', 'loyverse', array['loyverse'],
   'https://app.example.test/connections/callback', now() - interval '30 minutes');

begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true);
  select public.start_oauth_authorization(
    'state-alice-second-flow-aaaaaaaaaaaaaaaaaa',
    repeat('y', 86),
    'b1200000-0000-4000-8000-00000000000a',
    'loyverse',
    array['loyverse'],
    'https://app.example.test/connections/callback');
commit;

select app_test.check('the sweep removed the two-hour-old abandoned authorisation',
  (select count(*) = 0 from public.oauth_authorizations
    where state = 'state-abandoned-two-hours-ago-aaaaaaaaaaaa'),
  'a row nobody can read still holds a code_verifier; the sweep is why it does not sit there '
  'until someone builds a cron');

select app_test.check(
  'the sweep LEFT the thirty-minute-old one -- the horizon is GC, not the ten-minute TTL',
  (select count(*) = 1 from public.oauth_authorizations
    where state = 'state-half-an-hour-old-aaaaaaaaaaaaaaaaaaa'),
  'PENDING_TTL_MS in packages/oauth is the single authority on expiry. A ten-minute delete here '
  'would be a second constant that can disagree with it, and the customer would get silence '
  'instead of `expired`.');

-- And the thirty-minute row is still REDEEMABLE, which is the half that makes the refusal legible:
-- the Worker gets the row, verifyCallback throws `expired`, and the row is destroyed either way.
begin;
  set local role authenticated;
  select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true);
  select app_test.check(
    'a thirty-minute-old authorisation is still returned, so verifyCallback can say `expired`',
    (select count(*) = 1 from public.redeem_oauth_authorization(
      'state-half-an-hour-old-aaaaaaaaaaaaaaaaaaa')));
commit;

-- ---------------------------------------------------------------------------------------------
-- 7. WHAT THE ROW MAY HOLD.
--
-- The column set is asserted exactly, in the shape `13_scheduler_entry_point.sql` asserts
-- `due_connections`'s: a set assertion fails on a column nobody thought to ban. The one that would
-- be added first is `external_account_id`, because it looks like metadata and is the thing you
-- authenticate as -- and here it would also be the first personal-data-shaped column in a table
-- whose whole safety argument is that it holds none.
-- ---------------------------------------------------------------------------------------------
do $$
declare v_cols text[];
begin
  select array_agg(a.attname order by a.attnum)
    into v_cols
    from pg_attribute a
   where a.attrelid = 'public.oauth_authorizations'::regclass
     and a.attnum > 0
     and not a.attisdropped;

  perform app_test.check(
    'the pending row holds exactly the seven columns the flow needs and nothing else',
    v_cols = array['state','code_verifier','workspace_id','provider','sources','redirect_uri',
                   'created_at'],
    format('the table holds %s. packages/payloads redaction removes identifiers BY KEY and does '
           'not inspect values, so a personal datum inside a kept key is protected by nothing.',
           coalesce(v_cols::text, '(no columns?)')));
end $$;

\o

select name, 'FAIL' as result, detail from app_test.results where not passed order by id;
select count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed,
       count(*) as total
  from app_test.results;

-- The floor exists for the reason `06_jwt_claims.sql` gives: a suite that stops running looks
-- exactly like a suite that passes. Twenty-nine assertions today -- four ACL checks, two
-- enforcement checks, fourteen table privileges, the policy count, two signature checks, the start
-- and the cross-tenant start, three redemption checks, two sweep checks, the still-redeemable
-- check, and the column set.
do $$
declare v_failed integer; v_total integer;
begin
  select count(*) filter (where not passed), count(*) into v_failed, v_total from app_test.results;
  if v_failed > 0 then raise exception 'oauth pending: % assertion(s) failed', v_failed; end if;
  if v_total < 29 then
    raise exception 'oauth pending: only % assertion(s) ran; expected at least 29', v_total;
  end if;
end $$;
