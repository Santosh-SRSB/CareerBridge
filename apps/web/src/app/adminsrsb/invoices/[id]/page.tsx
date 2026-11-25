'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatInrFromPaise } from '@careerbridge/shared';
import { getAdminInvoice, type EmployerInvoiceRow } from '@/lib/api';
import {
  InvoiceDocument,
  type InvoiceSellerBank,
} from '@/components/billing/InvoiceDocument';
import { ErrorState } from '@/components/ui/StateViews';
import { LOAD_ERROR_MESSAGE, userFacingError } from '@/lib/client-errors';

export default function AdminInvoicePage() {
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
    getAdminInvoice(id)
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
    <main style={{ minHeight: '100vh', background: '#F4F6FB', padding: '24px 16px 48px' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <div
          className="no-print inv-print-hide"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'center' }}
        >
          <Link href="/adminsrsb/dashboard?tab=subscriptions" style={{ fontWeight: 700, color: '#1A1FC4' }}>
            ← Billing
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              marginLeft: 'auto',
              border: 0,
              borderRadius: 10,
              padding: '10px 14px',
              background: '#FBBF24',
              color: '#0C1245',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Download / Print
          </button>
        </div>
        <h1 className="no-print inv-print-hide" style={{ margin: '0 0 4px', fontSize: 24 }}>
          Tax invoice
        </h1>
        <p className="no-print inv-print-hide" style={{ margin: '0 0 16px', color: '#64748b' }}>
          Super Admin view · {invoice ? formatInrFromPaise(invoice.totalPaise) : '…'}
        </p>
        {loading ? <p className="no-print">Loading invoice…</p> : null}
        {!loading && error ? (
          <div className="no-print">
            <ErrorState message={error} onRetry={load} />
          </div>
        ) : null}
        {!loading && !error && invoice ? (
          <InvoiceDocument invoice={invoice} sellerBank={bank} />
        ) : null}
      </div>
    </main>
  );
}