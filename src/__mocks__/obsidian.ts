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
View.prototype.getViewType = jest.fn(() => 'markdown');
export const MarkdownView = View;

// Components and settings remember what the settings tab gave them, so tests can read the rendered tab back
class BaseComponent {
  public value: any;
  public changeHandler?: (val: any) => any;

  onChange(cb: (val: any) => any) {
    this.changeHandler = cb;
    return this;
  }
  setDisabled(b: boolean) {
    return this;
  }
  setValue(s: any) {
    this.value = s;
    return this;
  }
}
export class ToggleComponent extends BaseComponent {}
export class TextComponent extends BaseComponent {
  setPlaceholder(s: string) {
    return this;
  }
}
export class ButtonComponent {
  public text = '';
  public clickHandler?: () => any;
  public attributes: Record<string, string> = {};
  public buttonEl = { setAttr: (name: string, value: string) => { this.attributes[name] = value; } };

  setButtonText(text: string) {
    this.text = text;
    return this;
  }
  onClick(cb: () => any) {
    this.clickHandler = cb;
    return this;
  }
}

export class Setting {
  static rendered: Setting[] = [];

  public name = '';
  public desc = '';
  public heading = false;
  public disabled = false;
  public classes: string[] = [];
  public toggles: ToggleComponent[] = [];
  public texts: TextComponent[] = [];
  public buttons: ButtonComponent[] = [];
  public descEl = {
    classes: new Set<string>(),
    toggleClass(cls: string, on: boolean) {
      if (on) {
        this.classes.add(cls);
      } else {
        this.classes.delete(cls);
      }
    },
  };

  constructor(el: HTMLElement) {
    Setting.rendered.push(this);
  }

  setDesc(s: string) {
    this.desc = s;
    return this;
  }

  setHeading() {
    this.heading = true;
    return this;
  }

  setClass(cls: string) {
    this.classes.push(cls);
    return this;
  }

  setName(s: string) {
    this.name = s;
    return this;
  }

  setDisabled(disabled: boolean) {
    this.disabled = disabled;
    return this;
  }

  addToggle(cb: (toggle: ToggleComponent) => any) {
    const toggle = new ToggleComponent();
    this.toggles.push(toggle);
    cb(toggle);
    return this;
  }

  addText(cb: (text: TextComponent) => any) {
    const text = new TextComponent();
    this.texts.push(text);
    cb(text);
    return this;
  }

  addButton(cb: (button: ButtonComponent) => any) {
    const button = new ButtonComponent();
    this.buttons.push(button);
    cb(button);
    return this;
  }
}
