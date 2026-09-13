-- GIVING THE MEMBERSHIP HALF OF THE TRAIL A CALLER.
--
-- `20260913001200` declared eight event types. `20260913001300` wired exactly one of them --
-- `data_request_filed` -- and named the failure it was fixing: "an audit trail nothing writes to is
-- the same object". Six remain unwired, and this closes the two that issue #63 is about:
-- `member_role_changed` and `member_removed`.
--
-- ============================================================================================
-- A TRIGGER, NOT A DEFINER FUNCTION THE SCREEN CALLS
-- ============================================================================================
--
-- `20260913001300` puts the recording inside `file_data_request` because that act already goes
-- through a definer. Membership does not: `/members` changes a role with an ordinary `update` and
-- removes a member with an ordinary `delete`, both through row-level security. There is no definer
-- to record inside.
--
-- The alternative was to add one and route the screen through it. A trigger is chosen instead for
-- the reason `20260913000600_membership_guards.sql` already gives about its own rules: a server
-- action is ONE CALLER AMONG SEVERAL. A trigger catches the screen, a future bulk tool, a support
-- session and a migration alike -- and it keeps the atomicity argument intact, because a trigger
-- runs in the transaction of the statement that fired it. Either both happened or neither did.
--
-- ============================================================================================
-- IT INSERTS DIRECTLY RATHER THAN CALLING `record_security_event`, AND THAT IS DELIBERATE
-- ============================================================================================
--
-- That function opens with `if not app.is_org_member(...) then raise`, which is right for a call
-- arriving from an application and wrong here twice over. A cascade from an organisation being
-- erased deletes members while the organisation row is already gone, so the membership test would
-- fail and the RAISE would abort the erasure -- turning "delete my data" into an error. And a
-- migration or support session repairing a row has no session at all, so `app.current_user_id()`
-- is null and the same check would refuse.
--
-- So this writes the row itself, as the owner, which is the mechanism `15_force_rls.sql`
-- demonstrates: a definer reaching a FORCED table through NO insert policy, on the strength of the
-- owner holding BYPASSRLS. A permissive insert policy would be one line and would also let every
-- `authenticated` session write its own trail entries, which is the one thing an evidence table
-- must not allow.

create or replace function app.record_membership_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event app.security_event;
  v_detail text;
begin
  -- THE ERASURE ESCAPE HATCH, and the same one `assert_organisation_keeps_an_owner` needs. When an
  -- organisation is deleted its members cascade away, and the organisation row may already be gone
  -- by the time this fires -- so the foreign key on `organisation_id` would reject the event row
  -- and take the erasure down with it. There is nothing to record anyway: the whole account,
  -- including every event ever written about it, is being removed in the same statement.
  if not exists (select 1 from public.organisations o where o.id = old.organisation_id) then
    return null;
  end if;

  if tg_op = 'DELETE' then
    v_event := 'member_removed';
    v_detail := format('role at removal: %s', old.role);
  else
    -- ONLY A ROLE CHANGE. `accept_invitation` touches `updated_at` on a member who is already
    -- there, and `members` carries that column, so recording every UPDATE would file an event
    -- every time somebody re-accepted an invitation -- noise in the one table that must stay
    -- readable after an incident.
    if old.role is not distinct from new.role then
      return null;
    end if;
    v_event := 'member_role_changed';
    v_detail := format('%s -> %s', old.role, new.role);
  end if;

  -- WHAT IS RECORDED, AND WHAT IS NOT.
  --
  -- `subject_id` is the MEMBER ID and not the person's address. The address is personal data with
  -- its own retention question, and this table has no retention period at all yet -- so putting one
  -- here would create a store of identifiers nothing ever expires, in a table every member of the
  -- organisation can read. The member id resolves through `organisation_members` while the person
  -- is still in the account, and stops resolving when they are removed. That is a real limit and
  -- it is written down in issue #63 rather than papered over: this trail answers "what happened to
  -- this membership" completely, and "who was that" only while they are still here.
  --
  -- `detail` carries the ROLES, which are a closed vocabulary and not personal data. It is bounded
  -- at 200 characters by the table's own CHECK; `%s -> %s` over an enum cannot approach it.
  insert into public.security_events
    (organisation_id, workspace_id, event, actor, subject_id, detail)
  values
    (old.organisation_id, null, v_event, app.current_user_id(), old.id::text, v_detail);

  return null;
end;
$$;

comment on function app.record_membership_event() is
  'Files a security event when a member role changes or a member is removed. Inserts directly '
  'rather than through record_security_event, whose membership predicate is written for an '
  'application caller and would abort an organisation erasure mid-cascade.';

-- AFTER, so an event is only filed for a change that actually happened -- a BEFORE trigger records
-- an intention, and the guards in 20260913000600 can still refuse the statement after it.
create trigger members_security_trail
  after update or delete on public.members
  for each row
  execute function app.record_membership_event();

-- A NEW FUNCTION IS EXECUTE-ABLE BY `PUBLIC` BY DEFAULT and `alter default privileges` cannot take
-- it back. On a definer that writes the evidence table, that default is the whole attack.
revoke all on function app.record_membership_event() from public, anon, authenticated;
