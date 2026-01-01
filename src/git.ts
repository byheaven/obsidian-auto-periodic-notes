import { Moment } from 'moment';
import { ISettings } from './settings';
import { FileSystemAdapter, moment, Vault } from 'obsidian';
import { spawn } from 'node:child_process';
import debug from './log';

const FOLDER: string = '.git';

export class Git {
  private vault: Vault;
  private now: Moment;
  private gitRepo: boolean = false;

  constructor(vault: Vault, now?: Moment) {
    this.vault = vault;
    this.now = now || moment();
  }

  isGitRepo(): boolean {
    return this.gitRepo;
  }

  async checkForGitRepo() {
    this.gitRepo = await this.vault.adapter.exists(FOLDER);
    debug(`Setting git repo to ${this.gitRepo ? 'true' : 'false'}`);
  }

  async commitChanges(settings: ISettings) {
    if (!this.isGitRepo() || !settings.gitCommit || !this.getBasePath()) {
      return;
    }

    if (
      !this.now.isBetween(
        this.now.clone().set({ hour: 18, minute: 0, second: 0 }),
        this.now.clone().set({ hour: 18, minute: 4, second: 59 })
      )
    ) {
      return;
    }

    try {
      debug(this.getBasePath());
      debug('Staging changes in git');
      await this.runCommand(['add', '.']);
      debug('Committing changes in git');
      await this.runCommand([
        'commit',
        '-m',
        `"${settings.gitCommitMessage.replace('{DATE}', this.now.format('YYYY-MM-DD'))}"`,
      ]);
      debug('Pushing changes in git to remote');
      await this.runCommand(['push']);

      debug('Git commit complete');
    } catch (err) {
      debug(`Error committing to git: ${err}`);
    }
  }

  private getBasePath(): string {
    let adapter = this.vault.adapter;
    if (adapter instanceof FileSystemAdapter) {
      return adapter.getBasePath();
    }
    return '';
  }

  private async runCommand(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn('git', args, {
        cwd: this.getBasePath(),
      });
      process.on('close', () => resolve());
      process.on('error', (err) => reject(err));
      process.stderr.on('data', (data) => reject(data));
    });
  }
}
