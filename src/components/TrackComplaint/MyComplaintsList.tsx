import { useEffect, useState } from 'react';
import type { Complaint, ComplaintStatus } from '../../types';
import { getByIdentity } from '../../services/complaintService';
import { useMyComplaints } from '../../hooks/useComplaintSync';
import { useIdentitySession } from '../../hooks/useIdentitySession';
import { ComplaintCard } from './ComplaintCard';
import { ComplaintListSkeleton } from './Skeletons';

interface MyComplaintsListProps {
  onSelectComplaint: (complaintId: string) => void;
  onNavigateReport: () => void;
  onSignOut: () => void;
  /** Called when the verified session has lapsed and must be re-established. */
  onNeedsVerification: () => void;
}

type FilterType = 'ALL' | ComplaintStatus;

const FILTERS: Array<{ id: FilterType; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'escalated', label: 'Escalated' },
];

function matchesFilter(complaint: Complaint, filter: FilterType): boolean {
  return filter === 'ALL' || complaint.status === filter;
}

export function MyComplaintsList({
  onSelectComplaint,
  onNavigateReport,
  onSignOut,
  onNeedsVerification,
}: MyComplaintsListProps) {
  const { identity, isVerified } = useIdentitySession();
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');

  const reference = identity?.reference ?? '';

  // The list is fetched by identity reference, never by raw input. An
  // unverified visitor has no reference, so this hook stays disabled and
  // there is no code path that populates it.
  const { complaints, loading } = useMyComplaints(() => getByIdentity(reference), isVerified);

  // The verified session has a TTL. If it lapses while this list is open,
  // hand control back rather than leaving stale complaints on screen.
  useEffect(() => {
    if (!isVerified) onNeedsVerification();
  }, [isVerified, onNeedsVerification]);

  if (!isVerified) return null;

  const filtered = complaints.filter((c) => matchesFilter(c, activeFilter));
  const countFor = (filter: FilterType) =>
    filter === 'ALL' ? complaints.length : complaints.filter((c) => matchesFilter(c, filter)).length;

  // Only offer filters that would actually return something.
  const availableFilters = FILTERS.filter((f) => f.id === 'ALL' || countFor(f.id) > 0);

  return (
    <div className="track-stack">
      <div className="citizen-banner">
        <div>
          <span className="citizen-banner__eyebrow">
            My complaints{complaints.length > 0 ? ` — ${complaints.length}` : ''}
          </span>
          <h2 className="citizen-banner__name">
            {identity?.name ? `Welcome back, ${identity.name}` : 'Your complaints'}
          </h2>
          <span className="citizen-banner__ident">{identity?.label}</span>
        </div>
        <button type="button" className="citizen-banner__switch" onClick={onSignOut}>
          Sign out
        </button>
      </div>

      {availableFilters.length > 2 && (
        <div className="filter-row" role="group" aria-label="Filter complaints by status">
          {availableFilters.map((f) => (
            <button
              key={f.id}
              type="button"
              className="filter-pill"
              // `aria-pressed` is what makes the active filter perceivable
              // without relying on the blue fill alone.
              aria-pressed={activeFilter === f.id}
              onClick={() => setActiveFilter(f.id)}
            >
              {f.label}
              <span className="filter-pill__count">{countFor(f.id)}</span>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <ComplaintListSkeleton rows={2} />
      ) : filtered.length === 0 ? (
        <div className="track-empty track-empty--muted">
          <h3 className="track-empty__title">
            {complaints.length === 0 ? 'No complaints yet' : 'Nothing in this filter'}
          </h3>
          <p className="track-empty__text">
            {complaints.length === 0
              ? 'Reports you submit through JAN-SEVA will appear here.'
              : 'Try a different status to see your other complaints.'}
          </p>
          {complaints.length === 0 && (
            <button
              type="button"
              className="report-btn report-btn--primary track-empty__single"
              onClick={onNavigateReport}
            >
              REPORT AN ISSUE
            </button>
          )}
        </div>
      ) : (
        <div className="complaint-grid">
          {filtered.map((c) => (
            <ComplaintCard key={c.id} complaint={c} onSelect={onSelectComplaint} />
          ))}
        </div>
      )}
    </div>
  );
}
