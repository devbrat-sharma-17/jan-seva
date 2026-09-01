import type { Complaint, PublicComplaint } from '../../types';
import { IntegrityBadge, IntegrityChecklist } from '../proof/IntegrityBadge';
import { useState } from 'react';
import '../proof/proof.css';

interface ProofOfRepairCardProps {
  complaint: PublicComplaint;
  /** The full record, available only once the reporter has verified. */
  verifiedComplaint: Complaint | null;
}

/**
 * What the citizen is shown about the department's evidence.
 *
 * Every civic app asks a department for a resolution photo. The
 * difference this card makes visible is that the photo was checked: it
 * was taken live in-app, at this location, on this device's clock, and
 * has never been submitted anywhere in the city before.
 *
 * The grade renders on the PUBLIC projection, because whether a repair
 * was evidenced is not private information — it is the whole point. The
 * per-check breakdown needs the full record and appears once verified.
 */
export function ProofOfRepairCard({ complaint, verifiedComplaint }: ProofOfRepairCardProps) {
  const [open, setOpen] = useState(false);

  if (complaint.status !== 'resolved') return null;

  const grade = complaint.evidenceGrade ?? verifiedComplaint?.resolution?.evidenceGrade;
  const checks = verifiedComplaint?.resolution?.captureIntegrity ?? [];

  // A resolution recorded before capture grading existed has no grade.
  // Saying so is better than implying a check that never ran.
  if (!grade) {
    return (
      <section className="proof-card">
        <h3 className="proof-card__title">Proof of repair</h3>
        <p className="proof-card__none">
          This resolution was recorded before capture verification was introduced, so its photo
          was not checked at the shutter. Newer resolutions carry a verification grade.
        </p>
      </section>
    );
  }

  return (
    <section className="proof-card">
      <div className="proof-card__head">
        <h3 className="proof-card__title">Proof of repair</h3>
        <IntegrityBadge grade={grade} />
      </div>

      <p className="proof-card__blurb">
        {grade === 'verified'
          ? 'The department’s photo was taken live in this app, at the location you reported, and had never been submitted anywhere in this city before.'
          : grade === 'unverified'
          ? 'The photo was taken live in the app, but one or more provenance checks could not be completed — usually because there was no location fix on site.'
          : 'The photo failed a provenance check. A resolution graded this way cannot close your complaint.'}
      </p>

      {checks.length > 0 ? (
        <>
          <button
            type="button"
            className="proof-card__toggle"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            {open ? 'Hide the checks' : `Show what was checked (${checks[0].checks.length})`}
          </button>
          {open && (
            <div className="proof-card__checks">
              {checks.map((integrity, index) => (
                <IntegrityChecklist key={index} integrity={integrity} />
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="proof-card__locked">
          Verify your identity above to see the individual checks that ran on this photo.
        </p>
      )}
    </section>
  );
}
