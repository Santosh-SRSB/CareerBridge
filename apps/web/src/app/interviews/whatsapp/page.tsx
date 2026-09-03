'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { Button } from '@/components/ui/Button';

export default function WhatsAppPreviewPage() {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);

  return (
    <CandidateAppShell activeTab="interviews" showBack title="WhatsApp preview" maxWidth="max-w-2xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">WhatsApp Notification Preview</h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
            Sent automatically to candidate&apos;s WhatsApp number when an interview is scheduled.
          </p>
        </div>

        {/* WhatsApp Message Bubble Card */}
        <div className="rounded-2xl border border-slate-200 bg-[#efeae2] p-5 sm:p-8 shadow-xs">
          <div className="rounded-2xl bg-[#dcf8c6] p-5 shadow-sm text-slate-800 space-y-3 max-w-md mx-auto sm:mx-0">
            <p className="text-xs sm:text-sm font-semibold leading-relaxed">
              ABC Services has scheduled an interview for <strong>Customer service executive</strong>.
            </p>
            <div className="text-xs sm:text-sm space-y-1 text-slate-700 bg-white/50 p-3 rounded-xl">
              <p>📅 <strong>Date:</strong> 12 September</p>
              <p>⏰ <strong>Time:</strong> 11:00 AM IST</p>
            </div>
            <p className="text-xs font-medium text-slate-700">
              Please confirm your availability to lock the slot.
            </p>
            <div className="flex items-center justify-end gap-1 text-[10px] text-slate-500 pt-1">
              <span>11:02 AM</span>
              <span className="text-[#3b82f6]">✓✓</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            type="button"
            onClick={() => {
              setConfirmed(true);
              router.push('/interviews');
            }}
            className="flex-1 py-3.5 text-sm font-bold bg-[#0a2e2c] hover:bg-[#072422] text-white shadow-md hover:shadow-lg transition rounded-xl"
          >
            {confirmed ? 'Interview Confirmed ✓' : 'Confirm interview'}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/interviews')}
            className="flex-1 py-3.5 text-sm font-bold border-slate-200 text-slate-800 hover:bg-slate-50 rounded-xl"
          >
            Request reschedule
          </Button>
        </div>
      </div>
    </CandidateAppShell>
  );
}
