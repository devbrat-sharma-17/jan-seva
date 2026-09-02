
-- ========================================================
-- FILE: 0001_core_schema.sql
-- ========================================================

-- ============================================================
-- JAN-SEVA — core schema
-- ============================================================
-- Target: Supabase Postgres (PostgreSQL 15+).
-- Apply with `supabase db push`, or paste into the SQL editor in order.
--
-- SHAPE, AND WHY IT IS NOT FULLY NORMALISED
-- -----------------------------------------
-- The canonical Complaint already exists in src/types/index.ts and is
-- exercised by 187 self-tests. Shredding it into twenty tables would
-- rewrite every service for no operational gain, so the split follows
-- one rule: a field becomes a column when the SERVER needs it — to
-- filter, sort, index, enforce access, or aggregate. Everything else
-- rides in jsonb, typed by the application.
--
-- Columns:  id, city, department, status, priority, SLA, coordinates,
--           asset, version, timestamps, identity reference.
-- jsonb:    issue text, AI analysis, resolution, feedback, verification,
--           duplicate linkage.
-- Tables:   anything with its own lifecycle — timeline events, evidence,
--           audit, OTP challenges, the sync ledger.
--
-- THE ISSUE / REPORT SPLIT (spec §9) IS STRUCTURAL HERE.
-- `civic_issues` is the pothole. `complaints` are the people who
-- reported it. The issue owns the asset, the location, the work and the
-- SLA; each complaint owns its reporter, its evidence and its own
-- citizen confirmation. One is public infrastructure, the other is a
-- person, and they are retained on different clocks for that reason.

create extension if not exists "pgcrypto";     -- gen_random_uuid, digest
create extension if not exists "postgis";      -- geography(Point); see note

-- PostGIS is enabled up front rather than retrofitted. Coordinates are
-- stored BOTH as double precision lat/lng (exact, what the client sent,
-- never rounded — spec §38) and as a generated geography point (what
-- spatial queries use). If the Supabase plan in use does not offer
-- PostGIS, drop the `geog` columns and their GIST indexes; everything
-- else still works, and distance falls back to the Haversine already in
-- src/services/geoService.ts.

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------

create type complaint_status as enum (
  'pending', 'assigned', 'in-progress', 'resolution-submitted', 'resolved', 'escalated'
);

-- spec §53. A suspicious report is held for review, never auto-punished.
create type moderation_state as enum (
  'normal', 'flagged', 'under_review', 'rejected'
);

create type severity_level as enum ('low', 'medium', 'high', 'critical');

create type sla_state as enum ('normal', 'approaching', 'exceeded');

create type portal_role as enum ('admin', 'department_head', 'nodal_officer', 'field_officer');

create type identity_method as enum ('mobile', 'aadhaar');

create type capture_grade as enum ('verified', 'unverified', 'disputed');

-- ------------------------------------------------------------
-- Reference data
-- ------------------------------------------------------------

create table cities (
  id            text primary key,           -- 'gwalior'
  code          text not null unique,       -- 'GWL', the ticket prefix
  name          text not null,
  name_hindi    text,
  state         text not null,
  centre_lat    double precision not null,
  centre_lng    double precision not null,
  is_active     boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ⚠ BEFORE THE SECOND CITY IS ADDED, READ THIS.
--
-- `id` is a GLOBAL primary key, so 'roads' can exist exactly once across
-- the whole system — and 0005_reference_data.sql binds it to Gwalior.
-- src/data/cities.ts already ships Indore and Bhopal, and the header
-- CitySelector already offers them, so this is a live contradiction
-- waiting on whoever seeds city number two.
--
-- Two ways out, and the choice is not mine to make silently:
--
--   a) City-prefixed ids ('gwalior-roads', 'indore-roads'). No schema
--      change, but src/data/departments.ts uses the bare 'roads' today
--      and every routing path that compares a department id would have
--      to move with it.
--   b) Composite primary key (city_id, id). Truer to the model, and it
--      rewrites every foreign key that currently points at departments.
--
-- Until one is chosen, this schema is single-city and should be seeded
-- as such. auth_can_access_department() in 0003_rls.sql is already
-- written to survive either choice — it resolves the city by join.
create table departments (
  id            text primary key,           -- 'roads' | 'water' | ...
  city_id       text not null references cities(id) on delete restrict,
  name          text not null,
  short_name    text not null,
  name_hindi    text,
  helpline      text,
  categories    text[] not null default '{}',
  divisions     text[] not null default '{}',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- People who sign in
-- ------------------------------------------------------------
--
-- Citizens are NOT here. A citizen never gets an account (spec §10) —
-- they are an opaque identity reference on the complaints they filed.
-- This table is staff only, and every row is one Supabase auth user.
--
-- Password hashing, reset tokens and session issuance are Supabase Auth's
-- job (spec §16). Nothing in this schema stores a password.

create table portal_users (
  id            uuid primary key references auth.users(id) on delete cascade,
  account_id    text not null unique,       -- 'PWD-001'
  display_name  text not null,
  email         text not null unique,
  role          portal_role not null,
  city_id       text not null references cities(id) on delete restrict,
  -- Null for admins, who span the city. Required for every other role:
  -- this single column is what stops Water from reading Roads.
  department_id text references departments(id) on delete restrict,
  designation   text,
  division      text,
  is_active     boolean not null default true,
  mfa_enrolled  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint department_scope_required
    check ((role = 'admin' and department_id is null)
        or (role <> 'admin' and department_id is not null))
);

-- ------------------------------------------------------------
-- Civic assets — the city's memory (spec §44, §45)
-- ------------------------------------------------------------

create table civic_assets (
  id                text primary key,       -- 'GWL-RD-0142'
  city_id           text not null references cities(id) on delete restrict,
  asset_type        text not null,          -- 'road_segment' | 'streetlight' | ...
  name              text not null,
  department_id     text references departments(id) on delete set null,
  ward_id           text,
  -- Point assets carry a coordinate; segments carry a path. Both may be
  -- null for an asset known only by name.
  centre_lat        double precision,
  centre_lng        double precision,
  centre_geog       geography(Point, 4326)
                    generated always as (
                      case when centre_lat is not null and centre_lng is not null
                      then st_setsrid(st_makepoint(centre_lng, centre_lat), 4326)::geography end
                    ) stored,
  path              jsonb,                  -- [{lat,lng}, ...] for segments
  installed_on      date,
  -- Contractor, warranty and defect-liability dates are REAL municipal
  -- records we do not have. Left null rather than invented; the demo
  -- dataset marks its own values with is_synthetic (spec §45).
  contractor_ref    text,
  warranty_until    date,
  dlp_until         date,
  current_condition text,
  is_synthetic      boolean not null default false,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- The repair ledger. Long-lived by policy (spec §46): a record about
-- public infrastructure and public money, not about a person, and the
-- only thing that can answer "has this been fixed before?".
create table asset_repairs (
  id             uuid primary key default gen_random_uuid(),
  asset_id       text not null references civic_assets(id) on delete cascade,
  civic_issue_id uuid,
  department_id  text references departments(id) on delete set null,
  repaired_at    timestamptz not null,
  repaired_by    text,
  note           text,
  evidence_grade capture_grade,
  is_synthetic   boolean not null default false,
  created_at     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Civic issues — the real-world problem
-- ------------------------------------------------------------

create table civic_issues (
  id             uuid primary key default gen_random_uuid(),
  reference      text not null unique,      -- 'GWL-RD-0142-01'
  city_id        text not null references cities(id) on delete restrict,
  department_id  text references departments(id) on delete set null,
  asset_id       text references civic_assets(id) on delete set null,
  category       text not null,
  title          text not null,
  status         complaint_status not null default 'pending',
  severity       severity_level,
  -- The CONFIRMED location: where the problem is, not where the phone
  -- was. Full precision, never rounded before persistence (spec §38).
  lat            double precision not null,
  lng            double precision not null,
  geog           geography(Point, 4326)
                 generated always as (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored,
  locality       text,
  ward_id        text,
  report_count   integer not null default 0,
  first_reported_at timestamptz not null default now(),
  resolved_at    timestamptz,
  version        integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Complaints — one citizen's report
-- ------------------------------------------------------------

create table complaints (
  id                 text primary key,      -- 'JS-GWL-2026-001284'
  city_id            text not null references cities(id) on delete restrict,
  civic_issue_id     uuid references civic_issues(id) on delete set null,

  status             complaint_status not null default 'pending',
  moderation         moderation_state not null default 'normal',

  -- Routing. `department_id` is null while a low-confidence report sits
  -- in general triage (spec §81) — an empty queue is honest, a wrong
  -- department asserted confidently is not.
  department_id      text references departments(id) on delete set null,
  assigned_to        uuid references portal_users(id) on delete set null,

  category           text not null,
  severity           severity_level,
  priority_score     integer not null default 0 check (priority_score between 0 and 100),

  -- Location. Two coordinates, deliberately (spec §37): `lat/lng` is the
  -- CONFIRMED issue location and drives routing, clustering and asset
  -- snapping; `gps_*` is where the device was at capture, kept for
  -- evidence checks only.
  lat                double precision not null,
  lng                double precision not null,
  geog               geography(Point, 4326)
                     generated always as (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored,
  location_source    text not null default 'gps' check (location_source in ('gps','manual')),
  gps_lat            double precision,
  gps_lng            double precision,
  gps_accuracy_m     double precision,
  gps_captured_at    timestamptz,
  -- Geocoder provenance (spec §40). Which service said this, and when,
  -- so a wrong address can be traced to the lookup that produced it.
  formatted_address  text,
  locality           text,
  postal_code        text,
  ward_id            text,
  geocoder_provider  text,
  geocoded_at        timestamptz,

  asset_id           text references civic_assets(id) on delete set null,
  asset_snap_metres  integer,

  -- Reporter. NEVER a raw mobile number, NEVER a raw Aadhaar (spec §10,
  -- §47). `identity_reference` is an opaque server-salted digest; the
  -- mask is the only display form that exists.
  reporter_name      text,
  identity_reference text,
  identity_method    identity_method,
  identity_masked    text,
  identity_verified  boolean not null default false,

  sla_due_at         timestamptz,
  sla_state          sla_state not null default 'normal',
  escalated_at       timestamptz,
  escalation_level   text,

  resolved_at        timestamptz,
  citizen_verified   boolean not null default false,
  citizen_verified_at timestamptz,
  evidence_grade     capture_grade,

  -- Application-shaped detail. Typed in TypeScript, opaque to Postgres.
  issue              jsonb not null default '{}'::jsonb,  -- title, description
  ai_analysis        jsonb,
  resolution         jsonb,
  verification       jsonb,
  feedback           jsonb,
  duplicate_link     jsonb,

  -- Optimistic concurrency (spec §59). Already present on the client
  -- model; this is the authoritative copy. Every mutation sends the
  -- version it read, and a stale write is refused, never merged.
  version            integer not null default 0,

  -- Retention (spec §46). The identity link expires; the civic record
  -- does not. `identity_expires_at` is when the reporter columns above
  -- must be cleared by the retention job — the row itself survives.
  identity_expires_at timestamptz,
  is_publicly_trackable boolean not null default true,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- Demo rows and real rows never mix in an aggregate (spec §94, §96).
  is_synthetic       boolean not null default false
);

-- ------------------------------------------------------------
-- Timeline
-- ------------------------------------------------------------

create table timeline_events (
  id             uuid primary key default gen_random_uuid(),
  complaint_id   text not null references complaints(id) on delete cascade,
  occurred_at    timestamptz not null default now(),
  status         complaint_status,
  title          text not null,
  description    text,
  actor_label    text,
  actor_type     text check (actor_type in ('citizen','system','officer','head','admin')),
  -- 'internal' events never reach the public projection.
  visibility     text not null default 'public' check (visibility in ('public','internal')),
  created_at     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Evidence (spec §24, §31)
-- ------------------------------------------------------------
--
-- The IMAGE does not live here. Storage holds the bytes; this row holds
-- the reference and everything the integrity checks need. Base64 inside
-- a record was the prototype's hard 5 MB ceiling.

create table evidence (
  id                uuid primary key default gen_random_uuid(),
  complaint_id      text not null references complaints(id) on delete cascade,
  kind              text not null check (kind in ('report','progress','resolution')),

  storage_bucket    text not null,
  storage_key       text not null,
  content_type      text not null,
  byte_size         integer not null,
  width             integer,
  height            integer,

  -- SHA-256 of the stored bytes: the identity of the file (spec §26).
  sha256            text not null,
  -- 64-bit dHash, hex. Survives recompression and small crops, which is
  -- exactly what re-uploading last month's photo does to it.
  phash             text,

  captured_at       timestamptz,
  capture_lat       double precision,
  capture_lng       double precision,
  capture_accuracy_m double precision,
  distance_from_issue_m integer,
  -- Per-check results, each PASS | WARN | FAIL | UNAVAILABLE (spec §27).
  -- Never collapsed to a boolean: "could not check" is not "passed".
  integrity_checks  jsonb not null default '[]'::jsonb,
  integrity_grade   capture_grade,

  uploaded_by       uuid references portal_users(id) on delete set null,
  created_at        timestamptz not null default now(),

  unique (storage_bucket, storage_key)
);

-- City-wide reuse index. A hash seen before on a different complaint is
-- the single most useful fake-evidence signal available to us.
create table evidence_hashes (
  phash        text not null,
  complaint_id text not null references complaints(id) on delete cascade,
  asset_id     text,
  recorded_at  timestamptz not null default now(),
  primary key (phash, complaint_id)
);

-- ------------------------------------------------------------
-- Audit (spec §82) — append-only, long-lived
-- ------------------------------------------------------------

create table audit_events (
  id            bigserial primary key,
  occurred_at   timestamptz not null default now(),
  actor_id      uuid references portal_users(id) on delete set null,
  actor_label   text,
  actor_role    portal_role,
  action        text not null,             -- 'complaint.reassign', 'auth.login_failed'
  entity_type   text,
  entity_id     text,
  -- Required for discretionary admin actions; the API enforces which
  -- ones, because "required for some actions" is not a check constraint's
  -- job.
  reason        text,
  -- Never a password, an OTP, a raw identifier or an image (spec §82).
  detail        jsonb not null default '{}'::jsonb,
  ip_hash       text,                       -- salted digest, not the address
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- OTP challenges (spec §12) — server-side only
-- ------------------------------------------------------------
--
-- The code itself is never stored, never logged and never returned. Only
-- a salted hash, so reading this table verifies nobody.

create table otp_challenges (
  id                 uuid primary key default gen_random_uuid(),
  identity_reference text not null,
  method             identity_method not null,
  code_hash          text not null,
  salt               text not null,
  attempts           integer not null default 0,
  max_attempts       integer not null default 5,
  issued_at          timestamptz not null default now(),
  expires_at         timestamptz not null,
  consumed_at        timestamptz,
  -- Set when the provider accepted it for delivery, so "never sent" is
  -- distinguishable from "sent and never used".
  dispatched_at      timestamptz,
  provider           text,
  provider_ref       text
);

-- ------------------------------------------------------------
-- Rate limiting (spec §51, §52)
-- ------------------------------------------------------------
--
-- Server-side, in the database, so it survives a function cold start and
-- is shared across regions. A fixed window is enough for the abuse this
-- faces; it is not a token bucket and does not pretend to be.

create table rate_limits (
  bucket        text not null,              -- 'otp:send', 'complaint:create'
  subject       text not null,              -- salted IP hash or identity ref
  window_start  timestamptz not null,
  count         integer not null default 0,
  primary key (bucket, subject, window_start)
);

-- ------------------------------------------------------------
-- Sync ledger (spec §57) — idempotency
-- ------------------------------------------------------------
--
-- A field officer's queued operation carries an idempotency key. A retry
-- that reaches the server twice must not produce two timeline events,
-- two photos or two status changes. This table makes the second attempt
-- a no-op that replays the first attempt's result.

create table sync_operations (
  idempotency_key  text primary key,
  operation_type   text not null,
  entity_id        text not null,
  submitted_by     uuid references portal_users(id) on delete set null,
  expected_version integer,
  status           text not null default 'applied'
                   check (status in ('applied','rejected','conflict')),
  result           jsonb,
  error_code       text,
  received_at      timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Notification outbox (spec §91, §92)
-- ------------------------------------------------------------

create table notification_outbox (
  id                 uuid primary key default gen_random_uuid(),
  channel            text not null default 'sms'
                     check (channel in ('sms','whatsapp','push','email')),
  -- The recipient is an identity reference, resolved to a number by the
  -- provider adapter at send time. A queue of phone numbers sitting in
  -- the database is a breach waiting to be indexed.
  identity_reference text not null,
  template           text not null,
  variables          jsonb not null default '{}'::jsonb,
  complaint_id       text references complaints(id) on delete set null,
  status             text not null default 'pending'
                     check (status in ('pending','sent','failed','suppressed')),
  attempts           integer not null default 0,
  last_error         text,
  provider_ref       text,
  scheduled_for      timestamptz not null default now(),
  sent_at            timestamptz,
  created_at         timestamptz not null default now()
);


-- ========================================================
-- FILE: 0002_indexes.sql
-- ========================================================

-- ============================================================
-- JAN-SEVA — indexes
-- ============================================================
-- One rule, per spec §86: every index below names the query it serves.
-- An index nobody's query shape matches is write cost with no read
-- benefit, and Postgres already gives us the primary keys and unique
-- constraints for free — those are not repeated here.

-- ------------------------------------------------------------
-- Complaints
-- ------------------------------------------------------------

-- The department queue. This is THE hot path: every department screen
-- opens with "my department's open work, newest first". Composite and
-- ordered so the index answers the sort as well as the filter.
create index complaints_dept_status_created_idx
  on complaints (department_id, status, created_at desc);

-- The priority queue and the admin "needs attention" list, which read
-- the same rows in a different order. Partial: a resolved complaint is
-- never in a priority queue, and excluding them keeps the index roughly
-- the size of the open backlog rather than of all history.
create index complaints_open_priority_idx
  on complaints (department_id, priority_score desc, sla_due_at)
  where status not in ('resolved');

-- SLA sweeps: "what breaches in the next N hours", run by the escalation
-- job and by the SLA-at-risk tile. Partial for the same reason.
create index complaints_sla_due_idx
  on complaints (sla_due_at)
  where status not in ('resolved') and sla_due_at is not null;

-- Citizen tracking by verified identity — "my complaints" (spec §10).
-- Partial because the column is null for unverified reports and goes
-- null again when identity retention lapses.
create index complaints_identity_idx
  on complaints (identity_reference, created_at desc)
  where identity_reference is not null;

-- The asset history panel and repeat-failure detection (spec §112).
create index complaints_asset_idx
  on complaints (asset_id, created_at desc)
  where asset_id is not null;

-- All reports of one real-world problem (spec §9).
create index complaints_issue_idx
  on complaints (civic_issue_id)
  where civic_issue_id is not null;

-- The moderation queue (spec §54). Tiny partial index: almost every row
-- is 'normal', and those are exactly the ones a moderator never asks for.
create index complaints_moderation_idx
  on complaints (moderation, created_at desc)
  where moderation <> 'normal';

-- The retention job's only query: "whose identity link is now due to be
-- cleared?". Partial so it shrinks to nothing once the job has caught up.
create index complaints_identity_expiry_idx
  on complaints (identity_expires_at)
  where identity_reference is not null and identity_expires_at is not null;

-- Spatial. Hotspots, duplicate clustering, asset snapping and "issues
-- near this work card stop" are all ST_DWithin against this (spec §43).
create index complaints_geog_idx on complaints using gist (geog);

-- Admin city-wide list, and the ordering behind every trend chart.
create index complaints_city_created_idx on complaints (city_id, created_at desc);

-- Search by ticket ID is the primary key, so it needs nothing. Search by
-- title and description is a different problem and is deliberately NOT a
-- trigram index yet: it wants a real full-text configuration with Hindi
-- handling, and guessing at it now would just be an index to drop later
-- (spec §88).

-- ------------------------------------------------------------
-- Timeline, evidence, audit
-- ------------------------------------------------------------

-- Every complaint detail view reads its timeline in order.
create index timeline_complaint_time_idx
  on timeline_events (complaint_id, occurred_at desc);

create index evidence_complaint_idx on evidence (complaint_id, kind);

-- Reuse detection looks up a perceptual hash across the whole city
-- before accepting resolution evidence (spec §27).
create index evidence_phash_idx on evidence (phash) where phash is not null;

-- Duplicate-file detection, which is a different question from visual
-- reuse: the identical bytes uploaded twice.
create index evidence_sha_idx on evidence (sha256);

-- The audit trail is read by entity ("what happened to this complaint")
-- and by actor ("what did this officer do").
create index audit_entity_idx on audit_events (entity_type, entity_id, occurred_at desc);
create index audit_actor_idx on audit_events (actor_id, occurred_at desc);
create index audit_action_time_idx on audit_events (action, occurred_at desc);

-- ------------------------------------------------------------
-- Assets and issues
-- ------------------------------------------------------------

create index assets_geog_idx on civic_assets using gist (centre_geog);
create index assets_dept_idx on civic_assets (department_id, asset_type);
create index asset_repairs_asset_idx on asset_repairs (asset_id, repaired_at desc);

create index issues_geog_idx on civic_issues using gist (geog);
create index issues_dept_status_idx on civic_issues (department_id, status);
create index issues_asset_idx on civic_issues (asset_id) where asset_id is not null;

-- ------------------------------------------------------------
-- Operational tables
-- ------------------------------------------------------------

-- Verification looks up the newest live challenge for one identity.
create index otp_lookup_idx
  on otp_challenges (identity_reference, issued_at desc)
  where consumed_at is null;

-- The cleanup job.
create index otp_expiry_idx on otp_challenges (expires_at);

-- The outbox drain: due, unsent, oldest first.
create index outbox_due_idx
  on notification_outbox (scheduled_for)
  where status = 'pending';

create index sync_entity_idx on sync_operations (entity_id, received_at desc);


-- ========================================================
-- FILE: 0003_rls.sql
-- ========================================================

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
 * Admins span their own city AND NO OTHER — enforced here, not merely
 * intended. An earlier revision returned `true` for any admin, which read
 * correctly at the time because only Gwalior was seeded, and would have
 * silently become a cross-city read the moment Indore or Bhopal was
 * added (both already ship in src/data/cities.ts). The admin branch now
 * resolves the target department's own city and compares it.
 *
 * Department staff are locked to the department their account was issued
 * for — regardless of what a URL, a dropdown or a request body asks for.
 * They need no separate city check: their department belongs to exactly
 * one city by construction.
 *
 * A complaint in general triage (department_id is null) is deliberately
 * NOT visible to every department. It belongs to the triage queue, which
 * admins and nodal officers work; handing an unrouted report to all five
 * departments is how a citizen's description ends up read by people with
 * no business reading it. Admins keep that access — the null branch is
 * checked before the city lookup, because an unrouted complaint has no
 * department whose city could be compared. `complaints_triage_read`
 * carries the city predicate for that path.
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
    when target_department is null then auth_is_admin()
    when auth_is_admin() then exists (
      select 1 from departments d
      where d.id = target_department
        and d.city_id = auth_city_id()
    )
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


-- ========================================================
-- FILE: 0004_storage.sql
-- ========================================================

-- ============================================================
-- JAN-SEVA — object storage (spec §24, §89)
-- ============================================================
-- Photos leave the database. A base64 data URL inside a record was the
-- prototype's 5 MB ceiling and would be a 400 kB row read on every list
-- query in production.
--
-- Two buckets, because two different things are being protected:
--
--   civic-evidence   the originals. Citizen photos and resolution
--                    evidence. PRIVATE. Reached only through a signed
--                    URL minted by an API function that has already
--                    checked the caller's scope.
--   civic-public     the blurred, downscaled stand-ins the public
--                    tracking page already renders. PUBLIC, because
--                    that is what "anyone with the ticket ID" means,
--                    and they carry no faces, plates or doorways.
--
-- The split matters: `PublicComplaint.protectedPhotos` exists in the
-- type system today for exactly this reason, and putting both in one
-- bucket would make the type-level guarantee unenforceable at rest.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('civic-evidence', 'civic-evidence', false, 12582912,
   array['image/jpeg','image/png','image/webp']),
  ('civic-public', 'civic-public', true, 2097152,
   array['image/jpeg','image/webp'])
on conflict (id) do nothing;

-- Note the MIME allow-list above: no image/svg+xml. An SVG is a script
-- container, and nothing in this product needs one (spec §25). The
-- bucket refusing it is the backstop; the upload endpoint still sniffs
-- the file signature rather than trusting the declared type, because a
-- declared Content-Type is just a string the client chose.

-- ------------------------------------------------------------
-- civic-evidence — private
-- ------------------------------------------------------------
--
-- Object keys are laid out as:  <complaint_id>/<kind>/<uuid>.jpg
-- so the first path segment is the complaint, and a policy can join
-- through it to the department that owns the record.

create policy evidence_objects_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'civic-evidence'
    and exists (
      select 1 from complaints c
      where c.id = (storage.foldername(name))[1]
        and auth_can_access_department(c.department_id)
    )
  );

-- Uploads do NOT go direct to the bucket. Resolution evidence has to be
-- hashed, checked for reuse, distance-checked against the complaint and
-- graded before it counts as evidence (spec §30-§34), and a direct
-- client write would land bytes that skipped all of it. The API function
-- uploads with service_role after those checks pass, so there is no
-- insert policy here at all.

-- ------------------------------------------------------------
-- civic-public — public read
-- ------------------------------------------------------------

create policy public_previews_read on storage.objects
  for select to public
  using (bucket_id = 'civic-public');

-- Same reasoning: previews are DERIVED by the server from an accepted
-- original. Nothing writes to this bucket except service_role, so an
-- unblurred photo cannot be placed in the public bucket by a client.


-- ========================================================
-- FILE: 0005_reference_data.sql
-- ========================================================

-- ============================================================
-- JAN-SEVA — reference data
-- ============================================================
-- REFERENCE data only: the city and its departments. These are real,
-- publicly published municipal facts and they belong in every
-- environment including production.
--
-- What is NOT here, deliberately (spec §95, §96):
--
--   * complaints — not one. A production database starts empty. The
--     synthetic Gwalior history stays in src/data/seedComplaints.ts,
--     loaded only in demo and development builds.
--   * staff accounts — no officer rows, no admin row. Real department
--     accounts are created explicitly by an administrator against
--     Supabase Auth. Seeding "Er. Ramesh Verma" here would put a
--     fabricated officer's name on real citizens' complaints.
--   * civic assets — the asset registry is synthetic and is loaded by
--     the demo seeding script, which sets is_synthetic = true on every
--     row it writes.
--
-- Helplines below are the ones already published in the application's
-- department configuration. They are carried across rather than
-- invented; verify them against the corporation's current directory
-- before the beta goes public, because a wrong helpline on a civic
-- portal is worse than none.

insert into cities (id, code, name, name_hindi, state, centre_lat, centre_lng, is_active)
values
  ('gwalior', 'GWL', 'Gwalior', 'ग्वालियर', 'Madhya Pradesh', 26.2183, 78.1828, true)
on conflict (id) do nothing;

-- Indore and Bhopal exist as "coming soon" screens in the app. They are
-- inserted inactive so city selection has something real to point at,
-- and so no complaint can be filed against a city with no departments.
insert into cities (id, code, name, name_hindi, state, centre_lat, centre_lng, is_active)
values
  ('indore', 'IND', 'Indore', 'इंदौर', 'Madhya Pradesh', 22.7196, 75.8577, false),
  ('bhopal', 'BPL', 'Bhopal', 'भोपाल', 'Madhya Pradesh', 23.2599, 77.4126, false)
on conflict (id) do nothing;

insert into departments (id, city_id, name, short_name, helpline, categories, divisions)
values
  ('roads', 'gwalior', 'Public Works Department', 'Public Works', '0751-2441234',
   array['roads','potholes','footpath'],
   array['Road Maintenance','Bridges & Culverts','Footpaths']),

  ('sanitation', 'gwalior', 'Municipal Sanitation Department', 'Sanitation', '0751-2442222',
   array['garbage','drainage','sewage'],
   array['Solid Waste','Drainage','Public Toilets']),

  ('water', 'gwalior', 'Water Services Department', 'Water Services', '0751-2443333',
   array['water-supply','leakage','contamination'],
   array['Supply Network','Leak Repair','Quality Control']),

  ('electrical', 'gwalior', 'Electrical & Streetlight Department', 'Electrical', '0751-2444444',
   array['streetlight','electrical-hazard'],
   array['Streetlighting','Substations','Hazard Response']),

  ('infrastructure', 'gwalior', 'Urban Infrastructure Department', 'Infrastructure', '0751-2445555',
   array['parks','encroachment','public-property'],
   array['Parks & Gardens','Encroachment','Civic Structures'])
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Ticket sequence
-- ------------------------------------------------------------
-- Complaint IDs are generated in the browser today from a counter in
-- localStorage, which two devices filing at once would collide on. The
-- server issues them from here instead: one row per city per year, one
-- atomic increment.

create table if not exists ticket_sequences (
  city_id  text not null references cities(id) on delete restrict,
  year     integer not null,
  last_value integer not null default 0,
  primary key (city_id, year)
);

alter table ticket_sequences enable row level security;
-- No policy: only the server issues ticket numbers.

/**
 * Next complaint ID for a city, e.g. 'JS-GWL-2026-001284'.
 *
 * The UPDATE takes a row lock, so two concurrent submissions serialise
 * on it and cannot receive the same number — which is the failure the
 * localStorage counter has today and cannot fix.
 */
create or replace function next_complaint_id(p_city_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year  integer := extract(year from now() at time zone 'Asia/Kolkata');
  v_code  text;
  v_next  integer;
begin
  select code into v_code from cities where id = p_city_id;
  if v_code is null then
    raise exception 'unknown city: %', p_city_id;
  end if;

  insert into ticket_sequences (city_id, year, last_value)
  values (p_city_id, v_year, 1)
  on conflict (city_id, year)
    do update set last_value = ticket_sequences.last_value + 1
  returning last_value into v_next;

  return format('JS-%s-%s-%s', v_code, v_year, lpad(v_next::text, 6, '0'));
end;
$$;


-- ========================================================
-- FILE: 0006_screening_moderation.sql
-- ========================================================

-- ============================================================
-- JAN-SEVA — civic screening & moderation (spec §35)
-- ============================================================
-- Attached to the CANONICAL complaint. No alternate complaint model, no
-- duplicated citizen identity — a moderation case points at a complaint
-- id and an abuse profile points at an identity reference, and neither
-- copies anything it could have joined to.
--
-- The three-way separation from the type layer is preserved here on
-- purpose (spec §18):
--
--   image_analysis_results   what a model measured
--   risk_assessments         what our rules made of it
--   moderation_cases         what a human decided
--
-- They are separate tables rather than columns on `complaints` because
-- they have different lifetimes and different readers: an assessment is
-- immutable once written, a case is worked over 24 hours, and a profile
-- outlives both.

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------

create type moderation_case_state as enum (
  'PENDING_REVIEW',
  'UNDER_REVIEW',
  'VALIDATED',
  'DUPLICATE',
  'SPAM',
  'INVALID',
  'NEEDS_CLARIFICATION',
  'ESCALATED'
);

create type risk_level as enum ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- ------------------------------------------------------------
-- AI assessments — immutable measurements
-- ------------------------------------------------------------
--
-- One row per model call. Never updated: a decision made against an
-- assessment must remain reviewable against the assessment as it was,
-- and model precision (spec §38) cannot be measured against a record
-- that was edited after the fact.
--
-- `complaint_id` is nullable because an assessment can exist for a
-- submission that was BLOCKED and therefore never became a complaint
-- (spec §47). Those rows are how a false-positive rate on blocks is
-- measurable at all — without them, the citizens we turned away are
-- invisible.

create table image_analysis_results (
  id                uuid primary key default gen_random_uuid(),
  complaint_id      text references complaints(id) on delete cascade,

  -- Set when the model did not run. The whole row is then near-empty,
  -- which is correct: "not screened" is not a set of measurements.
  unavailable_reason text,

  civic_relevance   text,
  issue_category    text,
  issue_confidence  text,
  face_presence     boolean,
  face_dominance    text,
  portrait_likelihood text,
  screenshot_likelihood text,
  description_consistency text,
  image_quality     text,
  suspicious_signals text[] not null default '{}',
  ai_confidence     text,

  -- Provenance, always recorded (spec §34). A confidence with no model
  -- behind it is a fabricated number.
  model_provider    text,
  model_version     text,
  analyzed_at       timestamptz not null default now(),

  -- SHA-256 of the screened image, so an assessment can be matched back
  -- to the exact bytes and reused instead of re-billed (spec §32).
  image_sha256      text,

  created_at        timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Risk assessments — our own rules
-- ------------------------------------------------------------

create table risk_assessments (
  id             uuid primary key default gen_random_uuid(),
  complaint_id   text references complaints(id) on delete cascade,
  analysis_id    uuid references image_analysis_results(id) on delete set null,

  level          risk_level not null,
  score          integer not null,
  -- Each signal carries the weight it contributed, so an archived
  -- assessment stays explainable after the weights are retuned.
  signals        jsonb not null default '[]'::jsonb,

  -- What the gate did. 'BLOCK' rows have no complaint_id.
  decision       text not null check (decision in ('ALLOW','ALLOW_AND_MONITOR','ALLOW_AND_FLAG','BLOCK')),

  assessed_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Moderation cases — human authority
-- ------------------------------------------------------------

create table moderation_cases (
  complaint_id   text primary key references complaints(id) on delete cascade,
  state          moderation_case_state not null default 'PENDING_REVIEW',
  risk_id        uuid references risk_assessments(id) on delete set null,
  analysis_id    uuid references image_analysis_results(id) on delete set null,

  created_at     timestamptz not null default now(),
  -- created_at + 24h (spec §15, §16). Stored rather than computed so a
  -- policy change does not silently move every open deadline.
  review_due_at  timestamptz not null,

  opened_by      uuid references portal_users(id) on delete set null,
  opened_at      timestamptz,

  -- Decision. `reason` is NOT NULL-able in spirit and enforced by the
  -- constraint below: an outcome without a stated reason cannot be
  -- reviewed or appealed.
  outcome        text check (outcome in ('VALIDATED','DUPLICATE','SPAM','INVALID','NEEDS_CLARIFICATION')),
  reason         text,
  moderator_id   uuid references portal_users(id) on delete set null,
  moderated_at   timestamptz,

  constraint decision_is_complete
    check (
      (outcome is null and reason is null and moderated_at is null)
      or (outcome is not null and reason is not null and length(btrim(reason)) > 0 and moderated_at is not null)
    )
);

-- ------------------------------------------------------------
-- Abuse profiles (spec §21)
-- ------------------------------------------------------------
--
-- Keyed on the opaque identity reference. There is no citizen row to
-- join to and there is not meant to be: this records CONFIRMED
-- moderation outcomes against a verification, not a person's file.
--
-- Note the absence: there is no `banned` column, at any count. The
-- strongest state expressible here is `requires_manual_review`, which
-- slows a citizen's reports down and never stops them (spec §21, §22).

create table citizen_abuse_profiles (
  identity_reference     text primary key,
  confirmed_invalid_count integer not null default 0,
  confirmed_spam_count   integer not null default 0,
  warning_count          integer not null default 0,
  restriction_count      integer not null default 0,
  last_confirmed_abuse_at timestamptz,

  -- Always has an end. A null here means no cooldown, and a value in the
  -- past is simply expired — there is no way to express "forever".
  cooldown_until         timestamptz,
  requires_manual_review boolean not null default false,

  updated_at             timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Citizen warnings (spec §19, §29)
-- ------------------------------------------------------------
--
-- A queue, not a send. Delivery failure must never roll back the
-- moderation decision it followed (spec §47), so the decision commits
-- and a warning row is queued; the outbox drains separately and may
-- fail, retry or be suppressed without touching the case.

create table citizen_warnings (
  id                 uuid primary key default gen_random_uuid(),
  identity_reference text not null,
  complaint_id       text references complaints(id) on delete set null,
  kind               text not null check (kind in ('WARNING','WARNING_AND_COOLDOWN','MANUAL_REVIEW_REQUIRED')),
  message            text not null,
  -- Joins to notification_outbox once dispatched. Null while queued.
  outbox_id          uuid references notification_outbox(id) on delete set null,
  created_at         timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------

-- The moderator's queue: unreviewed, by deadline. Partial, so it stays
-- the size of the open work rather than of all history.
create index moderation_open_idx
  on moderation_cases (review_due_at)
  where outcome is null;

create index moderation_state_idx on moderation_cases (state, created_at desc);

-- Model quality measurement (spec §37, §38): flagged cases a human
-- decided, joined back to what the risk engine said.
create index risk_complaint_idx on risk_assessments (complaint_id);
create index risk_level_time_idx on risk_assessments (level, assessed_at desc);

-- Assessment reuse by image hash, so the same bytes are not re-billed.
create index analysis_sha_idx on image_analysis_results (image_sha256)
  where image_sha256 is not null;

create index analysis_complaint_idx on image_analysis_results (complaint_id)
  where complaint_id is not null;

create index warnings_identity_idx on citizen_warnings (identity_reference, created_at desc);

-- ------------------------------------------------------------
-- Row level security
-- ------------------------------------------------------------

alter table image_analysis_results   enable row level security;
alter table risk_assessments         enable row level security;
alter table moderation_cases         enable row level security;
alter table citizen_abuse_profiles   enable row level security;
alter table citizen_warnings         enable row level security;

-- Only admins read moderation material, and only through a select
-- policy — there is no insert, update or delete policy on any table
-- here. Every write goes through a server function that re-checks the
-- moderator's role, records the audit event and updates the complaint in
-- the same transaction (spec §45, §47). A direct table UPDATE from a
-- browser could record a decision and skip the audit row, so the client
-- is not given the option.

create policy moderation_admin_read on moderation_cases
  for select to authenticated using (auth_is_admin());

create policy risk_admin_read on risk_assessments
  for select to authenticated using (auth_is_admin());

create policy analysis_admin_read on image_analysis_results
  for select to authenticated using (auth_is_admin());

-- Abuse profiles and warnings have RLS on and NO policy at all: they
-- are reachable only with service_role. A queryable list of citizens
-- with confirmed strikes against them is not something any browser
-- session needs, including an administrator's — the moderation screen
-- shows one case at a time, resolved server-side.


-- ========================================================
-- FILE: 0007_sla_escalation_feedback.sql
-- ========================================================

-- ============================================================
-- JAN-SEVA — SLA events, escalations and feedback
-- ============================================================
-- Spec §24, §25, §26.
--
-- WHAT THIS ADDS, AND WHY IT IS NOT A DUPLICATE MODEL.
--
-- `complaints` already carries the CURRENT state of all three of these:
-- `sla_due_at` / `sla_state`, `escalated_at` / `escalation_level`, and a
-- `feedback` jsonb blob. That is enough to render a queue and nothing
-- else. It cannot answer:
--
--   when did this breach, and was anyone told?
--   how many times has this been escalated, by whom, and why?
--   did the citizen rate the first repair differently from the second?
--
-- Latest-state columns are a projection; these tables are the history
-- behind them. The columns on `complaints` stay exactly as they are and
-- remain the fast path for queue reads — nothing here replaces them, so
-- there is no second source of truth for "what is the state right now".
--
-- Every table here hangs off `complaints(id)`. Work orders deliberately
-- do NOT appear in this migration: see the note at the foot of the file.

-- ------------------------------------------------------------
-- SLA events (spec §24)
-- ------------------------------------------------------------
-- One row per SLA transition. `due_at` is copied in rather than joined
-- because the deadline itself moves — a reassignment restarts the clock,
-- and a breach recorded against the old deadline must keep the deadline
-- it was actually measured against.

create type sla_event_type as enum (
  'SLA_SET',
  'SLA_AT_RISK',
  'SLA_BREACHED',
  'SLA_MET',
  'ESCALATED'
);

create table sla_events (
  id            uuid primary key default gen_random_uuid(),
  complaint_id  text not null references complaints(id) on delete cascade,
  event_type    sla_event_type not null,

  -- The deadline this event was measured against, as it stood.
  due_at        timestamptz,
  occurred_at   timestamptz not null default now(),

  -- Which run of the clock produced this, so a reassignment's events do
  -- not read as repeated breaches of one deadline.
  cycle         integer not null default 1 check (cycle > 0),

  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),

  -- Demo rows never enter a real aggregate (spec §46).
  is_synthetic  boolean not null default false
);

-- A given cycle transitions to a given state once. A retried job or a
-- double-fired timer must not record two breaches of one deadline.
create unique index sla_events_once_per_cycle_idx
  on sla_events (complaint_id, event_type, cycle);

create index sla_events_complaint_time_idx
  on sla_events (complaint_id, occurred_at desc);

-- The operational query: what breached, most recent first.
create index sla_events_breach_idx
  on sla_events (event_type, occurred_at desc)
  where event_type in ('SLA_BREACHED', 'SLA_AT_RISK');

-- ------------------------------------------------------------
-- Escalations (spec §25)
-- ------------------------------------------------------------

create type escalation_trigger as enum (
  'SLA_BREACH',        -- the clock ran out
  'CITIZEN_REQUEST',   -- a citizen disputed or asked for re-inspection
  'REPEAT_FAILURE',    -- the asset failed again inside the warranty window
  'MANUAL'             -- a human decided
);

create table escalations (
  id              uuid primary key default gen_random_uuid(),
  complaint_id    text not null references complaints(id) on delete cascade,

  -- Roles, not user ids: an escalation travels up a chain of offices,
  -- and the office outlives the person sitting in it.
  from_role       portal_role,
  to_role         portal_role not null,

  trigger_type    escalation_trigger not null,
  reason          text not null,

  -- Who acted, where a human did. Null for a system escalation, which
  -- is honest — inventing an actor for an automatic trigger would put a
  -- name against a decision nobody made.
  raised_by       uuid references portal_users(id) on delete set null,
  acknowledged_by uuid references portal_users(id) on delete set null,

  created_at      timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at     timestamptz,

  is_synthetic    boolean not null default false,

  -- An escalation cannot be resolved before it was acknowledged, nor
  -- acknowledged before it was raised.
  constraint escalations_ack_after_raise
    check (acknowledged_at is null or acknowledged_at >= created_at),
  constraint escalations_resolved_after_raise
    check (resolved_at is null or resolved_at >= created_at)
);

create index escalations_complaint_idx
  on escalations (complaint_id, created_at desc);

-- The Command Centre's list: what is still open, oldest first, because
-- the oldest unacknowledged escalation is the one that matters.
create index escalations_open_idx
  on escalations (to_role, created_at)
  where acknowledged_at is null;

-- ------------------------------------------------------------
-- Feedback (spec §26)
-- ------------------------------------------------------------
-- The citizen's answer, kept apart from the department's claim.
--
-- A department closing a complaint sets `complaints.resolved_at`. THIS
-- table is the only place a citizen's own verdict is recorded, and the
-- two are never merged — that separation is the product's whole thesis
-- and the reason `citizen_verified` exists as its own column.

create type verification_response as enum (
  'CONFIRMED',              -- the citizen agrees it is fixed
  'DISPUTED',               -- it is not fixed
  'REINSPECTION_REQUESTED', -- fixed badly, look again
  'NO_RESPONSE'             -- the window closed with silence
);

create table feedback (
  id                 uuid primary key default gen_random_uuid(),
  complaint_id       text not null references complaints(id) on delete cascade,

  -- The reporter, as an opaque digest. There is no citizens table and no
  -- raw mobile number here for the same reason as everywhere else
  -- (spec §10): this record must not become a way to look a person up.
  identity_reference text,

  response           verification_response not null,
  rating             integer check (rating between 1 and 5),
  comment            text,

  -- Which resolution attempt this is about. A second repair gets a
  -- second row rather than overwriting the citizen's first answer.
  attempt            integer not null default 1 check (attempt > 0),

  created_at         timestamptz not null default now(),
  is_synthetic       boolean not null default false
);

-- One verdict per attempt. A resubmitted form must not stack ratings.
create unique index feedback_one_per_attempt_idx
  on feedback (complaint_id, attempt);

create index feedback_complaint_idx
  on feedback (complaint_id, created_at desc);

-- Satisfaction reporting reads only rated rows.
create index feedback_rating_idx
  on feedback (rating, created_at desc)
  where rating is not null;

-- ------------------------------------------------------------
-- Row level security (spec §32)
-- ------------------------------------------------------------
-- Same model as 0003: anon reads nothing directly, portal staff are
-- scoped by their portal_users row, service_role goes through the API
-- functions and re-derives scope there. The helpers come from 0003.
--
-- Every policy below is READ-ONLY. Writes to these tables happen in the
-- server functions under service_role, inside the same transaction as
-- the mutation they describe (spec §37) — an officer's session must not
-- be able to write its own SLA history or its own citizen feedback.

alter table sla_events   enable row level security;
alter table escalations  enable row level security;
alter table feedback     enable row level security;

-- Staff see SLA history for complaints their department may access.
create policy sla_events_department_read on sla_events
  for select to authenticated
  using (
    exists (
      select 1 from complaints c
      where c.id = sla_events.complaint_id
        and auth_can_access_department(c.department_id)
    )
  );

create policy escalations_department_read on escalations
  for select to authenticated
  using (
    exists (
      select 1 from complaints c
      where c.id = escalations.complaint_id
        and auth_can_access_department(c.department_id)
    )
  );

/**
 * Feedback is readable by the department it is about — an officer has to
 * be able to see that a citizen disputed their closure, or the dispute
 * is not actionable.
 *
 * `identity_reference` is exposed to nobody by this policy in any useful
 * form: it is a salted digest, and the public projection drops it
 * entirely (spec §34).
 */
create policy feedback_department_read on feedback
  for select to authenticated
  using (
    exists (
      select 1 from complaints c
      where c.id = feedback.complaint_id
        and auth_can_access_department(c.department_id)
    )
  );

-- ------------------------------------------------------------
-- NOT IN THIS MIGRATION: work_orders (spec §18)
-- ------------------------------------------------------------
-- Spec §18 asks for a `work_orders` table keyed to the civic issue, so
-- that three citizens reporting one pothole produce one repair job
-- rather than three (spec §14, §74).
--
-- That is the correct model and this schema does not implement it: work
-- state currently lives on `complaints` as `assigned_to`, `status`,
-- `sla_due_at`. Adding a work_orders table alongside those columns would
-- create exactly the duplicate system spec §8 forbids — two places
-- claiming to know who owns a job.
--
-- Doing it properly means MOVING that state off `complaints` and onto a
-- row keyed by `civic_issue_id`, which changes the shape every existing
-- query and repository reads. It is a restructure of 0001, not an
-- addition to it, and it needs a decision that is not this migration's
-- to make. Flagged rather than guessed at.

