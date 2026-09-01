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
