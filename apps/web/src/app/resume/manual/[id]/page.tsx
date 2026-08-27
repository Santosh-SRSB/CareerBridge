'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/** Legacy route — friend editor now lives at /resume/builder/[id] */
export default function ManualResumeLegacyEditorRedirect() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  useEffect(() => {
    if (params?.id) router.replace(`/resume/builder/${params.id}`);
    else router.replace('/resume/builder');
  }, [params?.id, router]);

  return <p style={{ padding: 24 }}>Opening resume editor…</p>;
}
