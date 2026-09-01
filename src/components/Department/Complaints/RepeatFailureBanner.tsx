import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Complaint } from '../../../types';
import { detectRepeatFailure, assetForComplaint } from '../../../services/assetService';
import { formatStamp } from '../../../services/timeService';
import '../../Assets/assets.css';

interface RepeatFailureBannerProps {
  complaint: Complaint;
}

/**
 * Told to the crew BEFORE they patch it again.
 *
 * A repeat failure is a different job from a first-time report: the
 * previous repair did not hold, so re-doing the same work the same way
 * is likely to produce a third complaint. It is also, inside a defect
 * liability period, someone else's cost.
 *
 * Attribution is shown here because the department portal is internal.
 * It is never published, and a claim against a contractor still needs a
 * human to confirm it.
 */
export function RepeatFailureBanner({ complaint }: RepeatFailureBannerProps) {
  const failure = useMemo(() => detectRepeatFailure(complaint), [complaint]);
  const asset = useMemo(() => assetForComplaint(complaint), [complaint]);

  // Not a repeat failure, but still worth naming the asset — an officer
  // who knows the asset ID can look up its history in one step.
  if (!failure) {
    if (!asset) return null;
    return (
      <p className="rf-asset-note">
        On asset <code>{asset.id}</code> — {asset.name}.{' '}
        <Link to="/admin/assets">View repair ledger</Link>
      </p>
    );
  }

  return (
    <section className="asset-warranty rf-banner" role="alert">
      <div className="asset-warranty__icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>

      <div>
        <strong>This asset has failed before</strong>
        <p>
          <code>{failure.assetId}</code> was repaired {failure.daysSinceRepair} days ago, on{' '}
          {formatStamp(failure.repair.completedAt)}: &ldquo;{failure.repair.note}&rdquo; Re-doing
          the same work the same way is likely to produce a third complaint — check the ledger
          before dispatching.
        </p>

        {failure.withinWarranty ? (
          <p className="rf-banner__claim">
            <strong>Inside the defect liability period.</strong> That repair carries a{' '}
            {failure.repair.defectLiabilityMonths}-month DLP running to{' '}
            {failure.warrantyExpiresAt ? formatStamp(failure.warrantyExpiresAt) : 'an unrecorded date'}
            {failure.repair.contractorName ? `, held by ${failure.repair.contractorName}` : ''}.
            Raise this with the works department before booking new expenditure.
          </p>
        ) : (
          <p className="rf-banner__claim">
            The defect liability on that repair has expired, so this is a fresh municipal cost.
          </p>
        )}

        <p className="asset-warranty__attribution">
          Internal only. Contractor attribution is never published and requires human
          confirmation before any claim is raised.
        </p>
      </div>
    </section>
  );
}
