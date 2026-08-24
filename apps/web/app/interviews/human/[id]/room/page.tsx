'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { humanInterviewJoinState, type HumanMockSession } from '@careerbridge/shared';
import { getHumanMock } from '@/lib/api';
import { HumanInterviewGate } from '@/components/HumanInterviewGate';
import { HumanMockRoom } from '@/components/HumanMockRoom';

function MeetBoot({ children }: { children: React.ReactNode }) {
  return <main className="cb-meet-boot">{children}</main>;
}

function HumanMockRoomInner() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const token = search.get('token') || undefined;
  const role = search.get('role') === 'interviewer' ? 'interviewer' : 'candidate';
  const [session, setSession] = useState<HumanMockSession | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const unlock = useCallback(() => setOpen(true), []);

  useEffect(() => {
    getHumanMock(params.id, token)
      .then((item) => {
        if (item.status === 'COMPLETED') {
          if (role === 'candidate') {
            router.replace(`/interviews/human/${item.id}/score`);
            return;
          }
          setError('This interview has ended. Video was not saved.');
          return;
        }
        const ready = item.status === 'LIVE' || humanInterviewJoinState(item.scheduledAt).canJoin;
        setOpen(ready);
        setSession(item);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not open this room.'));
  }, [params.id, token, router, role]);

  if (error) return <MeetBoot>{error}</MeetBoot>;
  if (!session) return <MeetBoot>Opening the live room…</MeetBoot>;
  if (!open) {
    return <HumanInterviewGate session={session} onReady={unlock} hideBack={role === 'interviewer'} />;
  }

  return (
    <HumanMockRoom
      id={session.id}
      role={role}
      token={token}
      jobRole={session.jobRole}
      peerName={role === 'candidate' ? session.interviewerName || 'Priya Kumari' : session.candidateName || 'Candidate'}
      onScored={(id) => router.replace(`/interviews/human/${id}/score`)}
    />
  );
}

export default function HumanMockRoomPage() {
  return (
    <Suspense fallback={<MeetBoot>Opening the live room…</MeetBoot>}>
      <HumanMockRoomInner />
    </Suspense>
  );
}
