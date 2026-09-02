-- ============================================================
-- JAN-SEVA — privileges
-- ============================================================
-- WHY THIS FILE EXISTS
-- --------------------
-- 0001-0007 create tables and enable RLS, and never once say `grant`.
-- On older Supabase projects that was invisible: the platform shipped
-- ALTER DEFAULT PRIVILEGES granting every new public table to anon,
-- authenticated and service_role, so tables arrived pre-granted. Newer
-- projects do not, which is a security improvement and which turned this
-- schema into 24 tables that exist and refuse every caller:
--
--   {"code":"42501","message":"permission denied for table cities",
--    "hint":"GRANT SELECT ON public.cities TO service_role;"}
--
-- RLS AND GRANTS ARE TWO DIFFERENT GATES, AND BOTH MUST BE OPEN.
-- A grant says the role may address the table at all; RLS decides which
-- rows come back. Neither substitutes for the other, and the failure
-- above is the first gate, not the second — which is why it looked like
-- "migrations did not apply" when they had applied perfectly.
--
-- THE MODEL, RESTATED FROM 0003
-- -----------------------------
--   anon           NOTHING. Not one table. Public complaint tracking is
--                  a server function returning a redacted projection,
--                  because "knows a ticket ID" is not a claim RLS can
--                  verify and must not hand over a reporter's name.
--   authenticated  SELECT, on the tables that actually have a SELECT
--                  policy, and nothing else. No INSERT, no UPDATE, no
--                  DELETE anywhere: every mutation goes through an API
--                  function that writes the row, the timeline event and
--                  the audit event in one transaction (spec §62). A
--                  direct table write could do the first and skip the
--                  rest, so the option is not offered.
--   service_role   everything. It is the server, it bypasses RLS by
--                  design, and it is the code that must therefore
--                  re-derive scope from the session on every request.
--
-- Idempotent: GRANT is a no-op when the privilege is already held, so
-- this is safe to re-run.

-- ------------------------------------------------------------
-- Schema usage
-- ------------------------------------------------------------
-- Without USAGE on the schema, a table grant is unreachable. anon is
-- included ONLY at the schema level, deliberately: it needs to resolve
-- `public` to call an RPC, and it is granted no table below.

grant usage on schema public to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- service_role — the server
-- ------------------------------------------------------------
-- Blanket, and deliberately so. This role already bypasses RLS; a
-- per-table list here would add no security and would silently break the
-- next migration that adds a table.

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;

-- So the NEXT migration's tables are not another 42501. This binds to
-- the role that runs it — run this file as `postgres` (the SQL editor
-- and `supabase db push` both do) or the defaults attach to the wrong
-- owner and quietly do nothing.
alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  grant all privileges on sequences to service_role;

-- ------------------------------------------------------------
-- authenticated — portal staff, SELECT only
-- ------------------------------------------------------------
-- Every table below has a SELECT policy in 0003, 0006 or 0007, and that
-- policy is what decides which rows are visible. The grant only opens
-- the door; RLS is still the whole lock.

-- Reference data (0003: cities_read, departments_read)
grant select on public.cities                to authenticated;
grant select on public.departments           to authenticated;

-- Staff directory (0003: portal_users_self, portal_users_same_department)
grant select on public.portal_users          to authenticated;

-- The operational core (0003)
grant select on public.complaints            to authenticated;
grant select on public.timeline_events       to authenticated;
grant select on public.evidence              to authenticated;
grant select on public.civic_issues          to authenticated;
grant select on public.civic_assets          to authenticated;
grant select on public.asset_repairs         to authenticated;
grant select on public.audit_events          to authenticated;

-- Screening and moderation (0006) — admin-only by policy
grant select on public.moderation_cases      to authenticated;
grant select on public.risk_assessments      to authenticated;
grant select on public.image_analysis_results to authenticated;

-- SLA, escalation, feedback (0007) — department-scoped by policy
grant select on public.sla_events            to authenticated;
grant select on public.escalations           to authenticated;
grant select on public.feedback              to authenticated;

-- ------------------------------------------------------------
-- Granted to NOBODY but service_role
-- ------------------------------------------------------------
-- These have RLS enabled and no policy, so RLS already denies every
-- client role. Withholding the grant as well is the second lock: if a
-- policy is ever added to one of these by mistake, or RLS is disabled
-- during an incident, the missing grant still refuses the browser.
--
--   otp_challenges          live verification challenges. A read is a
--                           step toward verifying as someone else.
--   rate_limits             readable counters are bypassable counters.
--   sync_operations         the idempotency ledger. Server bookkeeping.
--   notification_outbox     queued messages keyed to identity refs.
--   evidence_hashes         the reuse index. Knowing which hashes are
--                           burned tells a forger which photo to avoid.
--   citizen_abuse_profiles  a list of citizens with strikes against
--                           them. No browser session needs it, an
--                           administrator's included.
--   citizen_warnings        the same, per message.
--   ticket_sequences        only the server issues ticket numbers.
--
-- Listed rather than merely omitted, so that "no grant" reads as a
-- decision and not as something forgotten twice.

-- ------------------------------------------------------------
-- Functions
-- ------------------------------------------------------------
-- The auth_* helpers are called from inside RLS policy expressions, so
-- the role being filtered must be able to execute them. They are
-- SECURITY DEFINER and read only the caller's own portal_users row.

grant execute on function public.auth_portal_role()                to authenticated;
grant execute on function public.auth_department_id()              to authenticated;
grant execute on function public.auth_city_id()                    to authenticated;
grant execute on function public.auth_is_admin()                   to authenticated;
grant execute on function public.auth_can_access_department(text)  to authenticated;

-- Ticket issuance is the server's alone. anon and authenticated are
-- deliberately excluded: a client that could call this would burn
-- sequence numbers, and the gaps would be permanent.
revoke execute on function public.next_complaint_id(text) from public, anon, authenticated;
grant  execute on function public.next_complaint_id(text) to service_role;

-- ------------------------------------------------------------
-- anon — explicitly nothing
-- ------------------------------------------------------------
-- Not an omission. If a future migration grants anon a table, that is
-- the line to argue about in review, and this revoke is what makes the
-- argument necessary rather than accidental.

revoke all on all tables in schema public from anon;
