// ============================================================
// Admin — Open Civic Record
// ============================================================
// Municipal performance data in India is mostly reported by the
// municipality about itself. That is exactly the structure that produced
// the Swachh Survekshan credibility disputes. Publishing the record —
// with personal data absent by construction — is the cheapest
// credibility this platform can buy.

import { useCallback, useMemo, useState } from 'react';
import { getStoredComplaints } from '../../../services/complaintService';
import { toPublicComplaint } from '../../../services/privacyService';
import { getAssets, getRepairsForAsset } from '../../../services/assetService';
import {
  buildOpenDataBundle,
  buildServiceList,
  buildRequestFeed,
} from '../../../services/open311Service';
import { useLiveData } from '../../../hooks/useLiveData';
import '../admin-shared.css';
import './open-data.css';

export function AdminOpenData() {
  const complaints = useLiveData(useCallback(() => getStoredComplaints(), []));
  const [copied, setCopied] = useState(false);

  const bundle = useMemo(() => {
    const publicOnes = complaints.map((c) => toPublicComplaint(c));
    const assets = getAssets()
      .map((asset) => ({ asset, repairs: getRepairsForAsset(asset.id) }))
      .filter((row) => row.repairs.length > 0);

    return buildOpenDataBundle(publicOnes, assets);
  }, [complaints]);

  const services = useMemo(() => buildServiceList(), []);
  const sample = useMemo(
    () => buildRequestFeed(complaints.slice(0, 1).map((c) => toPublicComplaint(c)))[0],
    [complaints]
  );

  const download = () => {
    const blob = new Blob([bundle], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jan-seva-open311-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(bundle);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div className="admin-page-head__text">
          <h1 className="admin-page-title">Open civic record</h1>
          <p className="admin-page-desc">
            The complaint and repair record as open data, in Open311 GeoReport v2 shape. This is
            the answer to &ldquo;will this integrate with what the city already has?&rdquo; —
            a specification rather than a promise.
          </p>
        </div>
      </header>

      {/* --------------------------------------------------------
          Privacy is a property of the type system here, not of a
          reviewer's diligence, and the screen says which.
          -------------------------------------------------------- */}
      <section className="od-guarantee">
        <h2 className="od-guarantee__title">What is not in this feed, and why it cannot be</h2>
        <ul className="od-guarantee__list">
          <li>
            <strong>No reporter identity.</strong> The feed is built from{' '}
            <code>PublicComplaint</code>, which has no <code>reporter</code> field. A component
            cannot leak a name or number here even by mistake — the compiler stops it.
          </li>
          <li>
            <strong>No coordinates.</strong> GeoReport v2 permits <code>lat</code> and{' '}
            <code>long</code>. They are omitted: a complaint filed from a home address is
            re-identifiable from a point, and is not from a locality name.
          </li>
          <li>
            <strong>No photographs.</strong> Evidence images can carry faces, plates and door
            numbers. The evidence <em>hash</em> is published instead, so a repair stays checkable
            without the picture.
          </li>
          <li>
            <strong>No contractor attribution and no works cost.</strong> Naming a contractor in
            a public dataset on the strength of an automated attribution is the single most
            likely way to get this platform blocked at municipal level.
          </li>
        </ul>
      </section>

      <section className="od-services">
        <h2 className="admin-section-title">Service list</h2>
        <div className="od-services__grid">
          {services.map((service) => (
            <div key={service.service_code} className="od-service">
              <code>{service.service_code}</code>
              <span>{service.service_name}</span>
              <span className="od-service__group">{service.group}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="od-sample">
        <div className="od-sample__head">
          <h2 className="admin-section-title">Sample service request</h2>
          <div className="od-sample__actions">
            <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" onClick={copy}>
              {copied ? 'Copied' : 'Copy full bundle'}
            </button>
            <button type="button" className="admin-btn admin-btn--primary admin-btn--sm" onClick={download}>
              Download JSON
            </button>
          </div>
        </div>
        <pre className="od-sample__code">
          <code>{sample ? JSON.stringify(sample, null, 2) : 'No complaints to publish yet.'}</code>
        </pre>
      </section>

      <p className="od-footnote">
        A resolution the department has claimed but the citizen has not confirmed is reported as{' '}
        <code>open</code>, not <code>closed</code>. GeoReport has only two status values, and
        mapping a provisional close to <code>closed</code> would overstate it — which is the
        precise failure this platform exists to avoid.
      </p>
    </div>
  );
}
