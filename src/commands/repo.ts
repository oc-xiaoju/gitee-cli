import { Command } from 'commander';
import { execSync } from 'child_process';
import * as readline from 'readline';
import { getToken } from '../config.js';
import { apiRequest, resolveRepo, formatDate, handleError } from '../api.js';

interface GiteeRepo {
  id: number;
  full_name: string;
  name: string;
  description?: string;
  private: boolean;
  fork: boolean;
  html_url: string;
  ssh_url?: string;
  clone_url?: string;
  homepage?: string;
  language?: string;
  forks_count?: number;
  stargazers_count?: number;
  watchers_count?: number;
  open_issues_count?: number;
  default_branch?: string;
  created_at: string;
  updated_at: string;
  pushed_at?: string;
  owner?: { login: string };
}

function promptConfirm(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
    });
  });
}

export function registerRepoCommands(program: Command): void {
  const repo = program
    .command('repo')
    .description('Manage repositories');

  repo
    .command('list')
    .description('List repositories')
    .option('--owner <user>', 'List repos for a specific user (default: authenticated user)')
    .option('--type <type>', 'Type: all|owner|public|private|member', 'all')
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page (max 100)', '20')
    .option('--json', 'Output raw JSON')
    .action(async (opts: { owner?: string; type?: string; page?: string; perPage?: string; json?: boolean }) => {
      const token = getToken();
      try {
        let repos: GiteeRepo[];
        const params = {
          type: opts.type || 'all',
          page: opts.page || 1,
          per_page: opts.perPage || 20,
        };

        if (opts.owner) {
          repos = await apiRequest<GiteeRepo[]>(`/users/${opts.owner}/repos`, { token, params });
        } else {
          if (!token) {
            console.error('Error: Authentication required. Run `gitee auth login` or set GITEE_TOKEN.');
            process.exit(1);
          }
          repos = await apiRequest<GiteeRepo[]>('/user/repos', { token, params });
        }

        if (opts.json) {
          console.log(JSON.stringify(repos, null, 2));
          return;
        }

        if (!repos.length) {
          console.log('No repositories found.');
          return;
        }

        console.log(`Found ${repos.length} repositories:\n`);
        for (const r of repos) {
          const visibility = r.private ? '🔒 private' : '🌐 public';
          const stars = r.stargazers_count !== undefined ? `⭐ ${r.stargazers_count}` : '';
          const forks = r.forks_count !== undefined ? `🍴 ${r.forks_count}` : '';
          console.log(`  ${r.full_name} [${visibility}] ${stars} ${forks}`);
          if (r.description) console.log(`    ${r.description}`);
          console.log(`    ${r.html_url}`);
        }
      } catch (err) {
        handleError(err);
      }
    });

  repo
    .command('create <name>')
    .description('Create a new repository')
    .option('--private', 'Make repository private')
    .option('--description <desc>', 'Repository description')
    .option('--org <org>', 'Create under an organization')
    .option('--json', 'Output raw JSON')
    .action(async (name: string, opts: { private?: boolean; description?: string; org?: string; json?: boolean }) => {
      const token = getToken();
      if (!token) {
        console.error('Error: Authentication required. Run `gitee auth login` or set GITEE_TOKEN.');
        process.exit(1);
      }

      try {
        const body: Record<string, unknown> = {
          name,
          private: opts.private || false,
          description: opts.description || '',
          auto_init: false,
        };

        let endpoint = '/user/repos';
        if (opts.org) {
          endpoint = `/orgs/${opts.org}/repos`;
        }

        const created = await apiRequest<GiteeRepo>(endpoint, {
          method: 'POST',
          token,
          body,
        });

        if (opts.json) {
          console.log(JSON.stringify(created, null, 2));
          return;
        }

        console.log(`✓ Created repository: ${created.full_name}`);
        console.log(`  URL: ${created.html_url}`);
        console.log(`  Clone: ${created.clone_url || created.ssh_url}`);
      } catch (err) {
        handleError(err);
      }
    });

  repo
    .command('view [repo]')
    .description('View repository details (owner/repo or auto-detect)')
    .option('--repo <owner/repo>', 'Repository (owner/repo)')
    .option('--json', 'Output raw JSON')
    .action(async (repoArg: string | undefined, opts: { repo?: string; json?: boolean }) => {
      const token = getToken();
      const repoName = resolveRepo(repoArg || opts.repo);
      const [owner, name] = repoName.split('/');

      try {
        const r = await apiRequest<GiteeRepo>(`/repos/${owner}/${name}`, { token });

        if (opts.json) {
          console.log(JSON.stringify(r, null, 2));
          return;
        }

        const visibility = r.private ? '🔒 private' : '🌐 public';
        console.log(`${r.full_name} (${visibility})`);
        console.log(`─────────────────────────────`);
        if (r.description) console.log(`Description: ${r.description}`);
        console.log(`URL:     ${r.html_url}`);
        console.log(`Clone:   ${r.clone_url || r.ssh_url}`);
        console.log(`Branch:  ${r.default_branch || 'master'}`);
        console.log(`Stars:   ${r.stargazers_count ?? 0}  Forks: ${r.forks_count ?? 0}  Watchers: ${r.watchers_count ?? 0}`);
        console.log(`Issues:  ${r.open_issues_count ?? 0} open`);
        if (r.language) console.log(`Language: ${r.language}`);
        console.log(`Created: ${formatDate(r.created_at)}`);
        console.log(`Updated: ${formatDate(r.updated_at)}`);
      } catch (err) {
        handleError(err);
      }
    });

  repo
    .command('clone <repo>')
    .description('Clone a Gitee repository (owner/repo)')
    .action(async (repoArg: string) => {
      const cloneUrl = `https://gitee.com/${repoArg}.git`;
      console.log(`Cloning ${cloneUrl}...`);
      try {
        execSync(`git clone ${cloneUrl}`, { stdio: 'inherit' });
      } catch {
        console.error('Error: Clone failed.');
        process.exit(1);
      }
    });

  repo
    .command('delete <repo>')
    .description('Delete a repository (owner/repo) — requires confirmation')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (repoArg: string, opts: { yes?: boolean }) => {
      const token = getToken();
      if (!token) {
        console.error('Error: Authentication required. Run `gitee auth login` or set GITEE_TOKEN.');
        process.exit(1);
      }

      const [owner, name] = repoArg.split('/');
      if (!owner || !name) {
        console.error('Error: Invalid repo format. Use owner/repo.');
        process.exit(1);
      }

      if (!opts.yes) {
        const confirmed = await promptConfirm(`Are you sure you want to delete ${repoArg}? This is irreversible! (y/N): `);
        if (!confirmed) {
          console.log('Aborted.');
          return;
        }
      }

      try {
        await apiRequest(`/repos/${owner}/${name}`, { method: 'DELETE', token });
        console.log(`✓ Deleted repository: ${repoArg}`);
      } catch (err) {
        handleError(err);
      }
    });
}
