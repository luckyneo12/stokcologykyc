"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Visual + spoken guidance for the live selfie camera (used by LiveSelfieCapture).
 * Display only: it reads what the camera already detected and never changes a check, the
 * liveness challenge or the capture. Everything here is optional — if speech is missing or
 * blocked the selfie works exactly the same.
 *
 * The preview is mirrored, so "your left" is the left of the screen: arrows and the head turn
 * the way the user sees themselves.
 */

// ─── What to say / show for each guide cue ─────────────────────────────────
export const GUIDE_TEXT = {
  wait: { hi: "कैमरा तैयार हो रहा है…", en: "Getting the camera ready…" },
  location: { hi: "आपकी लोकेशन ली जा रही है…", en: "Getting your location…" },
  checking: { hi: "फोटो जाँची जा रही है…", en: "Checking your photo…" },
  get_ready: { hi: "तैयार हो जाइए", en: "Get ready" },
  turn_left: { hi: "धीरे से अपना सिर बाईं ओर घुमाइए", en: "Slowly turn your head to the left" },
  turn_right: { hi: "धीरे से अपना सिर दाईं ओर घुमाइए", en: "Slowly turn your head to the right" },
  straight: { hi: "अब सीधे कैमरे में देखिए", en: "Now look straight at the camera" },
  blink: { hi: "एक बार आँखें झपकाइए", en: "Blink your eyes once" },
  smile: { hi: "थोड़ा मुस्कुराइए", en: "Give a small smile" },
  move_left: { hi: "थोड़ा बाईं ओर आइए", en: "Move a little to your left" },
  move_right: { hi: "थोड़ा दाईं ओर आइए", en: "Move a little to your right" },
  move_up: { hi: "चेहरा थोड़ा ऊपर लाइए", en: "Move your face a little up" },
  move_down: { hi: "चेहरा थोड़ा नीचे लाइए", en: "Move your face a little down" },
  center: { hi: "अपना चेहरा गोले के अंदर लाइए", en: "Bring your face inside the oval" },
  closer: { hi: "कैमरे के थोड़ा पास आइए", en: "Come a little closer to the camera" },
  farther: { hi: "कैमरे से थोड़ा दूर जाइए", en: "Move a little away from the camera" },
  no_face: { hi: "अपना चेहरा कैमरे के सामने लाइए", en: "Bring your face in front of the camera" },
  multiple: { hi: "फ्रेम में सिर्फ आप ही रहिए", en: "Only you should be in the frame" },
  glasses: { hi: "कृपया चश्मा उतार दीजिए", en: "Please remove your glasses" },
  light: { hi: "रोशनी की तरफ मुँह कीजिए", en: "Face towards the light" },
  eyes_open: { hi: "आँखें खुली रखिए", en: "Keep your eyes open" },
  hold: { hi: "स्थिर रहिए", en: "Hold still" },
  click: { hi: "बहुत बढ़िया! स्थिर रहिए, फोटो ली जा रही है", en: "Great! Hold still — taking your photo" },
};

// Not spoken (status only) / spoken once instead of repeated
const SILENT_CUES = new Set(["wait", "location", "checking", "hold"]);
const ONCE_CUES = new Set(["click", "get_ready"]);
const SPEAK_DELAY_MS = 600; // the cue must stay this long before it is spoken (no chatter on flicker)
const REPEAT_MS = 7000; // repeated while the user hasn't done it yet

const STEP_CUES = { turn_left: "turn_left", turn_right: "turn_right", blink: "blink", smile: "smile" };
const BLOCKING_CUES = {
  noFace: "no_face",
  multipleFaces: "multiple",
  sunglasses: "glasses",
  glasses: "glasses",
  turned: "straight",
  needBlink: "blink",
};
const TIP_CUES = {
  tooFar: "closer",
  tooClose: "farther",
  tooDark: "light",
  backlit: "light",
  notStraight: "straight",
  eyesClosed: "eyes_open",
};

/** Picks the single instruction to show / speak from the camera's current state. */
export function getGuideCue({ stage, engineState, locationGranted, challengeView, issues = [], tips = [], nudge, ready }) {
  if (stage === "starting" || engineState === "loading") return "wait";
  if (engineState !== "ready" || !locationGranted) return null;
  if (stage === "verifying") return "checking";
  if (stage === "challengeLoading") return "get_ready";
  if (stage === "challenge") {
    if (!challengeView) return null;
    if (issues.includes("noFace")) return "no_face";
    if (issues.includes("multipleFaces")) return "multiple";
    if (challengeView.centering) return "straight";
    return STEP_CUES[challengeView.steps?.[challengeView.index]] || null;
  }
  if (stage !== "live" && stage !== "ready") return null;
  const blocking = issues.find((k) => BLOCKING_CUES[k]);
  if (blocking) return BLOCKING_CUES[blocking];
  const tip = tips[0];
  if (tip === "notCentered") return nudge ? `move_${nudge}` : "center";
  if (tip && TIP_CUES[tip]) return TIP_CUES[tip];
  if (stage === "ready" && ready) return "click";
  return "hold";
}

// ─── Saved choice: language + sound on/off (per device) ────────────────────
const PREFS_KEY = "lsgVoicePrefs";

export function useGuidePrefs() {
  const [prefs, setPrefs] = useState({ lang: "hi", muted: false });
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
      if (saved && (saved.lang === "hi" || saved.lang === "en")) setPrefs({ lang: saved.lang, muted: !!saved.muted });
    } catch {
      // storage unavailable — defaults apply
    }
  }, []);
  const update = useCallback((patch) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable — the choice lasts for this screen only
      }
      return next;
    });
  }, []);
  return [prefs, update];
}

// ─── Voice (the phone's built-in speech; no audio files) ───────────────────
export function useGuideVoice(cue, lang, muted) {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
  const [voices, setVoices] = useState([]);
  const [speaking, setSpeaking] = useState(false); // drives the voice waveform under the head
  const primedRef = useRef(false);

  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const load = () => setVoices(synth.getVoices() || []);
    load();
    if (synth.addEventListener) synth.addEventListener("voiceschanged", load);
    else synth.onvoiceschanged = load;
    return () => {
      if (synth.removeEventListener) synth.removeEventListener("voiceschanged", load);
      else synth.onvoiceschanged = null;
    };
  }, [supported]);

  const hindiVoice = voices.find((v) => /^hi([-_]|$)/i.test(v.lang));
  const englishVoice = voices.find((v) => /^en[-_]IN/i.test(v.lang)) || voices.find((v) => /^en([-_]|$)/i.test(v.lang));
  // Some browsers list no voices at all yet still speak — only a known list without Hindi counts as missing
  const hindiAvailable = voices.length === 0 || !!hindiVoice;
  const voiceLang = lang === "hi" && !hindiAvailable ? "en" : lang;
  const voiceRef = useRef(null);
  voiceRef.current = voiceLang === "hi" ? hindiVoice : englishVoice;
  const voiceName = voiceRef.current?.voiceURI || "";

  // iOS only lets speech start from a tap: call this from any tap on the selfie screen
  const prime = useCallback(() => {
    if (!supported || primedRef.current) return;
    primedRef.current = true;
    try {
      const u = new window.SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    } catch {
      // speech blocked — the guide stays visual only
    }
  }, [supported]);

  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const text = cue && GUIDE_TEXT[cue]?.[voiceLang];
    if (muted || !text || SILENT_CUES.has(cue)) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const speak = () => {
      try {
        synth.cancel();
        const u = new window.SpeechSynthesisUtterance(text);
        u.lang = voiceLang === "hi" ? "hi-IN" : "en-IN";
        if (voiceRef.current) u.voice = voiceRef.current;
        u.rate = 0.95;
        u.onstart = () => setSpeaking(true);
        u.onend = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
        synth.speak(u);
      } catch {
        // speech blocked — the guide stays visual only
      }
    };
    let repeat = null;
    const start = setTimeout(() => {
      speak();
      if (!ONCE_CUES.has(cue)) repeat = setInterval(speak, REPEAT_MS);
    }, SPEAK_DELAY_MS);
    return () => {
      clearTimeout(start);
      if (repeat) clearInterval(repeat);
    };
  }, [supported, cue, voiceLang, muted, voiceName]);

  // Stop talking when the camera screen goes away
  useEffect(() => () => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  return { supported, hindiAvailable, voiceLang, prime, speaking };
}

// ─── Guide tone (colour of the head ring / caption) ────────────────────────
const ACTION_CUES = new Set(["turn_left", "turn_right", "straight", "blink", "smile", "get_ready"]);
const WARN_CUES = new Set([
  "no_face", "multiple", "glasses", "light", "eyes_open", "closer", "farther",
  "center", "move_left", "move_right", "move_up", "move_down",
]);
export function cueTone(cue) {
  if (!cue) return "info";
  if (cue === "click") return "ok";
  if (ACTION_CUES.has(cue)) return "action";
  if (WARN_CUES.has(cue)) return "warn";
  return "info";
}

// ─── Guide head (short clips of a real person) ──────────────────────────────
// Clips are cut from one source video (public/selfie-guide). They face the way the user sees
// themselves in the mirrored preview: "turn-left" looks to the left of the screen.
const HEAD_CLIP_BASE = "/selfie-guide";
const HEAD_CLIP = {
  turn_left: "turn-left",
  turn_right: "turn-right",
  blink: "blink",
  smile: "smile",
  click: "smile",
};
// Cues without their own clip use the front clip with a gentle slide / zoom
const HEAD_MOTION = {
  closer: "lsg-m-grow",
  farther: "lsg-m-shrink",
  move_left: "lsg-m-nudgeL",
  move_right: "lsg-m-nudgeR",
  move_up: "lsg-m-nudgeU",
  move_down: "lsg-m-nudgeD",
  center: "lsg-m-search",
  no_face: "lsg-m-search",
};

// Playback speed per clip: the head turns are slowed down so the movement is easy to follow and copy
// ("slowly turn your head"); a blink or smile at normal speed looks natural.
const HEAD_CLIP_RATE = { "turn-left": 0.55, "turn-right": 0.55 };

function GuideHead({ cue }) {
  const clip = HEAD_CLIP[cue] || "front";
  const rate = HEAD_CLIP_RATE[clip] || 1;
  const videoRef = useRef(null);
  // The browser resets the speed when a clip (re)loads, so it is set again once it is ready
  const applyRate = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.defaultPlaybackRate = rate;
    v.playbackRate = rate;
  }, [rate]);
  useEffect(applyRate, [applyRate, clip]);
  return (
    <div className={`lsg-head ${HEAD_MOTION[cue] || ""}`}>
      <video
        ref={videoRef}
        onLoadedData={applyRate}
        onPlay={applyRate}
        className="lsg-head-video"
        src={`${HEAD_CLIP_BASE}/${clip}.mp4`}
        poster={`${HEAD_CLIP_BASE}/poster.jpg`}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-hidden="true"
      />
    </div>
  );
}

// Bars of the voice waveform (heights in %, staggered so they move like speech)
const VOICE_BARS = [30, 55, 80, 45, 95, 60, 85, 40, 70, 100, 50, 75, 35, 90, 55, 65, 40, 80, 30];

/** The instructor on a holographic panel, with a voice waveform that moves while the guide speaks. */
export function GuideHeadCoin({ cue, speaking = false }) {
  if (!cue) return null;
  const tone = cueTone(cue);
  const badge = cue === "click" ? "ok" : (cue === "glasses" || cue === "multiple") ? "bad" : cue === "light" ? "sun" : null;
  return (
    <div className={`lsg-coin lsg-coin-${tone} ${speaking ? "lsg-speaking" : ""}`} aria-hidden="true">
      <div className="lsg-coin-face" key={cue}>
        <GuideHead cue={cue} />
        <span className="lsg-scan" />
      </div>
      <span className="lsg-corner lsg-corner-tl" />
      <span className="lsg-corner lsg-corner-tr" />
      <span className="lsg-corner lsg-corner-bl" />
      <span className="lsg-corner lsg-corner-br" />
      <div className="lsg-voice">
        {VOICE_BARS.map((h, i) => (
          <span key={i} style={{ "--h": `${h}%`, animationDelay: `${(i * 97) % 600}ms` }} />
        ))}
      </div>
      {badge === "ok" && <span className="lsg-badge lsg-badge-ok">✓</span>}
      {badge === "bad" && <span className="lsg-badge lsg-badge-bad">✕</span>}
      {badge === "sun" && (
        <span className="lsg-badge lsg-badge-sun">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        </span>
      )}
    </div>
  );
}

// ─── Arrows on the camera ──────────────────────────────────────────────────
// Each arrow is a round bubble with an arrow pointing LEFT, rotated into place
const ARROWS = {
  turn_left: [{ x: 11, y: 47, rot: 0 }],
  move_left: [{ x: 11, y: 47, rot: 0 }],
  turn_right: [{ x: 89, y: 47, rot: 180 }],
  move_right: [{ x: 89, y: 47, rot: 180 }],
  straight: [{ x: 11, y: 47, rot: 180 }, { x: 89, y: 47, rot: 0 }],
  move_up: [{ x: 50, y: 12, rot: 90 }],
  move_down: [{ x: 50, y: 88, rot: -90 }],
  closer: [
    { x: 12, y: 10, rot: 45, sm: true }, { x: 88, y: 10, rot: 135, sm: true },
    { x: 88, y: 90, rot: -135, sm: true }, { x: 12, y: 90, rot: -45, sm: true },
  ],
  farther: [
    { x: 12, y: 10, rot: 225, sm: true }, { x: 88, y: 10, rot: 315, sm: true },
    { x: 88, y: 90, rot: 45, sm: true }, { x: 12, y: 90, rot: 135, sm: true },
  ],
};

export function GuideArrows({ cue }) {
  const groups = ARROWS[cue];
  if (!groups) return null;
  return (
    <div className="lsg-arrows" aria-hidden="true" key={cue}>
      {groups.map((g, gi) => (
        <div key={gi} className="lsg-anchor" style={{ left: `${g.x}%`, top: `${g.y}%` }}>
          <div className={`lsg-bubble ${g.sm ? "lsg-bubble-sm" : ""}`}>
            <div className="lsg-dir" style={{ transform: `rotate(${g.rot}deg)` }}>
              <svg className="lsg-arrow" viewBox="0 0 24 24">
                <path d="M19 12H6M11.5 6.5 6 12l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Caption under the camera: instruction + voice controls + progress ─────
function SpeakerIcon({ off }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none" />
      {off ? (
        <path d="M16 9.5l5 5M21 9.5l-5 5" />
      ) : (
        <>
          <path d="M15.5 9a4 4 0 0 1 0 6" />
          <path d="M18.2 6.5a7.5 7.5 0 0 1 0 11" />
        </>
      )}
    </svg>
  );
}

const CAPTION_LABELS = {
  action: { hi: "यह कीजिए", en: "Do this" },
  warn: { hi: "इसे ठीक कीजिए", en: "Fix this" },
  ok: { hi: "सब सही है", en: "All set" },
  info: { hi: "कृपया रुकिए", en: "Please wait" },
};

/**
 * cue          guide cue (its text in the chosen language) — or null to show `fallbackText`
 * fallbackText / fallbackTone   the camera's own status line when there is no guide cue
 * progress     { steps, index, done, centering, secondsLeft } while the liveness actions run
 */
export function GuideCaption({ cue, fallbackText, fallbackTone, prefs, setPrefs, voice, progress }) {
  const { lang, muted } = prefs;
  const text = cue ? (GUIDE_TEXT[cue]?.[lang] || GUIDE_TEXT[cue]?.en) : fallbackText;
  if (!text && !progress) return null;
  const tone = cue ? cueTone(cue) : fallbackTone === "warn" ? "warn" : fallbackTone === "ok" ? "ok" : "info";
  const speakerTitle = !voice.supported
    ? "Voice guidance isn't available in this browser"
    : muted
      ? "Turn voice guidance on"
      : lang === "hi" && voice.voiceLang !== "hi"
        ? "Hindi voice isn't available on this device — speaking in English"
        : "Turn voice guidance off";

  const label = CAPTION_LABELS[tone]?.[lang] || CAPTION_LABELS[tone]?.en;

  return (
    <div className={`lsg-caption lsg-tone-${tone}`}>
      <div className="lsg-cap-top">
        <span className="lsg-cap-label"><span className="lsg-pulse" aria-hidden="true" />{label}</span>
        <div className="lsg-controls">
          {voice.supported && (
            <button
              type="button"
              className={`lsg-speaker ${muted ? "lsg-off" : ""}`}
              onClick={() => {
                voice.prime();
                setPrefs({ muted: !muted });
              }}
              aria-label={muted ? "Turn voice guidance on" : "Turn voice guidance off"}
              aria-pressed={!muted}
              title={speakerTitle}
            >
              <SpeakerIcon off={muted} />
            </button>
          )}
          <div className="lsg-lang" role="group" aria-label="Guidance language">
            <button type="button" className={lang === "hi" ? "lsg-on" : ""} aria-pressed={lang === "hi"} onClick={() => { voice.prime(); setPrefs({ lang: "hi" }); }}>हिं</button>
            <button type="button" className={lang === "en" ? "lsg-on" : ""} aria-pressed={lang === "en"} onClick={() => { voice.prime(); setPrefs({ lang: "en" }); }}>EN</button>
          </div>
        </div>
      </div>
      {text && <p className="lsg-text" key={`${cue || fallbackText}-${lang}`} lang={cue && lang === "hi" ? "hi" : "en"} aria-live="polite">{text}</p>}
      {progress && (
        <div className="lsg-progress">
          <div className="lsg-segs">
            {progress.steps.map((s, i) => (
              <span key={s} className={`lsg-seg ${progress.done || i < progress.index ? "lsg-seg-done" : i === progress.index ? "lsg-seg-active" : ""}`} />
            ))}
          </div>
          <span className="lsg-progress-label">
            {progress.done
              ? "Liveness confirmed ✓"
              : progress.centering
                ? "Look straight"
                : `Step ${progress.index + 1} of ${progress.steps.length}`}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Styles (scoped by the lsg- prefix; added next to the lsc- styles) ──────
export const GUIDE_STYLES = `
/* Instructor on a holographic panel (no circle) */
.lsg-coin { position: relative; width: min(100%, 220px); margin: 0 auto; padding: 8px; --lsg-ring: #67e8f9; }
.lsg-coin-action { --lsg-ring: #4da3ff; }
.lsg-coin-warn { --lsg-ring: #f5a623; }
.lsg-coin-ok { --lsg-ring: var(--wise-green, #9fe870); }
.lsg-coin-face { position: relative; aspect-ratio: 1 / 1; border-radius: 18px; overflow: hidden; background: #0b1220;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--lsg-ring) 45%, transparent), 0 0 26px color-mix(in srgb, var(--lsg-ring) 35%, transparent), 0 14px 30px rgba(2,8,23,0.35);
  transition: box-shadow 0.3s; animation: lsg-pop 0.35s cubic-bezier(.2,1.3,.4,1); }
.lsg-coin-face::after { content: ""; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(0deg, rgba(103,232,249,0.06) 0 1px, transparent 1px 3px), linear-gradient(180deg, transparent 55%, rgba(11,18,32,0.55) 100%); }
.lsg-scan { position: absolute; left: 0; right: 0; top: 0; height: 22%; pointer-events: none;
  background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--lsg-ring) 28%, transparent) 85%, color-mix(in srgb, var(--lsg-ring) 70%, transparent)); mix-blend-mode: screen; animation: lsg-scanmove 3.2s linear infinite; }
.lsg-corner { position: absolute; width: 20px; height: 20px; border: 2.5px solid var(--lsg-ring); pointer-events: none; transition: border-color 0.3s; filter: drop-shadow(0 0 4px var(--lsg-ring)); }
.lsg-corner-tl { top: 0; left: 0; border-right: none; border-bottom: none; border-top-left-radius: 10px; }
.lsg-corner-tr { top: 0; right: 0; border-left: none; border-bottom: none; border-top-right-radius: 10px; }
.lsg-corner-bl { bottom: 0; left: 0; border-right: none; border-top: none; border-bottom-left-radius: 10px; }
.lsg-corner-br { bottom: 0; right: 0; border-left: none; border-top: none; border-bottom-right-radius: 10px; }
/* Voice waveform over the bottom of the panel — flat while silent, alive while speaking */
.lsg-voice { position: absolute; left: 20px; right: 20px; bottom: 16px; height: 26px; display: flex; align-items: center; justify-content: center; gap: 3px; pointer-events: none; }
.lsg-voice span { width: 3px; height: 12%; border-radius: 3px; background: linear-gradient(180deg, #a5f3fc, var(--lsg-ring)); box-shadow: 0 0 6px var(--lsg-ring); opacity: 0.55; transition: height 0.25s, opacity 0.25s; }
.lsg-speaking .lsg-voice span { height: var(--h); opacity: 1; animation: lsg-wave 0.6s ease-in-out infinite alternate; }
.lsg-head { width: 100%; height: 100%; }
.lsg-head-video { width: 100%; height: 100%; display: block; object-fit: cover; object-position: 50% 30%; pointer-events: none; }
.lsg-badge { position: absolute; right: 0; top: 0; z-index: 2; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 900; border: 3px solid var(--bg-primary, #fff); animation: lsg-pop 0.45s cubic-bezier(.2,1.6,.4,1); }
.lsg-badge-ok { background: var(--wise-green, #9fe870); color: var(--wise-dark-green, #163300); }
.lsg-badge-bad { background: #ef4444; color: #fff; }
.lsg-badge-sun { background: #fbbf24; color: #3b2a00; }

/* Slide / zoom of the front clip for position cues */
.lsg-m-grow { animation: lsg-grow 1.8s ease-in-out infinite; }
.lsg-m-shrink { animation: lsg-shrink 1.8s ease-in-out infinite; }
.lsg-m-nudgeL { animation: lsg-nudgeL 1.6s ease-in-out infinite; }
.lsg-m-nudgeR { animation: lsg-nudgeR 1.6s ease-in-out infinite; }
.lsg-m-nudgeU { animation: lsg-nudgeU 1.6s ease-in-out infinite; }
.lsg-m-nudgeD { animation: lsg-nudgeD 1.6s ease-in-out infinite; }
.lsg-m-search { animation: lsg-search 2s ease-in-out infinite; }

/* Arrow bubbles on the camera */
.lsg-arrows { position: absolute; inset: 0; pointer-events: none; z-index: 3; }
.lsg-anchor { position: absolute; transform: translate(-50%, -50%); }
.lsg-bubble { width: 46px; height: 46px; border-radius: 50%; background: rgba(255,255,255,0.96); color: var(--wise-dark-green, #163300); display: flex; align-items: center; justify-content: center;
  box-shadow: 0 6px 18px rgba(0,0,0,0.25), 0 0 0 4px rgba(159,232,112,0.55); animation: lsg-bubble 1.6s ease-in-out infinite; }
.lsg-bubble-sm { width: 34px; height: 34px; box-shadow: 0 4px 12px rgba(0,0,0,0.25), 0 0 0 3px rgba(159,232,112,0.55); }
.lsg-dir { display: flex; }
.lsg-arrow { width: 24px; height: 24px; animation: lsg-push 1s ease-in-out infinite; }
.lsg-bubble-sm .lsg-arrow { width: 18px; height: 18px; }

/* Instruction card */
.lsg-caption { margin-top: 14px; padding: 14px 16px 16px; border-radius: 18px; background: var(--bg-secondary, #f4f6f3); border: 1px solid var(--border-color, #e5e7eb); --lsg-accent: #94a3b8; transition: border-color 0.3s, background 0.3s; }
.lsg-tone-action { --lsg-accent: #4da3ff; }
.lsg-tone-warn { --lsg-accent: #f5a623; border-color: rgba(245,166,35,0.45); background: rgba(245,166,35,0.07); }
.lsg-tone-ok { --lsg-accent: #30a46c; border-color: rgba(48,164,108,0.4); background: rgba(159,232,112,0.14); }
.lsg-cap-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.lsg-cap-label { display: inline-flex; align-items: center; gap: 8px; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.4px; text-transform: uppercase; color: var(--lsg-accent); }
.lsg-pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--lsg-accent); flex-shrink: 0; animation: lsg-dot 1.6s ease-out infinite; }
.lsg-text { margin: 8px 0 0; font-size: 1.12rem; font-weight: 800; line-height: 1.4; color: var(--text-primary, #0e0f0c); animation: lsg-rise 0.3s ease-out; }
.lsg-controls { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.lsg-speaker { width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; border: none;
  background: var(--wise-green, #9fe870); color: var(--wise-dark-green, #163300); transition: transform 0.15s, background 0.2s; }
.lsg-speaker:not(.lsg-off) { animation: lsg-speak 2.2s ease-out infinite; }
.lsg-speaker:active { transform: scale(0.9); }
.lsg-speaker.lsg-off { background: var(--bg-primary, #fff); color: var(--text-muted, #6b7280); border: 1px solid var(--border-color, #e5e7eb); }
.lsg-lang { display: flex; padding: 3px; border-radius: 999px; background: var(--bg-primary, #fff); border: 1px solid var(--border-color, #e5e7eb); }
.lsg-lang button { border: none; background: transparent; color: var(--text-muted, #6b7280); font-size: 0.74rem; font-weight: 800; padding: 5px 10px; border-radius: 999px; cursor: pointer; line-height: 1.1; transition: background 0.2s, color 0.2s; }
.lsg-lang button.lsg-on { background: var(--wise-dark-green, #163300); color: #fff; }
.lsg-progress { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
.lsg-segs { display: flex; gap: 6px; flex: 1; }
.lsg-seg { height: 6px; flex: 1; border-radius: 999px; background: var(--border-color, #e5e7eb); position: relative; overflow: hidden; transition: background 0.3s; }
.lsg-seg-done { background: #30a46c; }
.lsg-seg-active { background: rgba(77,163,255,0.22); }
.lsg-seg-active::after { content: ""; position: absolute; inset: 0; width: 45%; border-radius: inherit; background: #4da3ff; animation: lsg-load 1.2s ease-in-out infinite; }
.lsg-progress-label { font-size: 0.74rem; font-weight: 700; color: var(--text-muted, #6b7280); white-space: nowrap; }

@keyframes lsg-grow { 0%, 100% { transform: scale(0.86); } 55% { transform: scale(1.06); } }
@keyframes lsg-shrink { 0%, 100% { transform: scale(1.06); } 55% { transform: scale(0.86); } }
@keyframes lsg-nudgeL { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-6px); } }
@keyframes lsg-nudgeR { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(6px); } }
@keyframes lsg-nudgeU { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
@keyframes lsg-nudgeD { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(5px); } }
@keyframes lsg-search { 0%, 100% { opacity: 0.55; transform: scale(0.97); } 50% { opacity: 1; transform: scale(1); } }
@keyframes lsg-bubble { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
@keyframes lsg-push { 0%, 100% { transform: translateX(2px); } 50% { transform: translateX(-3px); } }
@keyframes lsg-pop { 0% { transform: scale(0.75); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
@keyframes lsg-rise { 0% { transform: translateY(5px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
@keyframes lsg-scanmove { 0% { transform: translateY(-100%); } 100% { transform: translateY(460%); } }
@keyframes lsg-wave { 0% { transform: scaleY(0.35); } 100% { transform: scaleY(1); } }
@keyframes lsg-dot { 0% { box-shadow: 0 0 0 0 var(--lsg-accent); } 100% { box-shadow: 0 0 0 7px rgba(0,0,0,0); } }
@keyframes lsg-speak { 0% { box-shadow: 0 0 0 0 rgba(159,232,112,0.7); } 100% { box-shadow: 0 0 0 9px rgba(159,232,112,0); } }
@keyframes lsg-load { 0% { transform: translateX(-100%); } 100% { transform: translateX(230%); } }

@media (prefers-reduced-motion: reduce) {
  .lsg-scan, .lsg-voice span, .lsg-head, .lsg-speaker, .lsg-pulse, .lsg-seg-active::after, .lsg-bubble, .lsg-arrow { animation: none !important; }
}
`;
