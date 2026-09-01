import { Link } from 'react-router-dom';
import type { AssetHistory } from '../../types/asset';
import { warrantyExpiryOf, isUnderWarranty } from '../../services/assetService';
import { IntegrityBadge } from '../proof/IntegrityBadge';
import { formatStamp, formatRelative } from '../../services/timeService';
import './assets.css';

interface AssetHistoryPanelProps {
  history: AssetHistory;
  /** Contractor names and costs render only for the Command Centre. */
  showAttribution?: boolean;
  /** Base path for complaint links, e.g. "/admin/complaints". */
  complaintBasePath?: string;
}

const KIND_LABEL: Record<string, string> = {
  'road-segment': 'Road segment',
  'streetlight-pole': 'Streetlight pole',
  'drain-node': 'Drain node',
  'bin-point': 'Bin point',
  footpath: 'Footpath',
  'public-utility': 'Public utility',
};

const rupees = (value: number) =>
  `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

/**
 * One asset's permanent record.
 *
 * This is the screen the whole asset layer exists to produce: what
 * failed here, how many times, what was done about it, and whether the
 * contractor who did the work is still liable for it.
 */
export function AssetHistoryPanel({
  history,
  showAttribution = false,
  complaintBasePath = '/admin/complaints',
}: AssetHistoryPanelProps) {
  const { asset, repairs, repeatFailures } = history;
  const claimable = repeatFailures.filter((f) => f.withinWarranty);

  return (
    <section className="asset-panel">
      <header className="asset-panel__head">
        <div>
          <p className="asset-panel__id">{asset.id}</p>
          <h2 className="asset-panel__name">{asset.name}</h2>
          <p className="asset-panel__meta">
            {KIND_LABEL[asset.kind] ?? asset.kind}
            {asset.lengthMetres ? ` · ${asset.lengthMetres} m` : ''} · {asset.locality} · Ward{' '}
            {asset.wardId}
          </p>
        </div>

        <dl className="asset-panel__counts">
          <div>
            <dt>Complaints</dt>
            <dd>{history.totalComplaints}</dd>
          </div>
          <div>
            <dt>Repairs</dt>
            <dd>{history.totalRepairs}</dd>
          </div>
          <div>
            <dt>Repeat failures</dt>
            <dd className={repeatFailures.length > 0 ? 'is-alert' : undefined}>
              {repeatFailures.length}
            </dd>
          </div>
        </dl>
      </header>

      {/* --------------------------------------------------------
          The finding that converts a complaint into money.
          -------------------------------------------------------- */}
      {claimable.length > 0 && (
        <div className="asset-warranty" role="status">
          <div className="asset-warranty__icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <strong>
              Repeat failure inside the contractor&rsquo;s defect liability period
            </strong>
            {claimable.map((failure) => (
              <p key={failure.complaintId}>
                {failure.assetName} failed again {failure.daysSinceRepair} days after a repair
                completed on {formatStamp(failure.repair.completedAt)}. That repair carries a{' '}
                {failure.repair.defectLiabilityMonths}-month DLP running to{' '}
                {failure.warrantyExpiresAt ? formatStamp(failure.warrantyExpiresAt) : 'an unrecorded date'}.
                {failure.recoverableEstimate !== null
                  ? ` This is a warranty claim of about ${rupees(failure.recoverableEstimate)}, not a new municipal expense.`
                  : ' No works cost was recorded against that repair, so the recoverable value is unpriced.'}
              </p>
            ))}
            {showAttribution ? (
              <p className="asset-warranty__attribution">
                Recorded contractor:{' '}
                {claimable[0].repair.contractorName ?? 'not recorded'} (
                {claimable[0].repair.contractorId ?? 'no ID'}). Internal only — attribution
                requires human confirmation before any claim is raised, and is never published.
              </p>
            ) : (
              <p className="asset-warranty__attribution">
                Contractor attribution is held in the Command Centre and is not published.
              </p>
            )}
          </div>
        </div>
      )}

      {history.medianDaysBetweenRepairs !== null && history.totalRepairs > 1 && (
        <p className="asset-panel__cadence">
          Repaired {history.totalRepairs} times, a median of{' '}
          <strong>{history.medianDaysBetweenRepairs} days</strong> apart.
        </p>
      )}

      <h3 className="asset-panel__section">Repair ledger</h3>

      {repairs.length === 0 ? (
        <p className="asset-panel__empty">
          No repair has ever been recorded against this asset.
        </p>
      ) : (
        <ol className="asset-ledger">
          {repairs.map((repair) => {
            const expiry = warrantyExpiryOf(repair);
            const live = isUnderWarranty(repair);

            return (
              <li key={repair.id} className="asset-ledger__entry">
                <div className="asset-ledger__marker" aria-hidden="true" />
                <div className="asset-ledger__body">
                  <div className="asset-ledger__row">
                    <span className="asset-ledger__date">{formatStamp(repair.completedAt)}</span>
                    <span className="asset-ledger__age">{formatRelative(repair.completedAt)}</span>
                    {repair.captureGrade && (
                      <IntegrityBadge grade={repair.captureGrade} size="sm" />
                    )}
                  </div>

                  <p className="asset-ledger__note">{repair.note}</p>

                  <div className="asset-ledger__tags">
                    {expiry && (
                      <span
                        className={`asset-tag${live ? ' asset-tag--warranty' : ''}`}
                        title={`Defect liability period: ${repair.defectLiabilityMonths} months`}
                      >
                        {live ? 'Under warranty to ' : 'Warranty expired '}
                        {formatStamp(expiry)}
                      </span>
                    )}
                    {repair.crew && <span className="asset-tag">{repair.crew}</span>}
                    {/* Attribution and cost are Command Centre only. */}
                    {showAttribution && repair.contractorName && (
                      <span className="asset-tag asset-tag--internal">
                        {repair.contractorName}
                      </span>
                    )}
                    {showAttribution && repair.costEstimate && (
                      <span className="asset-tag asset-tag--internal">
                        {rupees(repair.costEstimate)}
                      </span>
                    )}
                    {repair.complaintId && (
                      <Link
                        className="asset-tag asset-tag--link"
                        to={`${complaintBasePath}/${repair.complaintId}`}
                      >
                        {repair.complaintId}
                      </Link>
                    )}
                  </div>

                  {repair.evidenceHash && (
                    <p className="asset-ledger__hash">
                      Evidence fingerprint <code>{repair.evidenceHash}</code> — published, so this
                      repair stays checkable without publishing the photograph.
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <h3 className="asset-panel__section">Complaints against this asset</h3>

      {history.complaintIds.length === 0 ? (
        <p className="asset-panel__empty">Nothing has been reported here.</p>
      ) : (
        <ul className="asset-panel__complaints">
          {history.complaintIds.map((id) => (
            <li key={id}>
              <Link to={`${complaintBasePath}/${id}`}>{id}</Link>
            </li>
          ))}
        </ul>
      )}

      <p className="asset-panel__caveat">
        Asset geometry in this build is seeded for Gwalior rather than imported from a municipal
        GIS. The ledger, the snapping and the defect-liability arithmetic are real; the inventory
        is not. Assets carry no personal data, which is what makes this record safe to publish.
      </p>
    </section>
  );
}
