-- ================================================================================================
-- GIVING THE TRAIL A CALLER, IN THE SAME STATEMENT AS THE ACT IT RECORDS.
--
-- `20260913001200` added `record_security_event` and NOTHING CALLED IT. That is the failure this
-- repository keeps finding and has now shipped twice -- `deleteWorkspacePayloads`, exported for the
-- R2 half of an erasure and never wired; `app.prune_restatement_events`, written, granted,
-- scheduled and unreachable because the Worker passes a null store. Both read as covered from every
-- artefact except the one that matters. An audit trail nothing writes to is the same object.
--
-- WHY THE RECORDING LIVES INSIDE THE DEFINER RATHER THAN IN THE APPLICATION. A second round trip
-- from the server action would be a separate transaction: the request would commit and the event
-- could fail, leaving an act with no record and nothing to reconcile against. Here the insert and
-- the event are one statement pair in one transaction -- either both happened or neither did, which
-- is the only version of an audit trail worth consulting after an incident.
--
-- `file_data_request` is replaced rather than edited in place: the earlier migration is already
-- pushed, and a migration that changes under a deployment that has run it is how two environments
-- stop agreeing about what the schema is.
-- ================================================================================================

create or replace function public.file_data_request(
  p_organisation_id uuid,
  p_kind app.data_request_kind,
  p_subject_note text default null
)
returns public.data_requests
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.data_requests;
begin
  if not app.is_org_member(p_organisation_id) then
    raise exception 'file_data_request: not a member of that organisation'
      using errcode = '42501';
  end if;

  if p_subject_note is not null and length(btrim(p_subject_note)) = 0 then
    raise exception 'file_data_request: a note must say something or be omitted'
      using errcode = '22023';
  end if;

  insert into public.data_requests (organisation_id, kind, requested_by, subject_note)
  values (p_organisation_id, p_kind, app.current_user_id(), nullif(btrim(p_subject_note), ''))
  returning * into v_row;

  -- THE EVENT, IN THE SAME TRANSACTION AS THE ROW IT IS ABOUT.
  --
  -- `p_detail` carries the KIND and never the note. The note is a person's own words about their
  -- own data and can contain anything they chose to write; the trail is readable by every member of
  -- the organisation, and copying a subject's free text into it would publish to their colleagues
  -- exactly what they asked to be private about. The kind is enough to answer "what happened here".
  perform public.record_security_event(
    p_organisation_id, 'data_request_filed', null, v_row.id::text, v_row.kind::text);

  return v_row;
end;
$$;

revoke all on function public.file_data_request(uuid, app.data_request_kind, text)
  from public, anon, authenticated;
grant execute on function public.file_data_request(uuid, app.data_request_kind, text)
  to authenticated;
