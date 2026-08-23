import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DashboardData } from "./DashboardData";

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");

  const login = (session.user as { login?: string } | undefined)?.login;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
      <header className="flex items-center justify-between border-b border-hairline pb-6 dark:border-white/10">
        <div className="flex items-center gap-3">
          {session.user?.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.user.image} alt="" width={32} height={32} className="rounded-full" />
          )}
          <span className="font-mono text-sm">@{login}</span>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      <DashboardData />
    </main>
  );
}
