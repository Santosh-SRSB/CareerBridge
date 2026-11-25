'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatInrFromPaise } from '@careerbridge/shared';
import { getEmployerInvoice, type EmployerInvoiceRow } from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { EvPageHead, EvSkeleton } from '@/components/employer/ui';
import { ErrorState } from '@/components/ui/StateViews';
import { LOAD_ERROR_MESSAGE, userFacingError } from '@/lib/client-errors';

export default function EmployerInvoicePage() {
  const params = useParams();
  const id = String(params?.id || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invoice, setInvoice] = useState<EmployerInvoiceRow | null>(null);
  const [bank, setBank] = useState<{
    accountName: string;
    accountNo: string;
    ifsc: string;
    branch: string;
    bankName: string;
  } | null>(null);

  function load() {
    if (!id) return;
    setLoading(true);
    setError('');
    getEmployerInvoice(id)
      .then((res) => {
        setInvoice(res.invoice);
        setBank(res.sellerBank);
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
              Print / PDF
            </button>
          </div>
        }
      />

      {loading ? <EvSkeleton height={420} /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={load} /> : null}

      {!loading && !error && invoice ? (
        <article
          className="ev-card ev-mt"
          style={{ maxWidth: 820, margin: '16px auto', padding: 28, background: '#fff', color: '#111' }}
        >
          <header style={{ borderBottom: '2px solid #111', paddingBottom: 16, marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 12, letterSpacing: 1 }}>TAX INVOICE</p>
            <h1 style={{ margin: '6px 0 4px', fontSize: 22 }}>{invoice.seller.name}</h1>
            <p style={{ margin: 0, fontSize: 13 }}>{invoice.seller.address}</p>
            <p style={{ margin: '4px 0 0', fontSize: 13 }}>
              GSTIN: {invoice.seller.gstin}
              {invoice.seller.email ? ` · E: ${invoice.seller.email}` : ''}
              {invoice.seller.phone ? ` · M: ${invoice.seller.phone}` : ''}
            </p>
          </header>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>To</p>
              <p style={{ margin: '4px 0', fontWeight: 700 }}>{invoice.buyer.name}</p>
              {invoice.buyer.address ? <p style={{ margin: 0, fontSize: 13 }}>{invoice.buyer.address}</p> : null}
              <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                GST No: {invoice.buyer.gstin || '—'}
              </p>
            </div>
            <div style={{ textAlign: 'right', fontSize: 13 }}>
              <p style={{ margin: 0 }}>
                <b>Invoice No</b> {invoice.invoiceNumber}
              </p>
              <p style={{ margin: '4px 0 0' }}>
                <b>Date</b>{' '}
                {new Date(invoice.issuedAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </p>
              <p style={{ margin: '4px 0 0' }}>
                <b>SAC</b> {invoice.sacCode}
              </p>
              <p style={{ margin: '4px 0 0' }}>
                <b>State Code</b> {invoice.buyer.stateCode || invoice.placeOfSupply || '—'}
              </p>
              <p style={{ margin: '4px 0 0' }}>
                <b>Status</b> {invoice.status}
                {invoice.paymentStatus ? ` · Payment ${invoice.paymentStatus}` : ''}
              </p>
            </div>
          </div>

          <p style={{ fontSize: 13, marginBottom: 12 }}>{invoice.lineDescription}</p>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '8px 4px' }}>Particulars</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '8px 4px' }}>Ref</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ccc', padding: '8px 4px' }}>Rates</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ccc', padding: '8px 4px' }}>Total Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '8px 4px' }}>Value of Service Rendered</td>
                <td style={{ padding: '8px 4px' }}>A</td>
                <td style={{ padding: '8px 4px', textAlign: 'right' }}>—</td>
                <td style={{ padding: '8px 4px', textAlign: 'right' }}>{formatInrFromPaise(invoice.taxablePaise)}</td>
              </tr>
              {invoice.taxMode === 'CGST_SGST' ? (
                <>
                  <tr>
                    <td style={{ padding: '8px 4px' }}>CGST {invoice.gstRatePercent / 2}%</td>
                    <td style={{ padding: '8px 4px' }}>B</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right' }}>{invoice.gstRatePercent / 2}%</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right' }}>{formatInrFromPaise(invoice.cgstPaise)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 4px' }}>SGST {invoice.gstRatePercent / 2}%</td>
                    <td style={{ padding: '8px 4px' }}>C</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right' }}>{invoice.gstRatePercent / 2}%</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right' }}>{formatInrFromPaise(invoice.sgstPaise)}</td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td style={{ padding: '8px 4px' }}>IGST {invoice.gstRatePercent}%</td>
                  <td style={{ padding: '8px 4px' }}>B</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }}>{invoice.gstRatePercent}%</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }}>{formatInrFromPaise(invoice.igstPaise)}</td>
                </tr>
              )}
              <tr>
                <td style={{ padding: '10px 4px', fontWeight: 700 }} colSpan={3}>
                  Total {invoice.taxMode === 'CGST_SGST' ? '(A+B+C)' : '(A+B)'}
                </td>
                <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 700 }}>
                  {formatInrFromPaise(invoice.totalPaise)}
                </td>
              </tr>
            </tbody>
          </table>

          <p style={{ marginTop: 16, fontSize: 13 }}>
            <b>In words:</b> {invoice.amountInWords}
          </p>

          {bank ? (
            <section style={{ marginTop: 20, fontSize: 13 }}>
              <p style={{ margin: '0 0 6px', fontWeight: 700 }}>Bank Details</p>
              <p style={{ margin: 0 }}>Account Name {bank.accountName}</p>
              <p style={{ margin: 0 }}>Account No {bank.accountNo}</p>
              <p style={{ margin: 0 }}>IFSC Code {bank.ifsc}</p>
              <p style={{ margin: 0 }}>Branch {bank.branch}</p>
              <p style={{ margin: 0 }}>Bank Name {bank.bankName}</p>
            </section>
          ) : null}

          <section
            style={{
              marginTop: 28,
              display: 'flex',
              justifyContent: 'flex-end',
              pageBreakInside: 'avoid',
            }}
            aria-label="Authorised signatory"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/invoices/authorised-signatory.png"
              alt="For SRSB Workforce Solutions Pvt. Ltd. — Authorised Signatory"
              width={280}
              height={120}
              style={{ maxWidth: 280, width: '100%', height: 'auto', objectFit: 'contain' }}
            />
          </section>
        </article>
      ) : null}
    </EmployerShellFallback>
  );
}
