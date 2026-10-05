"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Pause, Play, Square, Volume2 } from "lucide-react";
import type { Lang } from "@/lib/i18n";

/**
 * Reads a reviewed script aloud with the device's own voice (Web Speech API):
 * zero cost, works offline once the page is cached, and needs no audio files.
 * Long scripts are split into sentence chunks because some engines silently
 * stop after ~200–300 characters in a single utterance.
 */

const RATES = [0.8, 1, 1.2] as const;

function chunks(text: string): string[] {
  const parts = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?؟،؛:])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const p of parts) {
    if ((cur + " " + p).length > 220 && cur) {
      out.push(cur);
      cur = p;
    } else {
      cur = cur ? `${cur} ${p}` : p;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Preferred voice languages, best first: Saudi Arabic, then British, American or any English. */
const VOICE_PREFS: Record<Lang, string[]> = { ar: ["ar-sa", "ar"], en: ["en-gb", "en-us", "en"] };

function pickVoice(lang: Lang): SpeechSynthesisVoice | null {
  // Some Android engines report "en_US" rather than "en-US".
  const voices = window.speechSynthesis.getVoices().map((v) => ({ v, tag: v.lang.toLowerCase().replace(/_/g, "-") }));
  for (const pref of VOICE_PREFS[lang]) {
    const hit = voices.find(({ tag }) => tag.startsWith(pref));
    if (hit) return hit.v;
  }
  return null;
}

/** `lang` is the script's language — it picks the voice and the "no voice" message. */
export function NarrationPlayer({ text, lang = "ar" }: { text: string; lang?: Lang }) {
  const t = useTranslations("journey");
  const [supported, setSupported] = useState<boolean | null>(null);
  const [hasVoice, setHasVoice] = useState(true);
  const [state, setState] = useState<"idle" | "playing" | "paused">("idle");
  const [rate, setRate] = useState<(typeof RATES)[number]>(lang === "ar" ? 0.8 : 1);
  // Refs, not state, for everything the utterance callbacks read: callbacks
  // fire long after render. `gen` invalidates callbacks of a cancelled run, so
  // a late `onend` can never restart speech the visitor stopped.
  const parts = useRef<string[]>([]);
  const current = useRef(0);
  const gen = useRef(0);
  const rateRef = useRef<number>(rate);

  const halt = useCallback(() => {
    gen.current += 1;
    if (!("speechSynthesis" in window)) return;
    // Some engines ignore cancel() while paused; resume first.
    window.speechSynthesis.resume();
    window.speechSynthesis.cancel();
  }, []);

  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      setSupported(false);
      return;
    }
    setSupported(true);
    const check = () => setHasVoice(!!pickVoice(lang) || window.speechSynthesis.getVoices().length === 0);
    check();
    window.speechSynthesis.addEventListener("voiceschanged", check);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", check);
      halt();
    };
  }, [lang, halt]);

  // A new script (next stop) stops the current one.
  useEffect(() => {
    halt();
    setState("idle");
  }, [text, halt]);

  const speakFrom = useCallback(
    (i: number, run: number) => {
      if (run !== gen.current) return;
      if (i >= parts.current.length) {
        setState("idle");
        return;
      }
      current.current = i;
      const u = new SpeechSynthesisUtterance(parts.current[i]);
      const voice = pickVoice(lang);
      // English follows the chosen voice (an en-US voice reads as en-US).
      u.lang = lang === "ar" ? "ar-SA" : voice?.lang.replace(/_/g, "-") || "en-GB";
      if (voice) u.voice = voice;
      u.rate = rateRef.current;
      u.onend = () => speakFrom(i + 1, run);
      u.onerror = () => {
        if (run === gen.current) setState("idle");
      };
      window.speechSynthesis.speak(u);
    },
    [lang]
  );

  const play = () => {
    if (state === "paused") {
      window.speechSynthesis.resume();
      setState("playing");
      return;
    }
    halt();
    parts.current = chunks(text);
    setState("playing");
    speakFrom(0, gen.current);
  };

  const pause = () => {
    window.speechSynthesis.pause();
    setState("paused");
  };

  const stop = () => {
    halt();
    setState("idle");
  };

  // Speed applies at once: restart the current sentence at the new rate.
  const changeRate = (r: (typeof RATES)[number]) => {
    rateRef.current = r;
    setRate(r);
    if (state === "playing") {
      halt();
      speakFrom(current.current, gen.current);
    }
  };

  if (supported === false) return null;

  return (
    <div className="space-y-2 rounded-2xl bg-primary/10 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {state === "playing" ? (
          <button
            type="button"
            onClick={pause}
            className="flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-lg font-semibold text-paper"
          >
            <Pause aria-hidden="true" className="h-5 w-5" />
            {t("pause")}
          </button>
        ) : (
          <button
            type="button"
            onClick={play}
            className="flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-lg font-semibold text-paper"
          >
            {state === "paused" ? <Play aria-hidden="true" className="h-5 w-5" /> : <Volume2 aria-hidden="true" className="h-5 w-5" />}
            {state === "paused" ? t("resumeAudio") : t("listen")}
          </button>
        )}
        {state !== "idle" && (
          <button
            type="button"
            onClick={stop}
            aria-label={t("stop")}
            className="flex h-12 w-12 items-center justify-center rounded-xl border-[1.5px] border-ink/30"
          >
            <Square aria-hidden="true" className="h-5 w-5" />
          </button>
        )}
        <div role="group" aria-label={t("speed")} className="ms-auto flex gap-1">
          {RATES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => changeRate(r)}
              aria-pressed={rate === r}
              className={`min-h-11 min-w-11 rounded-lg px-2 text-sm font-semibold ltr-nums ${
                rate === r ? "bg-basalt text-paper" : "bg-surface"
              }`}
            >
              {r}×
            </button>
          ))}
        </div>
      </div>
      {!hasVoice && <p className="text-sm text-muted">{t(lang === "ar" ? "noVoice" : "noVoiceEn")}</p>}
    </div>
  );
}
