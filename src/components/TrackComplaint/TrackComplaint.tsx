import { useCallback, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useComplaintSync } from '../../hooks/useComplaintSync';
import { useIdentitySession } from '../../hooks/useIdentitySession';
import { TrackHeader } from './TrackHeader';
import { TrackSearchForm } from './TrackSearchForm';
import { MyComplaintsList } from './MyComplaintsList';
import { IdentityVerification } from './IdentityVerification';
import { ComplaintDetailView } from './ComplaintDetailView';
import { ComplaintDetailSkeleton } from './Skeletons';
import { ExpiredNotice } from './ExpiredNotice';
import { NotFoundNotice } from './NotFoundNotice';
import './TrackComplaint.css';

/**
 * `/track` has one URL-addressable state — a complaint being viewed, via
 * `?id=` — and three transient ones. Keeping the search and verification
 * modes out of the URL means a shared link never resumes mid-verification.
 */
type Mode = 'search' | 'identity' | 'my-complaints';

export function TrackComplaint() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryId = searchParams.get('id');

  const { identity, isVerified, signOut } = useIdentitySession();
  const [mode, setMode] = useState<Mode>('search');

  const {
    publicComplaint,
    verifiedComplaint,
    outcome,
    loading,
    refreshing,
    lastSyncedAt,
    refresh,
    clockTick,
  } = useComplaintSync(queryId);

  const openComplaint = (id: string) => setSearchParams({ id });

  const requireVerification = useCallback(() => setMode('identity'), []);

  const backToSearch = () => {
    setSearchParams({});
    // Returning from a complaint lands on the list for a verified citizen,
    // and on the search field for everyone else.
    setMode(isVerified ? 'my-complaints' : 'search');
  };

  const headerTitle = queryId && publicComplaint ? `Ticket ${publicComplaint.id}` : 'Track complaint';

  const handleBack = () => {
    if (queryId) {
      backToSearch();
      return;
    }
    if (mode !== 'search') {
      setMode('search');
      return;
    }
    navigate('/');
  };

  return (
    <div className="track-container">
      <div className="track-shell">
        <TrackHeader title={headerTitle} onBack={handleBack} />

        <div className="track-body">
          {/* ---- A complaint is addressed in the URL ---- */}
          {queryId ? (
            <>
              {loading && <ComplaintDetailSkeleton />}

              {!loading && outcome?.kind === 'expired' && (
                <ExpiredNotice
                  resolvedAt={outcome.resolvedAt}
                  onBack={backToSearch}
                  onFindMine={() => {
                    setSearchParams({});
                    setMode(isVerified ? 'my-complaints' : 'identity');
                  }}
                />
              )}

              {!loading && outcome?.kind === 'not-found' && (
                <NotFoundNotice
                  complaintId={queryId}
                  onBack={backToSearch}
                  onFindMine={() => {
                    setSearchParams({});
                    setMode(isVerified ? 'my-complaints' : 'identity');
                  }}
                />
              )}

              {!loading && publicComplaint && (
                <ComplaintDetailView
                  complaint={publicComplaint}
                  verifiedComplaint={verifiedComplaint}
                  refreshing={refreshing}
                  lastSyncedAt={lastSyncedAt}
                  clockTick={clockTick}
                  onRefresh={refresh}
                />
              )}
            </>
          ) : (
            <>
              {/* ---- Default: search only. No complaint list is shown
                       to an unverified visitor. ---- */}
              {mode === 'search' && (
                <TrackSearchForm
                  onSearch={openComplaint}
                  onFindMyComplaints={() => setMode(isVerified ? 'my-complaints' : 'identity')}
                  verifiedName={identity?.name}
                  isVerified={isVerified}
                />
              )}

              {mode === 'identity' && (
                <IdentityVerification
                  purpose="my-complaints"
                  onVerified={() => setMode('my-complaints')}
                  onCancel={() => setMode('search')}
                />
              )}

              {mode === 'my-complaints' && (
                <MyComplaintsList
                  onSelectComplaint={openComplaint}
                  onNavigateReport={() => navigate('/report')}
                  onSignOut={() => {
                    signOut();
                    setMode('search');
                  }}
                  onNeedsVerification={requireVerification}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
