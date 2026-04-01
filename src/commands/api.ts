import { Command } from 'commander';
import { getToken } from '../config.js';
import { apiRequest, handleError } from '../api.js';

export function registerApiCommand(program: Command): void {
  program
    .command('api <method> <path>')
    .description('Make a raw API call to Gitee API v5')
    .option('--field <key=value>', 'Set request field (repeatable)', (val: string, prev: string[]) => {
      prev.push(val);
      return prev;
    }, [] as string[])
    .option('--query <key=value>', 'Set query parameter (repeatable)', (val: string, prev: string[]) => {
      prev.push(val);
      return prev;
    }, [] as string[])
    .option('--no-auth', 'Skip authentication token')
    .option('--paginate', 'Fetch all pages and combine results')
    .action(async (method: string, path: string, opts: {
      field: string[];
      query: string[];
      auth: boolean;
      paginate?: boolean;
    }) => {
      const token = opts.auth !== false ? getToken() : undefined;

      // Parse fields into body
      const body: Record<string, string> = {};
      for (const f of opts.field) {
        const idx = f.indexOf('=');
        if (idx === -1) {
          console.error(`Error: Invalid field format "${f}". Use key=value.`);
          process.exit(1);
        }
        body[f.slice(0, idx)] = f.slice(idx + 1);
      }

      // Parse query params
      const params: Record<string, string> = {};
      for (const q of opts.query) {
        const idx = q.indexOf('=');
        if (idx === -1) {
          console.error(`Error: Invalid query format "${q}". Use key=value.`);
          process.exit(1);
        }
        params[q.slice(0, idx)] = q.slice(idx + 1);
      }

      // Normalize path
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;

      try {
        const requestOpts = {
          method: method.toUpperCase(),
          token,
          params: Object.keys(params).length > 0 ? params : undefined,
          body: ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && Object.keys(body).length > 0 ? body : undefined,
        };

        // Resolve the API path:
        // - If user passes /v5/... → use as-is (strip leading /v5 since API_BASE already has /v5)
        // - If user passes /repos/... or /user/... → prepend nothing (API_BASE handles it)
        // - Raw absolute URL → pass directly
        let apiPath: string;
        if (normalizedPath.startsWith('/v5/')) {
          // strip /v5 prefix since apiRequest prepends API_BASE which already ends with /v5
          apiPath = normalizedPath.slice(3); // remove /v5
        } else {
          apiPath = normalizedPath;
        }

        if (opts.paginate) {
          const allResults: unknown[] = [];
          let page = 1;
          while (true) {
            const pageParams = { ...params, page, per_page: 100 };
            const result = await apiRequest<unknown>(apiPath, {
              ...requestOpts,
              params: pageParams,
            });
            if (Array.isArray(result)) {
              allResults.push(...result);
              if (result.length < 100) break;
              page++;
            } else {
              console.log(JSON.stringify(result, null, 2));
              return;
            }
          }
          console.log(JSON.stringify(allResults, null, 2));
        } else {
          const result = await apiRequest<unknown>(apiPath, requestOpts);
          console.log(JSON.stringify(result, null, 2));
        }
      } catch (err) {
        handleError(err);
      }
    });
}
