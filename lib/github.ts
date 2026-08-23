export type ContributionDay = { date: string; count: number };

export type ContributionData = {
  login: string;
  avatarUrl: string;
  totalContributions: number;
  days: ContributionDay[];
  weeks: ContributionDay[][];
};

export type RepoBreakdown = {
  repos: { name: string; url: string; contributions: number; language: string | null; color: string | null }[];
  languages: { name: string; color: string; count: number }[];
};

export class GitHubApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Shared low-level GraphQL call. Never throws raw fetch/network detail to callers beyond a status + message. */
async function graphql<T>(token: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "streakline-app"
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store"
  });

  if (!res.ok) {
    throw new GitHubApiError(`GitHub API error: ${res.status}`, res.status);
  }

  const json = await res.json();
  if (json.errors) {
    const message: string = json.errors[0]?.message ?? "GitHub GraphQL error";
    // A bad/unknown username surfaces as a GraphQL error with `user` null,
    // not an HTTP error — normalize it to a 404-ish status callers can check.
    const notFound = /could not resolve to a user/i.test(message);
    throw new GitHubApiError(message, notFound ? 404 : 500);
  }

  return json.data as T;
}

function toCalendar(calendar: {
  totalContributions: number;
  weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
}) {
  const weeks: ContributionDay[][] = calendar.weeks.map((week) =>
    week.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount }))
  );
  return { weeks, days: weeks.flat(), totalContributions: calendar.totalContributions };
}

const VIEWER_QUERY = `
  query {
    viewer {
      login
      avatarUrl
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount } }
        }
      }
    }
  }
`;

/**
 * Fetches the last ~12 months of contribution activity for the
 * authenticated user. Runs server-side only — the access token never
 * reaches the browser. Uses `viewer` rather than a passed-in login, so a
 * given user's token can only ever read the profile it belongs to.
 */
export async function fetchViewerContributions(accessToken: string): Promise<ContributionData> {
  const data = await graphql<{
    viewer: {
      login: string;
      avatarUrl: string;
      contributionsCollection: { contributionCalendar: Parameters<typeof toCalendar>[0] };
    };
  }>(accessToken, VIEWER_QUERY);

  const { weeks, days, totalContributions } = toCalendar(
    data.viewer.contributionsCollection.contributionCalendar
  );

  return { login: data.viewer.login, avatarUrl: data.viewer.avatarUrl, totalContributions, days, weeks };
}

const REPO_BREAKDOWN_QUERY = `
  query {
    viewer {
      contributionsCollection {
        commitContributionsByRepository(maxRepositories: 15) {
          contributions { totalCount }
          repository {
            name
            url
            primaryLanguage { name color }
          }
        }
      }
    }
  }
`;

/**
 * Top repos by commit contributions this year, plus a derived language
 * breakdown (each repo's primary language, weighted by contributions to
 * it). This is an approximation — GitHub doesn't expose true per-language
 * line counts through this API — but it's a fair reflection of where the
 * user's activity actually went.
 */
export async function fetchViewerRepoBreakdown(accessToken: string): Promise<RepoBreakdown> {
  const data = await graphql<{
    viewer: {
      contributionsCollection: {
        commitContributionsByRepository: {
          contributions: { totalCount: number };
          repository: { name: string; url: string; primaryLanguage: { name: string; color: string } | null };
        }[];
      };
    };
  }>(accessToken, REPO_BREAKDOWN_QUERY);

  const rows = data.viewer.contributionsCollection.commitContributionsByRepository;

  const repos = rows
    .map((r) => ({
      name: r.repository.name,
      url: r.repository.url,
      contributions: r.contributions.totalCount,
      language: r.repository.primaryLanguage?.name ?? null,
      color: r.repository.primaryLanguage?.color ?? null
    }))
    .sort((a, b) => b.contributions - a.contributions);

  const langTotals = new Map<string, { count: number; color: string }>();
  for (const repo of repos) {
    if (!repo.language) continue;
    const existing = langTotals.get(repo.language);
    langTotals.set(repo.language, {
      count: (existing?.count ?? 0) + repo.contributions,
      color: repo.color ?? existing?.color ?? "#999999"
    });
  }

  const languages = [...langTotals.entries()]
    .map(([name, v]) => ({ name, count: v.count, color: v.color }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return { repos: repos.slice(0, 8), languages };
}

const PUBLIC_USER_QUERY = `
  query ($login: String!) {
    user(login: $login) {
      login
      avatarUrl
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount } }
        }
      }
    }
  }
`;

/**
 * Looks up ANY public GitHub user's contribution calendar — the same data
 * visible to anyone on github.com while logged out. Requires a
 * server-owned token (GITHUB_PUBLIC_DATA_TOKEN) rather than a visitor's
 * own OAuth token, since visitors don't have one for arbitrary usernames.
 *
 * Because this path doesn't require a visitor to be signed in, it's the
 * one most exposed to abuse — callers MUST rate limit by IP before
 * reaching this function. See /api/compare and /card/[username].
 */
export async function fetchPublicUserContributions(login: string): Promise<ContributionData> {
  const serverToken = process.env.GITHUB_PUBLIC_DATA_TOKEN;
  if (!serverToken) {
    throw new GitHubApiError("Public lookups are not configured on this server.", 501);
  }

  const data = await graphql<{
    user: {
      login: string;
      avatarUrl: string;
      contributionsCollection: { contributionCalendar: Parameters<typeof toCalendar>[0] };
    } | null;
  }>(serverToken, PUBLIC_USER_QUERY, { login });

  if (!data.user) {
    throw new GitHubApiError("No GitHub user with that username.", 404);
  }

  const { weeks, days, totalContributions } = toCalendar(data.user.contributionsCollection.contributionCalendar);
  return { login: data.user.login, avatarUrl: data.user.avatarUrl, totalContributions, days, weeks };
}
