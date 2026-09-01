// ============================================================
// Admin — Civic Asset Ledger
// ============================================================
// The screen that answers "has this been fixed before, did it hold, and
// is the contractor still liable" — three questions no complaint app in
// this category can answer at all.

import { useCallback, useMemo, useState } from 'react';
import { getStoredComplaints } from '../../../services/complaintService';
import {
  getAssetHistory,
  getAssetsByActivity,
  getWarrantyExposure,
} from '../../../services/assetService';
import { useLiveData } from '../../../hooks/useLiveData';
import { AssetHistoryPanel } from '../../Assets/AssetHistoryPanel';
import { AdminIcon } from '../AdminIcon';
import { PreMonsoonPanel } from './PreMonsoonPanel';
import '../admin-shared.css';
import '../../Assets/assets.css';

const rupees = (value: number) =>
  `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export function AdminAssetLedger() {
  const complaints = useLiveData(useCallback(() => getStoredComplaints(), []));

  const rows = useMemo(() => getAssetsByActivity(complaints, 20), [complaints]);
  const exposure = useMemo(() => getWarrantyExposure(complaints), [complaints]);

  // Open on the asset with the most repeat failures — the one worth
  // looking at, rather than whatever sorts first alphabetically.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = selectedId ?? rows[0]?.asset.id ?? null;

  const history = useMemo(
    () => (activeId ? getAssetHistory(activeId, complaints) : null),
    [activeId, complaints]
  );

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div className="admin-page-head__text">
          <h1 className="admin-page-title">Civic asset ledger</h1>
          <p className="admin-page-desc">
            Complaints anchored to infrastructure, with every repair on the asset&rsquo;s permanent
            record. A repeat failure inside a contractor&rsquo;s defect liability period is a
            warranty claim, not a new municipal expense.
          </p>
        </div>
      </header>

      {/* ----------------------------------------------------------
          The finance line. This is the number that changes who the
          product is sold to.
          ---------------------------------------------------------- */}
      <section className="asset-exposure">
        <div className="asset-exposure__figure">
          <span className="asset-exposure__label">Recoverable under warranty</span>
          <span className="asset-exposure__value">
            {exposure.recoverableTotal > 0 ? rupees(exposure.recoverableTotal) : '—'}
          </span>
          <span className="asset-exposure__note">
            {exposure.inWarranty.length} repeat failure
            {exposure.inWarranty.length === 1 ? '' : 's'} inside a recorded defect liability
            period
            {exposure.unpricedCount > 0
              ? `, of which ${exposure.unpricedCount} carries no recorded works cost and is therefore unpriced.`
              : '.'}
          </span>
        </div>

        <div className="asset-exposure__figure">
          <span className="asset-exposure__label">Repeat failures, all causes</span>
          <span className="asset-exposure__value">{exposure.failures.length}</span>
          <span className="asset-exposure__note">
            Assets that failed again within 180 days of a recorded repair.
          </span>
        </div>

        <p className="asset-exposure__caveat">
          Recoverable value counts only failures with both a live warranty and a recorded works
          cost. Failures missing either contribute nothing rather than an assumed average — an
          inflated figure is the fastest way to lose this conversation with a finance officer.
        </p>
      </section>

      <PreMonsoonPanel complaints={complaints} />

      <div className="asset-ledger-layout">
        <aside className="asset-index" aria-label="Assets by activity">
          <h2 className="asset-index__title">Assets by activity</h2>
          <ul className="asset-index__list">
            {rows.map((row) => (
              <li key={row.asset.id}>
                <button
                  type="button"
                  className={`asset-index__item${row.asset.id === activeId ? ' is-active' : ''}`}
                  onClick={() => setSelectedId(row.asset.id)}
                  aria-current={row.asset.id === activeId ? 'true' : undefined}
                >
                  <span className="asset-index__id">{row.asset.id}</span>
                  <span className="asset-index__name">{row.asset.name}</span>
                  <span className="asset-index__counts">
                    {row.complaints} report{row.complaints === 1 ? '' : 's'} · {row.repairs} repair
                    {row.repairs === 1 ? '' : 's'}
                    {row.repeatFailures > 0 && (
                      <span className="asset-index__flag">
                        {row.repeatFailures} repeat
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {rows.length === 0 && (
            <p className="asset-index__empty">
              No complaint has snapped to a known asset yet.
            </p>
          )}
        </aside>

        <div className="asset-ledger-layout__detail">
          {history ? (
            <AssetHistoryPanel history={history} showAttribution />
          ) : (
            <div className="admin-empty">
              <AdminIcon name="map" />
              <p>Select an asset to see its repair history.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
