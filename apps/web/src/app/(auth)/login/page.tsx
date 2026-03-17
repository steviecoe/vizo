import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100">
      <div className="w-full max-w-md rounded-2xl bg-stone-50 p-8 shadow-sm border border-stone-200">
        <LoginForm />
      </div>
    </main>
  );
}
