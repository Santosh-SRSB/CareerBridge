'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  HUMAN_INTERVIEW_TRACK_OPTIONS,
  humanInterviewRoleFromPassport,
  type HumanInterviewTrack,
} from '@careerbridge/shared';
import { getCandidateMe, scheduleHumanMock } from '@/lib/api';
import { CandidateShell } from '@/components/CandidatePortal';
import { HumanInterviewArt } from '@/components/HumanInterviewArt';
import { humanInterviewPaid } from '@/lib/human-interview-pay';

const TRACK_OPTIONS: { track: HumanInterviewTrack; label: string; hint: string }[] = (
  HUMAN_INTERVIEW_TRACK_OPTIONS?.length
    ? HUMAN_INTERVIEW_TRACK_OPTIONS
    : [
        { track: 'TECHNICAL' as const, label: 'Technical interview' },
        { track: 'NON_TECHNICAL' as const, label: 'Non-technical interview' },
      ]
).map((option) => ({
  ...option,
  hint:
    option.track === 'TECHNICAL'
      ? 'Coding, systems, and role skills'
      : 'HR, behavioural, and soft skills',
}));

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function defaultParts() {
  const next = new Date(Date.now() + 15 * 60 * 1000);
  next.setSeconds(0, 0);
  return {
    date: `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`,
    time: `${pad(next.getHours())}:${pad(next.getMinutes())}`,
  };
}

/** Parse date+time inputs as local wall clock (avoids UTC surprises). */
function localDateTime(date: string, time: string) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  if (![y, m, d, hh, mm].every((n) => Number.isFinite(n))) return null;
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export default function ScheduleHumanMockPage() {
  const router = useRouter();
  const initial = useMemo(defaultParts, []);
  const [jobRole, setJobRole] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [track, setTrack] = useState<HumanInterviewTrack>('NON_TECHNICAL');
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!humanInterviewPaid()) {
      router.replace('/interviews/human');
      return;
    }
    getCandidateMe()
      .then((profile) => {
        setJobRole(humanInterviewRoleFromPassport(profile) || '');
        setName([profile.firstName, profile.lastName].filter(Boolean).join(' '));
        setEmail(profile.email || '');
      })
      .catch((err) => {
        const code = (err as { code?: string }).code;
        if (code === 'UNAUTHORIZED') router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!humanInterviewPaid()) {
      router.replace('/interviews/human');
      return;
    }
    if (!track) {
      setError('Choose Technical or Non-technical interview.');
      return;
    }
    if (name.trim().length < 2) {
      setError('Enter your name.');
      return;
    }
    const when = localDateTime(date, time);
    if (!when || Number.isNaN(when.getTime())) {
      setError('Pick a date and a time.');
      return;
    }
    if (when.getTime() < Date.now() - 60_000) {
      setError('Pick a future date and time (at least a few minutes from now).');
      return;
    }
    setBooking(true);
    setError('');
    try {
      const session = await scheduleHumanMock({
        candidateName: name.trim(),
        candidateEmail: email.trim(),
        scheduledAt: when.toISOString(),
        interviewTrack: track,
      });
      router.push(`/interviews/human/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not book this interview.');
    } finally {
      setBooking(false);
    }
  }

  return (
    <CandidateShell>
      <div className="cb-hire is-wide">
        <Link href="/interviews/human" className="cb-hire-back">
          ← Payment
        </Link>
        <ol className="cb-hire-steps">
          <li>1 Pay</li>
          <li className="is-on cb-hire-shimmer">2 Schedule</li>
          <li>3 Meet</li>
        </ol>

        <div className="cb-hire-stage">
          <aside className="cb-hire-hero is-art">
            <HumanInterviewArt />
            <p>Pick a slot</p>
            <b>Choose your interview type, then book a time.</b>
            <span>Link opens 5 minutes before</span>
          </aside>

          {loading ? (
            <p className="cb-hire-note">Reading your Career Passport…</p>
          ) : !jobRole ? (
            <section className="cb-hire-card">
              <p className="font-bold text-primary">Add a job role to your Career Passport first.</p>
              <Link href="/passport/personal" className="cb-hire-btn cb-hire-shimmer">
                Complete Passport
              </Link>
            </section>
          ) : (
            <form onSubmit={onSubmit} className="cb-hire-card">
              <p className="cb-hire-kicker">1. Interview type</p>
              <div className="cb-hire-track-grid" role="radiogroup" aria-label="Interview type">
                {TRACK_OPTIONS.map((option) => {
                  const selected = track === option.track;
                  return (
                    <button
                      key={option.track}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`cb-hire-track${selected ? ' is-on' : ''}`}
                      onClick={() => {
                        setTrack(option.track);
                        setError('');
                      }}
                    >
                      <strong>{option.label}</strong>
                      <em>{option.hint}</em>
                    </button>
                  );
                })}
              </div>

              <p className="cb-hire-kicker">2. Role from Passport</p>
              <p className="cb-hire-role">{jobRole}</p>
              <label>
                Your name
                <input required value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label>
                Your email
                <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <p className="cb-hire-kicker">3. Date &amp; time</p>
              <div className="cb-hire-split">
                <label className="cb-hire-whenbox">
                  Date
                  <input type="date" required value={date} onChange={(event) => setDate(event.target.value)} />
                </label>
                <label className="cb-hire-whenbox">
                  Time
                  <input type="time" required value={time} onChange={(event) => setTime(event.target.value)} />
                </label>
              </div>
              <p className="cb-hire-note">
                Selected: <strong>{TRACK_OPTIONS.find((o) => o.track === track)?.label}</strong>. We email the
                interviewer after you book.
              </p>
              {error ? <p className="cb-hire-alert">{error}</p> : null}
              <button type="submit" disabled={booking} className="cb-hire-btn cb-hire-shimmer">
                {booking ? 'Booking…' : 'Book this time'}
              </button>
            </form>
          )}
        </div>
      </div>
    </CandidateShell>
  );
}
