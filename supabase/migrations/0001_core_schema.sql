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
