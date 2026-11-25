'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getEmployerInvoice, type EmployerInvoiceRow } from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { EvPageHead, EvSkeleton } from '@/components/employer/ui';
import {
  InvoiceDocument,
  type InvoiceSellerBank,
} from '@/components/billing/InvoiceDocument';
import { ErrorState } from '@/components/ui/StateViews';
import { LOAD_ERROR_MESSAGE, userFacingError } from '@/lib/client-errors';

export default function EmployerInvoicePage() {
  const params = useParams();
  const id = String(params?.id || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invoice, setInvoice] = useState<EmployerInvoiceRow | null>(null);
  const [bank, setBank] = useState<InvoiceSellerBank | null>(null);

  function load() {
    if (!id) return;
    setLoading(true);
    setError('');
    getEmployerInvoice(id)
      .then((res) => {
        setInvoice(res.invoice);
        setBank(res.sellerBank ?? null);
      })
      .catch((err) => setError(userFacingError(err, 'load invoice') || LOAD_ERROR_MESSAGE))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <EmployerShellFallback title="Tax invoice">
      <div className="no-print inv-print-hide">
        <EvPageHead
          eyebrow="Billing"
          title="Tax invoice"
          subtitle="SRSB Workforce Solutions — subscription invoice"
          actions={
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href="/employer/payments" className="ev-btn ev-btn--ghost">
                ← Billing
              </Link>
              <button type="button" className="ev-btn ev-btn--amber" onClick={() => window.print()}>
                Download / Print
              </button>
            </div>
          }
        />
      </div>

      {loading ? (
        <div className="no-print">
          <EvSkeleton height={420} />
        </div>
      ) : null}
      {!loading && error ? (
        <div className="no-print">
          <ErrorState message={error} onRetry={load} />
        </div>
      ) : null}
      {!loading && !error && invoice ? (
        <InvoiceDocument invoice={invoice} sellerBank={bank} />
      ) : null}
    </EmployerShellFallback>
  );
}
