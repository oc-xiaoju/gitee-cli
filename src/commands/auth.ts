import { Command } from 'commander';
import * as readline from 'readline';
import { getConfig, saveConfig, clearConfig, getToken } from '../config.js';
import { apiRequest, handleError, ApiError } from '../api.js';

interface GiteeUser {
  login: string;
  name: string;
  email?: string;
  avatar_url?: string;
  bio?: string;
  public_repos?: number;
  followers?: number;
  following?: number;
}

function prompt(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    if (hidden) {
      // Hide input for token
      process.stdout.write(question);
      let value = '';
      const stdin = process.stdin;
      stdin.setRawMode?.(true);
      stdin.resume();
      stdin.setEncoding('utf-8');
      stdin.on('data', (char: string) => {
        if (char === '\n' || char === '\r' || char === '\u0003') {
          stdin.setRawMode?.(false);
          stdin.pause();
          process.stdout.write('\n');
          rl.close();
          resolve(value);
        } else if (char === '\u007F') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          value += char;
          process.stdout.write('*');
        }
      });
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

export function registerAuthCommands(program: Command): void {
  const auth = program
    .command('auth')
    .description('Manage authentication');

  auth
    .command('login')
    .description('Authenticate with a Gitee Personal Access Token')
    .option('--with-token', 'Read token from stdin (non-interactive)')
    .action(async (opts: { withToken?: boolean }) => {
      let token: string;

      if (opts.withToken) {
        // Read from stdin
        const chunks: string[] = [];
        for await (const chunk of process.stdin) {
          chunks.push(chunk);
        }
        token = chunks.join('').trim();
      } else {
        console.log('Gitee CLI Authentication');
        console.log('Get your token at: https://gitee.com/profile/personal_access_tokens');
        console.log('');
        token = await prompt('Enter your Gitee Personal Access Token: ', true);
      }

      if (!token) {
        console.error('Error: Token cannot be empty.');
        process.exit(1);
      }

      // Verify the token
      console.log('Verifying token...');
      try {
        const user = await apiRequest<GiteeUser>('/user', { token });
        saveConfig({ token, username: user.login });
        console.log(`✓ Logged in as ${user.login} (${user.name || user.login})`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          console.error('Error: Invalid token. Please check your Personal Access Token.');
          process.exit(1);
        }
        handleError(err);
      }
    });

  auth
    .command('logout')
    .description('Clear stored authentication credentials')
    .action(() => {
      clearConfig();
      console.log('✓ Logged out. Token cleared.');
    });

  auth
    .command('status')
    .description('Show current authentication status')
    .action(async () => {
      const token = getToken();
      if (!token) {
        console.log('Not logged in.');
        console.log('Run `gitee auth login` to authenticate.');
        return;
      }

      const fromEnv = !!process.env.GITEE_TOKEN;
      const config = getConfig();

      console.log(`Token source: ${fromEnv ? 'GITEE_TOKEN (env)' : 'config file'}`);
      if (config.username) {
        console.log(`Cached username: ${config.username}`);
      }

      console.log('Verifying token...');
      try {
        const user = await apiRequest<GiteeUser>('/user', { token });
        console.log(`✓ Authenticated as ${user.login} (${user.name || user.login})`);
        if (user.email) console.log(`Email: ${user.email}`);
        if (user.public_repos !== undefined) console.log(`Public repos: ${user.public_repos}`);
      } catch {
        console.log('✗ Token is invalid or expired.');
      }
    });
}
