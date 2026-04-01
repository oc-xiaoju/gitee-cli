#!/usr/bin/env node
import { Command } from 'commander';
import { registerAuthCommands } from './commands/auth.js';
import { registerRepoCommands } from './commands/repo.js';
import { registerIssueCommands } from './commands/issue.js';
import { registerPrCommands } from './commands/pr.js';
import { registerReleaseCommands } from './commands/release.js';
import { registerOrgCommands } from './commands/org.js';
import { registerApiCommand } from './commands/api.js';

const program = new Command();

program
  .name('gitee')
  .description('Gitee (码云) command-line tool — like gh, but for Gitee')
  .version('0.1.0');

registerAuthCommands(program);
registerRepoCommands(program);
registerIssueCommands(program);
registerPrCommands(program);
registerReleaseCommands(program);
registerOrgCommands(program);
registerApiCommand(program);

program.parse(process.argv);
