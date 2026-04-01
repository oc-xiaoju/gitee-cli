import { Command } from 'commander';
import { getToken } from '../config.js';
import { apiRequest, resolveRepo, formatDate, handleError } from '../api.js';

interface GiteeIssue {
  id: number;
  number: string;
  title: string;
  state: string;
  body?: string;
  user?: { login: string };
  assignee?: { login: string };
  labels?: Array<{ name: string; color: string }>;
  comments?: number;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export function registerIssueCommands(program: Command): void {
  const issue = program
    .command('issue')
    .description('Manage issues');

  issue
    .command('list')
    .description('List issues in a repository')
    .option('--repo <owner/repo>', 'Repository (owner/repo)')
    .option('--state <state>', 'State: open|closed|all (default: open)', 'open')
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page', '20')
    .option('--json', 'Output raw JSON')
    .action(async (opts: { repo?: string; state?: string; page?: string; perPage?: string; json?: boolean }) => {
      const token = getToken();
      const repoName = resolveRepo(opts.repo);
      const [owner, repo] = repoName.split('/');

      try {
        const issues = await apiRequest<GiteeIssue[]>(`/repos/${owner}/${repo}/issues`, {
          token,
          params: {
            state: opts.state || 'open',
            page: opts.page || 1,
            per_page: opts.perPage || 20,
          },
        });

        if (opts.json) {
          console.log(JSON.stringify(issues, null, 2));
          return;
        }

        if (!issues.length) {
          console.log('No issues found.');
          return;
        }

        console.log(`Issues in ${repoName}:\n`);
        for (const issue of issues) {
          const labels = issue.labels?.map(l => `[${l.name}]`).join(' ') || '';
          const comments = issue.comments ? `💬 ${issue.comments}` : '';
          console.log(`  #${issue.number} ${issue.title} ${labels}`);
          console.log(`     ${issue.state} · by ${issue.user?.login || 'unknown'} · ${formatDate(issue.created_at)} ${comments}`);
        }
      } catch (err) {
        handleError(err);
      }
    });

  issue
    .command('create')
    .description('Create an issue')
    .option('--repo <owner/repo>', 'Repository (owner/repo)')
    .requiredOption('--title <title>', 'Issue title')
    .option('--body <body>', 'Issue body/description')
    .option('--assignee <username>', 'Assign to user')
    .option('--json', 'Output raw JSON')
    .action(async (opts: { repo?: string; title: string; body?: string; assignee?: string; json?: boolean }) => {
      const token = getToken();
      if (!token) {
        console.error('Error: Authentication required. Run `gitee auth login` or set GITEE_TOKEN.');
        process.exit(1);
      }

      const repoName = resolveRepo(opts.repo);
      const [owner, repo] = repoName.split('/');

      try {
        const created = await apiRequest<GiteeIssue>(`/repos/${owner}/${repo}/issues`, {
          method: 'POST',
          token,
          body: {
            title: opts.title,
            body: opts.body || '',
            assignee: opts.assignee,
          },
        });

        if (opts.json) {
          console.log(JSON.stringify(created, null, 2));
          return;
        }

        console.log(`✓ Created issue #${created.number}: ${created.title}`);
        console.log(`  URL: ${created.html_url}`);
      } catch (err) {
        handleError(err);
      }
    });

  issue
    .command('view <number>')
    .description('View issue details')
    .option('--repo <owner/repo>', 'Repository (owner/repo)')
    .option('--json', 'Output raw JSON')
    .action(async (number: string, opts: { repo?: string; json?: boolean }) => {
      const token = getToken();
      const repoName = resolveRepo(opts.repo);
      const [owner, repo] = repoName.split('/');

      try {
        const iss = await apiRequest<GiteeIssue>(`/repos/${owner}/${repo}/issues/${number}`, { token });

        if (opts.json) {
          console.log(JSON.stringify(iss, null, 2));
          return;
        }

        console.log(`#${iss.number} ${iss.title}`);
        console.log(`─────────────────────────────`);
        console.log(`State:   ${iss.state}`);
        console.log(`Author:  ${iss.user?.login || 'unknown'}`);
        if (iss.assignee) console.log(`Assignee: ${iss.assignee.login}`);
        if (iss.labels?.length) console.log(`Labels:  ${iss.labels.map(l => l.name).join(', ')}`);
        console.log(`Created: ${formatDate(iss.created_at)}`);
        console.log(`Updated: ${formatDate(iss.updated_at)}`);
        console.log(`URL:     ${iss.html_url}`);
        if (iss.body) {
          console.log(`\n${iss.body}`);
        }
      } catch (err) {
        handleError(err);
      }
    });

  issue
    .command('close <number>')
    .description('Close an issue')
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
        const updated = await apiRequest<GiteeIssue>(`/repos/${owner}/${repo}/issues/${number}`, {
          method: 'PATCH',
          token,
          body: { state: 'closed', repo },
        });

        if (opts.json) {
          console.log(JSON.stringify(updated, null, 2));
          return;
        }

        console.log(`✓ Closed issue #${number}`);
      } catch (err) {
        handleError(err);
      }
    });

  issue
    .command('comment <number>')
    .description('Add a comment to an issue')
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
        const comment = await apiRequest<{ id: number; body: string; created_at: string }>(
          `/repos/${owner}/${repo}/issues/${number}/comments`,
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
}
