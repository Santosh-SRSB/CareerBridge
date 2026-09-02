'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BasicInformationRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/onboarding');
  }, [router]);
  return null;
}
