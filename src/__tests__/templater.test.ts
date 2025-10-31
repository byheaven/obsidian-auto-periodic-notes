import { App, TFile } from 'obsidian';
import { processTemplaterInFile } from '../templater';

jest.mock('obsidian');

describe('Templater Integration', () => {
  let mockApp: App;
  let mockFile: TFile;
  let mockTemplaterPlugin: any;

  beforeEach(() => {
    mockApp = new App();
    mockFile = new TFile();
    mockFile.path = 'test-note.md';

    // Mock the Templater plugin
    mockTemplaterPlugin = {
      settings: {
        trigger_on_file_creation: false,
      },
      templater: {
        overwrite_file_commands: jest.fn().mockResolvedValue(undefined),
      },
    };

    // Mock app.plugins to return our Templater plugin
    (mockApp as any).plugins = {
      plugins: {
        'templater-obsidian': mockTemplaterPlugin,
      },
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('calls Templater API to process file when Templater is available', async () => {
    await processTemplaterInFile(mockApp, mockFile, true);

    expect(mockTemplaterPlugin.templater.overwrite_file_commands).toHaveBeenCalledWith(mockFile);
  });

  it('does not process file when Templater is not available', async () => {
    (mockApp as any).plugins = {
      plugins: {},
    };

    await processTemplaterInFile(mockApp, mockFile, true);

    expect(mockTemplaterPlugin.templater.overwrite_file_commands).not.toHaveBeenCalled();
  });

  it('processes file when forced even if trigger_on_file_creation is enabled', async () => {
    mockTemplaterPlugin.settings.trigger_on_file_creation = true;

    await processTemplaterInFile(mockApp, mockFile, true);

    expect(mockTemplaterPlugin.templater.overwrite_file_commands).toHaveBeenCalledWith(mockFile);
  });

  it('skips processing when not forced and trigger_on_file_creation is enabled', async () => {
    mockTemplaterPlugin.settings.trigger_on_file_creation = true;

    await processTemplaterInFile(mockApp, mockFile, false);

    expect(mockTemplaterPlugin.templater.overwrite_file_commands).not.toHaveBeenCalled();
  });

  it('handles errors gracefully when Templater processing fails', async () => {
    const error = new Error('Templater processing failed');
    mockTemplaterPlugin.templater.overwrite_file_commands.mockRejectedValue(error);

    // Should not throw
    await expect(processTemplaterInFile(mockApp, mockFile, true)).resolves.toBeUndefined();
  });
});
