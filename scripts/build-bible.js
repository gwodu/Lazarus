// Converts thiagobodruk/bible en_kjv.json (array of books in canonical order)
// into an OSIS-keyed lookup: { Gen: { name, chapters: [[verse, ...], ...] }, ... }
// Usage: node scripts/build-bible.js <input.json> <output.json>
const fs = require("fs");

const OSIS_ORDER = [
  "Gen", "Exod", "Lev", "Num", "Deut", "Josh", "Judg", "Ruth", "1Sam", "2Sam",
  "1Kgs", "2Kgs", "1Chr", "2Chr", "Ezra", "Neh", "Esth", "Job", "Ps", "Prov",
  "Eccl", "Song", "Isa", "Jer", "Lam", "Ezek", "Dan", "Hos", "Joel", "Amos",
  "Obad", "Jonah", "Mic", "Nah", "Hab", "Zeph", "Hag", "Zech", "Mal",
  "Matt", "Mark", "Luke", "John", "Acts", "Rom", "1Cor", "2Cor", "Gal", "Eph",
  "Phil", "Col", "1Thess", "2Thess", "1Tim", "2Tim", "Titus", "Phlm", "Heb",
  "Jas", "1Pet", "2Pet", "1John", "2John", "3John", "Jude", "Rev",
];

const [, , input, output] = process.argv;
const raw = fs.readFileSync(input, "utf8").replace(/^﻿/, "");
const books = JSON.parse(raw);

if (books.length !== OSIS_ORDER.length) {
  throw new Error(`Expected ${OSIS_ORDER.length} books, got ${books.length}`);
}

// Source markup: {word} = translator-supplied italics (keep the word),
// {text: or, alt} = marginal note (drop), [heading] = section heading (drop).
function cleanVerse(text) {
  return text
    .replace(/\{[^}]*:[^}]*\}/g, "")
    .replace(/\{([^}]*)\}/g, "$1")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s+/g, " ")
    .replace(/ ([,;.:!?])/g, "$1")
    .trim();
}

const out = {};
books.forEach((book, i) => {
  out[OSIS_ORDER[i]] = {
    name: book.name,
    chapters: book.chapters.map((ch) => ch.map(cleanVerse)),
  };
});

fs.writeFileSync(output, JSON.stringify(out));
console.log(`Wrote ${output}: ${OSIS_ORDER.length} books`);
