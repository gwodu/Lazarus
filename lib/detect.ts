import { bcv_parser } from "bible-passage-reference-parser/esm/bcv_parser.js";
import * as en from "bible-passage-reference-parser/esm/lang/en.js";
import { wordsToNumbers } from "./numbers";
import type { OsisPoint } from "./bible";

export interface DetectedRef {
  osis: string;
  start: OsisPoint;
  end: OsisPoint;
  /** True when the reference sits at the very end of still-interim text,
   * meaning more speech could extend it ("John 3" → "John 3 16"). */
  atTail: boolean;
}

const bcv = new bcv_parser(en);
bcv.set_options({
  // A bare "16-18" after "John 3:16" continues the previous reference.
  sequence_combination_strategy: "combine",
  osis_compaction_strategy: "bcv",
});

/** Extracts Bible references from a transcript snippet. Deterministic — no model involved. */
export function detectReferences(text: string): DetectedRef[] {
  const normalized = wordsToNumbers(text);
  const result = bcv.parse(normalized);
  const refs: DetectedRef[] = [];
  for (const parsed of result.parsed_entities()) {
    for (const entity of parsed.entities) {
      if (!entity.start?.b || !entity.start.c) continue;
      // Sub-entities often lack indices; fall back to the group's span.
      const [, endIdx] = entity.absolute_indices ?? parsed.indices ?? [0, 0];
      refs.push({
        osis: entity.osis,
        start: { b: entity.start.b, c: entity.start.c, v: entity.start.v ?? 1 },
        end: {
          b: entity.end?.b ?? entity.start.b,
          c: entity.end?.c ?? entity.start.c,
          v: entity.end?.v ?? entity.start.v ?? 1,
        },
        atTail: endIdx >= normalized.trim().length - 1,
      });
    }
  }
  return refs;
}

/**
 * Stateful gate deciding when a detected reference should fire.
 * Interim speech results repeat and grow, so the same reference is
 * detected many times; fire each osis at most once per cooldown window.
 */
export function createRefGate(cooldownMs = 8000) {
  const lastFired = new Map<string, number>();
  return {
    shouldFire(osis: string): boolean {
      const now = Date.now();
      const last = lastFired.get(osis);
      if (last !== undefined && now - last < cooldownMs) return false;
      lastFired.set(osis, now);
      return true;
    },
  };
}
