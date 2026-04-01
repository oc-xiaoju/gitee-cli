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

  pr
    .command('comment <number>')
    .description('Add a comment to a pull request')
    .option('--repo <owner/repo>', 'Repository (owner/repo)')
    .requiredOption('--body <comment>', 'Comment body')
    .option('--json', 'Output raw JSON')
    .action(async (number: string, opts: { repo?: string; body: string; json?: boolean }) => {
      const token = getToken();
      if (!token) {
        console.error('Error: Authentication required. Run `gitee auth login` or set GITEE_TOKEN.');
        process.exit(1);
      }

      const repoName = resolveRepo(opts.repo);
      const [owner, repo] = repoName.split('/');

      try {
        const comment = await apiRequest<{ id: number; body: string; user?: { login: string }; created_at: string }>(
          `/repos/${owner}/${repo}/pulls/${number}/comments`,
          {
            method: 'POST',
            token,
            body: { body: opts.body },
          }
        );

        if (opts.json) {
          console.log(JSON.stringify(comment, null, 2));
          return;
        }

        console.log(`✓ Comment added (id: ${comment.id})`);
      } catch (err) {
        handleError(err);
      }
    });

  pr
    .command('comments <number>')
    .description('List comments on a pull request')
    .option('--repo <owner/repo>', 'Repository (owner/repo)')
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page', '20')
    .option('--json', 'Output raw JSON')
    .action(async (number: string, opts: { repo?: string; page?: string; perPage?: string; json?: boolean }) => {
      const token = getToken();
      const repoName = resolveRepo(opts.repo);
      const [owner, repo] = repoName.split('/');

      try {
        const comments = await apiRequest<Array<{
          id: number;
          body: string;
          user?: { login: string };
          created_at: string;
          updated_at: string;
          path?: string;
          position?: number;
        }>>(`/repos/${owner}/${repo}/pulls/${number}/comments`, {
          token,
          params: {
            page: opts.page || 1,
            per_page: opts.perPage || 20,
          },
        });

        if (opts.json) {
          console.log(JSON.stringify(comments, null, 2));
          return;
        }

        if (!comments.length) {
          console.log('No comments found.');
          return;
        }

        console.log(`Comments on PR #${number} in ${repoName}:\n`);
        for (const c of comments) {
          const location = c.path ? ` · ${c.path}${c.position !== undefined ? `:${c.position}` : ''}` : '';
          console.log(`  ── ${c.user?.login || 'unknown'} · ${formatDate(c.created_at)}${location} (id: ${c.id})`);
          const lines = c.body.split('\n');
          for (const line of lines) {
            console.log(`     ${line}`);
          }
          console.log('');
        }
      } catch (err) {
        handleError(err);
      }
    });

  pr
    .command('files <number>')
    .description('List files changed in a pull request')
    .option('--repo <owner/repo>', 'Repository (owner/repo)')
    .option('--json', 'Output raw JSON')
    .action(async (number: string, opts: { repo?: string; json?: boolean }) => {
      const token = getToken();
      const repoName = resolveRepo(opts.repo);
      const [owner, repo] = repoName.split('/');

      try {
        const files = await apiRequest<Array<{
          sha: string;
          filename: string;
          status: string | null;
          additions: string | number;
          deletions: string | number;
          patch?: { new_file?: boolean; deleted_file?: boolean; renamed_file?: boolean };
        }>>(`/repos/${owner}/${repo}/pulls/${number}/files`, { token });

        if (opts.json) {
          console.log(JSON.stringify(files, null, 2));
          return;
        }

        if (!files.length) {
          console.log('No files changed.');
          return;
        }

        console.log(`Files changed in PR #${number} (${repoName}):\n`);
        for (const f of files) {
          // Determine change type
          let changeType = f.status || 'modified';
          if (f.patch?.new_file) changeType = 'added';
          else if (f.patch?.deleted_file) changeType = 'deleted';
          else if (f.patch?.renamed_file) changeType = 'renamed';

          const additions = Number(f.additions) || 0;
          const deletions = Number(f.deletions) || 0;

          const typeLabel = {
            added: '\x1b[32mA\x1b[0m',
            deleted: '\x1b[31mD\x1b[0m',
            renamed: '\x1b[33mR\x1b[0m',
            modified: '\x1b[36mM\x1b[0m',
          }[changeType] ?? '\x1b[36mM\x1b[0m';

          const stats = `\x1b[32m+${additions}\x1b[0m \x1b[31m-${deletions}\x1b[0m`;
          console.log(`  ${typeLabel} ${f.filename}  ${stats}`);
        }
        console.log(`\n  ${files.length} file(s) changed`);
      } catch (err) {
        handleError(err);
      }
    });

  pr
    .command('diff <number>')
    .description('Show the diff of a pull request')
    .option('--repo <owner/repo>', 'Repository (owner/repo)')
    .option('--json', 'Output raw JSON (patch content per file)')
    .action(async (number: string, opts: { repo?: string; json?: boolean }) => {
      const token = getToken();
      const repoName = resolveRepo(opts.repo);
      const [owner, repo] = repoName.split('/');

      try {
        const files = await apiRequest<Array<{
          filename: string;
          status: string | null;
          additions: string | number;
          deletions: string | number;
          patch?: { diff?: string; new_file?: boolean; deleted_file?: boolean };
        }>>(`/repos/${owner}/${repo}/pulls/${number}/files`, { token });

        if (opts.json) {
          console.log(JSON.stringify(files, null, 2));
          return;
        }

        if (!files.length) {
          console.log('No diff found.');
          return;
        }

        for (const f of files) {
          // File header
          console.log(`\x1b[1m\x1b[34mdiff -- ${f.filename}\x1b[0m`);
          if (!f.patch?.diff) {
            console.log('  (no diff available)');
            console.log('');
            continue;
          }
          // Colorize diff lines
          const lines = f.patch.diff.split('\n');
          for (const line of lines) {
            if (line.startsWith('@@')) {
              console.log(`\x1b[36m${line}\x1b[0m`);
            } else if (line.startsWith('+')) {
              console.log(`\x1b[32m${line}\x1b[0m`);
            } else if (line.startsWith('-')) {
              console.log(`\x1b[31m${line}\x1b[0m`);
            } else {
              console.log(line);
            }
          }
          console.log('');
        }
      } catch (err) {
        handleError(err);
      }
    });

  pr
    .command('review <number>')
    .description('Submit a review for a pull request')
    .option('--repo <owner/repo>', 'Repository (owner/repo)')
    .requiredOption('--action <action>', 'Review action: approve | request_changes | comment')
    .option('--body <comment>', 'Review comment body')
    .option('--json', 'Output raw JSON')
    .action(async (number: string, opts: { repo?: string; action: string; body?: string; json?: boolean }) => {
      const token = getToken();
      if (!token) {
        console.error('Error: Authentication required. Run `gitee auth login` or set GITEE_TOKEN.');
        process.exit(1);
      }

      const validActions = ['approve', 'request_changes', 'comment'];
      if (!validActions.includes(opts.action)) {
        console.error(`Error: --action must be one of: ${validActions.join(', ')}`);
        process.exit(1);
      }

      const repoName = resolveRepo(opts.repo);
      const [owner, repo] = repoName.split('/');

      try {
        const result = await apiRequest<Record<string, unknown>>(
          `/repos/${owner}/${repo}/pulls/${number}/review`,
          {
            method: 'POST',
            token,
            body: {
              action: opts.action,
              body: opts.body || '',
            },
          }
        );

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        const actionLabel: Record<string, string> = {
          approve: '✓ Approved',
          request_changes: '✗ Requested changes',
          comment: '💬 Review comment submitted',
        };
        console.log(`${actionLabel[opts.action] ?? '✓ Review submitted'} on PR #${number}`);
      } catch (err) {
        handleError(err);
      }
    });

  pr
    .command('review-comments <number>')
    .description('List review comments on a pull request')
    .option('--repo <owner/repo>', 'Repository (owner/repo)')
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page', '20')
    .option('--json', 'Output raw JSON')
    .action(async (number: string, opts: { repo?: string; page?: string; perPage?: string; json?: boolean }) => {
      const token = getToken();
      const repoName = resolveRepo(opts.repo);
      const [owner, repo] = repoName.split('/');

      try {
        // Gitee uses the same comments endpoint for inline review comments
        const comments = await apiRequest<Array<{
          id: number;
          body: string;
          user?: { login: string };
          created_at: string;
          path?: string;
          position?: number;
          commit_id?: string;
        }>>(`/repos/${owner}/${repo}/pulls/${number}/comments`, {
          token,
          params: {
            page: opts.page || 1,
            per_page: opts.perPage || 20,
          },
        });

        if (opts.json) {
          console.log(JSON.stringify(comments, null, 2));
          return;
        }

        if (!comments.length) {
          console.log('No review comments found.');
          return;
        }

        console.log(`Review comments on PR #${number} (${repoName}):\n`);
        for (const c of comments) {
          const fileInfo = c.path ? `\x1b[33m${c.path}${c.position !== undefined ? `:${c.position}` : ''}\x1b[0m · ` : '';
          console.log(`  ── ${fileInfo}${c.user?.login || 'unknown'} · ${formatDate(c.created_at)} (id: ${c.id})`);
          const lines = c.body.split('\n');
          for (const line of lines) {
            console.log(`     ${line}`);
          }
          console.log('');
        }
      } catch (err) {
        handleError(err);
      }
    });
}
