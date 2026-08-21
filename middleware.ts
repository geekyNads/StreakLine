import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, identifierFromRequest } from "@/lib/rateLimit";

// A lighter, IP-based limit specifically on the OAuth endpoints, so the
// sign-in flow itself can't be used to hammer GitHub or brute-force
// callback params. The per-user limit in /api/contributions handles the
// data endpoint separately.
export async function middleware(req: NextRequest) {
  const identifier = identifierFromRequest(req);
  const { success, reset } = await checkRateLimit(`auth:${identifier}`);

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": Math.max(0, Math.ceil((reset - Date.now()) / 1000)).toString()
        }
      }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/auth/:path*"]
};
