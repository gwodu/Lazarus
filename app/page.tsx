"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadBible,
  getPassage,
  stepVerse,
  type BibleData,
} from "@/lib/bible";
import { detectReferences, createRefGate } from "@/lib/detect";
import { sendToDisplay, readCurrentPassage } from "@/lib/channel";
import {
  createWebSpeechEngine,
  speechSupported,
  type SpeechEngine,
} from "@/lib/speech";
import type { Passage } from "@/lib/types";

const MAX_TRANSCRIPT_SEGMENTS = 40;
const MAX_HISTORY = 30;

export default function ControlPage() {
  const [bible, setBible] = useState<BibleData | null>(null);
  const [listening, setListening] = useState(false);
  const [autoShow, setAutoShow] = useState(true);
  const [segments, setSegments] = useState<string[]>([]);
  const [interim, setInterim] = useState("");
  const [current, setCurrent] = useState<Passage | null>(null);
  const [history, setHistory] = useState<Passage[]>([]);
  const [manualRef, setManualRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  const engineRef = useRef<SpeechEngine | null>(null);
  const gateRef = useRef(createRefGate());
  const bibleRef = useRef<BibleData | null>(null);
  const autoShowRef = useRef(autoShow);
  const currentRef = useRef<Passage | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  autoShowRef.current = autoShow;
  currentRef.current = current;

  useEffect(() => {
    setSupported(speechSupported());
    loadBible()
      .then((data) => {
        setBible(data);
        bibleRef.current = data;
      })
      .catch(() => setError("Could not load Bible data."));
    const persisted = readCurrentPassage();
    if (persisted) setCurrent(persisted);
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [segments, interim]);

  const showPassage = useCallback((passage: Passage) => {
    sendToDisplay({ type: "show", passage });
    setCurrent(passage);
    setHistory((prev) => {
      if (prev[0]?.osis === passage.osis) return prev;
      return [passage, ...prev].slice(0, MAX_HISTORY);
    });
  }, []);

  const clearDisplay = useCallback(() => {
    sendToDisplay({ type: "clear" });
    setCurrent(null);
  }, []);

  const handleDetectedText = useCallback(
    (text: string, isFinal: boolean) => {
      const data = bibleRef.current;
      if (!data) return;
      for (const ref of detectReferences(text)) {
        // A reference still growing at the tip of interim speech
        // ("John 3" might become "John 3 16") waits for more words.
        if (!isFinal && ref.atTail) continue;
        if (!gateRef.current.shouldFire(ref.osis)) continue;
        const passage = getPassage(data, ref.osis, ref.start, ref.end);
        if (!passage) continue;
        if (autoShowRef.current) {
          showPassage(passage);
        } else {
          setHistory((prev) =>
            prev[0]?.osis === passage.osis
              ? prev
              : [passage, ...prev].slice(0, MAX_HISTORY),
          );
        }
      }
    },
    [showPassage],
  );

  const toggleListening = useCallback(() => {
    if (listening) {
      engineRef.current?.stop();
      setListening(false);
      setInterim("");
      return;
    }
    setError(null);
    engineRef.current = createWebSpeechEngine(({ finalText, interimText }) => {
      if (finalText) {
        setSegments((prev) =>
          [...prev, finalText].slice(-MAX_TRANSCRIPT_SEGMENTS),
        );
        handleDetectedText(finalText, true);
      }
      setInterim(interimText);
      if (interimText) handleDetectedText(interimText, false);
    }, setError);
    engineRef.current.start();
    setListening(true);
  }, [listening, handleDetectedText]);

  const step = useCallback(
    (direction: 1 | -1) => {
      const data = bibleRef.current;
      const passage = currentRef.current;
      if (!data || !passage) return;
      const anchor =
        direction === 1
          ? passage.verses[passage.verses.length - 1]
          : passage.verses[0];
      const bookId = Object.keys(data).find(
        (id) => data[id].name === passage.bookName,
      );
      if (!bookId) return;
      const next = stepVerse(data, bookId, anchor.chapter, anchor.verse, direction);
      if (next) showPassage(next);
    },
    [showPassage],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === "ArrowRight") step(1);
      else if (event.key === "ArrowLeft") step(-1);
      else if (event.key === "Escape" || event.key.toLowerCase() === "b")
        clearDisplay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, clearDisplay]);

  const submitManual = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const data = bibleRef.current;
      if (!data || !manualRef.trim()) return;
      const refs = detectReferences(manualRef);
      if (refs.length === 0) {
        setError(`Couldn't understand "${manualRef}" as a Bible reference.`);
        return;
      }
      setError(null);
      const passage = getPassage(data, refs[0].osis, refs[0].start, refs[0].end);
      if (passage) showPassage(passage);
      setManualRef("");
    },
    [manualRef, showPassage],
  );

  return (
    <main className="flex-1 bg-zinc-950 text-zinc-100 p-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Lazarus</h1>
            <p className="text-sm text-zinc-400">
              Live scripture display — speak a reference, it appears on screen.
            </p>
          </div>
          <a
            href="/display"
            target="_blank"
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-medium"
          >
            Open Display ↗
          </a>
        </header>

        {!supported && (
          <div className="rounded-lg border border-amber-600 bg-amber-950/50 p-4 text-amber-200 text-sm">
            This browser doesn&apos;t support the Web Speech API. Use Chrome or
            Edge for live dictation — manual reference entry below still works.
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-700 bg-red-950/50 p-4 text-red-200 text-sm">
            {error}
          </div>
        )}

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: listening + transcript */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleListening}
                disabled={!supported || !bible}
                className={`rounded-lg px-5 py-3 font-semibold text-sm transition-colors disabled:opacity-40 ${
                  listening
                    ? "bg-red-600 hover:bg-red-500"
                    : "bg-emerald-600 hover:bg-emerald-500"
                }`}
              >
                {listening ? "■ Stop Listening" : "● Start Listening"}
              </button>
              <label className="flex items-center gap-2 text-sm text-zinc-300 select-none">
                <input
                  type="checkbox"
                  checked={autoShow}
                  onChange={(e) => setAutoShow(e.target.checked)}
                  className="accent-indigo-500 size-4"
                />
                Auto-show detected verses
              </label>
              {!bible && (
                <span className="text-xs text-zinc-500">loading Bible…</span>
              )}
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900 h-64 overflow-y-auto p-4 text-sm leading-relaxed">
              {segments.length === 0 && !interim ? (
                <p className="text-zinc-600 italic">
                  {listening
                    ? "Listening… say something like “Turn with me to John chapter 3 verse 16.”"
                    : "Transcript will appear here."}
                </p>
              ) : (
                <>
                  {segments.map((seg, i) => (
                    <span key={i} className="text-zinc-300">
                      {seg}{" "}
                    </span>
                  ))}
                  <span className="text-zinc-500">{interim}</span>
                  <div ref={transcriptEndRef} />
                </>
              )}
            </div>

            <form onSubmit={submitManual} className="flex gap-2">
              <input
                value={manualRef}
                onChange={(e) => setManualRef(e.target.value)}
                placeholder="Type a reference — e.g. Romans 8:28-30"
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!bible}
                className="rounded-lg bg-zinc-700 hover:bg-zinc-600 px-4 py-2 text-sm font-medium disabled:opacity-40"
              >
                Show
              </button>
            </form>
          </div>

          {/* Right: now showing + history */}
          <div className="space-y-4">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Now on screen
                </h2>
                <div className="flex gap-1">
                  <button
                    onClick={() => step(-1)}
                    disabled={!current}
                    title="Previous verse (←)"
                    className="rounded bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 text-sm disabled:opacity-30"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => step(1)}
                    disabled={!current}
                    title="Next verse (→)"
                    className="rounded bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 text-sm disabled:opacity-30"
                  >
                    →
                  </button>
                  <button
                    onClick={clearDisplay}
                    disabled={!current}
                    title="Blank the screen (Esc)"
                    className="rounded bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 text-sm disabled:opacity-30"
                  >
                    Blank
                  </button>
                </div>
              </div>
              {current ? (
                <div>
                  <p className="font-semibold text-indigo-400">
                    {current.reference}{" "}
                    <span className="text-zinc-500 font-normal">
                      ({current.version})
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-zinc-300 line-clamp-4">
                    {current.verses.map((v) => v.text).join(" ")}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-zinc-600 italic">Screen is blank.</p>
              )}
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                Detected / recent
              </h2>
              {history.length === 0 ? (
                <p className="text-sm text-zinc-600 italic">
                  Detected references collect here — click one to show it.
                </p>
              ) : (
                <ul className="space-y-1 max-h-72 overflow-y-auto">
                  {history.map((p, i) => (
                    <li key={`${p.osis}-${i}`}>
                      <button
                        onClick={() => showPassage(p)}
                        className={`w-full text-left rounded px-3 py-2 text-sm hover:bg-zinc-800 ${
                          current?.osis === p.osis
                            ? "bg-zinc-800 text-indigo-300"
                            : "text-zinc-300"
                        }`}
                      >
                        <span className="font-medium">{p.reference}</span>{" "}
                        <span className="text-zinc-500">
                          {p.verses[0].text.slice(0, 60)}…
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-xs text-zinc-600">
              Shortcuts: ← → step verses · Esc or B blanks the screen. Open the
              Display window on the TV/projector output and press F11 for
              fullscreen.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
