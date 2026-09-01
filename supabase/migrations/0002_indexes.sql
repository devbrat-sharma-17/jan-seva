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
