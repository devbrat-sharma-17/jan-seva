// ============================================================
// JAN-SEVA production-mode lockout suite
// ============================================================
// Run with `npm run selftest:prod`.
//
// One question: with VITE_APP_MODE=production, can anything demo still
// get in? "Demo Admin must not open real Admin" is the sort of
// requirement that is true on the day it is written and quietly false
// six commits later, so it is asserted here rather than remembered.
//
// Built against `.env.selftest`, which pins VITE_APP_MODE=production, so
// this exercises the real resolved mode rather than a value handed in.

import { installBrowserShims, check, checkEqual, section, report } from './harness';

installBrowserShims();

const run = async () => {
  const appMode = await import('../config/appMode');
  const demoDirectory = await import('../data/demoDirectory');
  const authService = await import('../services/authService');
  const complaintService = await import('../services/complaintService');

  // ==========================================================
  section('1. The build really is in production mode');
  // ==========================================================

  checkEqual('APP_MODE resolves to production', appMode.APP_MODE, 'production');
  check('isProduction() agrees', appMode.isProduction());

  // ==========================================================
  section('2. Mode policy');
  // ==========================================================

  check('Demo accounts are refused in production', !appMode.demoAccountsAllowed('production'));
  check('Seed data is refused in production', !appMode.demoSeedDataAllowed('production'));
  check('The fixed OTP is refused in production', !appMode.demoOtpAllowed('production'));
  check('Demo accounts are allowed in development', appMode.demoAccountsAllowed('development'));
  check('Demo accounts are allowed in demo mode', appMode.demoAccountsAllowed('demo'));

  // ==========================================================
  section('3. The demo directory is inert');
  // ==========================================================

  check('DEMO_MODE is off', demoDirectory.DEMO_MODE === false);
  check('The admin demo ID resolves to nothing', demoDirectory.findDemoAccount('ADMIN-DEMO') === null);
  check('A department demo ID resolves to nothing', demoDirectory.findDemoAccount('PWD-001') === null);
  check(
    'No department accounts are listed for the sign-in screen',
    demoDirectory.listDemoDepartmentAccounts('roads').length === 0
  );

  // The digest for ADMIN-DEMO is still compiled into this bundle. Verify
  // that having it is not enough: the check itself refuses.
  const forgedAccount = {
    kind: 'admin' as const,
    accountId: 'ADMIN-DEMO',
    aliases: ['admin-demo'],
    displayName: 'Dr. Rakesh Agrawal',
    email: 'rakesh.agrawal@gwalior.gov.in',
    cityId: 'gwalior',
  };
  check(
    'The known demo password does not verify, even against a hand-built account',
    !demoDirectory.verifyCredential(forgedAccount, demoDirectory.DEMO_PASSWORD_HINT)
  );

  // ==========================================================
  section('4. Sign-in refuses demo credentials');
  // ==========================================================

  const adminAttempt = await authService.loginAdmin({
    identifier: 'admin-demo',
    password: demoDirectory.DEMO_PASSWORD_HINT,
  });
  check('Admin sign-in with the demo password fails', !adminAttempt.ok);
  check(
    'It fails as unrecognised credentials, revealing nothing about the account',
    !adminAttempt.ok && adminAttempt.reason === 'invalid_credentials'
  );

  const deptAttempt = await authService.loginDepartment(
    { identifier: 'PWD-001', password: demoDirectory.DEMO_PASSWORD_HINT },
    'roads'
  );
  check('Department sign-in with the demo password fails', !deptAttempt.ok);

  // ==========================================================
  section('5. Quick Demo cannot open a session');
  // ==========================================================

  let adminDemoThrew = false;
  try {
    authService.startAdminDemoSession();
  } catch {
    adminDemoThrew = true;
  }
  check('startAdminDemoSession refuses', adminDemoThrew);

  let deptDemoThrew = false;
  try {
    authService.startDepartmentDemoSession('roads', 'head');
  } catch {
    deptDemoThrew = true;
  }
  check('startDepartmentDemoSession refuses', deptDemoThrew);

  check('No session was created by either attempt', authService.getCurrentAdminUser() === null);

  // ==========================================================
  section('6. The fixed verification code is not accepted');
  // ==========================================================

  const send = await authService.sendOtp('9876543210', 'mobile');
  check('sendOtp does not claim to have sent a code', !send.success);

  const verify = await authService.verifyOtp('9876543210', '123456', 'mobile');
  check('123456 does not verify anyone', !verify.success);
  check('No identity reference is handed back', verify.identityReference === undefined);

  // ==========================================================
  section('7. The complaint store starts empty');
  // ==========================================================

  const complaints = complaintService.getStoredComplaints();
  checkEqual('No synthetic complaints are seeded', complaints.length, 0);

  report();
};

void run();
