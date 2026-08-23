import { getToken } from "next-auth/jwt";
import { authOptions } from "./auth";

export async function getAuthedUser(req: Request) {
  const token = await getToken({
    // @ts-expect-error - getToken accepts the raw Request in the App Router
    req,
    secret: process.env.NEXTAUTH_SECRET,
    // Must match the custom cookie name in lib/auth.ts, or this silently finds nothing.
    cookieName: authOptions.cookies?.sessionToken?.name,
    secureCookie: process.env.NODE_ENV === "production"
  });

  if (!token || !token.accessToken || !token.login) return null;
  return { accessToken: token.accessToken as string, login: token.login as string };
}
