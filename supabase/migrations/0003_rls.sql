-- ============================================================
-- JAN-SEVA — row level security
-- ============================================================
-- This file is the answer to spec §18. Route guards and service-layer
-- checks in the browser are usability, not access control; the client
-- controls its own runtime and can ask for anything. These policies are
-- the boundary that a Water officer typing a Roads complaint ID into the
-- address bar actually hits.
--
-- The model:
--
--   anon           the public. Reads NOTHING directly. Every citizen
--                  read goes through a server function that returns the
--                  redacted projection, because "knowing a ticket ID"
--                  is not something RLS can verify and is not supposed
--                  to hand over a reporter's name.
--   authenticated  portal staff. Scoped by their portal_users row.
--   service_role   the API functions. Bypasses RLS by design — every
--                  one of them must re-derive scope from the session,
--                  which is why the helpers below are also used there.
--
-- Nothing here trusts a value the client sent. Role and department come
-- from portal_users, keyed on auth.uid(), which only Supabase Auth sets.

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------
-- SECURITY DEFINER so a policy can read portal_users without needing a
-- policy on portal_users that would recurse. STABLE so Postgres calls
-- them once per statement rather than once per row.

create or replace function auth_portal_role()
returns portal_role
language sql
stable
security definer
set search_path = public
as $$
  select role from portal_users where id = auth.uid() and is_active
$$;

create or replace function auth_department_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select department_id from portal_users where id = auth.uid() and is_active
$$;

create or replace function auth_city_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select city_id from portal_users where id = auth.uid() and is_active
$$;

create or replace function auth_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth_portal_role() = 'admin', false)
$$;

/**
 * The one predicate that matters: may the caller touch a record owned by
 * this department?
 *
 * Admins span their own city and no other. Department staff are locked
 * to the department their account was issued for — regardless of what a
 * URL, a dropdown or a request body asks for.
 *
 * A complaint in general triage (department_id is null) is deliberately
 * NOT visible to every department. It belongs to the triage queue, which
 * admins and nodal officers work; handing an unrouted report to all five
 * departments is how a citizen's description ends up read by people with
 * no business reading it.
 */
create or replace function auth_can_access_department(target_department text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then false
    when auth_is_admin() then true
    when target_department is null then false
    else auth_department_id() = target_department
  end
$$;

-- ------------------------------------------------------------
-- Enable RLS everywhere
-- ------------------------------------------------------------
-- Including the tables with no policy at all. A table with RLS enabled
-- and no policy denies everything except service_role, which is the
-- correct default for anything the browser has no business reading.

alter table cities              enable row level security;
alter table departments         enable row level security;
alter table portal_users        enable row level security;
alter table civic_assets        enable row level security;
alter table asset_repairs       enable row level security;
alter table civic_issues        enable row level security;
alter table complaints          enable row level security;
alter table timeline_events     enable row level security;
alter table evidence            enable row level security;
alter table evidence_hashes     enable row level security;
alter table audit_events        enable row level security;
alter table otp_challenges      enable row level security;
alter table rate_limits         enable row level security;
alter table sync_operations     enable row level security;
alter table notification_outbox enable row level security;

-- ------------------------------------------------------------
-- Reference data — readable by any signed-in user
-- ------------------------------------------------------------
-- Department names and helplines are published on the landing page
-- already. There is nothing to protect and a lot of joins to serve.

create policy cities_read on cities
  for select to authenticated using (true);

create policy departments_read on departments
  for select to authenticated using (true);

-- ------------------------------------------------------------
-- portal_users
-- ------------------------------------------------------------
-- A user reads their own row. Staff read the names of colleagues in
-- their own department, which is what assignment dropdowns need — and
-- nothing about staff in other departments. Nobody writes: account
-- creation and role changes are administrative operations that go
-- through the API with service_role, so a compromised session cannot
-- promote itself.

create policy portal_users_self on portal_users
  for select to authenticated using (id = auth.uid());

create policy portal_users_same_department on portal_users
  for select to authenticated
  using (auth_can_access_department(department_id));

-- ------------------------------------------------------------
-- Complaints
-- ------------------------------------------------------------
--
-- Reads are scoped to the caller's department. Writes are NOT granted
-- here at all: every mutation goes through an API function that has to
-- check the version, write the timeline event, write the audit event and
-- update the record in one transaction (spec §62). A direct table
-- UPDATE from the browser could do the first and skip the rest, so the
-- only way to change a complaint is the endpoint that does all four.

create policy complaints_department_read on complaints
  for select to authenticated
  using (auth_can_access_department(department_id));

-- Admins and nodal officers work the general triage queue: reports the
-- classifier could not route with confidence (spec §81).
create policy complaints_triage_read on complaints
  for select to authenticated
  using (
    department_id is null
    and auth_portal_role() in ('admin', 'nodal_officer')
    and city_id = auth_city_id()
  );

create policy timeline_read on timeline_events
  for select to authenticated
  using (exists (
    select 1 from complaints c
    where c.id = timeline_events.complaint_id
      and auth_can_access_department(c.department_id)
  ));

-- Evidence METADATA follows the complaint. The image bytes are a
-- separate question, answered by storage policies and signed URLs in
-- 0004_storage.sql — a readable metadata row must not imply a readable
-- photo (spec §89).
create policy evidence_read on evidence
  for select to authenticated
  using (exists (
    select 1 from complaints c
    where c.id = evidence.complaint_id
      and auth_can_access_department(c.department_id)
  ));

-- ------------------------------------------------------------
-- Civic issues, assets, repair history
-- ------------------------------------------------------------
-- The asset ledger is city infrastructure, not departmental property.
-- Roads seeing that Water dug up the same junction three times is the
-- entire point of keeping it (spec §44) — and it contains no personal
-- data, so the read is city-wide for any signed-in user.

create policy issues_read on civic_issues
  for select to authenticated using (city_id = auth_city_id());

create policy assets_read on civic_assets
  for select to authenticated using (city_id = auth_city_id());

create policy asset_repairs_read on asset_repairs
  for select to authenticated using (true);

-- ------------------------------------------------------------
-- Audit
-- ------------------------------------------------------------
-- Readable by admins only, and append-only for everyone including them:
-- no update policy and no delete policy exist, so an audit row cannot be
-- edited or removed through the API at all. Writes come from
-- service_role inside the same transaction as the action they record.

create policy audit_admin_read on audit_events
  for select to authenticated using (auth_is_admin());

-- ------------------------------------------------------------
-- Deliberately policy-free
-- ------------------------------------------------------------
--
--   otp_challenges       a table of live verification challenges. No
--                        client role has any reason to read it, and a
--                        read is a step toward verifying as someone else.
--   rate_limits          readable counters are bypassable counters.
--   sync_operations      the idempotency ledger. Server bookkeeping.
--   notification_outbox  queued messages, keyed to identity references.
--   evidence_hashes      the city-wide reuse index. Knowing which hashes
--                        are already burned tells a forger exactly which
--                        photo to avoid re-using.
--
-- RLS is enabled on all five with no policy, so they are reachable only
-- with service_role — i.e. only from server code.
