import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage, type Messaging } from 'firebase/messaging';

function getFirebaseWebConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  };
}

export function isFirebaseMessagingConfigured() {
  const config = getFirebaseWebConfig();
  return Boolean(
    config.apiKey &&
      config.projectId &&
      config.appId &&
      config.messagingSenderId &&
      process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
  );
}

function getOrInitApp(): FirebaseApp {
  const config = getFirebaseWebConfig();
  return getApps()[0] || initializeApp(config);
}

let messagingPromise: Promise<Messaging | null> | null = null;

async function getMessagingClient(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;
  if (!isFirebaseMessagingConfigured()) return null;
  if (!(await isSupported())) return null;
  if (!messagingPromise) {
    messagingPromise = Promise.resolve(getMessaging(getOrInitApp()));
  }
  return messagingPromise;
}

export async function requestFcmToken(): Promise<string | null> {
  if (!isFirebaseMessagingConfigured()) return null;
  if (typeof Notification === 'undefined') return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const messaging = await getMessagingClient();
  if (!messaging) return null;

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
    scope: '/',
  });
  await navigator.serviceWorker.ready;

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) return null;

  return getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });
}

export async function listenForForegroundMessages(
  onNotify: (payload: { title: string; body: string; link?: string }) => void,
) {
  const messaging = await getMessagingClient();
  if (!messaging) return () => undefined;

  return onMessage(messaging, (payload) => {
    const title = payload.notification?.title || payload.data?.title || 'CareerBridge';
    const body = payload.notification?.body || payload.data?.body || '';
    const link = payload.data?.link;
    onNotify({ title, body, link });
  });
}
