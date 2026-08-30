/** Parses "owner/repo" from GITHUB_PROJECT_REPO. Returns null if unset or malformed, so callers can hide the feature cleanly. */
export function getProjectRepo(): { owner: string; repo: string } | null {
  const raw = process.env.GITHUB_PROJECT_REPO;
  if (!raw) return null;
  const [owner, repo] = raw.split("/");
  if (!owner || !repo) return null;
  return { owner, repo };
}
