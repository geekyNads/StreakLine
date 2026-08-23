import type { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";

/**
 * Security notes:
 * - We request only the `read:user` scope. No repo, org, or write access —
 *   the app has no reason to see private code, so it never asks for it.
 * - The GitHub access token lives only inside the encrypted (JWE) session
 *   cookie via the `jwt` callback below. It is deliberately left off the
 *   `session` object returned by the `session` callback, so client-side
 *   JavaScript can never read it. Only server code (API routes) can decrypt
 *   it via `getToken()`.
 * - Sessions are short-lived and re-validated against GitHub on each
 *   dashboard load, so a revoked GitHub authorization stops working
 *   immediately rather than lingering in a stale session.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID as string,
      clientSecret: process.env.GITHUB_SECRET as string,
      authorization: { params: { scope: "read:user" } }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 12 * 60 * 60 // 12 hours
  },
  cookies: {
    sessionToken: {
      // The __Host- prefix only works over HTTPS, so it's reserved for
      // production. Local dev over http:// falls back to a plain name.
      name:
        process.env.NODE_ENV === "production"
          ? "__Host-streakline.session-token"
          : "streakline.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production"
      }
    }
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.accessToken = account.access_token;
        token.login = (profile as { login?: string }).login;
      }
      return token;
    },
    async session({ session, token }) {
      // Intentionally omit accessToken — the browser never needs it.
      if (session.user) {
        (session.user as { login?: string }).login = token.login as string | undefined;
      }
      return session;
    }
  },
  pages: {
    signIn: "/"
  },
  secret: process.env.NEXTAUTH_SECRET
};
