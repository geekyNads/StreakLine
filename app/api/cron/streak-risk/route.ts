import { NextResponse } from "next/server";
import { listSubscriptions } from "@/lib/notifications";
import { fetchPublicUserContributions, GitHubApiError } from "@/lib/github";
import { computeStreaks } from "@/lib/streak";
import { sendEmail, isEmailConfigured } from "@/lib/email";

export const maxDuration = 60;

function buildMessage(login: string, currentStreak: number, unsubToken: string, origin: string) {
  const unsubUrl = `${origin}/api/notify/unsubscribe?token=${unsubToken}`;
  return [
    `Hey @${login} — you're on a ${currentStreak}-day GitHub streak, and there's no contribution logged yet today.`,
    ``,
    `A single commit, PR, or review keeps it alive.`,
    ``,
    `— streakline`,
    ``,
    `Unsubscribe: ${unsubUrl}`
  ].join("\n");
}

/**
 * Invoked by Vercel Cron (see vercel.json), once daily. Protected by
 * CRON_SECRET — Vercel automatically sends it as a Bearer token when that
 * env var is set, so this rejects any other caller, including someone who
 * discovers the URL.
 *
 * Deliberately checks PUBLIC contribution data (the same server token the
 * share card uses) rather than needing anyone's personal GitHub token —
 * this app never stores those, and this is why it doesn't have to.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json({ skipped: "Email not configured." });
  }

  const origin = new URL(req.url).origin;
  const subs = await listSubscriptions();

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const sub of subs) {
    try {
      const data = await fetchPublicUserContributions(sub.login);
      const { current } = computeStreaks(data.days);
      const today = new Date().toISOString().slice(0, 10);
      const todayCount = data.days.find((d) => d.date === today)?.count ?? 0;

      // Only email if there's an actual streak worth protecting AND today
      // genuinely has nothing logged yet — never just "here's your streak".
      if (current > 0 && todayCount === 0) {
        await sendEmail(sub.email, `Your ${current}-day streak is at risk`, buildMessage(sub.login, current, sub.unsubToken, origin));
        sent += 1;
      } else {
        skipped += 1;
      }
    } catch (err) {
      failed += 1;
      const status = err instanceof GitHubApiError ? err.status : "unknown";
      console.error(`streak-risk check failed for ${sub.login}`, status, err);
    }
  }

  return NextResponse.json({ checked: subs.length, sent, skipped, failed });
}
