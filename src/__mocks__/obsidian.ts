/* eslint-disable @typescript-eslint/no-explicit-any */
import * as momentImpl from 'moment';

export class Plugin {}
export class PluginSettingTab {}

export const App = jest.fn();

export class TAbstractFile {}
export class TFile extends TAbstractFile {
  public basename!: string;
}

export const moment = momentImpl;

export const Notice = jest.fn();

export const Workspace = jest.fn();
Workspace.prototype.getLeaf = jest.fn();
Workspace.prototype.iterateAllLeaves = jest.fn();
export const WorkspaceLeaf = jest.fn();
WorkspaceLeaf.prototype.detach = jest.fn();
WorkspaceLeaf.prototype.openFile = jest.fn();
WorkspaceLeaf.prototype.setPinned = jest.fn();
WorkspaceLeaf.prototype.view = jest.fn();

export const View = jest.fn();
View.prototype.getState = jest.fn();
export const MarkdownView = View;

class BaseComponent {
  onChange(cb: (val: any) => any) {
    return this;
  }
  setDisabled(b: boolean) {
    return this;
  }
  setValue(s: string) {
    return this;
  }
}
export class ToggleComponent extends BaseComponent {}

export class Setting {
  constructor(el: HTMLElement) {
    return this;
  }

  setDesc(s: string) {
    return this;
  }

  setHeading() {
    return this;
  }

  setName(s: string) {
    return this;
  }

  addToggle(cb: (toggle: ToggleComponent) => any) {
    cb(new ToggleComponent);
    return this;
  }
}
