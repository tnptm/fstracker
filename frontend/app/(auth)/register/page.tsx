import Link from "next/link";
import RegisterForm from "@/components/RegisterForm";

export const metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Create account</h1>
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-teal-700 hover:underline dark:text-teal-300">
          Log in
        </Link>
      </p>
    </>
  );
}
