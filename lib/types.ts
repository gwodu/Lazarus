export interface Verse {
  chapter: number;
  verse: number;
  text: string;
}

export interface Passage {
  /** Human-readable reference, e.g. "John 3:16–18" */
  reference: string;
  /** OSIS identifier, e.g. "John.3.16-John.3.18" */
  osis: string;
  bookName: string;
  verses: Verse[];
  /** True when the range was longer than the display cap and got truncated */
  truncated: boolean;
  version: string;
}

export type DisplayMessage =
  | { type: "show"; passage: Passage }
  | { type: "clear" };

export const DISPLAY_CHANNEL = "lazarus-display";
export const DISPLAY_STORAGE_KEY = "lazarus-current-passage";
