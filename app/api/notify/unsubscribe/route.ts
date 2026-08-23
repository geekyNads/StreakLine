import { unsubscribeByToken } from "@/lib/notifications";
import { checkRateLimit, identifierFromRequest } from "@/lib/rateLimit";

export async function GET(req: Request) {
  const { success } = await checkRateLimit(identifierFromRequest(req), "strict");
  if (!success) return new Response("Too many requests", { status: 429 });

  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") ?? "";
  if (!token) return new Response("Missing token", { status: 400 });

  const ok = await unsubscribeByToken(token);

  return new Response(
    ok
      ? "You've been unsubscribed from streak-risk reminders. You can close this tab."
      : "That unsubscribe link is invalid or already used.",
    { status: ok ? 200 : 404, headers: { "Content-Type": "text/plain" } }
  );
}
