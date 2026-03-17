import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <LoginForm />
      </div>
    </main>
  );
}
