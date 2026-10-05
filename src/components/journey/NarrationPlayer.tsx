"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Pause, Play, Square, Volume2 } from "lucide-react";

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

function pickVoice(lang: "ar" | "en"): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const prefix = lang === "ar" ? "ar" : "en";
  return (
    voices.find((v) => v.lang.toLowerCase().startsWith(lang === "ar" ? "ar-sa" : "en-gb")) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) ??
    null
  );
}

export function NarrationPlayer({ text, lang = "ar" }: { text: string; lang?: "ar" | "en" }) {
  const t = useTranslations("journey");
  const [supported, setSupported] = useState<boolean | null>(null);
  const [hasVoice, setHasVoice] = useState(true);
  const [state, setState] = useState<"idle" | "playing" | "paused">("idle");
  const [rate, setRate] = useState<(typeof RATES)[number]>(lang === "ar" ? 0.8 : 1);
  const queue = useRef<string[]>([]);
  const cancelled = useRef(false);

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
      cancelled.current = true;
      window.speechSynthesis.cancel();
    };
  }, [lang]);

  // A new script (next stop) stops the current one.
  useEffect(() => {
    cancelled.current = true;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setState("idle");
  }, [text]);

  const speakNext = useCallback(() => {
    const next = queue.current.shift();
    if (!next || cancelled.current) {
      setState("idle");
      return;
    }
    const u = new SpeechSynthesisUtterance(next);
    u.lang = lang === "ar" ? "ar-SA" : "en-GB";
    const voice = pickVoice(lang);
    if (voice) u.voice = voice;
    u.rate = rate;
    u.onend = speakNext;
    u.onerror = () => setState("idle");
    window.speechSynthesis.speak(u);
  }, [lang, rate]);

  const play = () => {
    const synth = window.speechSynthesis;
    if (state === "paused") {
      synth.resume();
      setState("playing");
      return;
    }
    synth.cancel();
    cancelled.current = false;
    queue.current = chunks(text);
    setState("playing");
    speakNext();
  };

  const pause = () => {
    window.speechSynthesis.pause();
    setState("paused");
  };

  const stop = () => {
    cancelled.current = true;
    window.speechSynthesis.cancel();
    setState("idle");
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
              onClick={() => setRate(r)}
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
      {!hasVoice && <p className="text-sm text-muted">{t("noVoice")}</p>}
    </div>
  );
}
