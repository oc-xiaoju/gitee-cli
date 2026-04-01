import { Command } from 'commander';
import { getToken } from '../config.js';
import { apiRequest, resolveRepo, formatDate, handleError } from '../api.js';

interface GiteeRelease {
  id: number;
  tag_name: string;
  name: string;
  body?: string;
  draft: boolean;
  prerelease: boolean;
  author?: { login: string };
  created_at: string;
  assets?: Array<{ id: number; name: string; size: number; download_count: number }>;
}

export function registerReleaseCommands(program: Command): void {
  const release = program
    .command('release')
    .description('Manage releases');

  release
    .command('list')
    .description('List releases')
    .option('--repo <owner/repo>', 'Repository (owner/repo)')
    .option('--page <n>', 'Page number', '1')
    .option('--per-page <n>', 'Results per page', '20')
    .option('--json', 'Output raw JSON')
    .action(async (opts: { repo?: string; page?: string; perPage?: string; json?: boolean }) => {
      const token = getToken();
      const repoName = resolveRepo(opts.repo);
      const [owner, repo] = repoName.split('/');

      try {
        const releases = await apiRequest<GiteeRelease[]>(`/repos/${owner}/${repo}/releases`, {
          token,
          params: {
            page: opts.page || 1,
            per_page: opts.perPage || 20,
          },
        });

        if (opts.json) {
          console.log(JSON.stringify(releases, null, 2));
          return;
        }

        if (!releases.length) {
          console.log('No releases found.');
          return;
        }

        console.log(`Releases in ${repoName}:\n`);
        for (const r of releases) {
          const flags: string[] = [];
          if (r.draft) flags.push('draft');
          if (r.prerelease) flags.push('pre-release');
          const flagStr = flags.length ? ` [${flags.join(', ')}]` : '';
          console.log(`  ${r.tag_name} — ${r.name}${flagStr}`);
          console.log(`    by ${r.author?.login || 'unknown'} · ${formatDate(r.created_at)}`);
          if (r.assets?.length) {
            console.log(`    Assets: ${r.assets.map(a => a.name).join(', ')}`);
          }
        }
      } catch (err) {
        handleError(err);
      }
    });

  release
    .command('create')
    .description('Create a release')
    .option('--repo <owner/repo>', 'Repository (owner/repo)')
    .requiredOption('--tag <tag>', 'Tag name (e.g. v1.0.0)')
    .requiredOption('--name <name>', 'Release name/title')
    .option('--body <desc>', 'Release description')
    .option('--draft', 'Create as draft')
    .option('--prerelease', 'Mark as pre-release')
    .option('--json', 'Output raw JSON')
    .action(async (opts: {
      repo?: string;
      tag: string;
      name: string;
      body?: string;
      draft?: boolean;
      prerelease?: boolean;
      json?: boolean;
    }) => {
      const token = getToken();
      if (!token) {
        console.error('Error: Authentication required. Run `gitee auth login` or set GITEE_TOKEN.');
        process.exit(1);
      }

      const repoName = resolveRepo(opts.repo);
      const [owner, repo] = repoName.split('/');

      try {
        const created = await apiRequest<GiteeRelease>(`/repos/${owner}/${repo}/releases`, {
          method: 'POST',
          token,
          body: {
            tag_name: opts.tag,
            name: opts.name,
            body: opts.body || '',
            draft: opts.draft || false,
            prerelease: opts.prerelease || false,
          },
        });

        if (opts.json) {
          console.log(JSON.stringify(created, null, 2));
          return;
        }

        console.log(`✓ Created release: ${created.name} (${created.tag_name})`);
      } catch (err) {
        handleError(err);
      }
    });
}
