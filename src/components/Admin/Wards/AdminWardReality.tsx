// ============================================================
// Admin — Ward Reality Index
// ============================================================
// The screen that inverts the hotspot map. Every civic dashboard shows
// where the noise is. This one shows where the silence is.

import { useCallback, useMemo } from 'react';
import { getStoredComplaints } from '../../../services/complaintService';
import { getWardReality, WARD_INDEX_CAVEAT } from '../../../services/wardService';
import { useLiveData } from '../../../hooks/useLiveData';
import type { WardReality } from '../../../types/field';
import '../admin-shared.css';
import './wards.css';

const SIGNAL_LABEL: Record<WardReality['signal'], string> = {
  silent: 'Silent',
  'under-reported': 'Under-reported',
  expected: 'As expected',
  'over-reported': 'Over-reported',
};

export function AdminWardReality() {
  const complaints = useLiveData(useCallback(() => getStoredComplaints(), []));
  const wards = useMemo(() => getWardReality(complaints), [complaints]);

  const silent = wards.filter((w) => w.signal === 'silent' || w.signal === 'under-reported');

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div className="admin-page-head__text">
          <h1 className="admin-page-title">Ward reality index</h1>
          <p className="admin-page-desc">
            Complaint volume normalised by each ward&rsquo;s population and estimated access, so
            &ldquo;most complaints&rdquo; stops being mistaken for &ldquo;worst conditions&rdquo;.
          </p>
        </div>
      </header>

      {/* ----------------------------------------------------------
          The uncertainty is displayed, not buried. A confident and
          wrong equity claim is worse than no equity claim at all, and
          this is the surface where that mistake would be made.
          ---------------------------------------------------------- */}
      <p className="ward-caveat" role="note">
        <strong>Illustrative.</strong> {WARD_INDEX_CAVEAT}
      </p>

      {/* The screen nobody builds. */}
      <section className="ward-silent">
        <h2 className="ward-silent__title">
          Silent wards
          <span className="ward-silent__count">{silent.length}</span>
        </h2>
        <p className="ward-silent__lead">
          Areas reporting far below what their population and access would predict. Low reporting
          is an attention item, not good performance — the literature on 311 equity is clear that
          the propensity to complain tracks income, literacy and connectivity, so a
          complaint-driven service allocation systematically over-serves the already-served.
        </p>

        {silent.length === 0 ? (
          <p className="ward-silent__empty">
            No ward is reporting materially below expectation right now.
          </p>
        ) : (
          <ul className="ward-silent__list">
            {silent.map((row) => (
              <li key={row.ward.id} className="ward-silent__item">
                <div className="ward-silent__head">
                  <span className="ward-silent__name">
                    {row.ward.name} <span className="ward-silent__id">{row.ward.id}</span>
                  </span>
                  <span className={`ward-signal ward-signal--${row.signal}`}>
                    {SIGNAL_LABEL[row.signal]}
                  </span>
                </div>
                <p className="ward-silent__reading">{row.interpretation}</p>
                <p className="ward-silent__numbers">
                  {row.observedComplaints} observed vs {row.expectedComplaints.toFixed(1)} expected
                  · population {row.ward.population.toLocaleString('en-IN')} · access index{' '}
                  {row.ward.connectivityIndex.toFixed(2)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ward-table-wrap">
        <h2 className="admin-section-title">All wards</h2>
        <div className="ward-table-scroll">
          <table className="ward-table">
            <thead>
              <tr>
                <th scope="col">Ward</th>
                <th scope="col">Observed</th>
                <th scope="col">Expected</th>
                <th scope="col">Ratio</th>
                <th scope="col">Signal</th>
                <th scope="col">Resolved</th>
                <th scope="col">SLA breached</th>
              </tr>
            </thead>
            <tbody>
              {wards.map((row) => (
                <tr key={row.ward.id}>
                  <th scope="row">
                    {row.ward.name}
                    <span className="ward-table__zone">{row.ward.zone}</span>
                  </th>
                  <td>{row.observedComplaints}</td>
                  <td>{row.expectedComplaints.toFixed(1)}</td>
                  <td className="ward-table__ratio">{row.reportingRatio.toFixed(2)}×</td>
                  <td>
                    <span className={`ward-signal ward-signal--${row.signal}`}>
                      {SIGNAL_LABEL[row.signal]}
                    </span>
                  </td>
                  <td>{row.resolvedCount}</td>
                  <td>{row.slaBreachedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="ward-method">
        <strong>Method.</strong> Expected volume distributes the city total across wards in
        proportion to population × estimated reporting propensity, where propensity is 0.65 ×
        connectivity + 0.35 × literacy. It is deliberately simple enough to read in the source.
        A production version needs real census ward tables, device-penetration data and prior
        reporting rates, plus a proper reporting-bias estimator — until it has those, this is a
        demonstration of the correction, not a measurement of Gwalior.
      </p>
    </div>
  );
}
