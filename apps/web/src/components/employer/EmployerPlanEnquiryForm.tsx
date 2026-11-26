'use client';

import { FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EMPLOYER_SUPPORT_EMAIL } from '@careerbridge/shared';
import { submitPlanEnquiry } from '@/lib/api';
import { userFacingError } from '@/lib/client-errors';
import { CloseIcon } from '@/components/landing/home/icons';

type Props = {
  open: boolean;
  planName?: string;
  onClose: () => void;
};

export function EmployerPlanEnquiryForm({ open, planName, onClose }: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const reset = useCallback(() => {
    setName('');
    setCompanyName('');
    setQuery('');
    setError('');
    setDone(false);
    setLoading(false);
  }, []);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 30);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, [open, close]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await submitPlanEnquiry({
        name: name.trim(),
        companyName: companyName.trim(),
        query: query.trim(),
        planName: planName?.trim() || undefined,
      });
      setDone(true);
    } catch (err) {
      setError(userFacingError(err, 'send your enquiry'));
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="cb-plan-enq" role="presentation" onClick={close}>
      <div
        className="cb-plan-enq__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          className="cb-plan-enq__close"
          aria-label="Close enquiry form"
          onClick={close}
        >
          <CloseIcon size={18} />
        </button>

        {done ? (
          <div className="cb-plan-enq__done">
            <p className="cb-plan-enq__eyebrow">Sent</p>
            <h2 id={titleId}>Thanks — we got your enquiry</h2>
            <p>
              Our team will reply at {EMPLOYER_SUPPORT_EMAIL}
              {planName ? ` about ${planName}` : ''}.
            </p>
            <button type="button" className="cb-plan-enq__submit" onClick={close}>
              Close
            </button>
          </div>
        ) : (
          <form className="cb-plan-enq__form" onSubmit={onSubmit}>
            <p className="cb-plan-enq__eyebrow">Talk with us</p>
            <h2 id={titleId}>{planName ? `${planName} enquiry` : 'Plan enquiry'}</h2>
            <p className="cb-plan-enq__lede">
              Share a few details and we&apos;ll email {EMPLOYER_SUPPORT_EMAIL}.
            </p>

            <label className="cb-plan-enq__field">
              <span>Name</span>
              <input
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </label>

            <label className="cb-plan-enq__field">
              <span>Company name</span>
              <input
                required
                minLength={2}
                maxLength={160}
                autoComplete="organization"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Company name"
              />
            </label>

            <label className="cb-plan-enq__field">
              <span>Query</span>
              <textarea
                required
                minLength={5}
                maxLength={2000}
                rows={4}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tell us about your hiring needs"
              />
            </label>

            {error ? (
              <p className="cb-plan-enq__error" role="alert">
                {error}
              </p>
            ) : null}

            <button type="submit" className="cb-plan-enq__submit" disabled={loading}>
              {loading ? 'Sending…' : 'Submit enquiry'}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
