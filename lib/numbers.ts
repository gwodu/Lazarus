// Speech recognition sometimes leaves small numbers as words
// ("John chapter three verse sixteen"). The reference parser only
// understands digits (plus ordinal book prefixes like "first John",
// which it handles natively), so convert spoken numbers to digits.
//
// Adjacent number words only merge when English grammar compounds them
// ("twenty three" → 23, "one hundred nineteen" → 119). Otherwise they
// stay separate: "John three sixteen" → "John 3 16", never "John 19".

const ONES: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};

export function wordsToNumbers(text: string): string {
  const tokens = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];

  let value = 0;
  let active = false;
  // What the current number can still absorb: tens can take ones 1-9,
  // a hundred can take tens and ones.
  let afterTens = false;
  let afterHundred = false;

  const flush = () => {
    if (active) out.push(String(value));
    value = 0;
    active = false;
    afterTens = false;
    afterHundred = false;
  };

  for (const token of tokens) {
    const trailing = token.match(/[.,;:!?]+$/)?.[0] ?? "";
    const word = token.slice(0, token.length - trailing.length).toLowerCase();

    if (word in ONES) {
      const n = ONES[word];
      const canMerge = active && ((afterTens && n < 10) || afterHundred);
      if (!canMerge) flush();
      value += n;
      active = true;
      afterTens = false;
      afterHundred = false;
    } else if (word in TENS) {
      if (!(active && afterHundred)) flush();
      value += TENS[word];
      active = true;
      afterTens = true;
      afterHundred = false;
    } else if (word === "hundred" && active) {
      value = value * 100;
      afterTens = false;
      afterHundred = true;
    } else {
      flush();
      out.push(token);
      continue;
    }

    if (trailing) {
      flush();
      out[out.length - 1] += trailing;
    }
  }
  flush();
  return out.join(" ");
}
