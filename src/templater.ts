import type { App, TFile } from 'obsidian';
import debug from './log';

/**
 * Gets the Templater plugin instance if it's installed and enabled.
 *
 * @param app The Obsidian app instance
 * @returns The Templater plugin instance or null if not available
 */
function getTemplater(app: App): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plugins = (app as any).plugins;
  return plugins?.plugins?.['templater-obsidian'] || null;
}

/**
 * Processes Templater templates in a file by calling Templater's API.
 * This will execute all Templater commands like <% tp.file.cursor(0) %> in the file.
 *
 * @param app The Obsidian app instance
 * @param file The file to process
 * @param force Whether to force processing even if Templater's "trigger_on_file_creation" setting is enabled
 */
export async function processTemplaterInFile(
  app: App,
  file: TFile,
  force: boolean = false
): Promise<void> {
  const templater = getTemplater(app);

  if (!templater) {
    debug('Templater plugin not found or not enabled');
    return;
  }

  // Only process if forced or if Templater's automatic trigger is disabled
  if (force || !templater?.settings?.['trigger_on_file_creation']) {
    debug(`Processing Templater commands in file: ${file.path}`);
    try {
      await templater.templater.overwrite_file_commands(file);
      debug('Templater processing completed successfully');
    } catch (error) {
      debug(`Error processing Templater commands: ${error}`);
    }
  } else {
    debug('Skipping Templater processing - trigger_on_file_creation is enabled');
  }
}
