import UserPanel from "@/components/UserPanel";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">
          fstracker
        </h1>
        <UserPanel />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <p className="text-zinc-600 dark:text-zinc-400">
          Volunteer hour tracking is coming soon.
        </p>
      </main>
    </div>
  );
}
