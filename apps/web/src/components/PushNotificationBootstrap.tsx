'use client';

import { useEffect, useRef } from 'react';
import { getAccessToken } from '@/lib/session';
import { registerDeviceToken } from '@/lib/api';
import {
  isFirebaseMessagingConfigured,
  listenForForegroundMessages,
  requestFcmToken,
} from '@/lib/firebase-messaging';

/**
 * Registers the browser FCM token after login and shows foreground toasts.
 * Retries briefly so late session writes (post-login) still pick up push.
 */
export function PushNotificationBootstrap() {
  const registeredToken = useRef<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    if (!isFirebaseMessagingConfigured()) return;

    let cancelled = false;
    let attempts = 0;

    async function boot() {
      if (cancelled) return;
      if (!getAccessToken()) {
        if (attempts < 40) {
          attempts += 1;
          window.setTimeout(() => void boot(), 1500);
        }
        return;
      }

      try {
        const token = await requestFcmToken();
        if (cancelled || !token) return;
        if (registeredToken.current === token) return;

        await registerDeviceToken(token, 'WEB');
        registeredToken.current = token;

        if (!unsubscribeRef.current) {
          unsubscribeRef.current = await listenForForegroundMessages(({ title, body }) => {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification(title, { body, icon: '/srsb-mark.png' });
            }
          });
        }
      } catch {
        // Push is optional — ignore permission / config failures.
      }
    }

    void boot();

    return () => {
      cancelled = true;
      if (typeof unsubscribeRef.current === 'function') {
        unsubscribeRef.current();
        unsubscribeRef.current = undefined;
      }
    };
  }, []);

  return null;
}
