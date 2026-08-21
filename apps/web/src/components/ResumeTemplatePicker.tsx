'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ResumeContent } from '@careerbridge/shared';
import { setPendingResumeBuild } from '@/lib/resume-build';

const DUMMY: ResumeContent = {
  fullName: 'Priya Sharma',
  city: 'Bengaluru',
  phone: '+91 98765 43210',
  summary:
    'Customer-first professional with 2 years in retail and support. Strong in Excel, clear communication, and solving issues quickly.',
  skills: ['MS Excel', 'Customer Service', 'Sales', 'Communication'],
  education: [{ qualification: 'B.Com', institution: 'Bangalore University', yearCompleted: 2023 }],
  experiences: [
    {
      company: 'ABC Services',
      jobTitle: 'Customer Support Associate',
      description: 'Handled 40+ daily queries and improved first-response time.',
      isInternship: false,
    },
  ],
  languages: ['English', 'Hindi', 'Kannada'],
};

const DUMMY_PHOTO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150">
      <rect width="120" height="150" fill="#d7eee8"/>
      <circle cx="60" cy="54" r="28" fill="#0a2e2c"/>
      <ellipse cx="60" cy="138" rx="48" ry="42" fill="#0a2e2c"/>
    </svg>`,
  );

export const RESUME_LAYOUTS = [
  { id: 'CLASSIC', name: 'Classic', api: 'CLASSIC' },
  { id: 'MODERN', name: 'Modern', api: 'MODERN' },
  { id: 'SIMPLE', name: 'Simple', api: 'SIMPLE' },
  { id: 'PROFESSIONAL', name: 'Professional', api: 'CLASSIC' },
  { id: 'CREATIVE', name: 'Creative', api: 'MODERN' },
] as const;

export const PHOTO_RESUME_TEMPLATES = [
  { id: 'PHOTO_NAVY', name: 'Executive Navy', api: 'CLASSIC', image: '/resume/photo-1.png?v=4' },
  { id: 'PHOTO_CIRCLE', name: 'Clean Circle', api: 'MODERN', image: '/resume/photo-2.png?v=4' },
  { id: 'PHOTO_GROWTH', name: 'Web Developer', api: 'SIMPLE', image: '/resume/photo-3.png?v=3' },
  { id: 'PHOTO_IT', name: 'IT Manager', api: 'CLASSIC', image: '/resume/photo-4.png?v=4' },
  { id: 'PHOTO_SOFT', name: 'Soft Sidebar', api: 'MODERN', image: '/resume/photo-5.png?v=2' },
] as const;

export const PLAIN_RESUME_TEMPLATES = [
  { id: 'PLAIN_CLASSIC', name: 'Classic Text', api: 'CLASSIC', image: '/resume/plain-1.png?v=1' },
  { id: 'PLAIN_HEADER', name: 'Header Bar', api: 'MODERN', image: '/resume/plain-2.png?v=2' },
  { id: 'PLAIN_SIMPLE', name: 'Simple ATS', api: 'SIMPLE', image: '/resume/plain-3.png?v=1' },
  { id: 'PLAIN_SPLIT', name: 'Two Column', api: 'CLASSIC', image: '/resume/plain-4.png?v=1' },
  { id: 'PLAIN_MINIMAL', name: 'Minimal', api: 'MODERN', image: '/resume/plain-5.png?v=1' },
] as const;

export type ResumeLayoutId = (typeof RESUME_LAYOUTS)[number]['id'];
export type ResumePhotoKind = 'photo' | 'plain';

function DummyPhoto({ size }: { size: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'h-28 w-24' : size === 'md' ? 'h-16 w-14' : 'h-10 w-8';
  return (
    <img
      src={DUMMY_PHOTO}
      alt=""
      className={`${dim} shrink-0 rounded-sm object-cover ring-1 ring-black/10`}
    />
  );
}

function Paper({
  layout,
  withPhoto,
  size = 'thumb',
}: {
  layout: ResumeLayoutId;
  withPhoto: boolean;
  size?: 'thumb' | 'full';
}) {
  const data = DUMMY;
  const title = 'Customer Service Executive';
  const full = size === 'full';
  const photoSize = full ? 'lg' : 'sm';
  const t = {
    name: full ? 'text-2xl font-extrabold leading-tight' : 'text-[11px] font-extrabold leading-tight',
    role: full
      ? 'text-sm font-semibold uppercase tracking-[0.16em]'
      : 'text-[8px] font-semibold uppercase tracking-[0.14em]',
    body: full ? 'text-sm leading-relaxed' : 'text-[7px] leading-snug',
    h: full ? 'text-xs font-extrabold uppercase tracking-[0.14em]' : 'text-[8px] font-extrabold',
    line: full ? 'text-sm font-bold' : 'text-[8px] font-bold',
    muted: full ? 'text-sm' : 'text-[7px]',
    pad: full ? 'p-8' : 'p-4',
    chip: full ? 'rounded-full px-2.5 py-1 text-[11px] font-bold' : 'rounded-full px-1.5 py-0.5 text-[6px] font-bold',
  };

  if (layout === 'MODERN') {
    return (
      <article className="overflow-hidden bg-white text-[#0a2e2c]">
        <div className="flex min-h-full">
          <aside className={`${full ? 'w-[34%] p-6' : 'w-[32%] p-3'} bg-[#0a2e2c] text-white`}>
            {withPhoto ? (
              <div className="mb-3 overflow-hidden rounded-sm ring-2 ring-white/20">
                <DummyPhoto size={photoSize} />
              </div>
            ) : null}
            <p className={t.name}>{data.fullName}</p>
            <p className={`mt-3 uppercase tracking-[0.14em] text-[#14b8a6] ${full ? 'text-xs' : 'text-[7px]'}`}>
              Contact
            </p>
            <p className={`mt-1 text-white/80 ${t.muted}`}>{data.city}</p>
            <p className={`text-white/80 ${t.muted}`}>{data.phone}</p>
            <p className={`mt-4 uppercase tracking-[0.14em] text-[#14b8a6] ${full ? 'text-xs' : 'text-[7px]'}`}>
              Skills
            </p>
            <ul className={`mt-1 space-y-1 text-white/85 ${t.muted}`}>
              {data.skills.map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ul>
          </aside>
          <div className={`min-w-0 flex-1 ${full ? 'p-6' : 'p-3'}`}>
            <p className={`${t.role} text-[#14b8a6]`}>{title}</p>
            <p className={`mt-3 text-[#4e6864] ${t.body}`}>{data.summary}</p>
            <p className={`mt-4 ${t.h}`}>Experience</p>
            <p className={`mt-1 ${t.line}`}>{data.experiences[0]?.jobTitle}</p>
            <p className={`text-[#4e6864] ${t.muted}`}>{data.experiences[0]?.company}</p>
            <p className={`mt-1 text-[#4e6864] ${t.body}`}>{data.experiences[0]?.description}</p>
            <p className={`mt-4 ${t.h}`}>Education</p>
            <p className={`mt-1 ${t.muted}`}>
              {data.education[0]?.qualification} · {data.education[0]?.institution}
            </p>
          </div>
        </div>
      </article>
    );
  }

  if (layout === 'SIMPLE') {
    return (
      <article className={`bg-white text-[#0a2e2c] ${t.pad}`}>
        {withPhoto ? (
          <div className="mb-3 flex justify-center">
            <DummyPhoto size={photoSize} />
          </div>
        ) : null}
        <h3 className={`text-center ${t.name}`}>{data.fullName}</h3>
        <p className={`mt-1 text-center text-[#4e6864] ${t.muted}`}>
          {data.city} · {data.phone}
        </p>
        <div className="mx-auto mt-3 h-px w-20 bg-[#0a2e2c]/20" />
        <p className={`mt-3 text-center ${t.role}`}>{title}</p>
        <p className={`mt-3 text-[#4e6864] ${t.body}`}>{data.summary}</p>
        <p className={`mt-4 ${t.h}`}>Skills</p>
        <p className={`mt-1 ${t.muted}`}>{data.skills.join(' · ')}</p>
        <p className={`mt-4 ${t.h}`}>Experience</p>
        <p className={`mt-1 ${t.line}`}>{data.experiences[0]?.jobTitle}</p>
        <p className={`text-[#4e6864] ${t.muted}`}>{data.experiences[0]?.company}</p>
      </article>
    );
  }

  if (layout === 'PROFESSIONAL') {
    return (
      <article className={`bg-[#faf8f3] text-[#0a2e2c] ${t.pad}`}>
        <div className="flex items-start gap-3 border-b-2 border-[#ca8a04] pb-3">
          {withPhoto ? <DummyPhoto size={photoSize} /> : null}
          <div className="min-w-0">
            <p className={t.name}>{data.fullName}</p>
            <p className={`${t.role} text-[#ca8a04]`}>{title}</p>
            <p className={`mt-1 text-[#4e6864] ${t.muted}`}>
              {data.city} · {data.phone}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className={t.h}>Experience</p>
            <p className={`mt-1 ${t.line}`}>{data.experiences[0]?.jobTitle}</p>
            <p className={`text-[#4e6864] ${t.muted}`}>{data.experiences[0]?.company}</p>
            <p className={`mt-2 text-[#4e6864] ${t.body}`}>{data.experiences[0]?.description}</p>
          </div>
          <div>
            <p className={t.h}>Education</p>
            <p className={`mt-1 ${t.muted}`}>{data.education[0]?.qualification}</p>
            <p className={`text-[#4e6864] ${t.muted}`}>{data.education[0]?.institution}</p>
            <p className={`mt-4 ${t.h}`}>Languages</p>
            <p className={`mt-1 ${t.muted}`}>{data.languages.join(', ')}</p>
          </div>
        </div>
      </article>
    );
  }

  if (layout === 'CREATIVE') {
    return (
      <article className="overflow-hidden bg-white text-[#0a2e2c]">
        <div
          className={`relative bg-gradient-to-r from-[#0a2e2c] via-[#0d9488] to-[#ca8a04] text-white ${full ? 'px-8 py-6' : 'px-4 py-3'}`}
        >
          <div className="flex items-end gap-3">
            {withPhoto ? (
              <div className="overflow-hidden rounded-sm ring-2 ring-white/40">
                <DummyPhoto size={photoSize} />
              </div>
            ) : null}
            <div>
              <p className={t.name}>{data.fullName}</p>
              <p className={`${t.role} text-white/80`}>{title}</p>
            </div>
          </div>
        </div>
        <div className={t.pad}>
          <p className={`text-[#4e6864] ${t.body}`}>{data.summary}</p>
          <div className="mt-3 flex flex-wrap gap-1">
            {data.skills.map((skill) => (
              <span key={skill} className={`${t.chip} bg-[#0a2e2c] text-white`}>
                {skill}
              </span>
            ))}
          </div>
          <p className={`mt-4 ${t.h}`}>Experience</p>
          <p className={`mt-1 ${t.line}`}>{data.experiences[0]?.jobTitle}</p>
          <p className={`text-[#4e6864] ${t.muted}`}>{data.experiences[0]?.company}</p>
        </div>
      </article>
    );
  }

  return (
    <article className={`bg-white text-[#0a2e2c] ${t.pad}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`rounded-full bg-[#ca8a04] ${full ? 'h-1.5 w-16' : 'h-1 w-12'}`} />
          <p className={`mt-3 ${t.name}`}>{data.fullName}</p>
          <p className={`${t.role} text-[#ca8a04]`}>{title}</p>
          <p className={`mt-1 text-[#4e6864] ${t.muted}`}>
            {data.city} · {data.phone}
          </p>
        </div>
        {withPhoto ? <DummyPhoto size={photoSize} /> : null}
      </div>
      <p className={`mt-3 text-[#4e6864] ${t.body}`}>{data.summary}</p>
      <p className={`mt-4 ${t.h}`}>Skills</p>
      <p className={`mt-1 ${t.muted}`}>{data.skills.join(' · ')}</p>
      <p className={`mt-4 ${t.h}`}>Experience</p>
      <p className={`mt-1 ${t.line}`}>{data.experiences[0]?.jobTitle}</p>
      <p className={`text-[#4e6864] ${t.muted}`}>{data.experiences[0]?.company}</p>
      <p className={`mt-4 ${t.h}`}>Education</p>
      <p className={`mt-1 ${t.muted}`}>
        {data.education[0]?.qualification} · {data.education[0]?.institution}
      </p>
    </article>
  );
}

function StyleCard({
  kind,
  onSelect,
}: {
  kind: ResumePhotoKind;
  onSelect: (kind: ResumePhotoKind) => void;
}) {
  const withPhoto = kind === 'photo';
  return (
    <button type="button" className="cb-template-style-card" onClick={() => onSelect(kind)}>
      <span className="cb-template-style-image">
        <img
          src={withPhoto ? '/resume/photo-1.png?v=4' : '/resume/plain-1.png?v=1'}
          alt=""
        />
      </span>
      <span className="cb-template-style-label">
        {withPhoto ? 'Photo attach resume' : 'Without photo attach resume'}
      </span>
    </button>
  );
}

export function ResumeTemplatePicker({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<ResumePhotoKind | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      setKind(null);
      setIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      if (!kind) return;
      if (event.key === 'ArrowLeft') setIndex((value) => (value === 0 ? 4 : value - 1));
      if (event.key === 'ArrowRight') setIndex((value) => (value === 4 ? 0 : value + 1));
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, kind]);

  if (!open) return null;

  const withPhoto = kind === 'photo';
  const slides = withPhoto ? PHOTO_RESUME_TEMPLATES : PLAIN_RESUME_TEMPLATES;
  const total = slides.length;
  const selected = slides[index];
  const heading = kind ? selected.name : 'How should your resume look?';

  function pickKind(next: ResumePhotoKind) {
    setKind(next);
    setIndex(0);
  }

  function goPrev() {
    setIndex((value) => (value === 0 ? total - 1 : value - 1));
  }

  function goNext() {
    setIndex((value) => (value === total - 1 ? 0 : value + 1));
  }

  function useTemplate(api: string) {
    const payload = { template: api, photo: withPhoto ? '1' : '0' } as const;
    setPendingResumeBuild(payload);
    onClose();
    router.push(`/resume/build?template=${api}&photo=${payload.photo}`);
  }

  return (
    <div className="cb-template-modal" role="dialog" aria-modal="true" aria-labelledby="resume-template-title">
      <button type="button" className="cb-template-modal-backdrop" aria-label="Close" onClick={onClose} />
      <h2 id="resume-template-title" className="sr-only">
        {heading}
      </h2>
      {kind ? (
        <>
          <button type="button" className="cb-template-corner-back" onClick={() => setKind(null)}>
            Back
          </button>
          <button type="button" className="cb-template-corner-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </>
      ) : null}
      <div className={`cb-template-modal-panel${kind ? ' is-bare' : ''}`}>
        {kind ? (
          <div className="cb-template-carousel">
            <div className="cb-template-stage">
              <button type="button" className="cb-template-side-btn" aria-label="Previous template" onClick={goPrev}>
                &lt;
              </button>
              <div className="cb-template-preview">
                <div className="cb-template-large is-photo">
                  {'image' in selected ? (
                    <img className="cb-template-shot" src={selected.image} alt={`${selected.name} resume template`} />
                  ) : null}
                  <button type="button" className="cb-template-go" onClick={() => useTemplate(selected.api)}>
                    Go with this template
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
                <div className="cb-template-dots">
                  {slides.map((item, i) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`cb-template-dot${i === index ? ' is-active' : ''}`}
                      aria-label={`${item.name} ${i + 1} of ${total}`}
                      onClick={() => setIndex(i)}
                    />
                  ))}
                  <span className="cb-template-count">
                    {index + 1}/{total}
                  </span>
                </div>
              </div>
              <button type="button" className="cb-template-side-btn" aria-label="Next template" onClick={goNext}>
                &gt;
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-teal">ATS Resume</p>
                <h2 className="mt-1 text-lg font-extrabold text-primary">{heading}</h2>
              </div>
              <button type="button" className="cb-template-corner-close is-on-card" aria-label="Close" onClick={onClose}>
                ×
              </button>
            </div>
            <div className="cb-template-style-grid">
              <StyleCard kind="photo" onSelect={pickKind} />
              <StyleCard kind="plain" onSelect={pickKind} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
