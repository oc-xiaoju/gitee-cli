import { Command } from 'commander';
import { getToken } from '../config.js';
import { apiRequest, resolveRepo, formatDate, handleError } from '../api.js';

interface GiteePR {
  id: number;
  number: number;
  title: string;
  state: string;
  body?: string;
  user?: { login: string };
  head?: { label: string; sha: string };
  base?: { label: string; sha: string };
  merged?: boolean;
  merged_at?: string;
  created_at: string;
  updated_at: string;
  html_url: string;
  comments?: number;
  commits?: number;
  changed_files?: number;
}

export function registerPrCommands(program: Command): void {
  const pr = program
    .command('pr')
    .description('Manage pull requests');

  pr
    .command('list')
    .description('List pull requests')
    .option('--repo <owner/repo>', 'Repository (owner/repo)')
    .option('--state <state>', 'State: open|closed|merged|all (default: open)', 'open')
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page', '20')
    .option('--json', 'Output raw JSON')
    .action(async (opts: { repo?: string; state?: string; page?: string; perPage?: string; json?: boolean }) => {
      const token = getToken();
      const repoName = resolveRepo(opts.repo);
      const [owner, repo] = repoName.split('/');

      try {
        const prs = await apiRequest<GiteePR[]>(`/repos/${owner}/${repo}/pulls`, {
          token,
          params: {
            state: opts.state || 'open',
            page: opts.page || 1,
            per_page: opts.perPage || 20,
          },
        });

        if (opts.json) {
          console.log(JSON.stringify(prs, null, 2));
          return;
        }

        if (!prs.length) {
          console.log('No pull requests found.');
          return;
        }

        console.log(`Pull requests in ${repoName}:\n`);
        for (const p of prs) {
          const head = p.head?.label || 'unknown';
          const base = p.base?.label || 'unknown';
          console.log(`  #${p.number} ${p.title}`);
          console.log(`     ${p.state} · ${head} → ${base} · by ${p.user?.login || 'unknown'} · ${formatDate(p.created_at)}`);
        }
      } catch (err) {
        handleError(err);
      }
    });

  pr
    .command('create')
    .description('Create a pull request')
    .option('--repo <owner/repo>', 'Repository (owner/repo)')
    .requiredOption('--title <title>', 'PR title')
    .requiredOption('--head <branch>', 'Source branch (head)')
    .option('--base <branch>', 'Target branch (base)', 'master')
    .option('--body <desc>', 'PR description')
    .option('--json', 'Output raw JSON')
    .action(async (opts: { repo?: string; title: string; head: string; base?: string; body?: string; json?: boolean }) => {
      const token = getToken();
      if (!token) {
        console.error('Error: Authentication required. Run `gitee auth login` or set GITEE_TOKEN.');
        process.exit(1);
      }

      const repoName = resolveRepo(opts.repo);
      const [owner, repo] = repoName.split('/');

      try {
        const created = await apiRequest<GiteePR>(`/repos/${owner}/${repo}/pulls`, {
          method: 'POST',
          token,
          body: {
            title: opts.title,
            head: opts.head,
            base: opts.base || 'master',
            body: opts.body || '',
          },
        });

        if (opts.json) {
          console.log(JSON.stringify(created, null, 2));
          return;
        }

        console.log(`✓ Created PR #${created.number}: ${created.title}`);
        console.log(`  URL: ${created.html_url}`);
      } catch (err) {
        handleError(err);
      }
    });

  pr
    .command('view <number>')
    .description('View pull request details')
    .option('--repo <owner/repo>', 'Repository (owner/repo)')
    .option('--json', 'Output raw JSON')
    .action(async (number: string, opts: { repo?: string; json?: boolean }) => {
      const token = getToken();
      const repoName = resolveRepo(opts.repo);
      const [owner, repo] = repoName.split('/');

      try {
        const p = await apiRequest<GiteePR>(`/repos/${owner}/${repo}/pulls/${number}`, { token });

        if (opts.json) {
          console.log(JSON.stringify(p, null, 2));
          return;
        }

        console.log(`#${p.number} ${p.title}`);
        console.log(`─────────────────────────────`);
        console.log(`State:   ${p.state}${p.merged ? ' (merged)' : ''}`);
        console.log(`Author:  ${p.user?.login || 'unknown'}`);
        console.log(`Head:    ${p.head?.label || 'unknown'}`);
        console.log(`Base:    ${p.base?.label || 'unknown'}`);
        if (p.commits !== undefined) console.log(`Commits: ${p.commits}`);
        if (p.changed_files !== undefined) console.log(`Changed: ${p.changed_files} files`);
        console.log(`Created: ${formatDate(p.created_at)}`);
        console.log(`Updated: ${formatDate(p.updated_at)}`);
        if (p.merged_at) console.log(`Merged:  ${formatDate(p.merged_at)}`);
        console.log(`URL:     ${p.html_url}`);
        if (p.body) {
          console.log(`\n${p.body}`);
        }
      } catch (err) {
        handleError(err);
      }
    });

  pr
    .command('merge <number>')
    .description('Merge a pull request')
    .option('--repo <owner/repo>', 'Repository (owner/repo)')
    .option('--method <method>', 'Merge method: merge|squash|rebase', 'merge')
    .option('--message <msg>', 'Merge commit message')
    .option('--json', 'Output raw JSON')
    .action(async (number: string, opts: { repo?: string; method?: string; message?: string; json?: boolean }) => {
      const token = getToken();
      if (!token) {
        console.error('Error: Authentication required. Run `gitee auth login` or set GITEE_TOKEN.');
        process.exit(1);
      }

      const repoName = resolveRepo(opts.repo);
      const [owner, repo] = repoName.split('/');

      const methodMap: Record<string, string> = {
        merge: 'merge',
        squash: 'squash',
        rebase: 'rebase',
      };

      const mergeMethod = methodMap[opts.method || 'merge'] || 'merge';

      try {
        await apiRequest(`/repos/${owner}/${repo}/pulls/${number}/merge`, {
          method: 'PUT',
          token,
          body: {
            merge_method: mergeMethod,
            commit_message: opts.message || '',
          },
        });

        if (opts.json) {
          console.log(JSON.stringify({ merged: true, number, method: mergeMethod }));
          return;
        }

        console.log(`✓ Merged PR #${number} (${mergeMethod})`);
      } catch (err) {
        handleError(err);
      }
    });

  pr
    .command('close <number>')
    .description('Close a pull request')
    .option('--repo <owner/repo>', 'Repository (owner/repo)')
    .option('--json', 'Output raw JSON')
    .action(async (number: string, opts: { repo?: string; json?: boolean }) => {
      const token = getToken();
      if (!token) {
        console.error('Error: Authentication required. Run `gitee auth login` or set GITEE_TOKEN.');
        process.exit(1);
      }

      const repoName = resolveRepo(opts.repo);
      const [owner, repo] = repoName.split('/');

      try {
        const updated = await apiRequest<GiteePR>(`/repos/${owner}/${repo}/pulls/${number}`, {
          method: 'PATCH',
          token,
          body: { state: 'closed' },
        });

        if (opts.json) {
          console.log(JSON.stringify(updated, null, 2));
          return;
        }

        console.log(`✓ Closed PR #${number}`);
      } catch (err) {
        handleError(err);
      }
    });
}
