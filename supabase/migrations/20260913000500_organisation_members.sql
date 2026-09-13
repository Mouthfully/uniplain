-- WHO IS IN THIS ACCOUNT, AND WHY READING IT NEEDS A FUNCTION.
--
-- `public.members` holds `user_id`, a reference into `auth.users`, and nothing a person would
-- recognise. Every user-management screen has to show an email address, and `authenticated` holds
-- no grant on `auth.users` -- correctly, because a tenant role that could read that table could
-- enumerate every user of the platform, not only its own colleagues.
--
-- So the address is joined here, in one SECURITY DEFINER function, with the tenancy predicate
-- written into the body rather than left to the caller. That is the same shape `app.can_read_*`
-- takes everywhere else in this schema: the privilege is the point, and it is spent on exactly one
-- question.
--
-- ============================================================================================
-- WHAT THIS DELIBERATELY DOES NOT RETURN
-- ============================================================================================
--
-- Not the user id. A screen needs to name a person and act on their membership; `members.id` is
-- the handle for both, and `auth.users.id` would be a second identifier for the same person that
-- a caller could accumulate and join against elsewhere. It is not needed, so it does not leave.
--
-- Not anything from `raw_user_meta_data`, which is user-controlled free text of unbounded shape --
-- the same hazard as `envelope_rows.entity_name` (issue #53), in a table nothing in this
-- repository redacts.
--
-- ============================================================================================
-- WHO MAY CALL IT: ANY MEMBER, NOT ONLY AN ADMIN
-- ============================================================================================
--
-- `members_select` already lets any member of an organisation see its membership rows. Restricting
-- the email join to admins would be a different rule in a second place, and the thing it would
-- protect is already visible: a colleague's address is knowable to anyone in the same small
-- business by asking them. What must not happen is a member of ONE organisation reading another's,
-- and that is what `app.is_org_member` enforces here, once, in the body.

create or replace function public.organisation_members(p_organisation_id uuid)
returns table (
  member_id  uuid,
  email      text,
  role       app.member_role,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
begin
  -- THE PREDICATE IS FIRST AND IT RAISES. Returning an empty set to a caller who may not read the
  -- organisation would be indistinguishable from an organisation with no members, and a screen
  -- built on that difference would tell a stranger "this account is empty" rather than "not yours".
  if not app.is_org_member(p_organisation_id) then
    raise exception 'organisation_members: not a member of that organisation' using errcode = '42501';
  end if;

  return query
    select m.id, u.email::text, m.role, m.created_at
      from public.members m
      join auth.users u on u.id = m.user_id
     where m.organisation_id = p_organisation_id
     order by m.created_at, m.id;
end;
$$;

comment on function public.organisation_members(uuid) is
  'The membership of one organisation, with each member''s sign-in address joined from auth.users. '
  'SECURITY DEFINER because authenticated holds no grant on auth.users, and must not: a tenant role '
  'able to read it could enumerate every user of the platform. Callable by any member of the '
  'organisation named, and by nobody else.';

-- A NEW FUNCTION IS EXECUTABLE BY `PUBLIC` BY DEFAULT, and `alter default privileges` cannot revoke
-- it. This has gone wrong in this schema before, which is why the revoke is written out rather than
-- assumed from the grant below.
--
-- THE GRANT BELOW IS REDUNDANT TODAY AND STAYS ANYWAY. A hosted project ships `alter default
-- privileges in schema public grant all on functions to anon, authenticated, service_role`, so
-- `authenticated` would hold EXECUTE without it -- deleting the line leaves the suite green, which
-- is recorded beside the assertion in `17_organisation_members.sql` rather than left for the next
-- person to rediscover. It is written out because that default is platform behaviour this
-- repository does not own, and because the revoke above would otherwise be the only statement
-- deciding who may call this, one word away from taking the privilege from every customer.
revoke all on function public.organisation_members(uuid) from public, anon;
grant execute on function public.organisation_members(uuid) to authenticated;
