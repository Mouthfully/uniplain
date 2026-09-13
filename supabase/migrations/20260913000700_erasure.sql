-- ERASURE, AND THE REASON THIS SCHEMA DID NOT HAVE IT.
--
-- `20260908000700_rls.sql` says, in the grant block: "Deliberately no DELETE on organisations,
-- workspaces, invitations or api_keys. Each is retired by setting deleted_at or revoked_at,
-- because a hard delete of an organisation destroys the audit log and the Meta client-list record
-- along with it."
--
-- That reasoning was sound when it was written and two thirds of it no longer holds:
--
--   THERE IS NO AUDIT LOG. No table records who did what, anywhere in this schema. Issue #63 is
--   open precisely because nothing does. A retention argument cannot rest on an artefact that does
--   not exist.
--
--   THERE IS NO META CLIENT-LIST RECORD EITHER. No Meta onboarding exists, platform-terms gate 11
--   is N/A on every design note to date, and no table holds a legal entity name for a client.
--
-- What does hold is the PDPA, which binds this controller already: s.33 gives a data subject the
-- right to have their personal data erased, and s.37(3) requires erasure once the retention period
-- ends or the purpose is gone. CLAUDE.md is blunt about what soft delete does to that promise:
-- "Soft-deleted rows staying readable is the usual way 'delete my data' quietly fails to mean
-- anything." A `deleted_at` timestamp makes a tenant invisible. It does not erase them.
--
-- ============================================================================================
-- SO THIS DELETES, AND THE CASCADE IS THE WHOLE MECHANISM
-- ============================================================================================
--
-- Every foreign key that reaches an organisation is already `on delete cascade`, through
-- `workspaces` where it is not direct: members, invitations, billing_customers, subscriptions,
-- connections, api_keys, envelope_rows, restatement_events, webhook_endpoints,
-- oauth_authorizations, ambient_subscriptions and workspace_members. One `delete` removes all of
-- it, and `20260913000600_membership_guards.sql` already returns early from the owner-count guard
-- for exactly this reason -- "refusing that cascade would make an organisation undeletable".
--
-- Nothing here enumerates those tables. A list would be a second place the schema is written down
-- and the one that goes stale the first time a table is added: a table added tomorrow with a
-- cascading key is erased by this function on the day it lands, and a table added WITHOUT one
-- fails `supabase/tests/19_erasure.sql`, which counts what survives rather than naming what should.
--
-- ============================================================================================
-- WHAT THIS CANNOT REACH, STATED HERE RATHER THAN DISCOVERED LATER
-- ============================================================================================
--
-- THE SIGN-IN RECORD. `public.members` references `auth.users`, never the other way round, so the
-- cascade runs away from the login. Deleting it needs the Auth admin API and therefore a
-- service-role credential; this function does not have one and is not getting one. The address
-- survives in `auth.users` until a person with that credential removes it, and `/account` says so
-- in words rather than leaving a customer to assume otherwise.
--
-- ARCHIVED PLATFORM RESPONSES. There are none. `putPayload` and `putBufferedPayload` are exported
-- from `@repo/payloads` and called from nowhere under `apps/api-edge/src` -- the R2 bucket has
-- never had anything written to it. `deleteWorkspacePayloads` exists, is tested five ways
-- including "is idempotent, so a retried erasure is not an error", and also has no caller. When
-- something starts writing payloads, THAT change owns wiring the erasure, and this comment is the
-- note it should fail against.
--
-- THE PAYMENT PROCESSOR'S OWN RECORDS. `billing_customers` holds a customer id and
-- `20260912000600_billing.sql` deliberately stores no invoices, so erasing here does not cancel a
-- subscription or remove anything the processor holds. The function REFUSES while a subscription
-- is live rather than leaving a customer erased and still charged -- which is the same class of
-- error as a wrong number that looks right, in money.

create or replace function public.delete_organisation(
  p_organisation_id uuid,
  p_confirmation    text
)
returns table (deleted_organisation uuid, deleted_at timestamptz)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_name         text;
  v_live_billing integer;
begin
  -- OWNER ONLY, AND NOT `is_org_admin`. Every other administrative act in this schema is gated on
  -- owner-or-admin; this one is not, because an admin is a delegate and ending the business is not
  -- a delegated act. It is the same argument `members_owner_changed_only_by_owner` makes about an
  -- admin removing an owner, applied to the account itself.
  if app.org_role(p_organisation_id) is distinct from 'owner' then
    raise exception 'delete_organisation: only an owner may erase an organisation'
      using errcode = '42501';
  end if;

  select o.name into v_name from public.organisations o where o.id = p_organisation_id;
  if v_name is null then
    raise exception 'delete_organisation: no such organisation' using errcode = '42501';
  end if;

  -- THE TYPED CONFIRMATION IS CHECKED HERE AND NOT IN THE FORM. A confirmation enforced only by a
  -- screen is a confirmation absent from every other caller, and this is the one irreversible
  -- operation in the product. Compared exactly: no trimming, no case folding. A customer who
  -- cannot reproduce their own organisation's name character for character has not confirmed
  -- anything, and the cost of asking again is nothing against the cost of being wrong.
  if p_confirmation is distinct from v_name then
    raise exception 'delete_organisation: confirmation does not match the organisation name'
      using errcode = '22023';
  end if;

  -- REFUSE WHILE THE MONEY IS STILL RUNNING. Erasing `subscriptions` does not tell the payment
  -- processor anything, so a customer who erased their account here would keep being charged with
  -- nothing left to show them why. Refusing is the honest half of not having built cancellation.
  select count(*) into v_live_billing
    from public.subscriptions s
   where s.organisation_id = p_organisation_id
     -- FOUR OF THE EIGHT STATUSES IN `app.subscription_status`, and the list is the decision.
     -- `active` and `trialing` are plainly live. `past_due` and `unpaid` are the ones worth
     -- arguing for: both mean the processor is still trying to take money, so erasing under either
     -- leaves a customer being charged for an account they were told was gone. `canceled`,
     -- `incomplete`, `incomplete_expired` and `paused` are not attempts to collect.
     and s.status in ('active', 'trialing', 'past_due', 'unpaid');

  if v_live_billing > 0 then
    raise exception 'delete_organisation: a subscription is still live'
      using errcode = '23514',
            hint = 'End the subscription with the payment provider first, then erase the account.';
  end if;

  -- ONE STATEMENT. Everything else goes with it, through keys that already say `on delete cascade`.
  delete from public.organisations where id = p_organisation_id;

  return query select p_organisation_id, now();
end;
$$;

comment on function public.delete_organisation(uuid, text) is
  'Erases an organisation and everything that cascades from it. Owner only, and only when the '
  'typed confirmation matches the organisation name exactly and no subscription is live. Does NOT '
  'reach auth.users -- the cascade runs away from the login record -- and does not tell the payment '
  'processor anything.';

-- A NEW FUNCTION IS EXECUTE-ABLE BY `PUBLIC` BY DEFAULT and `alter default privileges` cannot take
-- it back. On a function whose whole job is destruction that is not a formality.
revoke all on function public.delete_organisation(uuid, text) from public, anon;
grant execute on function public.delete_organisation(uuid, text) to authenticated;
