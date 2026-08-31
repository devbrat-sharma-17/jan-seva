// ============================================================
// useOnlineStatus — Connectivity awareness
// ============================================================
// This portal is used on a phone, outdoors, on patchy mobile data.
// Knowing the connection dropped is the difference between "the app
// is broken" and "your report is saved and will send when you're back".

import { useEffect, useState } from 'react';

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // The events can fire between first render and this effect attaching.
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}
