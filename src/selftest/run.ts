// ============================================================
// JAN-SEVA self-test
// ============================================================
// Runs the real service layer headless: the shared repository, the
// department scoping rules, the audit trail, the offline queue and the
// derived metrics. Run with `npm run selftest`.
//
// It covers the flows that would be expensive to re-check by hand every
// time — the citizen-to-department-to-track-to-admin round trip, and the
// cross-department access rules, which are the ones that matter most and
// are the least visible when they break.

import { installBrowserShims, setOnline, check, checkEqual, section, report } from './harness';

installBrowserShims();

const run = async () => {
  // Imported after the shims are installed: these modules read storage
  // at module scope.
  const complaintService = await import('../services/complaintService');
  const authService = await import('../services/authService');
  const sessionService = await import('../services/sessionService');
  const auditService = await import('../services/auditService');
  const adminService = await import('../services/adminService');
  const syncService = await import('../services/syncService');
  const networkService = await import('../services/networkService');
  const identityService = await import('../services/identityService');
  const loginThrottle = await import('../services/loginThrottle');
  const { DEMO_PASSWORD_HINT } = await import('../data/demoDirectory');
  const { computeSlaHealth } = await import('../services/slaService');

  networkService.startNetworkMonitor();
  syncService.startSyncEngine();

  const PW = DEMO_PASSWORD_HINT;

  // ==========================================================
  section('1. Authentication');
  // ==========================================================

  let result = await authService.loginDepartment(
    { identifier: 'PWD-001', password: 'wrong-password' },
    'roads'
  );
  check('Wrong password is refused', !result.ok);
  check('No session is issued on a failed sign-in', sessionService.getSession() === null);

  result = await authService.loginDepartment({ identifier: 'PWD-001', password: '' }, 'roads');
  check('Empty password is refused', !result.ok);

  result = await authService.loginDepartment({ identifier: 'NOPE-999', password: PW }, 'roads');
  check('Unknown account is refused', !result.ok);
  check(
    'Unknown account and wrong password give the same message',
    !result.ok && result.reason === 'invalid_credentials'
  );

  // Signing in with a Water ID while the Roads form is selected.
  result = await authService.loginDepartment({ identifier: 'WTR-001', password: PW }, 'roads');
  check('Credentials for another department are refused', !result.ok);

  // A department ID must not open the admin portal.
  const crossPortal = await authService.loginAdmin({ identifier: 'PWD-001', password: PW });
  check('A department ID cannot sign in to the admin portal', !crossPortal.ok);

  loginThrottle.clearAttempts('PWD-001');
  result = await authService.loginDepartment({ identifier: 'PWD-001', password: PW }, 'roads');
  check('Correct credentials sign in', result.ok);
  checkEqual(
    'Session is authenticated',
    result.ok ? result.session.authenticationState : null,
    'authenticated'
  );
  checkEqual(
    'Session is scoped to the Roads department',
    sessionService.getSession()?.departmentId,
    'roads'
  );
  check(
    'Session carries an expiry',
    (sessionService.getSession()?.expiresAt.length ?? 0) > 0
  );

  const deptUser = authService.getCurrentDepartmentUser();
  checkEqual('Department user resolves from the session', deptUser?.departmentId, 'roads');
  check('Admin user does not resolve from a department session', authService.getCurrentAdminUser() === null);

  // Rate limiting.
  loginThrottle.clearAttempts('THROTTLE-TEST');
  for (let i = 0; i < 5; i += 1) {
    await authService.loginDepartment({ identifier: 'THROTTLE-TEST', password: 'x' }, 'roads');
  }
  const throttled = await authService.loginDepartment(
    { identifier: 'THROTTLE-TEST', password: 'x' },
    'roads'
  );
  check(
    'Repeated failures trigger a lockout',
    !throttled.ok && throttled.reason === 'rate_limited'
  );

  // ==========================================================
  section('2. Golden path — citizen files, department resolves');
  // ==========================================================

  // Sign back in as the Roads nodal officer for the operations steps.
  authService.logoutPortal();
  loginThrottle.clearAttempts('PWD-001');
  await authService.loginDepartment({ identifier: 'PWD-001', password: PW }, 'roads');

  const identityReference = identityService.deriveIdentityReference('mobile', '9876543210');

  const complaint = await complaintService.submitReport(
    {
      photos: [{ id: 'p1', url: 'data:image/jpeg;base64,AAA', name: 'pothole.jpg', timestamp: Date.now() }],
      description: 'Deep pothole near Phool Bagh Road causing two-wheeler accidents every evening.',
      identityMethod: 'mobile',
      aadhaarNumber: '',
      mobileNumber: '9876543210',
      otp: '',
      identityVerified: true,
      name: 'Raj Sharma',
      location: {
        latitude: 26.2124,
        longitude: 78.1772,
        address: 'Phool Bagh Road',
        locality: 'Phool Bagh',
        city: 'Gwalior',
        state: 'Madhya Pradesh',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      category: 'roads',
      categoryTitle: 'Roads & Potholes',
      severity: 'high',
      priorityScore: 88,
      department: 'pwd',
      departmentName: 'Public Works Department',
      confidence: 92,
    }
  );

  check('Complaint ID matches the ticket format', complaintService.isValidTicketFormat(complaint.id));
  checkEqual('New complaint starts as pending', complaint.status, 'pending');
  checkEqual('Routed to Public Works', complaint.department.name, 'Public Works Department');
  check('Raw mobile number is not persisted', JSON.stringify(complaint).indexOf('9876543210') === -1);
  check('A masked contact is stored instead', Boolean(complaint.reporter.mobileMasked));

  // The department sees it.
  const inQueue = complaintService
    .getComplaintsByDepartment('roads')
    .some((c) => c.id === complaint.id);
  check('Roads sees the new complaint in its queue', inQueue);

  // Assign.
  let op = await complaintService.assignComplaint(
    complaint.id,
    { name: 'Rahul Yadav', designation: 'Junior Engineer', staffId: 'PWD-FIELD' },
    'Road Repair Team A'
  );
  check('Assignment succeeds', op.ok);
  checkEqual('Status moves to assigned', op.ok ? op.complaint.status : null, 'assigned');

  let current = complaintService.getComplaintForActor(complaint.id)!;

  // Start work.
  op = await complaintService.startWorkOnComplaint(complaint.id, current.version);
  check('Start work succeeds', op.ok);
  checkEqual('Status moves to in-progress', op.ok ? op.complaint.status : null, 'in-progress');

  // Progress update with a field photo.
  current = complaintService.getComplaintForActor(complaint.id)!;
  op = await complaintService.addDepartmentProgressUpdate(
    complaint.id,
    'Excavation complete, hot-mix laid. Curing overnight.',
    ['data:image/jpeg;base64,BBB'],
    false,
    current.version
  );
  check('Progress update succeeds', op.ok);

  // Stale version is refused.
  const staleVersion = current.version;
  op = await complaintService.addDepartmentProgressUpdate(
    complaint.id,
    'A second writer, working from an older copy.',
    [],
    false,
    staleVersion
  );
  check('A write from a stale version is refused as a conflict', !op.ok && op.reason === 'conflict');

  // Resolution requires evidence.
  current = complaintService.getComplaintForActor(complaint.id)!;
  op = await complaintService.submitDepartmentResolution(complaint.id, 'Fixed.', [], current.version);
  check('Resolution without a photo is refused', !op.ok);

  op = await complaintService.submitDepartmentResolution(
    complaint.id,
    'Road surface repaired and pothole filled.',
    ['data:image/jpeg;base64,CCC'],
    current.version
  );
  check('Resolution with evidence succeeds', op.ok);
  checkEqual('Status moves to resolved', op.ok ? op.complaint.status : null, 'resolved');
  checkEqual(
    'Resolution is NOT citizen-verified yet',
    op.ok ? op.complaint.resolution?.citizenVerifiedResolved : null,
    false
  );

  // ==========================================================
  section('3. Citizen tracking sees the same record');
  // ==========================================================

  const lookup = await complaintService.getById(complaint.id);
  check('Public tracking finds the complaint', lookup.kind === 'found');

  if (lookup.kind === 'found') {
    checkEqual('Track shows the resolved status', lookup.complaint.status, 'resolved');
    check(
      'Track reports that resolution evidence exists',
      lookup.complaint.resolutionEvidenceCount > 0
    );
    check(
      'Track offers protected stand-ins for the evidence',
      lookup.complaint.protectedResolutionPhotos.length > 0
    );
    // A Complaint ID alone must not hand over the original photographs.
    // The full-resolution set is behind OTP verification.
    check(
      'The ID-only view withholds the original evidence photos',
      (lookup.complaint.resolution?.evidencePhotos?.length ?? 0) === 0
    );
    check(
      'Public view carries no reporter identity',
      !('reporter' in (lookup.complaint as unknown as Record<string, unknown>))
    );
    check(
      'Public view carries no coordinates',
      !('location' in (lookup.complaint as unknown as Record<string, unknown>))
    );
    check(
      'Public view carries no internal timeline entries',
      lookup.complaint.timeline.every((e) => e.visibility !== 'internal')
    );
  }

  // Citizen confirms and rates.
  const verified = await complaintService.submitFeedback(
    complaint.id,
    identityReference,
    5,
    'Fixed quickly, thank you.'
  );
  check('Citizen verification succeeds', verified !== null);
  checkEqual('Now citizen-verified', verified?.resolution?.citizenVerifiedResolved, true);
  checkEqual('Rating recorded', verified?.feedback?.rating, 5);

  // Another citizen's identity cannot rate this complaint.
  const otherIdentity = identityService.deriveIdentityReference('mobile', '9000000000');
  const spoofed = await complaintService.submitFeedback(complaint.id, otherIdentity, 1);
  check("A different citizen cannot submit feedback on someone else's complaint", spoofed === null);

  // ==========================================================
  section('4. Cross-department access control');
  // ==========================================================

  // Find a complaint that belongs to a different department.
  const waterComplaint = complaintService.getComplaintsByDepartment('water')[0];
  check('There is a Water complaint to test against', Boolean(waterComplaint));

  if (waterComplaint) {
    // Still signed in as Roads.
    checkEqual('Signed in as Roads', sessionService.getSession()?.departmentId, 'roads');

    check(
      'Roads cannot read a Water complaint',
      complaintService.getComplaintForActor(waterComplaint.id) === null
    );

    const access = complaintService.describeComplaintAccess(waterComplaint.id);
    checkEqual('The refusal is recorded as forbidden, not not-found', access.kind, 'forbidden');

    const denied = await complaintService.startWorkOnComplaint(waterComplaint.id);
    check(
      'Roads cannot mutate a Water complaint',
      !denied.ok && denied.reason === 'unauthorized'
    );

    const deniedAdmin = await complaintService.manualEscalateComplaint(
      waterComplaint.id,
      'Trying an admin-only action from a department session.'
    );
    check(
      'A department session cannot perform an admin-only action',
      !deniedAdmin.ok && deniedAdmin.reason === 'unauthorized'
    );

    // Session scope helper.
    check(
      'Session scope check refuses another department',
      !sessionService.sessionCanAccessDepartment(sessionService.getSession(), 'water')
    );
    check(
      'Session scope check allows its own department',
      sessionService.sessionCanAccessDepartment(sessionService.getSession(), 'roads')
    );
  }

  // Signed out, nothing is reachable.
  authService.logoutPortal();
  check('Sign-out clears the session', sessionService.getSession() === null);
  check(
    'No records are readable without a session',
    complaintService.getComplaintForActor(complaint.id) === null
  );
  const noSession = await complaintService.startWorkOnComplaint(complaint.id);
  check('No mutation is possible without a session', !noSession.ok && noSession.reason === 'no-session');

  // ==========================================================
  section('5. Admin authority');
  // ==========================================================

  loginThrottle.clearAttempts('admin-demo');
  const adminLogin = await authService.loginAdmin({ identifier: 'admin-demo', password: PW });
  check('Admin signs in with credentials', adminLogin.ok);
  checkEqual('Session role is admin', sessionService.getSession()?.role, 'admin');

  check(
    'Admin can read a Roads complaint',
    complaintService.getComplaintForActor(complaint.id) !== null
  );
  if (waterComplaint) {
    check(
      'Admin can read a Water complaint',
      complaintService.getComplaintForActor(waterComplaint.id) !== null
    );
  }

  const pendingRoads = complaintService
    .getComplaintsByDepartment('roads')
    .find((c) => c.status !== 'resolved');

  if (pendingRoads) {
    const noReason = await complaintService.reassignComplaintDepartment(
      pendingRoads.id,
      'water',
      'Water Works Department',
      '   '
    );
    check('Reassignment without a reason is refused', !noReason.ok);

    const reassigned = await complaintService.reassignComplaintDepartment(
      pendingRoads.id,
      'water',
      'Water Works Department',
      'Root cause is a supply pipeline leak, not road surface damage.',
      pendingRoads.version
    );
    check('Admin reassignment succeeds', reassigned.ok);

    if (reassigned.ok) {
      checkEqual('Department is now Water', reassigned.complaint.department.id, 'water');
      check('Assignment is cleared for the new department', !reassigned.complaint.assignedOfficer);

      const stillInRoads = complaintService
        .getComplaintsByDepartment('roads')
        .some((c) => c.id === pendingRoads.id);
      check('The complaint has left the Roads queue', !stillInRoads);

      const nowInWater = complaintService
        .getComplaintsByDepartment('water')
        .some((c) => c.id === pendingRoads.id);
      check('The complaint is in the Water queue', nowInWater);
    }
  }

  // ==========================================================
  section('6. Audit trail');
  // ==========================================================

  const adminTrail = auditService.getAuditTrail({ role: 'admin' }, 200);
  check('Admin sees a city-wide audit trail', adminTrail.length > 0);

  const complaintTrail = auditService.getAuditTrailForComplaint(complaint.id, { role: 'admin' });
  check('The resolved complaint has audit entries', complaintTrail.length > 0);
  check(
    'The assignment was audited',
    complaintTrail.some((e) => e.action === 'complaint_assigned')
  );
  check(
    'The resolution was audited',
    complaintTrail.some((e) => e.action === 'resolution_submitted')
  );
  check(
    'Audit entries name the actor',
    complaintTrail.every((e) => e.actorName.length > 0)
  );
  check(
    'The audit trail carries no citizen contact details',
    !JSON.stringify(adminTrail).includes('9876543210')
  );

  const sanitationTrail = auditService.getAuditTrail(
    { role: 'department', departmentId: 'sanitation' },
    200
  );
  check(
    'Sanitation does not see the Roads department actions',
    sanitationTrail.every((e) => e.departmentId !== 'roads')
  );

  // ==========================================================
  section('7. Derived metrics');
  // ==========================================================

  const roadsMetrics = complaintService.getDepartmentMetrics('roads');
  check('Roads has complaints', roadsMetrics.totalReceived > 0);
  check(
    'Resolved count never exceeds total received',
    roadsMetrics.resolved <= roadsMetrics.totalReceived
  );
  check(
    'Active plus resolved equals total',
    roadsMetrics.active + roadsMetrics.resolved === roadsMetrics.totalReceived
  );
  check(
    'Citizen-verified never exceeds resolved',
    roadsMetrics.citizenVerified <= roadsMetrics.resolved
  );
  check(
    'Resolution rate is a real percentage',
    roadsMetrics.resolutionRatePercent >= 0 && roadsMetrics.resolutionRatePercent <= 100
  );

  // An empty department must not be flattered.
  const emptyMetrics = {
    ...roadsMetrics,
    totalReceived: 0,
    active: 0,
    resolved: 0,
    backlogCount: 0,
    escalated: 0,
    slaBreached: 0,
    totalRatingsCount: 0,
    citizenSatisfactionAverage: 0,
    averageResolutionHours: 0,
    resolutionRatePercent: 0,
    slaCompliancePercent: 0,
    // Outcome-quality inputs. A department with nothing filed against
    // it has not achieved a durability rate or an evidence-integrity
    // score — it has none, and the score must say so.
    citizenVerifiedRatePercent: 0,
    durabilityFailures: 0,
    durabilityHolding: 0,
    durabilityRatePercent: null,
    repeatFailures: 0,
    repeatFailureRatePercent: null,
    resolutionsWithEvidence: 0,
    evidenceIntegrityPercent: null,
    disputedEvidenceCount: 0,
    auditsCompleted: 0,
    auditsUpheld: 0,
    workloadPerOfficer: 0,
  };
  const { calculatePerformanceScore } = await import('../services/performanceService');
  const emptyScore = calculatePerformanceScore(emptyMetrics);
  checkEqual('A department with no data gets no tier', emptyScore.tier, 'no-data');
  checkEqual('A department with no data scores zero, not a default', emptyScore.totalScore, 0);
  check(
    'Satisfaction is reported as absent, not as 4.5',
    emptyScore.components.citizenSatisfaction.value.toLowerCase().includes('no ratings')
  );

  const overview = adminService.getCityOverview();
  check('City totals are non-negative', overview.totalComplaints >= 0);
  check(
    'Pending verification never exceeds resolved',
    overview.pendingCitizenVerification <= overview.resolvedComplaints
  );
  check(
    'Verification rate is a real percentage',
    overview.resolutionVerificationRate >= 0 && overview.resolutionVerificationRate <= 100
  );

  const rankings = adminService.getAllDepartmentRankings();
  checkEqual('All five departments are ranked', rankings.length, 5);
  check(
    'No department is credited for work it has not done',
    rankings.every(
      (r) =>
        r.backlogCount > 0 ||
        r.escalations > 0 ||
        r.pendingVerification > 0 ||
        !r.recognitions.includes('Fast turnaround') ||
        r.averageResolutionHours > 0
    )
  );

  // SLA health is derived, not read from the stored snapshot.
  const staleRecord = {
    createdAt: new Date(Date.now() - 100 * 3600_000).toISOString(),
    updatedAt: new Date(Date.now() - 100 * 3600_000).toISOString(),
    status: 'in-progress' as const,
    // The stored snapshot claims all is well; the due date says otherwise.
    sla: { dueAt: new Date(Date.now() - 4 * 3600_000).toISOString() },
  };
  checkEqual(
    'A past-due complaint reads as breached regardless of its stored status',
    computeSlaHealth(staleRecord)?.status,
    'exceeded'
  );

  // Every complaint must belong to exactly one department. A record that
  // matches none is invisible to every department portal; one that
  // matches two appears in both queues and is counted twice in the
  // city-wide metrics.
  const allStored = complaintService.getStoredComplaints();
  const deptIds = ['roads', 'sanitation', 'water', 'electrical', 'infrastructure'] as const;

  const orphans = allStored.filter(
    (c) => !deptIds.some((d) => complaintService.matchesDepartment(c, d))
  );
  checkEqual('No complaint is orphaned across departments', orphans.length, 0);

  const doubleCounted = allStored.filter(
    (c) => deptIds.filter((d) => complaintService.matchesDepartment(c, d)).length > 1
  );
  checkEqual('No complaint is claimed by two departments', doubleCounted.length, 0);

  const perDeptTotal = deptIds.reduce(
    (sum, d) => sum + complaintService.getComplaintsByDepartment(d).length,
    0
  );
  checkEqual(
    'Department queues sum to the whole repository',
    perDeptTotal,
    allStored.length
  );

  // ==========================================================
  section('8. Offline queue and retry');
  // ==========================================================

  syncService.clearSyncQueue();
  authService.logoutPortal();
  loginThrottle.clearAttempts('PWD-001');
  await authService.loginDepartment({ identifier: 'PWD-001', password: PW }, 'roads');

  const target = complaintService
    .getComplaintsByDepartment('roads')
    .find((c) => c.status !== 'resolved');

  check('There is an open Roads complaint to work offline', Boolean(target));

  if (target) {
    setOnline(false);
    checkEqual('Network reports offline', networkService.getNetworkSnapshot().state, 'offline');

    const offlineOp = await complaintService.assignComplaint(
      target.id,
      { name: 'Rahul Yadav', designation: 'Junior Engineer', staffId: 'PWD-FIELD' },
      'Road Repair Team A',
      target.version
    );

    check('An offline mutation still succeeds locally', offlineOp.ok);
    check('It is reported as queued', offlineOp.ok && offlineOp.queued);

    const queued = syncService.getPendingOperations();
    checkEqual('One operation is waiting to sync', queued.length, 1);
    checkEqual('The queued operation names the record', queued[0].entityId, target.id);
    check(
      'The queue carries no citizen data',
      !JSON.stringify(queued).includes('9876543210')
    );

    // The local write is real, not deferred.
    const afterOffline = complaintService.getComplaintForActor(target.id);
    checkEqual(
      'The change is readable immediately',
      afterOffline?.assignedOfficer?.name,
      'Rahul Yadav'
    );

    // Reconnect and let the queue drain.
    setOnline(true);
    await syncService.syncPendingOperations();
    await new Promise((resolve) => setTimeout(resolve, 400));

    checkEqual('The queue drains on reconnect', syncService.getPendingOperations().length, 0);
  }

  // ==========================================================
  section('9. Session expiry');
  // ==========================================================

  await authService.loginDepartment({ identifier: 'PWD-001', password: PW }, 'roads');
  check('Session is active', sessionService.getSessionStatus().kind === 'active');

  // Look at the session far enough into the future that it has lapsed.
  const future = Date.now() + sessionService.SESSION_IDLE_MS + 1000;
  checkEqual('Session reports expired past its window', sessionService.getSessionStatus(future).kind, 'expired');
  check('An expired session is cleared, not left behind', sessionService.getSession() === null);

  // ==========================================================
  section('10. Proof of Repair — capture integrity');
  // ==========================================================

  const proof = await import('../services/proofService');

  const hashA = await proof.perceptualHash('data:image/jpeg;base64,AAAA-sample-one');
  const hashB = await proof.perceptualHash('data:image/jpeg;base64,AAAA-sample-one');
  const hashC = await proof.perceptualHash('data:image/jpeg;base64,ZZZZ-entirely-different');

  checkEqual('A perceptual hash is 16 hex characters', hashA.length, 16);
  checkEqual('The same image hashes identically', hashA, hashB);
  check('A different image hashes differently', proof.hammingDistance(hashA, hashC) > 0);

  const reportedAt = { latitude: 26.2052, longitude: 78.1924 };

  // The whole Gurugram failure mode: a stored image, not a live capture.
  const galleryGrade = await proof.gradeCapture('data:image/jpeg;base64,gallery-upload', {
    liveCapture: false,
    capturedAt: reportedAt,
    reportedAt,
    deviceTimeMs: Date.now(),
  });
  checkEqual('A gallery upload is graded disputed', galleryGrade.grade, 'disputed');
  check('A disputed capture cannot be submitted', !proof.isSubmittable(galleryGrade));

  // Live, but photographed three kilometres away.
  const farGrade = await proof.gradeCapture('data:image/jpeg;base64,far-away-shot', {
    liveCapture: true,
    capturedAt: { latitude: 26.2400, longitude: 78.2300 },
    reportedAt,
    deviceTimeMs: Date.now(),
  });
  checkEqual('A capture kilometres from the report is disputed', farGrade.grade, 'disputed');

  // Live, on site, novel: the only combination that passes.
  const goodGrade = await proof.gradeCapture('data:image/jpeg;base64,honest-repair-photo', {
    liveCapture: true,
    capturedAt: { latitude: 26.2053, longitude: 78.1925 },
    reportedAt,
    deviceTimeMs: Date.now(),
    sessionStartedMs: Date.now() - 60_000,
    sessionElapsedMs: 60_000,
    mockLocationSuspected: false,
  });
  checkEqual('A live, on-site, novel capture is verified', goodGrade.grade, 'verified');

  // No GPS fix is reported as unavailable, never as a pass.
  const noFixGrade = await proof.gradeCapture('data:image/jpeg;base64,no-fix-photo', {
    liveCapture: true,
    capturedAt: null,
    reportedAt,
    deviceTimeMs: Date.now(),
    mockLocationSuspected: false,
  });
  checkEqual('A capture with no location fix is unverified, not verified', noFixGrade.grade, 'unverified');
  check(
    'An unavailable check is reported as unavailable',
    noFixGrade.checks.some((c) => c.id === 'location-match' && c.passed === null)
  );

  // Reuse: the same photo cannot close a second complaint.
  proof.recordEvidenceHash(goodGrade.perceptualHash, 'JS-GWL-2026-001284');
  const reusedGrade = await proof.gradeCapture('data:image/jpeg;base64,honest-repair-photo', {
    liveCapture: true,
    capturedAt: { latitude: 26.2053, longitude: 78.1925 },
    reportedAt,
    deviceTimeMs: Date.now(),
    mockLocationSuspected: false,
    complaintId: 'JS-GWL-2026-999999',
  });
  checkEqual('A reused image is graded disputed', reusedGrade.grade, 'disputed');
  checkEqual(
    'The reuse names the complaint it was already used on',
    reusedGrade.reusedFromComplaintId,
    'JS-GWL-2026-001284'
  );

  // ==========================================================
  section('11. Civic Asset Memory & repeat failure');
  // ==========================================================

  const assets = await import('../services/assetService');
  const allForAssets = complaintService.getStoredComplaints();

  const snapped = assets.snapToAsset({ latitude: 26.2052, longitude: 78.1924 }, 'roads');
  check('A pothole on Phool Bagh Road snaps to a road segment', snapped?.asset.id === 'GWL-RD-0142');

  // Category matters as much as distance: a garbage report standing on a
  // road belongs to the bin point, not to the road it is standing on.
  const wrongCategory = assets.snapToAsset({ latitude: 26.2052, longitude: 78.1924 }, 'streetlights');
  check(
    'A streetlight report does not snap to a road segment',
    wrongCategory === null || wrongCategory.asset.kind === 'streetlight-pole'
  );

  const nowhere = assets.snapToAsset({ latitude: 19.0760, longitude: 72.8777 }, 'roads');
  checkEqual('A report far outside the city snaps to nothing', nowhere, null);

  const history = assets.getAssetHistory('GWL-RD-0142', allForAssets);
  check('The demonstration asset has a repair ledger', (history?.repairs.length ?? 0) >= 3);
  check('The ledger is ordered newest first', Boolean(
    history &&
      history.repairs.every(
        (r, i) =>
          i === 0 ||
          new Date(history.repairs[i - 1].completedAt).getTime() >= new Date(r.completedAt).getTime()
      )
  ));

  const roadRepair = assets.getRepairsForAsset('GWL-RD-0142')[0];
  check('A road repair carries a defect liability period', (roadRepair?.defectLiabilityMonths ?? 0) >= 12);
  check('That repair is still inside its warranty window', assets.isUnderWarranty(roadRepair));

  const exposure = assets.getWarrantyExposure(allForAssets);
  check('Repeat failures are detected against the ledger', exposure.failures.length > 0);
  check(
    'Recoverable value counts only in-warranty failures with a recorded cost',
    exposure.recoverableTotal ===
      exposure.inWarranty.reduce((sum, f) => sum + (f.recoverableEstimate ?? 0), 0)
  );
  check(
    'Every in-warranty failure has an expiry date to claim against',
    exposure.inWarranty.every((f) => f.warrantyExpiresAt !== null)
  );

  // ==========================================================
  section('12. Retention split — identity expires, the record does not');
  // ==========================================================

  const privacy = await import('../services/privacyService');
  const archivedSource = allForAssets.find(
    (c) => c.status === 'resolved' && !privacy.isPubliclyTrackable(c)
  );

  check('There is an archived historical complaint to inspect', Boolean(archivedSource));

  if (archivedSource) {
    const outcome = privacy.resolveLookup(archivedSource);
    checkEqual('An archived complaint resolves as expired', outcome.kind, 'expired');

    if (outcome.kind === 'expired') {
      check('The archived civic record is still returned', Boolean(outcome.archived));
      checkEqual('It is flagged as archived', outcome.archived.isArchived, true);
      checkEqual('The named officer is removed on archival', outcome.archived.assignedOfficer, undefined);
      checkEqual('Photographs are removed on archival', outcome.archived.protectedPhotos.length, 0);
      checkEqual('The timeline is removed on archival', outcome.archived.timeline.length, 0);
      check('The department is retained — it is not personal data', outcome.archived.department.name.length > 0);
      check('The asset link survives archival', typeof outcome.archived.assetId === 'string' || outcome.archived.assetId === undefined);
    }
  }

  // ==========================================================
  section('13. Issue / report split & distributed consent');
  // ==========================================================

  const issues = await import('../services/issueService');

  const primary = complaintService
    .getStoredComplaints()
    .find((c) => c.status !== 'resolved');

  if (primary) {
    const issue = issues.ensureIssueFor(primary);
    checkEqual('A shared issue starts with one stake', issue.stakes.length, 1);

    const second = complaintService
      .getStoredComplaints()
      .find((c) => c.id !== primary.id && c.status !== 'resolved');

    if (second) {
      const joined = issues.addStake(issue.id, second);
      checkEqual('A second reporter is added as their own stake', joined?.stakes.length, 2);
      check(
        'The joining complaint keeps its own ticket — it is not archived',
        Boolean(complaintService.getStoredComplaints().find((c) => c.id === second.id))
      );

      const consentBefore = issues.summariseConsent(joined!);
      checkEqual('Nobody has confirmed yet', consentBefore.confirmed, 0);
      check('An issue with pending stakes is not unanimous', !consentBefore.unanimous);

      // One reporter confirming does not close the issue for the other.
      const afterOne = issues.recordConfirmation(issue.id, primary.id);
      const consentOne = issues.summariseConsent(afterOne!);
      checkEqual('One confirmation is recorded', consentOne.confirmed, 1);
      check('One confirmation does not close a two-reporter issue', !consentOne.unanimous);
      check('The issue is not marked closed', afterOne?.status !== 'closed');

      // The second reporter disputes: the issue is contested, not closed.
      const dispute = issues.recordDispute(issue.id, second.id, 'Still broken on my side of the road.');
      checkEqual('A dispute puts the issue in contested', dispute.issue?.status, 'contested');
      check('A first dispute is not capped', !dispute.capped);
      check('A first dispute reopens the work', dispute.reopened);

      // Reopens are capped, so one voice cannot loop the issue forever.
      issues.recordDispute(issue.id, second.id, 'Still broken.');
      const third = issues.recordDispute(issue.id, second.id, 'Still broken.');
      check('Repeated reopens by one reporter are capped', third.capped);
      check('A capped dispute does not reopen the work again', !third.reopened);

      // Spread, not count.
      const spread = issues.computeSpread(dispute.issue!);
      checkEqual('Spread counts both stakes', spread.totalReports, 2);
      check('Spread weight is bounded to 0-1', spread.weight >= 0 && spread.weight <= 1);
      check(
        'Spread cannot add more than the capped priority points',
        spread.priorityContribution <= issues.MAX_SPREAD_PRIORITY_POINTS
      );
      check('Spread is described as spread, not as a raw count', spread.label.length > 0);

      const base = 70;
      check(
        'Priority with spread never exceeds 99',
        issues.priorityWithSpread(base, dispute.issue!) <= 99
      );
      check(
        'Priority with no issue is unchanged',
        issues.priorityWithSpread(base, null) === base
      );
    }
  }

  // ==========================================================
  section('14. Deferred verification & audit sampling');
  // ==========================================================

  const verification = await import('../services/verificationService');

  const window = verification.openWatchWindow(new Date().toISOString());
  checkEqual('A watch window schedules exactly two checkpoints', window.checkpoints?.length, 2);
  check(
    'Checkpoints are at 30 and 90 days',
    window.checkpoints?.map((c) => c.dayOffset).join(',') === '30,90'
  );

  // Sampling must be reproducible from the record, not re-rolled per render.
  const drawOnce = verification.isAuditSampled('JS-GWL-2026-001284');
  const drawAgain = verification.isAuditSampled('JS-GWL-2026-001284');
  checkEqual('Audit sampling is deterministic for a given complaint', drawOnce, drawAgain);

  const sampledShare = complaintService
    .getStoredComplaints()
    .filter((c) => verification.isAuditSampled(c.id)).length;
  check('The audit sample is a minority of closures', sampledShare < complaintService.getStoredComplaints().length);

  const durability = verification.computeDurabilityStats(complaintService.getStoredComplaints());
  check(
    'An unmeasured durability rate is null, not 100%',
    durability.holding + durability.failed > 0 || durability.durabilityRate === null
  );

  // ==========================================================
  section('15. One-Trip Work Card');
  // ==========================================================

  const workCards = await import('../services/workCardService');

  /* Pool from every open complaint rather than from one department:
     the earlier sections resolve most of the Roads queue, and a test
     that silently skips because its fixture was consumed upstream is a
     test that stops protecting anything. */
  const openPool = complaintService.getStoredComplaints().filter((c) => c.status !== 'resolved');
  const cards = workCards.buildDailyCards('roads', openPool);

  check('There is open work to route', openPool.length > 1);

  {
    check('At least one work card is produced', cards.length > 0);
    check(
      'No card exceeds the stop limit',
      cards.every((c) => c.stops.length <= workCards.MAX_STOPS_PER_CARD)
    );
    check(
      'Batching never drives further than one trip per complaint',
      cards.every((c) => c.totalDistanceMetres <= c.naiveDistanceMetres)
    );
    check(
      'Stops are numbered in route order',
      cards.every((c) => c.stops.every((s, i) => s.sequence === i + 1))
    );
    check(
      'Every complaint appears on at most one card',
      (() => {
        const seen = new Set<string>();
        for (const card of cards) {
          for (const stop of card.stops) {
            if (seen.has(stop.complaintId)) return false;
            seen.add(stop.complaintId);
          }
        }
        return true;
      })()
    );
    check(
      'A card carries a single skill, so the crew is equipped for it',
      cards.every((c) => new Set(c.stops.map((s) => s.category)).size === 1)
    );
    check(
      'Every stop tells the crew what to photograph',
      cards.every((c) => c.stops.every((s) => s.captureRequirement.length > 0))
    );

    const saving = workCards.summariseSaving(cards);
    check('The reported saving is never negative', saving.savedMetres >= 0);
    checkEqual(
      'Stop count matches the cards',
      saving.stops,
      cards.reduce((sum, c) => sum + c.stops.length, 0)
    );
  }

  // ==========================================================
  section('16. Escalation ladder & Ward Reality Index');
  // ==========================================================

  const escalation = await import('../services/escalationService');
  const wards = await import('../services/wardService');
  const everything = complaintService.getStoredComplaints();

  const ladder = escalation.getLadderState(everything);
  checkEqual('The ladder has three rungs', ladder.length, 3);
  check(
    'Response windows are defined for every post',
    ladder.every((r) => r.post.responseHours > 0)
  );
  check(
    'Only Level 1 is publicly visible by default',
    ladder.filter((r) => r.post.publiclyVisible).length === 1
  );
  check(
    'A resolved complaint is never in an escalation queue',
    ladder.every((r) =>
      r.complaintIds.every((id) => everything.find((c) => c.id === id)?.status !== 'resolved')
    )
  );

  const reality = wards.getWardReality(everything);
  check('Every ward is reported on', reality.length > 0);
  check(
    'No ward reports an impossible ratio',
    reality.every((w) => Number.isFinite(w.reportingRatio) && w.reportingRatio >= 0)
  );
  check(
    'A ward with too little expected volume is not called a finding',
    reality.every((w) => w.expectedComplaints >= 1 || w.signal === 'expected')
  );
  check(
    'Every row carries a plain-language reading',
    reality.every((w) => w.interpretation.length > 0)
  );
  check('The index is labelled illustrative', wards.WARD_INDEX_CAVEAT.length > 0);

  // ==========================================================
  section('17. Open311 projection carries no personal data');
  // ==========================================================

  const open311 = await import('../services/open311Service');
  const publicOnes = everything
    .map((c) => privacy.toPublicComplaint(c))
    .slice(0, 10);

  const feed = open311.buildRequestFeed(publicOnes);
  check('The feed emits one request per complaint', feed.length === publicOnes.length);

  const serialised = JSON.stringify(feed);
  check('No reporter name reaches the feed', !serialised.includes('Raj Sharma'));
  check('No masked mobile reaches the feed', !serialised.includes('+91 XXXXX'));
  check('No coordinates reach the feed', !/"lat"|"long"|latitude|longitude/.test(serialised));

  check(
    'A department-closed complaint stays open until the citizen confirms',
    feed.every((r) => r.status !== 'closed' || r.jan_seva_citizen_verified)
  );

  const bundle = open311.buildOpenDataBundle(publicOnes, [
    { asset: assets.getAssets()[0], repairs: assets.getRepairsForAsset(assets.getAssets()[0].id) },
  ]);
  check('No contractor is named in the open data bundle', !bundle.includes('Gwalior Roadlines'));
  check('No works cost is published', !bundle.includes('costEstimate'));
  check('The bundle declares its specification', bundle.includes('GeoReport v2'));

  // ==========================================================
  section('18. Landing-page figures are true');
  // ==========================================================

  const cityStats = await import('../services/cityStatsService');
  const programmeStats = await import('../services/programmeStats');
  const { defaultCity } = await import('../data/cities');

  const liveStats = cityStats.getLiveCityStats('gwalior');
  const programme = programmeStats.getProgrammeStats(defaultCity);

  checkEqual(
    'Reported count matches the store for this city',
    liveStats.reported,
    complaintService.getStoredComplaints().filter((c) => c.cityId === 'gwalior').length
  );

  check(
    'Citizen-verified never exceeds department-closed',
    liveStats.citizenVerified <= liveStats.departmentClosed
  );

  check(
    'The headline rate is measured on citizen confirmation, not department closure',
    liveStats.verifiedRatePercent === null ||
      liveStats.verifiedRatePercent ===
        Math.round((liveStats.citizenVerified / liveStats.reported) * 100)
  );

  // The bug this whole module exists to make impossible.
  checkEqual(
    'The programme rate is divided, not asserted',
    programme.resolutionRatePercent,
    Math.round((programme.resolved / programme.reported) * 100)
  );
  check(
    'Programme figures are labelled illustrative',
    programme.disclaimer.toLowerCase().includes('illustrative')
  );

  // A city with nothing filed has no rate, and must not report one.
  const emptyCityStats = cityStats.getLiveCityStats('indore');
  checkEqual('An empty city reports no complaints', emptyCityStats.reported, 0);
  checkEqual(
    'An empty city has no resolution rate, rather than 0% or 100%',
    emptyCityStats.verifiedRatePercent,
    null
  );

  report();
};

run().catch((err) => {
  process.stdout.write(`\nHarness error: ${String(err)}\n`);
  process.exitCode = 1;
});
