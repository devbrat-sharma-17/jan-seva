// ============================================================
// Admin — Report review (spec §24, §25, §26)
// ============================================================
//
// The queue is ordered the way the work is actually done: overdue
// first, then by deadline, then by risk. A moderator opening this screen
// should be looking at the thing that matters most without filtering.
//
// Two rules govern everything rendered here:
//
//   1. The AI assessment is shown as SIGNALS, never as a verdict. There
//      is no copy anywhere on this screen that says a citizen did
//      something wrong — the strongest language available is "requires
//      review" (spec §26).
//   2. A decision needs a written reason before the buttons enable. Not
//      a nicety: an unexplained decision cannot be reviewed or appealed,
//      and the strike it may produce lands on a real person.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ModerationCase, ModerationOutcome } from '../../../types/screening';
import {
  getModerationQueue,
  getModerationStats,
  isOverdue,
  msUntilDue,
  openForReview,
  recordDecision,
  subscribeToModeration,
  type ModerationFilter,
} from '../../../services/moderationService';
import { describeAssessment } from '../../../services/citizenReportRiskService';
import { describeProvenance } from '../../../services/imageIntelligenceService';
import { getCurrentAdminUser } from '../../../services/authService';
import { getComplaintForActor } from '../../../services/complaintService';
import { queueWarning } from '../../../services/citizenWarningService';
import { CITIZEN_WARNING_ENABLED, MODERATION_ENABLED } from '../../../config/featureFlags';
import './moderation.css';

const FILTERS: Array<{ id: ModerationFilter; label: string }> = [
  { id: 'unreviewed', label: 'Unreviewed' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'due-soon', label: 'Due soon' },
  { id: 'high-risk', label: 'High risk' },
  { id: 'all', label: 'All' },
];

const OUTCOMES: Array<{ id: ModerationOutcome; label: string; tone?: 'valid' | 'adverse' }> = [
  { id: 'VALIDATED', label: 'Mark valid', tone: 'valid' },
  { id: 'DUPLICATE', label: 'Mark duplicate' },
  { id: 'NEEDS_CLARIFICATION', label: 'Request clarification' },
  { id: 'SPAM', label: 'Mark spam', tone: 'adverse' },
  { id: 'INVALID', label: 'Mark invalid', tone: 'adverse' },
];

/** Risk level -> the pill tone the rest of the admin already uses. */
const RISK_PILL: Record<string, string> = {
  LOW: 'admin-pill--success',
  MEDIUM: 'admin-pill--warning',
  HIGH: 'admin-pill--danger',
  CRITICAL: 'admin-pill--danger',
};

function formatDue(ms: number): string {
  if (ms <= 0) {
    const overdueHours = Math.floor(-ms / 3_600_000);
    return overdueHours >= 1 ? `${overdueHours}h overdue` : 'Overdue';
  }
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours}h left`;
  return `${Math.max(1, Math.floor(ms / 60_000))}m left`;
}

export function AdminModeration() {
  const [filter, setFilter] = useState<ModerationFilter>('unreviewed');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => subscribeToModeration(refresh), [refresh]);

  const admin = getCurrentAdminUser();

  const queue = useMemo(() => getModerationQueue(filter), [filter, tick]);
  const stats = useMemo(() => getModerationStats(), [tick]);
  const selected = useMemo(
    () => queue.find((c) => c.complaintId === selectedId) ?? null,
    [queue, selectedId]
  );

  const openCase = (moderationCase: ModerationCase) => {
    setSelectedId(moderationCase.complaintId);
    setReason('');
    setError(null);
    if (admin && !moderationCase.decision) {
      openForReview(
        { id: admin.id, name: admin.name, role: 'admin' },
        moderationCase.complaintId
      );
    }
  };

  const decide = (outcome: ModerationOutcome) => {
    if (!selected || !admin) return;
    const identityReference = getComplaintForActor(selected.complaintId)?.reporter
      ?.identityReference;

    try {
      const result = recordDecision({
        complaintId: selected.complaintId,
        outcome,
        reason,
        moderator: { id: admin.id, name: admin.name, role: 'admin' },
        identityReference,
      });

      // After the decision has committed, never before. A failure to
      // queue a notice must not cost us the decision (spec §47) — and
      // `queueWarning` cannot throw, so it cannot.
      queueWarning({
        action: result.abuseAction,
        identityReference,
        complaintId: selected.complaintId,
      });

      setSelectedId(null);
      setReason('');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That decision could not be recorded.');
    }
  };

  if (!MODERATION_ENABLED) {
    return (
      <div className="admin-page">
        <header className="admin-page-head">
          <div className="admin-page-head__text">
            <h1 className="admin-page-title">Report review</h1>
          </div>
        </header>
        <div className="admin-state">
          <p className="admin-page-desc">Report review is switched off in this environment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div className="admin-page-head__text">
          <h1 className="admin-page-title">Report review</h1>
          <p className="admin-page-desc">
            Submissions flagged by automated screening. Screening produces signals; every
            decision here is yours.
          </p>
        </div>
      </header>

      {/* The same KPI tiles the rest of the Command Centre uses, so this
          screen reads as part of it rather than as a bolted-on tool. */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-card__label">Pending</span>
          <span className="kpi-card__value">{stats.pending}</span>
        </div>

        <div className={`kpi-card${stats.overdue > 0 ? ' kpi-card--red' : ''}`}>
          <span className="kpi-card__label">Overdue</span>
          <span
            className={`kpi-card__value${stats.overdue > 0 ? ' kpi-card__value--danger' : ''}`}
          >
            {stats.overdue}
          </span>
        </div>

        <div className="kpi-card">
          <span className="kpi-card__label">Within 24h SLA</span>
          {/* Null reads as "not measured yet", never as 0% or 100%. */}
          <span className="kpi-card__value">
            {stats.slaCompliance === null ? '\u2014' : `${Math.round(stats.slaCompliance * 100)}%`}
          </span>
          <span className="kpi-card__sub">
            {stats.slaCompliance === null ? 'No cases decided yet' : 'Of decided cases'}
          </span>
        </div>

        <div className="kpi-card">
          <span className="kpi-card__label">Flags upheld</span>
          <span className="kpi-card__value">
            {stats.aiPrecision === null ? '\u2014' : `${Math.round(stats.aiPrecision * 100)}%`}
          </span>
          <span className="kpi-card__sub">
            {stats.aiPrecision === null ? 'Screening precision unmeasured' : 'Screening precision'}
          </span>
        </div>
      </div>

      {/* Model quality, stated plainly. If moderators overturn most flags
          the thresholds are wrong, and this is where that becomes
          visible (spec 38). */}
      {stats.aiFlaggedOverturned > 0 && (
        <div className="admin-card">
          <p className="admin-page-desc">
            <span className="admin-pill admin-pill--warning">Review thresholds</span>{' '}
            {stats.aiFlaggedOverturned} flagged submission
            {stats.aiFlaggedOverturned === 1 ? ' was' : 's were'} found valid on review.
            Screening thresholds should be revisited if this stays high.
          </p>
        </div>
      )}

      <div className="mod-filters" role="tablist" aria-label="Queue filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            className="mod-filter"
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {queue.length === 0 ? (
        <div className="admin-state">
          <p className="admin-page-desc">
            Nothing in this queue. Flagged submissions appear here within moments of being filed.
          </p>
        </div>
      ) : (
        <ul className="mod-list">
          {queue.map((c) => {
            const due = msUntilDue(c);
            const overdue = isOverdue(c);
            const decided = Boolean(c.decision);

            return (
              <li key={c.complaintId}>
                <button
                  type="button"
                  aria-expanded={selectedId === c.complaintId}
                  className={`mod-row mod-row--${c.risk.level.toLowerCase()}${
                    decided ? ' mod-row--decided' : ''
                  }`}
                  onClick={() => openCase(c)}
                >
                  <span
                    className={`admin-pill ${RISK_PILL[c.risk.level] ?? 'admin-pill--neutral'}`}
                  >
                    {c.risk.level.toLowerCase()}
                  </span>

                  <span className="mod-row__main">
                    <span className="mod-row__id">{c.complaintId}</span>
                    <span className="mod-row__reason">
                      {c.risk.signals[0]?.label ?? 'Flagged for review'}
                      {c.risk.signals.length > 1 && ` +${c.risk.signals.length - 1} more`}
                    </span>
                  </span>

                  <span
                    className={`mod-row__due${overdue && !decided ? ' mod-row__due--over' : ''}`}
                  >
                    {decided
                      ? c.decision!.outcome.replace(/_/g, ' ').toLowerCase()
                      : formatDue(due)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected && (
        <section className="admin-card" aria-label={`Review ${selected.complaintId}`}>
          <div className="mod-detail__head">
            <h2 className="mod-detail__id">{selected.complaintId}</h2>
            <Link
              className="admin-btn admin-btn--ghost admin-btn--sm"
              to={`/admin/complaints/${selected.complaintId}`}
            >
              Open full record
            </Link>
          </div>

          <div className="mod-panel">
            <h3 className="mod-panel__title">Automated assessment</h3>
            <ul className="mod-signals">
              {describeAssessment(selected.aiAssessment, selected.risk).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {/* Provenance, always. A submission nothing screened says so. */}
            <p className="mod-provenance">{describeProvenance(selected.aiAssessment)}</p>
          </div>

          <div className="mod-panel">
            <h3 className="mod-panel__title">Risk signals</h3>
            {selected.risk.signals.length === 0 ? (
              <p className="mod-hint">No signals recorded.</p>
            ) : (
              <ul className="mod-signals">
                {selected.risk.signals.map((s) => (
                  <li key={s.code}>
                    <span>{s.label}</span>
                    <span className="admin-pill admin-pill--neutral">
                      {s.source === 'ai' ? 'model' : s.source === 'history' ? 'history' : 'record'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selected.decision ? (
            <div className="mod-panel">
              <h3 className="mod-panel__title">Decision</h3>
              <p className="mod-signals">
                <span className="admin-pill admin-pill--neutral">
                  {selected.decision.outcome.replace(/_/g, ' ').toLowerCase()}
                </span>{' '}
                {selected.decision.moderatorId} {'\u00b7'}{' '}
                {new Date(selected.decision.moderatedAt).toLocaleString('en-IN')}
              </p>
              <p className="mod-reason-text">{selected.decision.reason}</p>
            </div>
          ) : (
            <div className="mod-panel">
              <h3 className="mod-panel__title">Record a decision</h3>

              <label className="admin-page-desc" htmlFor="mod-reason">
                Reason (required {'\u2014'} recorded in the audit trail)
              </label>
              <textarea
                id="mod-reason"
                className="mod-textarea"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="What you looked at, and what you concluded."
              />

              {CITIZEN_WARNING_ENABLED && (
                <p className="mod-hint">
                  <span className="admin-pill admin-pill--warning">Notice</span> Marking this spam
                  or invalid will send the citizen a notice if their mobile number was verified.
                </p>
              )}

              <div className="mod-actions">
                {OUTCOMES.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className={`admin-btn admin-btn--secondary admin-btn--sm${
                      o.tone ? ` mod-action--${o.tone}` : ''
                    }`}
                    disabled={!reason.trim()}
                    onClick={() => decide(o.id)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              {!reason.trim() && <p className="mod-hint">Enter a reason to enable these actions.</p>}

              {error && (
                <p className="mod-error" role="alert">
                  {error}
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
