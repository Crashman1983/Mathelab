/**
 * URL Hash Router (Baustein 10).
 *
 * Format: #/moduleId/taskType?d=difficulty
 * Example: #/multiplication/core?d=2
 */

export interface RouteParams {
  moduleId: string;
  taskType?: string;
  difficulty?: number;
}

/**
 * Parse the current URL hash into route params.
 * Returns null if no valid route found.
 */
export function parseRoute(): RouteParams | null {
  const hash = window.location.hash;
  if (!hash || hash === "#" || hash === "#/") return null;

  // Format: #/moduleId or #/moduleId/taskType or #/moduleId/taskType?d=2
  const match = hash.match(
    /^#\/([a-zA-Z][a-zA-Z0-9-]*)(?:\/([a-zA-Z][a-zA-Z0-9-]*))?(?:\?(.*))?$/,
  );
  if (!match) return null;

  const [, moduleId, taskType, queryString] = match;
  if (!moduleId) return null;

  const params: RouteParams = { moduleId };
  if (taskType) params.taskType = taskType;

  if (queryString) {
    const searchParams = new URLSearchParams(queryString);
    const d = searchParams.get("d");
    if (d) {
      const num = parseInt(d, 10);
      if (!isNaN(num) && num >= 1) params.difficulty = num;
    }
  }

  return params;
}

/**
 * Set the URL hash without triggering a hashchange event handler
 * (useful for programmatic navigation).
 */
export function setRoute(params: RouteParams): void {
  let hash = `#/${params.moduleId}`;
  if (params.taskType) hash += `/${params.taskType}`;
  if (params.difficulty) hash += `?d=${params.difficulty}`;
  history.replaceState(null, "", hash);
}

/**
 * Listen for hash changes and invoke callback.
 * Returns cleanup function.
 */
export function onRouteChange(
  callback: (params: RouteParams | null) => void,
): () => void {
  const handler = (): void => callback(parseRoute());
  window.addEventListener("hashchange", handler);
  return () => window.removeEventListener("hashchange", handler);
}

/**
 * Navigate to home (clear hash).
 */
export function navigateHome(): void {
  history.replaceState(null, "", window.location.pathname);
}
