'use client';

import { useEffect } from 'react';

/**
 * Registers the network-only PWA service worker for installability.
 * Does not cache API/auth traffic. Firebase messaging keeps its own SW.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Installability is best-effort; never block the app shell.
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
