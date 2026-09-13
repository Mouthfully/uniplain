-- THE TWO WAYS A USER-MANAGEMENT SCREEN BRICKS AN ACCOUNT, AND THE ONE PLACE THEY ARE STOPPED.
--
-- `members_update` and `members_delete` have said `app.is_org_admin(organisation_id)` since
-- 20260908000700. That was correct while nothing in the product could call them: an organisation
-- got exactly one member, from `create_organisation`, and no screen offered to change it. A
-- members page offers both, so the policy is now the whole of the authorisation on an operation
-- that can end an account -- and it is not enough for either of these:
--
--   1. THE LAST OWNER. `is_org_admin` is true for 'owner' AND 'admin', so an admin may delete the
--      owner, and an owner may demote themselves. Either can leave an organisation whose members
--      are all viewers: `organisations_update`, `members_insert`, `members_update`,
--      `members_delete`, `invitations_insert` and every workspace grant are gated on
--      `is_org_admin`, so nobody left can invite anybody, and nobody left can promote anybody.
--      The account is unadministrable from inside and there is no support tool. This is not a
--      permission error a customer can back out of; it is a one-way door.
--
--   2. AN ADMIN ACTING ON AN OWNER. An admin is a delegate. Letting a delegate remove or demote
--      the principal who appointed them inverts the relationship, and it is the escalation shape
--      an account takeover uses: compromise the weaker account, remove the stronger one, own the
--      organisation. Only an owner may touch an owner.
--
-- WHY A TRIGGER AND NOT A POLICY. A policy sees one row at a time and cannot count what is left
-- after the statement; "at least one owner must remain" is a property of the TABLE after the
-- write, which is what an AFTER trigger with a constraint-style recount is for. Writing it as a
-- policy would also mean writing it four times -- update and delete, for each of two rules -- in
-- the language least likely to be read during an audit.
--
-- AND WHY IT IS NOT A PERMISSIVE POLICY: CLAUDE.md's rule. Every definer writer in this schema
-- reaches a FORCED table through no policy at all, on the strength of the owner holding BYPASSRLS.
-- A trigger applies to all of them regardless -- which is the point here, because the invariant is
-- about the data and not about who is writing it.

-- ---------------------------------------------------------------------------------------------
-- 1. AN ORGANISATION ALWAYS HAS AN OWNER.
-- ---------------------------------------------------------------------------------------------
--
-- Deferred to the end of the statement, and counted rather than reasoned about, so that a single
-- statement which demotes one owner and promotes another in the same breath is allowed while the
-- two orderings that would leave nobody are not.

-- SECURITY DEFINER, AND THIS IS NOT DECORATION -- IT IS WHY THE GUARD WORKS AT ALL.
--
-- The first version was an ordinary trigger function, so it ran as `authenticated` under the
-- caller's own row-level security, and the last owner deleting themselves sailed straight through.
-- The reason is worth writing down because it would have been discovered in production: the moment
-- that member row is gone, `app.is_org_member` is false for that session, so `organisations_select`
-- hides the organisation and `members_select` hides every remaining member. The guard then read an
-- empty table and concluded the organisation had been deleted -- the one branch written to let a
-- cascade through.
--
-- An invariant about the whole table cannot be enforced through a view of it that the writer's own
-- statement has just narrowed. It runs as the owner, which holds BYPASSRLS, and counts what is
-- actually there.
create or replace function app.assert_organisation_keeps_an_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- NOT `coalesce(old.…, new.…)`. In a DELETE trigger plpgsql leaves NEW unassigned, and reading a
  -- field off it raises "record new is not assigned yet" -- inside `coalesce`, which never gets to
  -- evaluate its second argument because the first one already failed. TG_OP is the only way to
  -- ask which record exists.
  v_organisation_id uuid := case tg_op when 'DELETE' then old.organisation_id
                                       else new.organisation_id end;
  v_owners integer;
begin
  -- A DELETED ORGANISATION HAS NOTHING TO PROTECT. `on delete cascade` removes its members, and
  -- refusing that cascade would make an organisation undeletable -- which is the same one-way
  -- door in the other direction, and would break "delete my data" outright.
  if not exists (select 1 from public.organisations o where o.id = v_organisation_id) then
    return null;
  end if;

  select count(*) into v_owners
    from public.members m
   where m.organisation_id = v_organisation_id and m.role = 'owner';

  if v_owners = 0 then
    raise exception 'members: an organisation must keep at least one owner'
      using errcode = '23514',
            hint = 'Make somebody else an owner first, then change or remove this one.';
  end if;

  return null;
end;
$$;

create constraint trigger members_keep_an_owner
  after update or delete on public.members
  deferrable initially immediate
  for each row
  execute function app.assert_organisation_keeps_an_owner();

-- ---------------------------------------------------------------------------------------------
-- 2. ONLY AN OWNER MAY CHANGE OR REMOVE AN OWNER.
-- ---------------------------------------------------------------------------------------------
--
-- `app.current_user_id()` IS NULL FOR EVERY NON-SESSION WRITER -- a migration, a definer function
-- called by the scheduler, a psql console. Those are not the principal this rule is about, and
-- making them fail it would mean `create_organisation` could not seed the first owner and a
-- migration could not repair a table. So the check applies exactly when there is a signed-in user
-- to check, and rule 1 above -- which holds unconditionally -- is what protects the data itself.

-- Definer for the same reason, though it bites less hard here: `old.role` comes from the record
-- rather than from a query, and `app.org_role` is already definer. Written out anyway, because the
-- alternative is a reader having to work out which of the two is which.
create or replace function app.assert_owner_changed_only_by_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := app.current_user_id();
begin
  -- Same reason as above: NEW is unassigned in a DELETE trigger, so the return value is chosen by
  -- TG_OP. A BEFORE trigger returning NULL would silently skip the row, which is the one outcome
  -- worse than either raising or allowing.
  if v_actor is null then
    return case tg_op when 'DELETE' then old else new end;
  end if;

  -- Only rows that ARE an owner, or that stop being one, are in scope. Promoting a viewer to
  -- admin, or an admin to owner, is ordinary admin work.
  if old.role is distinct from 'owner' then
    return case tg_op when 'DELETE' then old else new end;
  end if;

  -- `is distinct from`, not `<>`: `app.org_role` returns NULL for a caller who is not a member,
  -- and `null <> 'owner'` is NULL, which `if` treats as false -- so the plain comparison would let
  -- a non-member through the one branch written to stop them.
  if app.org_role(old.organisation_id) is distinct from 'owner' then
    raise exception 'members: only an owner may change or remove an owner'
      using errcode = '42501';
  end if;

  return case tg_op when 'DELETE' then old else new end;
end;
$$;

create trigger members_owner_changed_only_by_owner
  before update or delete on public.members
  for each row
  execute function app.assert_owner_changed_only_by_owner();

-- THE FUNCTIONS ARE NOT CALLABLE DIRECTLY. A trigger function takes no arguments and returns
-- `trigger`, so calling it from SQL raises -- but EXECUTE is still granted to PUBLIC on creation,
-- and this schema has been bitten by that default before. Revoked rather than reasoned about.
revoke all on function app.assert_organisation_keeps_an_owner() from public, anon, authenticated;
revoke all on function app.assert_owner_changed_only_by_owner() from public, anon, authenticated;

comment on function app.assert_organisation_keeps_an_owner() is
  'Refuses any statement that would leave an organisation with no owner. Every administrative '
  'policy in this schema is gated on app.is_org_admin, so an organisation without one cannot be '
  'administered by anybody and has no route back.';

comment on function app.assert_owner_changed_only_by_owner() is
  'Refuses an admin changing or removing an owner. Applies only when there is a signed-in user; a '
  'definer writer or a migration has no org_role to test and is governed by the owner-count rule.';
