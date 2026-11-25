'use client';

import { formatInrFromPaise, SRSB_INVOICE_SELLER } from '@careerbridge/shared';
import type { EmployerInvoiceRow } from '@/lib/api';
import './invoice-print.css';

export type InvoiceSellerBank = {
  accountName: string;
  accountNo: string;
  ifsc: string;
  branch: string;
  bankName: string;
};

function formatIssued(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function InvoiceDocument({
  invoice,
  sellerBank,
}: {
  invoice: EmployerInvoiceRow;
  sellerBank?: InvoiceSellerBank | null;
}) {
  const bank = sellerBank ?? SRSB_INVOICE_SELLER.bank;

  return (
    <article
      className="ev-card inv-doc"
      style={{
        maxWidth: 860,
        margin: '16px auto',
        padding: 0,
        overflow: 'hidden',
        background: '#fff',
        color: '#0f172a',
        border: '1px solid #e2e8f0',
        boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #0C1245 0%, #1A1FC4 55%, #4F63FF 100%)',
          color: '#fff',
          padding: '22px 28px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/srsb-logo.png"
            alt="SRSB Career Bridge"
            width={56}
            height={56}
            style={{
              width: 56,
              height: 56,
              objectFit: 'contain',
              background: '#fff',
              borderRadius: 12,
              padding: 4,
              flexShrink: 0,
            }}
          />
          <div>
            <p style={{ margin: 0, fontSize: 11, letterSpacing: 1.6, opacity: 0.85 }}>TAX INVOICE</p>
            <h1 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, letterSpacing: 0.2 }}>
              SRSB Career Bridge
            </h1>
          </div>
        </div>
      </div>

      <div style={{ padding: '22px 28px 28px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 18,
            marginBottom: 22,
            paddingBottom: 18,
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 0.6 }}>
              BILL TO
            </p>
            <p style={{ margin: '6px 0 0', fontWeight: 800, fontSize: 16 }}>{invoice.buyer.name}</p>
            {invoice.buyer.address ? (
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569' }}>{invoice.buyer.address}</p>
            ) : null}
            <p style={{ margin: '6px 0 0', fontSize: 13 }}>GSTIN: {invoice.buyer.gstin || '—'}</p>
          </div>
          <div style={{ textAlign: 'right', fontSize: 13 }}>
            <p style={{ margin: 0 }}>
              <b>Invoice No</b>
              <br />
              {invoice.invoiceNumber}
            </p>
            <p style={{ margin: '10px 0 0' }}>
              <b>Date & time</b>
              <br />
              {formatIssued(invoice.issuedAt)}
            </p>
            <p style={{ margin: '10px 0 0' }}>
              <b>SAC</b> {invoice.sacCode} · <b>State</b>{' '}
              {invoice.buyer.stateCode || invoice.placeOfSupply || '—'}
            </p>
            <p style={{ margin: '10px 0 0' }}>
              <b>Invoice</b> {invoice.status}
              {invoice.paymentStatus ? (
                <>
                  {' '}
                  · <b>Payment</b> {invoice.paymentStatus}
                </>
              ) : null}
            </p>
            {invoice.paidAt ? (
              <p style={{ margin: '10px 0 0' }}>
                <b>Paid at</b>
                <br />
                {formatIssued(invoice.paidAt)}
              </p>
            ) : null}
          </div>
        </div>

        <p style={{ fontSize: 13, margin: '0 0 14px', color: '#334155' }}>{invoice.lineDescription}</p>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid #e2e8f0' }}>
                Particulars
              </th>
              <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid #e2e8f0' }}>Ref</th>
              <th style={{ textAlign: 'right', padding: '10px 8px', borderBottom: '1px solid #e2e8f0' }}>
                Rate
              </th>
              <th style={{ textAlign: 'right', padding: '10px 8px', borderBottom: '1px solid #e2e8f0' }}>
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '10px 8px' }}>Value of Service Rendered</td>
              <td style={{ padding: '10px 8px' }}>A</td>
              <td style={{ padding: '10px 8px', textAlign: 'right' }}>—</td>
              <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                {formatInrFromPaise(invoice.taxablePaise)}
              </td>
            </tr>
            {invoice.taxMode === 'CGST_SGST' ? (
              <>
                <tr>
                  <td style={{ padding: '10px 8px' }}>CGST {invoice.gstRatePercent / 2}%</td>
                  <td style={{ padding: '10px 8px' }}>B</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                    {invoice.gstRatePercent / 2}%
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                    {formatInrFromPaise(invoice.cgstPaise)}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '10px 8px' }}>SGST {invoice.gstRatePercent / 2}%</td>
                  <td style={{ padding: '10px 8px' }}>C</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                    {invoice.gstRatePercent / 2}%
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                    {formatInrFromPaise(invoice.sgstPaise)}
                  </td>
                </tr>
              </>
            ) : (
              <tr>
                <td style={{ padding: '10px 8px' }}>IGST {invoice.gstRatePercent}%</td>
                <td style={{ padding: '10px 8px' }}>B</td>
                <td style={{ padding: '10px 8px', textAlign: 'right' }}>{invoice.gstRatePercent}%</td>
                <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                  {formatInrFromPaise(invoice.igstPaise)}
                </td>
              </tr>
            )}
            <tr style={{ background: '#EEF0FF' }}>
              <td style={{ padding: '12px 8px', fontWeight: 800 }} colSpan={3}>
                Total payable {invoice.taxMode === 'CGST_SGST' ? '(A+B+C)' : '(A+B)'}
              </td>
              <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 800, color: '#1A1FC4' }}>
                {formatInrFromPaise(invoice.totalPaise)}
              </td>
            </tr>
          </tbody>
        </table>

        <p style={{ marginTop: 16, fontSize: 13 }}>
          <b>In words:</b> {invoice.amountInWords}
        </p>

        {invoice.razorpayPaymentId ? (
          <p style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
            Razorpay payment ID: {invoice.razorpayPaymentId}
          </p>
        ) : null}

        <div
          style={{
            marginTop: 20,
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: 24,
            alignItems: 'end',
            pageBreakInside: 'avoid',
            breakInside: 'avoid',
          }}
        >
          <section style={{ fontSize: 13, minWidth: 0 }} aria-label="Bank details">
            <p style={{ margin: '0 0 6px', fontWeight: 700 }}>Bank Details</p>
            <p style={{ margin: 0 }}>Account Name {bank.accountName}</p>
            <p style={{ margin: 0 }}>Account No {bank.accountNo}</p>
            <p style={{ margin: 0 }}>IFSC Code {bank.ifsc}</p>
            <p style={{ margin: 0 }}>Branch {bank.branch}</p>
            <p style={{ margin: 0 }}>Bank Name {bank.bankName}</p>
          </section>

          <section
            style={{
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'flex-end',
            }}
            aria-label="Authorised signatory"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/invoices/authorised-signatory.png"
              alt="For SRSB Workforce Solutions Pvt. Ltd. — Authorised Signatory"
              width={220}
              height={96}
              style={{
                maxWidth: 220,
                width: 220,
                height: 'auto',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </section>
        </div>
      </div>
    </article>
  );
}
