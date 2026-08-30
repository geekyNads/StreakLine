export type ProjectPR = {
  number: number;
  title: string;
  author: string;
  state: "open" | "merged" | "closed";
  url: string;
  updatedAt: string;
};

export type ProjectPRCounts = {
  open: number;
  merged: number;
  closed: number;
};

function classify(pr: { state: string; merged_at: string | null }): ProjectPR["state"] {
  if (pr.merged_at) return "merged";
  return pr.state === "open" ? "open" : "closed";
}

async function githubRest(path: string) {
  const token = process.env.GITHUB_PUBLIC_DATA_TOKEN;
  if (!token) throw new Error("GITHUB_PUBLIC_DATA_TOKEN is not configured.");

  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "streakline-app"
    },
    cache: "no-store"
  });

  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json();
}

export async function fetchProjectPullRequests(
  owner: string,
  repo: string,
  limit = 20
): Promise<ProjectPR[]> {
  const raw = await githubRest(
    `/repos/${owner}/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=${limit}`
  );

  return (raw as Array<Record<string, unknown>>).map((pr) => ({
    number: pr.number as number,
    title: pr.title as string,
    author: (pr.user as { login?: string } | null)?.login ?? "unknown",
    state: classify(pr as { state: string; merged_at: string | null }),
    url: pr.html_url as string,
    updatedAt: pr.updated_at as string
  }));
}

/** Uses the search API for accurate total counts rather than paginating the list endpoint. */
export async function fetchProjectPRCounts(owner: string, repo: string): Promise<ProjectPRCounts> {
  const [open, merged, closed] = await Promise.all([
    githubRest(`/search/issues?q=repo:${owner}/${repo}+is:pr+is:open`),
    githubRest(`/search/issues?q=repo:${owner}/${repo}+is:pr+is:merged`),
    githubRest(`/search/issues?q=repo:${owner}/${repo}+is:pr+is:closed+is:unmerged`)
  ]);

  return {
    open: (open as { total_count: number }).total_count,
    merged: (merged as { total_count: number }).total_count,
    closed: (closed as { total_count: number }).total_count
  };
}
