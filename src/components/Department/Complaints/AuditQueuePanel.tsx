import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getDepartmentAuditQueue,
  recordAuditReinspection,
} from '../../../services/complaintService';
import { AUDIT_SAMPLE_RATE } from '../../../services/verificationService';
import { useLiveData } from '../../../hooks/useLiveData';
import { useToast } from '../../ui/Toast';
import { formatRelative } from '../../../services/timeService';
import type { DepartmentUser } from '../../../types/department';
import './audit-queue.css';

interface AuditQueuePanelProps {
  user: DepartmentUser;
}

/**
 * Independent re-inspection of a sampled closure.
 *
 * Random audit sampling is standard public-sector audit practice, and it
 * is the only mechanism in this product that constitutes FIELD
 * validation — the thing a Washington DC rat-infestation model lacked
 * when it validated on held-out 311 data and then failed against actual
 * inspections.
 *
 *   The officer who closed the job cannot audit it. That is enforced in
 *   the mutation layer, not here, so no screen can accidentally allow
 *   it — but the queue below is also pre-filtered, so an officer is
 *   never shown work they are not permitted to sign off.
 */
export function AuditQueuePanel({ user }: AuditQueuePanelProps) {
  const queue = useLiveData(
    useCallback(
      () => getDepartmentAuditQueue(user.departmentId, user.name),
      [user.departmentId, user.name]
    )
  );

  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  const samplePercent = useMemo(() => Math.round(AUDIT_SAMPLE_RATE * 100), []);

  const submit = async (complaintId: string, outcome: 'upheld' | 'failed') => {
    if (!note.trim()) {
      showToast('Record what you found before signing off.', 'warning');
      return;
    }

    setBusy(true);
    try {
      const result = await recordAuditReinspection(complaintId, outcome, note.trim());
      if (result.ok) {
        showToast(
          outcome === 'upheld'
            ? 'Re-inspection recorded. The closure stands.'
            : 'Re-inspection recorded. The complaint has been reopened.',
          outcome === 'upheld' ? 'success' : 'warning'
        );
        setOpenId(null);
        setNote('');
      } else {
        showToast(result.message, 'warning');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="audit-panel">
      <header className="audit-panel__head">
        <h2 className="audit-panel__title">Independent re-inspection</h2>
        <span className="audit-panel__rate">{samplePercent}% sample</span>
      </header>

      <p className="audit-panel__lead">
        A fixed share of citizen-confirmed closures is drawn for a second look by an officer who
        did not do the work. Sampling is deterministic from the complaint ID, so a decision is
        reproducible from the record rather than re-rolled on each visit.
      </p>

      {queue.length === 0 ? (
        <p className="audit-panel__empty">
          Nothing in your re-inspection queue. Closures you signed yourself are excluded — you
          cannot audit your own work.
        </p>
      ) : (
        <ul className="audit-list">
          {queue.slice(0, 5).map((complaint) => (
            <li key={complaint.id} className="audit-item">
              <div className="audit-item__head">
                <Link className="audit-item__id" to={`/department/complaints/${complaint.id}`}>
                  {complaint.id}
                </Link>
                <span className="audit-item__age">
                  closed {formatRelative(complaint.resolution?.resolvedAt ?? complaint.updatedAt)}
                </span>
              </div>

              <p className="audit-item__title">{complaint.issue.title}</p>
              <p className="audit-item__closed-by">
                Closed by {complaint.resolution?.resolvedBy ?? 'an officer'} ·{' '}
                {complaint.location.locality}
              </p>

              {openId === complaint.id ? (
                <div className="audit-item__form">
                  <textarea
                    className="dept-form-textarea"
                    rows={2}
                    placeholder="What did you find on site?"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <div className="audit-item__actions">
                    <button
                      type="button"
                      className="dept-modal-btn dept-modal-btn--success"
                      disabled={busy}
                      onClick={() => void submit(complaint.id, 'upheld')}
                    >
                      Closure upheld
                    </button>
                    <button
                      type="button"
                      className="dept-modal-btn dept-modal-btn--secondary"
                      disabled={busy}
                      onClick={() => void submit(complaint.id, 'failed')}
                    >
                      Failed — reopen
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="audit-item__start"
                  onClick={() => {
                    setOpenId(complaint.id);
                    setNote('');
                  }}
                >
                  Record re-inspection
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
