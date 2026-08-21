import { redirect } from 'next/navigation';

export default function EmployerRegisterRedirectPage() {
  redirect('/register?role=employer');
}
