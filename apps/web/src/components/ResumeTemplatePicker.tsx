'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ATS_PHOTO_TEMPLATES, ATS_PLAIN_TEMPLATES } from '@careerbridge/shared';
import { setPendingResumeBuild, type ResumeBuildSource } from '@/lib/resume-build';
import TemplatePreview from '@/components/resume-templates/TemplatePreview.jsx';

export type ResumePhotoKind = 'photo' | 'plain';

const PHOTO_RESUME_TEMPLATES = ATS_PHOTO_TEMPLATES.map((item) => ({
  id: item.id,
  name: item.name,
  api: item.id,
}));

const PLAIN_RESUME_TEMPLATES = ATS_PLAIN_TEMPLATES.map((item) => ({
  id: item.id,
  name: item.name,
  api: item.id,
}));

function StyleCard({ kind, onSelect }: { kind: ResumePhotoKind; onSelect: (kind: ResumePhotoKind) => void }) {
  const photo = kind === 'photo';
  return (
    <button type="button" className="cb-template-style-card" onClick={() => onSelect(kind)}>
      <span className="cb-template-style-image">
        <img src={photo ? '/resume/with-photo.png' : '/resume/without-photo.png'} alt="" />
      </span>
      <span className="cb-template-style-label">
        {photo ? 'With photo' : 'Without photo'}
      </span>
    </button>
  );
}

function SourceCard({
  source,
  title,
  image,
  onSelect,
}: {
  source: ResumeBuildSource;
  title: string;
  image: string;
  onSelect: (source: ResumeBuildSource) => void;
}) {
  return (
    <button type="button" className="cb-template-style-card" onClick={() => onSelect(source)}>
      <span className="cb-template-style-image">
        <img src={image} alt="" />
      </span>
      <span className="cb-template-style-label">{title}</span>
    </button>
  );
}

export function ResumeTemplatePicker({
  open,
  onClose,
  mode = 'build',
}: {
  open: boolean;
  onClose: () => void;
  mode?: 'build' | 'enhance';
}) {
  const router = useRouter();
  const [source, setSource] = useState<ResumeBuildSource | null>(null);
  const [kind, setKind] = useState<ResumePhotoKind | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      setSource(null);
      setKind(null);
      setIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const slides = kind === 'photo' ? PHOTO_RESUME_TEMPLATES : PLAIN_RESUME_TEMPLATES;
    const last = Math.max(0, slides.length - 1);
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      if (!kind) return;
      if (event.key === 'ArrowLeft') setIndex((value) => (value === 0 ? last : value - 1));
      if (event.key === 'ArrowRight') setIndex((value) => (value === last ? 0 : value + 1));
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, kind]);

  if (!open) return null;

  const needsSource = mode === 'build';
  const atSourceStep = needsSource && !source;
  const atPhotoStep = (!needsSource || Boolean(source)) && !kind;
  const atTemplateStep = Boolean(kind);

  const withPhoto = kind === 'photo';
  const slides = withPhoto ? PHOTO_RESUME_TEMPLATES : PLAIN_RESUME_TEMPLATES;
  const total = slides.length;
  const selected = slides[index] || slides[0];
  const heading = atTemplateStep
    ? selected.name
    : atSourceStep
      ? 'How do you want to build?'
      : 'How should your resume look?';

  function pickSource(next: ResumeBuildSource) {
    setSource(next);
    setKind(null);
    setIndex(0);
  }

  function pickKind(next: ResumePhotoKind) {
    setKind(next);
    setIndex(0);
  }

  function goBack() {
    if (atTemplateStep) {
      setKind(null);
      setIndex(0);
      return;
    }
    if (needsSource && source) {
      setSource(null);
    }
  }

  function goPrev() {
    setIndex((value) => (value === 0 ? total - 1 : value - 1));
  }

  function goNext() {
    setIndex((value) => (value === total - 1 ? 0 : value + 1));
  }

  function useTemplate(api: string) {
    const photo = withPhoto ? '1' : '0';
    if (mode === 'enhance') {
      setPendingResumeBuild({ template: api, photo });
      onClose();
      router.push(`/resume/enhance?template=${encodeURIComponent(api)}&photo=${photo}`);
      return;
    }
    const buildSource: ResumeBuildSource = source === 'manual' ? 'manual' : 'passport';
    setPendingResumeBuild({ template: api, photo, source: buildSource });
    onClose();
    router.push(
      `/resume/builder/start?source=${buildSource}&template=${encodeURIComponent(api)}&photo=${photo}`,
    );
  }

  const showCornerChrome = atTemplateStep || (needsSource && Boolean(source));

  return (
    <div className="cb-template-modal" role="dialog" aria-modal="true" aria-labelledby="resume-template-title">
      <button type="button" className="cb-template-modal-backdrop" aria-label="Close" onClick={onClose} />
      <h2 id="resume-template-title" className="sr-only">
        {heading}
      </h2>
      {showCornerChrome ? (
        <>
          <button type="button" className="cb-template-corner-back" onClick={goBack}>
            Back
          </button>
          <button type="button" className="cb-template-corner-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </>
      ) : null}
      <div className={`cb-template-modal-panel${atTemplateStep ? ' is-bare' : ''}`}>
        {atTemplateStep ? (
          <div className="cb-template-carousel">
            <div className="cb-template-stage">
              <button type="button" className="cb-template-side-btn" aria-label="Previous template" onClick={goPrev}>
                &lt;
              </button>
              <div className="cb-template-preview">
                <div className="cb-template-large is-photo is-live">
                  <div className="cb-template-live">
                    <TemplatePreview id={selected.id} />
                  </div>
                  <p className="cb-template-live-name">{selected.name}</p>
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
              {atSourceStep ? (
                <>
                  <SourceCard
                    source="passport"
                    title="Build using passport"
                    image="/mascots/passport-with-resume.png"
                    onSelect={pickSource}
                  />
                  <SourceCard
                    source="manual"
                    title="Build manually"
                    image="/mascots/passport-without-resume.png"
                    onSelect={pickSource}
                  />
                </>
              ) : atPhotoStep ? (
                <>
                  <StyleCard kind="photo" onSelect={pickKind} />
                  <StyleCard kind="plain" onSelect={pickKind} />
                </>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
