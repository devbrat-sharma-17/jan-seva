// ============================================================
// Complaint detail panels — department view
// ============================================================
// Split out of ComplaintDetailView so the screen reads as its hierarchy
// rather than as one 400-line render, and so the admin detail view can
// reuse the same panels instead of growing a second copy.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Complaint } from '../../../types';
import type { AuditEvent } from '../../../types/audit';
import { computeSlaHealth } from '../../../services/slaService';
import { explainPriority } from '../../../services/aiService';
import { formatDateLong, formatRelative } from '../../../services/timeService';
import { AUDIT_ACTION_LABELS } from '../../../services/auditService';

// ------------------------------------------------------------
// SLA
// ------------------------------------------------------------

/**
 * Human states, not a ticking clock. A second-by-second countdown on an
 * operations screen reads as an alarm and pulls attention away from the
 * queue; "8h remaining" is the same information and stays still.
 */
export function SlaPanel({ complaint }: { complaint: Complaint }) {
  const health = computeSlaHealth(complaint);
  if (!health) return null;

  const state =
    health.status === 'exceeded'
      ? { label: 'Breached', tone: 'breached', detail: `Exceeded by ${health.label}` }
      : health.status === 'approaching'
      ? { label: 'At risk', tone: 'atrisk', detail: `${health.label} remaining` }
      : health.status === 'met'
      ? { label: 'Met', tone: 'met', detail: health.headline }
      : { label: 'On track', tone: 'normal', detail: `${health.label} remaining` };

  return (
    <section className={`dept-card dept-sla-card dept-sla-card--${state.tone}`}>
      <h2 className="dept-card__title">Service level</h2>

      <p className="dept-sla-card__state">{state.label}</p>
      <p className="dept-sla-card__detail">{state.detail}</p>

      <div
        className="dept-sla-card__track"
        role="img"
        aria-label={`${Math.round(health.progress * 100)}% of the SLA window elapsed`}
      >
        <span className="dept-sla-card__fill" style={{ width: `${Math.round(health.progress * 100)}%` }} />
      </div>

      <p className="dept-sla-card__due">
        Target {formatDateLong(complaint.sla.dueAt)}
      </p>

      {complaint.sla.escalatedAt && (
        <p className="dept-sla-card__escalated">
          Escalated {formatRelative(complaint.sla.escalatedAt)}
          {complaint.sla.escalatedTo ? ` to ${complaint.sla.escalatedTo}` : ''}
        </p>
      )}
    </section>
  );
}

// ------------------------------------------------------------
// Priority rationale
// ------------------------------------------------------------

/**
 * Only shown for work that is actually urgent. A "why this is medium
 * priority" panel on every routine complaint trains people to skip the
 * box on the one that matters.
 */
export function PriorityReasonPanel({ complaint }: { complaint: Complaint }) {
  const priority = explainPriority(complaint);
  if (priority.level !== 'critical' && priority.level !== 'high') return null;

  return (
    <section className={`dept-card dept-why-card dept-why-card--${priority.level}`}>
      <h2 className="dept-card__title">Why this is {priority.level} priority</h2>
      <ul className="dept-why-card__list">
        {priority.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </section>
  );
}

// ------------------------------------------------------------
// Automated triage
// ------------------------------------------------------------

export function AiAnalysisPanel({ complaint }: { complaint: Complaint }) {
  const ai = complaint.aiAnalysis;
  const priority = explainPriority(complaint);

  const facts: Array<{ label: string; value: string }> = [
    { label: 'Category', value: ai?.categoryTitle || complaint.issue.category || '—' },
    { label: 'Severity', value: ai?.severity ?? 'medium' },
    { label: 'Priority', value: priority.level },
    {
      label: 'Confidence',
      value: ai?.confidenceScore ? `${Math.round(ai.confidenceScore)}%` : '—',
    },
    { label: 'Department', value: complaint.department.name },
    {
      label: 'Duplicate',
      value: complaint.duplicate?.isLinked
        ? `Linked to ${complaint.duplicate.primaryIssueId ?? 'a primary issue'}`
        : 'No matching issue',
    },
  ];

  return (
    <section className="dept-card dept-ai-card">
      <div className="dept-card__header">
        <h2 className="dept-card__title">Automated triage</h2>
        {/* Named for what it is. A confidence figure derived from a
            keyword margin must not be read as model confidence. */}
        <span className="demo-tag">Keyword match</span>
      </div>

      <dl className="dept-ai-card__facts">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ------------------------------------------------------------
// Linked civic issue
// ------------------------------------------------------------

export function DuplicatePanel({ complaint }: { complaint: Complaint }) {
  const dup = complaint.duplicate;
  if (!dup?.isLinked) return null;

  return (
    <section className="dept-card dept-linked-card">
      <h2 className="dept-card__title">Linked civic issue</h2>

      <dl className="dept-linked-card__facts">
        <div>
          <dt>Primary issue</dt>
          <dd>{dup.primaryIssueId ?? dup.civicIssueId ?? '—'}</dd>
        </div>
        <div>
          <dt>Citizen reports</dt>
          <dd>{dup.supportingCount ?? 1}</dd>
        </div>
      </dl>

      {dup.primaryTitle && <p className="dept-linked-card__title">{dup.primaryTitle}</p>}

      {dup.primaryIssueId && (
        <Link
          to={`/department/complaints/${dup.primaryIssueId}`}
          className="dept-action-btn dept-action-btn--secondary dept-action-btn--sm dept-action-btn--block"
        >
          View primary issue
        </Link>
      )}
    </section>
  );
}

// ------------------------------------------------------------
// Before / after evidence
// ------------------------------------------------------------

/**
 * Two labelled columns rather than a drag-handle slider: the photos are
 * taken from different positions on different days, so a wipe comparison
 * would imply an alignment that is not there. Both scroll horizontally
 * on a phone instead of shrinking to thumbnails.
 */
export function BeforeAfterEvidence({ complaint }: { complaint: Complaint }) {
  const before = complaint.photos ?? [];
  const after = complaint.resolution?.evidencePhotos ?? [];

  if (before.length === 0 && after.length === 0) return null;

  return (
    <section className="dept-card">
      <h2 className="dept-card__title">Evidence</h2>

      <div className="dept-ba">
        <div className="dept-ba__col">
          <p className="dept-ba__label">
            Before <span>reported by the citizen</span>
          </p>
          {before.length > 0 ? (
            <div className="dept-ba__strip">
              {before.map((photo, i) => (
                <a key={i} href={photo} target="_blank" rel="noopener noreferrer" className="dept-ba__shot">
                  <img src={photo} alt={`Reported condition ${i + 1}`} loading="lazy" decoding="async" />
                </a>
              ))}
            </div>
          ) : (
            <p className="dept-ba__empty">No photo was attached to the report.</p>
          )}
        </div>

        <div className="dept-ba__col">
          <p className="dept-ba__label">
            After <span>submitted by the field team</span>
          </p>
          {after.length > 0 ? (
            <div className="dept-ba__strip">
              {after.map((photo, i) => (
                <a key={i} href={photo} target="_blank" rel="noopener noreferrer" className="dept-ba__shot">
                  <img src={photo} alt={`Completed work ${i + 1}`} loading="lazy" decoding="async" />
                </a>
              ))}
            </div>
          ) : (
            <p className="dept-ba__empty">Not submitted yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------
// Audit log
// ------------------------------------------------------------

/**
 * Internal accountability record, deliberately separate from the
 * citizen-facing timeline above it. Collapsed by default: it answers
 * "who did this", which is a question people ask occasionally, not the
 * one they open the record for.
 */
export function AuditPanel({ events }: { events: AuditEvent[] }) {
  const [open, setOpen] = useState(false);

  if (events.length === 0) return null;

  return (
    <section className="dept-card dept-audit">
      <button
        type="button"
        className="dept-audit__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="dept-card__title">Audit log · {events.length}</span>
        <span className={`dept-audit__chevron${open ? ' is-open' : ''}`} aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {open && (
        <>
          <p className="dept-audit__note">
            Internal record of who acted on this complaint. Not shown to the citizen.
          </p>
          <ol className="dept-audit__list">
            {events.map((evt) => (
              <li key={evt.id}>
                <span className="dept-audit__action">{AUDIT_ACTION_LABELS[evt.action]}</span>
                <span className="dept-audit__desc">{evt.description}</span>
                <span className="dept-audit__meta">
                  {evt.actorName} · {formatDateLong(evt.timestamp)}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
