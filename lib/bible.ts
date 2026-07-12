import type { Passage, Verse } from "./types";

interface BibleBook {
  name: string;
  chapters: string[][];
}

export type BibleData = Record<string, BibleBook>;

let biblePromise: Promise<BibleData> | null = null;

/** Fetches the bundled translation once and caches it for the session. */
export function loadBible(): Promise<BibleData> {
  if (!biblePromise) {
    biblePromise = fetch("/bibles/kjv.json").then((res) => {
      if (!res.ok) throw new Error(`Failed to load Bible: ${res.status}`);
      return res.json();
    });
  }
  return biblePromise;
}

export interface OsisPoint {
  b: string;
  c: number;
  v: number;
}

/** Max verses shown at once; longer ranges are truncated and stepped through. */
export const MAX_VERSES = 6;

export function getPassage(
  bible: BibleData,
  osis: string,
  start: OsisPoint,
  end: OsisPoint,
): Passage | null {
  const book = bible[start.b];
  if (!book || start.b !== end.b) return null;

  const verses: Verse[] = [];
  let truncated = false;
  for (let c = start.c; c <= end.c; c++) {
    const chapter = book.chapters[c - 1];
    if (!chapter) break;
    const from = c === start.c ? start.v : 1;
    const to = c === end.c ? Math.min(end.v, chapter.length) : chapter.length;
    for (let v = from; v <= to; v++) {
      if (verses.length >= MAX_VERSES) {
        truncated = true;
        break;
      }
      verses.push({ chapter: c, verse: v, text: chapter[v - 1] });
    }
    if (truncated) break;
  }
  if (verses.length === 0) return null;

  return {
    reference: formatReference(book.name, verses, truncated),
    osis,
    bookName: book.name,
    verses,
    truncated,
    version: "KJV",
  };
}

/** Passage containing the single verse offset by `step` from the given point. */
export function stepVerse(
  bible: BibleData,
  bookId: string,
  chapter: number,
  verse: number,
  step: 1 | -1,
): Passage | null {
  const book = bible[bookId];
  if (!book) return null;
  let c = chapter;
  let v = verse + step;
  if (v < 1) {
    if (c === 1) return null;
    c -= 1;
    v = book.chapters[c - 1].length;
  } else if (v > book.chapters[c - 1].length) {
    if (c === book.chapters.length) return null;
    c += 1;
    v = 1;
  }
  const osis = `${bookId}.${c}.${v}`;
  return getPassage(bible, osis, { b: bookId, c, v }, { b: bookId, c, v });
}

function formatReference(
  bookName: string,
  verses: Verse[],
  truncated: boolean,
): string {
  const first = verses[0];
  const last = verses[verses.length - 1];
  let ref = `${bookName} ${first.chapter}:${first.verse}`;
  if (last.chapter !== first.chapter) {
    ref += `–${last.chapter}:${last.verse}`;
  } else if (last.verse !== first.verse) {
    ref += `–${last.verse}`;
  }
  return truncated ? `${ref}…` : ref;
}
