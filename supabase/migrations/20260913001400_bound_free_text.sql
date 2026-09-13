-- ================================================================================================
-- THE THREE UNCONSTRAINED FREE-TEXT COLUMNS, BOUNDED AND GIVEN A STATED CONTRACT.
--
-- Issue #53 filed `envelope_rows.entity_name` as tenant-typed free text nothing has a policy over.
-- Mapping every store for the s.39 record found two more, and they are sharper:
-- `workspaces.client_name` and `workspaces.client_contact` exist to hold an AGENCY'S CLIENT'S
-- contact details -- in ordinary use a named human and their email or phone -- and had no length or
-- shape constraint at all, while `workspaces.name` beside them has one.
--
-- WHAT A BOUND IS AND IS NOT. It is not redaction and does not make these columns safe to fill with
-- a person: `packages/payloads/src/redaction.ts` removes fields BY KEY and says so itself, and it
-- governs the R2 archive rather than Postgres, so nothing inspects these values and nothing will.
-- What a bound does is stop the failure that is actually reachable today -- a pasted document, a
-- CSV cell, a whole customer list arriving in a column designed for a name -- and put a stated
-- contract where there was silence. A column with a comment saying what it is for is one the next
-- person has to argue with before widening.
--
-- THE BOUNDS ARE CHOSEN TO REFUSE NOTHING THAT IS REAL. 500 for an entity name, because a campaign
-- or listing name from a platform is long and this must not start rejecting ingest; 200 for the two
-- workspace columns, matching `workspaces.name` and `external_account_id`. Each is `not valid`
-- first and validated separately, so an existing row that violates it is reported rather than
-- blocking the migration -- a deployment that fails on real data is a worse outcome than a
-- constraint that takes two steps.
-- ================================================================================================

alter table public.envelope_rows
  add constraint envelope_rows_entity_name_bounded
  check (entity_name is null or length(entity_name) between 1 and 500) not valid;

alter table public.workspaces
  add constraint workspaces_client_name_bounded
  check (client_name is null or length(client_name) between 1 and 200) not valid;

alter table public.workspaces
  add constraint workspaces_client_contact_bounded
  check (client_contact is null or length(client_contact) between 1 and 200) not valid;

alter table public.envelope_rows validate constraint envelope_rows_entity_name_bounded;
alter table public.workspaces validate constraint workspaces_client_name_bounded;
alter table public.workspaces validate constraint workspaces_client_contact_bounded;

-- THE CONTRACT, WRITTEN WHERE A PERSON ADDING A COLUMN BESIDE IT WILL SEE IT.
comment on column public.envelope_rows.entity_name is
  'Display name of the platform entity, as the CUSTOMER typed it at the platform. Business '
  'metadata, not a person -- but nothing inspects the value, so a merchant who names a campaign '
  'after a buyer has put personal data here and no module will notice. Bounded, never redacted. '
  'See issue #53 and docs/marketplane/78.';

comment on column public.workspaces.client_name is
  'An agency customer''s own client, for the Meta Platform Terms 5.b.ii.2 client-list record. '
  'Capable of holding a person''s name. Bounded; not redacted; no retention period set.';

comment on column public.workspaces.client_contact is
  'Contact details for the client above -- in ordinary use a named human and their email or phone. '
  'This is the most likely place in the schema for third-party personal data to arrive without '
  'anybody deciding it should. Bounded; not redacted; no retention period set. Named in the s.39 '
  'record at apps/web/app/_processing/activities.ts.';
