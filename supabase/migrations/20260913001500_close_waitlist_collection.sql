-- CLOSING A COLLECTION PATH THAT OUTLIVED ITS PURPOSE.
--
-- `public.join_waitlist` is executable by `anon`, which means it is executable by the internet: the
-- anon key ships in browsers, that is what it is for. That grant was correct when it was written.
-- The product was pre-launch, every page offered to take an address, and the person offering one
-- was by definition not authenticated -- so something reachable by a stranger had to be able to
-- write the table. `07_anon_grants.sql` records that reasoning at length and admits the function to
-- its allow-list on the strength of it.
--
-- THE WAITING LIST WAS THEN REMOVED. `/waitlist` became `/access`, the form went, the server action
-- went, and the only caller of this function went with them. What did not go is the grant, so the
-- write path is still open to the internet with no page in front of it and no purpose behind it.
--
-- WHY THIS IS A DEFECT AND NOT AN UNTIDINESS. `_processing/activities.ts` publishes the record of
-- processing at `/processing`, and its `waiting-list` entry says, in capitals, "COLLECTION HAS
-- ENDED." That is a statement of fact in a compliance artefact, addressed to a regulator and to a
-- customer's counsel, and the grants in this schema contradict it. A stranger can still cause a row
-- to be written. The record is not wrong because someone wrote it carelessly -- it is wrong because
-- the code drifted underneath it, which is the failure mode this repository fails builds over.
--
-- Under the PDPA it is also the substantive problem rather than a formal one: collecting personal
-- data for a purpose that no longer exists has no basis, and consent given "to be told when access
-- opened" cannot cover a collection made after that offer was withdrawn.
--
-- WHAT THIS MIGRATION DOES NOT DO, DELIBERATELY: it does not drop the table, delete a row, or drop
-- the function. Addresses already submitted are real people's data and may be the founder's to
-- honour rather than to discard -- `/access` says exactly that, and `/privacy` discloses that they
-- are held. Deleting them is a destructive act that belongs to a person who knows whether anyone
-- was promised anything, not to a migration closing a grant.
--
-- So: collection stops today, retention stays the founder's decision, and the two are separated so
-- that neither waits for the other. The function remains in the schema, callable by the owner and
-- by `service_role`, which is what makes reopening a waiting list a deliberate grant rather than a
-- rewrite.

revoke execute on function public.join_waitlist(text, text) from anon, authenticated;

-- `public` NAMED FIRST AND EXPLICITLY. A function is `EXECUTE`-able by `PUBLIC` by default and
-- `alter default privileges` cannot revoke it, so revoking from `anon` and `authenticated` alone
-- would leave the grant standing through `PUBLIC` and every one of those roles would still reach
-- it. The original migration revoked from `public` before granting to `anon`; this one has to
-- revoke from `public` again, because a re-`create or replace` of the function anywhere downstream
-- restores the default. This has already gone wrong once in this schema, which is why it is written
-- out rather than assumed.
revoke execute on function public.join_waitlist(text, text) from public;

comment on function public.join_waitlist(text, text) is
  'The only write path to public.waitlist. NO LONGER ANON-EXECUTABLE: the waiting list was removed '
  'with the /waitlist page and collection has ended, so the grant that made this reachable by the '
  'internet was revoked in 20260913001500. The function is kept rather than dropped so that '
  'reopening a waiting list is a deliberate grant. Existing rows are untouched; their retention is '
  'a separate decision, disclosed at /privacy and recorded at /processing.';

comment on table public.waitlist is
  'Pre-launch sign-ups. CLOSED TO NEW WRITES since 20260913001500 -- collection ended with the '
  'waiting-list page. Rows already here are retained pending a founder decision and are disclosed '
  'in the record of processing; readable by no tenant role.';
