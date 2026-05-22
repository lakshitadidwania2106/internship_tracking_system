import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-br from-[#b8efe3] via-background to-[#eef6fb] px-4 py-10">
      <LoginForm />
    </div>
  );
}
