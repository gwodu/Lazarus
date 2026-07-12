# Lazarus — Live Scripture Display

The pastor says *"turn with me to First Corinthians thirteen, verse four"* — and the verse is already on the screen.

Lazarus listens to the sermon, detects Bible references in real time, and puts the passage on the TV/projector automatically. No more media-team scramble to find the verse the pastor just mentioned.

## How it works

```
Microphone → Speech-to-text → Reference parser → Verse lookup → Display
             (Web Speech API)  (deterministic,    (bundled KJV,   (BroadcastChannel
                                no LLM)            no network)     to display window)
```

- **Speech-to-text**: the browser's built-in Web Speech API (Chrome/Edge). Zero setup, real-time streaming. The engine is behind a small interface (`lib/speech.ts`) so a fully local Whisper model (via transformers.js) can be swapped in later.
- **Reference detection**: [Bible-Passage-Reference-Parser](https://github.com/openbibleinfo/Bible-Passage-Reference-Parser) from OpenBible.info — a deterministic parser, not a language model, so it never hallucinates a reference. Handles "John 3:16", "First Corinthians 13 verse 4", "Psalm twenty three", ranges, and 40+ languages.
- **Bible text**: King James Version bundled as JSON (`public/bibles/kjv.json`), loaded once — no external API calls during a live service.
- **Display sync**: `BroadcastChannel` + `localStorage`, so the control page and the display window stay in sync on the same machine (the standard media-PC-with-extended-display setup).

## Running it

```bash
npm install
npm run dev
```

1. Open `http://localhost:3000` — this is the **control page** (for the media desk).
2. Click **Open Display** — drag that window to the TV/projector output and press F11.
3. Click **Start Listening** and allow microphone access.
4. Say *"John chapter 3 verse 16"*.

### Controls

- **Auto-show** — detected verses go straight to the screen. Turn it off to queue them for one-click operator approval instead.
- **← / →** — step to the previous/next verse (for reading through a passage).
- **Esc** or **B** — blank the screen.
- **Manual box** — type any reference (e.g. `Romans 8:28-30`) and press Enter.

## Deploying to Vercel

The app is fully static — no server-side code, no API keys, no database:

```bash
npx vercel
```

or import the GitHub repo at [vercel.com/new](https://vercel.com/new). Speech recognition runs in the browser of whoever opens the control page, so the deployed app works anywhere Chrome/Edge runs.

## Roadmap

- [ ] Fully local speech-to-text (Whisper via transformers.js + WebGPU) for offline use and better accuracy on proper nouns
- [ ] More translations (World English Bible, and licensed ones like NIV/ESV via API.Bible)
- [ ] Fuzzy quote detection — pastor quotes a verse without the reference ("for God so loved the world…") and it's found by text match
- [ ] Song lyrics / announcement slides to fully replace EasyWorship
- [ ] Remote control: pastor's phone as microphone, media PC as display (needs a realtime backend)

## Rebuilding the Bible data

```bash
node scripts/build-bible.js <source.json> public/bibles/kjv.json
```

Source format: [thiagobodruk/bible](https://github.com/thiagobodruk/bible) (public domain KJV text).
