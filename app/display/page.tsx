"use client";

import { useEffect, useState } from "react";
import { onDisplayMessage, readCurrentPassage } from "@/lib/channel";
import type { Passage } from "@/lib/types";

export default function DisplayPage() {
  const [passage, setPassage] = useState<Passage | null>(null);

  useEffect(() => {
    setPassage(readCurrentPassage());
    return onDisplayMessage((message) => {
      if (message.type === "show") setPassage(message.passage);
      else setPassage(null);
    });
  }, []);

  const totalChars =
    passage?.verses.reduce((sum, v) => sum + v.text.length, 0) ?? 0;
  const sizeClass =
    totalChars > 700
      ? "text-[3.2vmin]"
      : totalChars > 400
        ? "text-[4vmin]"
        : totalChars > 200
          ? "text-[5vmin]"
          : "text-[6vmin]";

  return (
    <main className="fixed inset-0 bg-black text-white flex flex-col cursor-none select-none">
      {passage ? (
        <>
          <div className="flex-1 flex items-center justify-center px-[6vmin] overflow-hidden">
            <p className={`${sizeClass} leading-snug font-serif text-center max-w-[85vw]`}>
              {passage.verses.map((v, i) => (
                <span key={`${v.chapter}-${v.verse}`}>
                  {passage.verses.length > 1 && (
                    <sup className="text-[0.55em] text-amber-400/90 mr-1">
                      {i === 0 || v.verse === 1 ? `${v.chapter}:${v.verse}` : v.verse}
                    </sup>
                  )}
                  {v.text}{" "}
                </span>
              ))}
            </p>
          </div>
          <footer className="pb-[4vmin] px-[6vmin] flex items-baseline justify-center gap-[2vmin]">
            <span className="text-[3.5vmin] font-semibold text-amber-400">
              {passage.reference}
            </span>
            <span className="text-[2.2vmin] text-zinc-400 uppercase tracking-widest">
              {passage.version}
            </span>
          </footer>
        </>
      ) : (
        // Blank screen — the operator cleared it or nothing is live yet.
        <div className="flex-1" />
      )}
    </main>
  );
}
