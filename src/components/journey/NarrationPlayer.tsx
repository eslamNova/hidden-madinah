"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LoaderCircle, Pause, Play, Square, Volume2 } from "lucide-react";
import type { Lang } from "@/lib/i18n";

/**
 * Plays a stop's narration: the recorded MP3 when there is one (`src`, see
 * src/lib/narration-audio.ts), otherwise the device's own voice (Web Speech
 * API) — zero cost, works offline once the page is cached, needs no audio
 * files. A recording that fails to load (offline, missing) hands over to the
 * device's voice. Both share one set of controls, so focus and the chosen
 * speed survive the switch.
 */

const RATES = [0.8, 1, 1.2] as const;
type Rate = (typeof RATES)[number];
type PlayState = "idle" | "playing" | "paused";

/**
 * Long scripts are split into sentence chunks because some speech engines
 * silently stop after ~200–300 characters in a single utterance.
 */
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

/** "1:05" */
function clock(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** `lang` is the script's language — it picks the voice and the "no voice" message. */
export function NarrationPlayer({ text, lang = "ar", src = null }: { text: string; lang?: Lang; src?: string | null }) {
  const t = useTranslations("journey");
  // Until the visitor picks a speed each source has its own default (device
  // Arabic voices read fast); a pick then holds for both.
  const [chosenRate, setChosenRate] = useState<Rate | null>(null);
  const voiceRate = lang === "ar" ? 0.8 : 1;
  // The recording that failed to load, if any: the device's voice reads instead.
  const [failed, setFailed] = useState<string | null>(null);
  const recorded = !!src && src !== failed;
  const speech = useSpeech(text, lang, chosenRate ?? voiceRate);
  const rec = useRecording(recorded ? src : null, chosenRate ?? 1, (bad, wasPlaying) => {
    setFailed(bad);
    // The visitor pressed Listen: carry on with the device's voice.
    if (wasPlaying && speech.supported) speech.play(false);
  });

  if (!recorded && speech.supported === false) return null;

  const state = recorded ? rec.state : speech.state;
  const rate = chosenRate ?? (recorded ? 1 : voiceRate);
  const changeRate = (r: Rate) => {
    setChosenRate(r);
    if (!recorded) speech.setSpeed(r);
  };

  return (
    <div className="space-y-2 rounded-2xl bg-primary/10 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {state === "playing" ? (
          <button
            type="button"
            onClick={() => (recorded ? rec.pause() : speech.pause())}
            className="flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-lg font-semibold text-paper"
          >
            {recorded && rec.loading ? (
              <LoaderCircle aria-hidden="true" className="h-5 w-5 motion-safe:animate-spin" />
            ) : (
              <Pause aria-hidden="true" className="h-5 w-5" />
            )}
            {t("pause")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => (recorded ? rec.play() : speech.play())}
            className="flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-lg font-semibold text-paper"
          >
            {state === "paused" ? <Play aria-hidden="true" className="h-5 w-5" /> : <Volume2 aria-hidden="true" className="h-5 w-5" />}
            {state === "paused" ? t("resumeAudio") : t("listen")}
          </button>
        )}
        {state !== "idle" && (
          <button
            type="button"
            onClick={() => (recorded ? rec.stop() : speech.stop())}
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
      {recorded && state !== "idle" && (
        // Playback timelines run left to right in RTL interfaces too.
        <div dir="ltr" className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={Math.floor(rec.duration)}
            step={1}
            value={Math.floor(Math.min(rec.time, rec.duration))}
            onChange={(e) => rec.seek(Number(e.target.value))}
            disabled={!rec.duration}
            aria-label={t("audioPosition")}
            aria-valuetext={t("audioTime", { elapsed: clock(rec.time), total: clock(rec.duration) })}
            className="h-11 min-w-0 flex-1 accent-brand"
          />
          <span className="shrink-0 text-sm tabular-nums">
            {rec.duration ? `${clock(rec.time)} / ${clock(rec.duration)}` : clock(rec.time)}
          </span>
        </div>
      )}
      {recorded && <audio ref={rec.ref} preload="none" />}
      {!recorded && !speech.hasVoice && <p className="text-sm text-muted">{t(lang === "ar" ? "noVoice" : "noVoiceEn")}</p>}
    </div>
  );
}

/** The device's voice reading `text`. */
function useSpeech(text: string, lang: Lang, rate: number) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [hasVoice, setHasVoice] = useState(true);
  const [state, setState] = useState<PlayState>("idle");
  // Refs, not state, for everything the utterance callbacks read: callbacks
  // fire long after render. `gen` invalidates callbacks of a cancelled run, so
  // a late `onend` can never restart speech the visitor stopped.
  const parts = useRef<string[]>([]);
  const current = useRef(0);
  const gen = useRef(0);
  const rateRef = useRef(rate);
  const started = useRef(false);

  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

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

  // A new script (kids toggle) stops the current one.
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
      u.onstart = () => {
        started.current = true;
      };
      u.onend = () => speakFrom(i + 1, run);
      u.onerror = () => {
        if (run === gen.current) setState("idle");
      };
      window.speechSynthesis.speak(u);
    },
    [lang]
  );

  /** `tapped` is false when the device's voice takes over from a recording that failed to load. */
  const play = (tapped = true) => {
    if (state === "paused") {
      window.speechSynthesis.resume();
      setState("playing");
      return;
    }
    halt();
    parts.current = chunks(text);
    setState("playing");
    const run = gen.current;
    started.current = false;
    speakFrom(0, run);
    // iOS only lets a tap start speech, so a takeover may stay silent: offer
    // "Listen" again rather than a Pause button over silence.
    if (!tapped) {
      setTimeout(() => {
        if (run === gen.current && !started.current) {
          halt();
          setState("idle");
        }
      }, 4000);
    }
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
  const setSpeed = (r: number) => {
    rateRef.current = r;
    if (state === "playing") {
      halt();
      speakFrom(current.current, gen.current);
    }
  };

  return { supported, hasVoice, state, play, pause, stop, setSpeed };
}

/**
 * A recorded MP3 in an <audio> element the caller renders with `ref` and
 * preload="none": nothing downloads until the visitor taps Listen (data
 * matters on mobile). `onFail` gets the recording that failed to load and
 * whether the visitor was waiting to hear it.
 */
function useRecording(src: string | null, rate: number, onFail: (src: string, wasPlaying: boolean) => void) {
  const ref = useRef<HTMLAudioElement>(null);
  const [state, setState] = useState<PlayState>("idle");
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // Whether the visitor wants sound now: tells a deliberately aborted play() from a failure.
  const wanted = useRef(false);
  const failRef = useRef(onFail);
  useEffect(() => {
    failRef.current = onFail;
  });

  // Each recording (kids toggle) starts stopped, from the beginning.
  useEffect(() => {
    setState("idle");
    setLoading(false);
    setTime(0);
    setDuration(0);
    const a = ref.current;
    if (!src || !a) return;
    const on: [keyof HTMLMediaElementEventMap, () => void][] = [
      [
        "playing",
        () => {
          setLoading(false);
          setState("playing");
        },
      ],
      ["waiting", () => setLoading(true)],
      [
        // Also a pause from outside (headphones unplugged, a call). The end of
        // the file pauses too; "ended" handles that.
        "pause",
        () => {
          if (a.ended) return;
          setLoading(false);
          setState((s) => (s === "playing" ? "paused" : s));
        },
      ],
      [
        "ended",
        () => {
          wanted.current = false;
          setState("idle");
          setTime(0);
        },
      ],
      ["timeupdate", () => setTime(a.currentTime)],
      ["durationchange", () => setDuration(Number.isFinite(a.duration) ? a.duration : 0)],
      [
        "error",
        () => {
          const was = wanted.current;
          wanted.current = false;
          setLoading(false);
          setState("idle");
          failRef.current(src, was);
        },
      ],
    ];
    for (const [type, fn] of on) a.addEventListener(type, fn);
    a.src = src;
    return () => {
      for (const [type, fn] of on) a.removeEventListener(type, fn);
      wanted.current = false;
      a.pause();
      // Stop the download as well.
      a.removeAttribute("src");
      a.load();
    };
  }, [src]);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    // Loading a file resets playbackRate to defaultPlaybackRate: set both.
    a.defaultPlaybackRate = rate;
    a.playbackRate = rate;
  }, [rate, src]);

  const play = () => {
    const a = ref.current;
    if (!a) return;
    wanted.current = true;
    setState("playing");
    if (a.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) setLoading(true);
    a.play().catch(() => {
      // A failed load also fires "error" (→ the device's voice); pause, stop
      // and a new recording abort play() on purpose. Anything else (an
      // autoplay policy) just stops.
      if (a.error || !wanted.current) return;
      wanted.current = false;
      setLoading(false);
      setState("idle");
    });
  };

  const pause = () => {
    wanted.current = false;
    setLoading(false);
    setState("paused");
    ref.current?.pause();
  };

  const stop = () => {
    wanted.current = false;
    setLoading(false);
    setState("idle");
    setTime(0);
    const a = ref.current;
    if (!a) return;
    a.pause();
    if (a.readyState > HTMLMediaElement.HAVE_NOTHING) a.currentTime = 0;
  };

  const seek = (to: number) => {
    const a = ref.current;
    if (!a) return;
    a.currentTime = to;
    setTime(to);
  };

  return { ref, state, loading, time, duration, play, pause, stop, seek };
}
