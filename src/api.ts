import { execSync } from 'child_process';

const API_BASE = 'https://gitee.com/api/v5';

export interface RequestOptions {
  method?: string;
  params?: Record<string, string | number | boolean | undefined>;
  body?: Record<string, unknown>;
  token?: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', params = {}, body, token } = options;

  // Build URL
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`);

  // Add token to params if available
  if (token) {
    url.searchParams.set('access_token', token);
  }

  // Add other query params
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null) {
      url.searchParams.set(key, String(val));
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'gitee-cli/0.1.0',
  };

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url.toString(), fetchOptions);

  if (!response.ok) {
    let message = `HTTP ${response.status} ${response.statusText}`;
    try {
      const errBody = await response.json() as Record<string, unknown>;
      if (errBody.message) {
        message = String(errBody.message);
      } else if (errBody.error) {
        message = String(errBody.error);
      }
    } catch {
      // ignore
    }
    throw new ApiError(response.status, message);
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

/**
 * Detect owner/repo from current git remote (gitee.com)
 */
export function detectRepo(): string | undefined {
  try {
    const remote = execSync('git remote get-url origin 2>/dev/null', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    // Match: https://gitee.com/owner/repo or git@gitee.com:owner/repo.git
    const httpsMatch = remote.match(/https:\/\/gitee\.com\/([^/]+\/[^/]+?)(?:\.git)?$/);
    const sshMatch = remote.match(/git@gitee\.com:([^/]+\/[^/]+?)(?:\.git)?$/);

    return (httpsMatch || sshMatch)?.[1];
  } catch {
    return undefined;
  }
}

/**
 * Resolve owner/repo: explicit arg > auto-detect > error
 */
export function resolveRepo(explicit?: string): string {
  if (explicit) return explicit;
  const detected = detectRepo();
  if (detected) {
    return detected;
  }
  console.error('Error: Could not determine repository. Use --repo <owner/repo> or run inside a gitee.com git directory.');
  process.exit(1);
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export function handleError(err: unknown): never {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      console.error('Error: Unauthorized. Please run `gitee auth login` first or set GITEE_TOKEN.');
    } else if (err.status === 404) {
      console.error('Error: Not found. Check repository name and your access permissions.');
    } else if (err.status === 403) {
      console.error('Error: Forbidden. You may not have permission for this operation.');
    } else {
      console.error(`Error: ${err.message}`);
    }
  } else if (err instanceof Error) {
    console.error(`Error: ${err.message}`);
  } else {
    console.error('Unknown error occurred');
  }
  process.exit(1);
}
