import { Suspense } from "react";
import Link from "next/link";
import LoginForm from "@/components/LoginForm";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Welcome back</h1>
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
        No account yet?{" "}
        <Link href="/register" className="font-medium text-teal-700 hover:underline dark:text-teal-300">
          Create one
        </Link>
      </p>
    </>
  );
}
