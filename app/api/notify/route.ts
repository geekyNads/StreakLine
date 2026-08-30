import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/session";
import { checkRateLimit } from "@/lib/rateLimit";
import { subscribe, unsubscribe, getSubscription, isNotifyConfigured } from "@/lib/notifications";
import { isEmailConfigured } from "@/lib/email";

const NOT_CONFIGURED = "Email notifications aren't set up on this server yet. See README.";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function enabled() {
  return isNotifyConfigured() && isEmailConfigured();
}

export async function GET(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!enabled()) return NextResponse.json({ subscribed: false, enabled: false });

  const sub = await getSubscription(user.login);
  return NextResponse.json({ subscribed: Boolean(sub), enabled: true });
}

export async function POST(req: Request) {
  if (!enabled()) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 501 });

  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { success, reset } = await checkRateLimit(user.login);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": Math.max(0, Math.ceil((reset - Date.now()) / 1000)).toString() } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  try {
    await subscribe(user.login, email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("notify subscribe failed", err);
    return NextResponse.json({ error: "Could not save that right now." }, { status: 502 });
  }
}

export async function DELETE(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  await unsubscribe(user.login);
  return NextResponse.json({ ok: true });
}
