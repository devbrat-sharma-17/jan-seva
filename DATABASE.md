# JAN-SEVA — Database

## Status, stated plainly

**Nothing in this document has ever run.**

There is no Supabase project. The migrations in `supabase/migrations/`
were written against environment-variable placeholders and have never
been applied to a live Postgres. The application does not import a
Supabase client — `@supabase/supabase-js` is not a dependency, and no
file in `src/` references it.

The running application's source of truth is **browser `localStorage`**,
via `src/services/complaintService.ts` (key `jan_seva_complaints_v3`).

So this file describes a schema that is *designed and reviewable*, not
one that is *deployed and verified*. Every "PASS" you might want here is
currently "not yet run". The section [Bringing it up](#bringing-it-up)
is the gap.

---

## Architecture, intended

```
Browser
  ↓  (anon key, RLS-enforced reads; no privileged credential)
Server functions  (api/, Vercel)
  ↓  (service_role, re-deriving scope from the session every time)
Supabase
  ├── PostgreSQL + PostGIS
  ├── Auth        → portal_users
  ├── Storage     → private evidence buckets
  └── Realtime    → department queue, admin ops
```

The rule the schema is built around: **the browser never holds a
privileged credential, and the server never trusts a scope the client
sent.** Role, department and city are read from `portal_users` keyed on
`auth.uid()`, which only Supabase Auth can set.

---

## Tables

### Organisation

| Table | Purpose |
|---|---|
| `cities` | Municipal areas. Gwalior is the only live one. |
| `departments` | PWD, Sanitation, Water, Electrical, Infrastructure. |
| `portal_users` | Staff accounts, mapped 1:1 to `auth.users` by id. Carries `role`, `department_id`, `city_id` — the scope every RLS policy reads. |
| `ticket_sequences` | Per-city counter behind `next_complaint_id()`. |

Roles: `admin`, `department_head`, `nodal_officer`, `field_officer`.

No passwords are stored here. Credentials belong to Supabase Auth.

### The civic record

| Table | Purpose |
|---|---|
| `civic_issues` | The real-world physical problem (one pothole). |
| `complaints` | One citizen's report about a civic issue. PK is the human-readable id, e.g. `JS-GWL-2026-001284`. |
| `civic_assets` | Streetlights, road segments, drains. |
| `asset_repairs` | Repair ledger, the basis of repeat-failure detection. |

**Issue vs report** is the separation the product depends on: three
citizens reporting one pothole produce **one** `civic_issue` and
**three** `complaints`, each with its own independent verification.

### Evidence

| Table | Purpose |
|---|---|
| `evidence` | Metadata + storage path. Carries `sha256`, `phash`, capture timestamps, location, integrity state. |
| `evidence_hashes` | City-wide reuse index. |

Image binaries live in Storage, never in a row.

### History and oversight

| Table | Purpose |
|---|---|
| `timeline_events` | The citizen-visible narrative. `visibility` splits public from internal. |
| `audit_events` | The operational record. Not the same thing as the timeline, deliberately. |
| `sla_events` | *(0007)* One row per SLA transition, with the deadline it was measured against. |
| `escalations` | *(0007)* Who escalated what to which office, and why. |
| `feedback` | *(0007)* The citizen's own verdict, one row per resolution attempt. |

`complaints` keeps latest-state columns (`sla_state`, `escalated_at`,
`feedback` jsonb) as the fast path for queue reads. The 0007 tables are
the **history behind** those columns, not a competing source of truth.

### Screening and moderation

`image_analysis_results`, `risk_assessments`, `moderation_cases`,
`citizen_abuse_profiles`, `citizen_warnings`.

The model's assessment and a human's decision are separate rows, on
purpose. No punitive action is keyed to an AI probability alone.

### Machinery

`otp_challenges` (never stores an OTP value), `rate_limits`,
`sync_operations` (idempotency keys), `notification_outbox` (stores an
identity reference, never a phone number).

---

## Identity

There is **no `citizens` table**, and that is a design decision rather
than an omission. The product model (spec §31) is that a citizen has no
permanent account: they return with a complaint ID or a verified mobile
lookup. A table keyed by mobile number would be a directory of residents
and their grievances — the exact artefact worth breaching.

What is stored on `complaints`:

- `identity_reference` — an opaque, server-salted digest
- `identity_masked` — `+91 XXXXX 43210`, the only display form
- `identity_expires_at` — when the reporter columns must be cleared

**No raw Aadhaar number is stored anywhere.** Aadhaar remains a future
verification abstraction, not an integration.

---

## Location

Two coordinate pairs, never merged:

- `lat` / `lng` — the **confirmed issue location**. Drives routing,
  clustering, asset snapping. A manual correction updates this.
- `gps_lat` / `gps_lng` / `gps_accuracy_m` — **where the device was** at
  capture. Evidence only. A manual correction never touches it.

`geog` is a generated `geography(Point,4326)` column with a GIST index,
on `complaints`, `civic_issues` and `civic_assets`.

---

## Row level security

Enabled on every application table. The model:

| Role | Access |
|---|---|
| `anon` | **Nothing directly.** Public tracking goes through a server function returning a redacted projection. Knowing a ticket ID is not something RLS can verify. |
| `authenticated` | Portal staff, scoped by their `portal_users` row. |
| `service_role` | Server functions only. Bypasses RLS by design, so each one re-derives scope from the session. |

Helpers in `0003_rls.sql`: `auth_portal_role()`, `auth_department_id()`,
`auth_city_id()`, `auth_is_admin()`, `auth_can_access_department()`. All
`SECURITY DEFINER` + `STABLE`.

The predicate that matters: a Water officer typing a Roads complaint ID
into the address bar hits `auth_can_access_department()` and is refused
at the database, not by a route guard.

---

## Retention

Three independent clocks. Public visibility expiring does **not** delete
the civic record.

| Field | Governs |
|---|---|
| `identity_expires_at` | When reporter columns are cleared |
| `is_publicly_trackable` | Whether `/track` will return it |
| `asset_repairs` | Permanent repair history |

---

## Demo vs production

`is_synthetic boolean not null default false` on every table that holds
complaint-derived data. Demo rows and real rows never mix in an
aggregate. Production initialisation creates departments, categories,
city config and SLA config — and **zero complaints**.

---

## Bringing it up

These are the steps that have not been done. None of them can be done
from inside this repository.

### 1. Create the Supabase project

At [supabase.com](https://supabase.com), new project, region
`ap-south-1` (Mumbai) — it is the closest to Gwalior and keeps citizen
data in India.

### 2. Enable PostGIS

In the SQL editor:

```sql
create extension if not exists postgis;
```

The migrations assume it. `0001` will fail without it.

### 3. Apply the migrations, in order

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

`0001` → `0007`. They have never been run; expect to fix things.

> **Validating the SQL without a cloud project.** The migrations can be
> proved to apply cleanly on a local Postgres first, which costs nothing
> and needs no credentials:
>
> ```bash
> npx supabase start      # boots local Postgres + Auth + Storage
> npx supabase db reset   # applies 0001 → 0007 from scratch
> ```
>
> This requires **Docker Desktop**, which is not installed on this
> machine — it is why the migrations in this repository are still
> unexecuted. `supabase start` is the cheapest way to find the errors in
> them before they meet a real project. The Supabase CLI alone is not
> enough: every `supabase db` subcommand needs either this local stack
> or a linked remote database.

### 4. Put the credentials where they belong

**Local** — `.env.local`, which is gitignored:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

**Vercel** — project → Settings → Environment Variables:

| Variable | Scope | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | all | Public by design |
| `VITE_SUPABASE_ANON_KEY` | all | Publishable; RLS is what makes it safe |
| `SUPABASE_URL` | server | |
| `SUPABASE_SERVICE_ROLE_KEY` | server | **Never** `VITE_` prefixed |
| `APP_MODE` | server | `production` |

> The `VITE_` prefix means "ship this to the browser". Putting the
> service role key behind it publishes a credential that bypasses every
> RLS policy in the project. If that ever happens, rotate it in the
> Supabase dashboard immediately.

Do not paste any of these into source control.

### 5. Create the storage buckets

Private, not public:

- `citizen-report-evidence`
- `resolution-evidence`

Object naming: `city/entity/year/month/uuid.ext`. A user-supplied
filename is never an authorization identifier.

### 6. Then — and only then — the repository layer

The application still reads `localStorage`. Connecting it means writing
`SupabaseComplaintRepository` behind a `ComplaintRepository` interface,
with `LocalDemoComplaintRepository` kept for demo mode.

This is the large remaining piece. `complaintService.ts` is ~70 KB of
mostly **synchronous** functions (`getStoredComplaints(): Complaint[]`),
and every component calling them assumes synchronous returns. A network
-backed repository is necessarily async, so the swap is a sync → async
refactor across the service and its call sites — not a drop-in.

### 7. Verify what this document claims

None of the following has been run:

- migrations apply cleanly
- RLS denies cross-department reads
- RLS denies anonymous reads
- public projection omits identity
- storage policies deny unauthorized objects
- idempotency prevents duplicate mutations
- optimistic concurrency returns CONFLICT

Treat each as unproven until you have run it.

---

## Backups

**Not verified.** Supabase's backup guarantees depend on the project's
plan — Free retains no point-in-time recovery. Check the actual plan
before making any claim about recoverability. This project has no plan
because it has no project.
