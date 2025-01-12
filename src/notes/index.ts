import type { TFile } from 'obsidian';

export default abstract class Note {
  abstract getAllPaths(): string[];
  abstract isPresent(): boolean;
  abstract create(): Promise<TFile>;
}
