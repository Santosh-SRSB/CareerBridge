import Link from 'next/link';
import { AuthShell } from '@/components/AuthShell';
import { PhoneAuthForm } from '@/components/PhoneAuthForm';

export default function OtpLoginPage() {
  return (
    <AuthShell title="Sign in with OTP" subtitle="Use Mobile OTP or Email OTP." scene="verify">
      <PhoneAuthForm purpose="LOGIN" />
      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="font-semibold text-primary">
          Sign in with password
        </Link>
      </p>
    </AuthShell>
  );
}
