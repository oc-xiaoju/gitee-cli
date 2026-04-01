import { Command } from 'commander';
import { getToken } from '../config.js';
import { apiRequest, handleError } from '../api.js';

interface GiteeOrg {
  id: number;
  login: string;
  name?: string;
  avatar_url?: string;
  description?: string;
  html_url?: string;
  public_repos?: number;
  members_count?: number;
}

export function registerOrgCommands(program: Command): void {
  const org = program
    .command('org')
    .description('Manage organizations');

  org
    .command('list')
    .description('List organizations for the authenticated user')
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page', '20')
    .option('--json', 'Output raw JSON')
    .action(async (opts: { page?: string; perPage?: string; json?: boolean }) => {
      const token = getToken();
      if (!token) {
        console.error('Error: Authentication required. Run `gitee auth login` or set GITEE_TOKEN.');
        process.exit(1);
      }

      try {
        const orgs = await apiRequest<GiteeOrg[]>('/user/orgs', {
          token,
          params: {
            page: opts.page || 1,
            per_page: opts.perPage || 20,
          },
        });

        if (opts.json) {
          console.log(JSON.stringify(orgs, null, 2));
          return;
        }

        if (!orgs.length) {
          console.log('No organizations found.');
          return;
        }

        console.log(`Organizations:\n`);
        for (const o of orgs) {
          console.log(`  ${o.login}${o.name && o.name !== o.login ? ` (${o.name})` : ''}`);
          if (o.description) console.log(`    ${o.description}`);
        }
      } catch (err) {
        handleError(err);
      }
    });
}
