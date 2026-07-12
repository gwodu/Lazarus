// Thin wrapper over the Web Speech API with auto-restart, since Chrome
// stops recognition after silence. Structured so a local Whisper engine
// (e.g. transformers.js) can implement the same interface later.

export interface TranscriptUpdate {
  /** Newly finalized text since the last final result. */
  finalText: string;
  /** Current in-progress hypothesis (changes as the speaker talks). */
  interimText: string;
}

export interface SpeechEngine {
  start(): void;
  stop(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

export function speechSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function createWebSpeechEngine(
  onUpdate: (update: TranscriptUpdate) => void,
  onError: (message: string) => void,
): SpeechEngine {
  const w = window as unknown as Record<string, unknown>;
  const Ctor = (w.SpeechRecognition ||
    w.webkitSpeechRecognition) as SpeechRecognitionCtor;

  let recognition: SpeechRecognitionLike | null = null;
  let running = false;

  const spinUp = () => {
    recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript + " ";
        else interimText += result[0].transcript;
      }
      onUpdate({ finalText: finalText.trim(), interimText });
    };

    recognition.onend = () => {
      // Chrome ends recognition after silence; restart while active.
      if (running) spinUp();
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        running = false;
        onError("Microphone access was denied. Allow it in the browser and try again.");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        onError(`Speech recognition error: ${event.error}`);
      }
    };

    recognition.start();
  };

  return {
    start() {
      if (running) return;
      running = true;
      spinUp();
    },
    stop() {
      running = false;
      recognition?.stop();
      recognition = null;
    },
  };
}
