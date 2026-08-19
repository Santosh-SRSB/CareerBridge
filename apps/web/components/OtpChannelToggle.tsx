'use client';

import type { OtpChannel } from '@careerbridge/shared';

export function OtpChannelToggle({
  value,
  onChange,
}: {
  value: OtpChannel;
  onChange: (channel: OtpChannel) => void;
}) {
  return (
    <div className="relative grid grid-cols-2 rounded-md bg-primary/5 p-0.5 ring-1 ring-primary/10">
      <span
        className={`absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-sm bg-primary shadow-sm transition-transform duration-300 ease-out ${
          value === 'EMAIL' ? 'translate-x-full' : 'translate-x-0'
        }`}
      />
      <button
        type="button"
        onClick={() => onChange('MOBILE')}
        className={`relative z-10 rounded-sm px-2 py-2 text-xs font-bold transition-colors duration-300 ${
          value === 'MOBILE' ? 'text-white' : 'text-primary/60 hover:text-primary'
        }`}
      >
        Mobile OTP
      </button>
      <button
        type="button"
        onClick={() => onChange('EMAIL')}
        className={`relative z-10 rounded-sm px-2 py-2 text-xs font-bold transition-colors duration-300 ${
          value === 'EMAIL' ? 'text-white' : 'text-primary/60 hover:text-primary'
        }`}
      >
        Email OTP
      </button>
    </div>
  );
}
