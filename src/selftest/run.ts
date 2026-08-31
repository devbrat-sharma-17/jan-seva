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

  report();
};

run().catch((err) => {
  process.stdout.write(`\nHarness error: ${String(err)}\n`);
  process.exitCode = 1;
});
