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
  headwear: { hi: "कृपया टोपी उतार दीजिए", en: "Please remove your cap or hat" },
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
  headwear: "headwear",
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
      return;
    }
    const speak = () => {
      try {
        synth.cancel();
        const u = new window.SpeechSynthesisUtterance(text);
        u.lang = voiceLang === "hi" ? "hi-IN" : "en-IN";
        if (voiceRef.current) u.voice = voiceRef.current;
        u.rate = 0.95;
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

  return { supported, hindiAvailable, voiceLang, prime };
}

// ─── Guide tone (colour of the head ring / caption) ────────────────────────
const ACTION_CUES = new Set(["turn_left", "turn_right", "straight", "blink", "smile", "get_ready"]);
const WARN_CUES = new Set([
  "no_face", "multiple", "glasses", "headwear", "light", "eyes_open", "closer", "farther",
  "center", "move_left", "move_right", "move_up", "move_down",
]);
export function cueTone(cue) {
  if (!cue) return "info";
  if (cue === "click") return "ok";
  if (ACTION_CUES.has(cue)) return "action";
  if (WARN_CUES.has(cue)) return "warn";
  return "info";
}

// ─── Animated head (shaded portrait) ───────────────────────────────────────
const HEAD_CLASS = {
  turn_left: "lsg-h-turnL",
  turn_right: "lsg-h-turnR",
  straight: "lsg-h-front",
  blink: "lsg-h-blink",
  smile: "lsg-h-smile",
  click: "lsg-h-happy",
  closer: "lsg-h-closer",
  farther: "lsg-h-farther",
  move_left: "lsg-h-moveL",
  move_right: "lsg-h-moveR",
  move_up: "lsg-h-moveU",
  move_down: "lsg-h-moveD",
  center: "lsg-h-search",
  no_face: "lsg-h-search",
  multiple: "lsg-h-multi",
  eyes_open: "lsg-h-eyes",
};

// Almond-shaped eye. side: "l" | "r" (screen side) — the outer corner sits slightly higher.
function Eye({ cx, side }) {
  const o = side === "l" ? -1 : 1; // direction of the outer corner
  const outer = cx + 5.2 * o;
  const inner = cx - 5 * o;
  const almond = `M${inner} 53.4 Q${cx - 0.6 * o} 50 ${outer} 52.6 Q${cx + 0.4 * o} 55.8 ${inner} 53.4 Z`;
  const clipId = `lsgEye${side}`;
  return (
    <g className={`lsg-eye lsg-eye-${side}`}>
      <clipPath id={clipId}><path d={almond} /></clipPath>
      <path d={almond} fill="#f3ede7" />
      <g clipPath={`url(#${clipId})`}>
        <circle cx={cx} cy="53.2" r="2.3" fill="url(#lsgIris)" />
        <circle cx={cx} cy="53.2" r="1" fill="#120a06" />
        <circle cx={cx + 0.75} cy="52.5" r="0.55" fill="#ffffff" opacity="0.95" />
        <path d={`M${inner} 52.2 Q${cx} 50 ${outer} 51.6 L${outer} 50 L${inner} 50 Z`} fill="#000" opacity="0.18" />
      </g>
      {/* Lash line, crease, lower lid */}
      <path d={`M${inner} 53.4 Q${cx - 0.6 * o} 50 ${outer} 52.6`} fill="none" stroke="#24150e" strokeWidth="1.25" strokeLinecap="round" />
      <path d={`M${inner + 0.4 * o} 51.4 Q${cx - 0.4 * o} 48.6 ${outer - 0.2 * o} 50.8`} fill="none" stroke="#a96d4c" strokeWidth="0.75" strokeLinecap="round" opacity="0.7" />
      <path d={`M${inner + 0.8 * o} 54 Q${cx + 0.4 * o} 55.9 ${outer - 0.6 * o} 53.4`} fill="none" stroke="#9c6345" strokeWidth="0.6" strokeLinecap="round" opacity="0.45" />
      {/* Eyelid — closes on a blink */}
      <g className="lsg-lid">
        <path d={`M${inner - 0.6 * o} 53.6 Q${cx - 0.6 * o} 49.2 ${outer + 0.6 * o} 52.4 Q${cx + 0.4 * o} 56.2 ${inner - 0.6 * o} 53.6 Z`} fill="url(#lsgLidSkin)" />
        <path d={`M${inner} 53.9 Q${cx + 0.4 * o} 55.7 ${outer} 53.1`} fill="none" stroke="#24150e" strokeWidth="1.2" strokeLinecap="round" />
      </g>
    </g>
  );
}

function GuideHead({ cue }) {
  return (
    <svg className={`lsg-head ${HEAD_CLASS[cue] || "lsg-h-idle"}`} viewBox="9 9 102 104" aria-hidden="true">
      <defs>
        <radialGradient id="lsgSkin" cx="50%" cy="38%" r="68%">
          <stop offset="0" stopColor="#f4cdae" />
          <stop offset="0.5" stopColor="#e4ab86" />
          <stop offset="1" stopColor="#bf805b" />
        </radialGradient>
        <linearGradient id="lsgLidSkin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d99f7b" />
          <stop offset="1" stopColor="#e6b08d" />
        </linearGradient>
        <linearGradient id="lsgNeck" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a8694a" />
          <stop offset="0.45" stopColor="#d29a76" />
          <stop offset="1" stopColor="#dca581" />
        </linearGradient>
        <linearGradient id="lsgHair" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#3a2a20" />
          <stop offset="0.6" stopColor="#1d140e" />
          <stop offset="1" stopColor="#0f0a07" />
        </linearGradient>
        <linearGradient id="lsgShirt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#40516d" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
        <radialGradient id="lsgIris" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#7c5236" />
          <stop offset="1" stopColor="#2c1a10" />
        </radialGradient>
        <linearGradient id="lsgLip" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9675c" />
          <stop offset="1" stopColor="#cf8274" />
        </linearGradient>
        <linearGradient id="lsgCap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f4fa8" />
          <stop offset="1" stopColor="#1b2f6b" />
        </linearGradient>
        <filter id="lsgSoft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.4" /></filter>
        <filter id="lsgSofter" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.6" /></filter>
        <clipPath id="lsgFaceClip">
          <path d="M60 21 C73.5 21 82.5 31 83.5 45 C84.3 56 83 64 80 71 C76.5 79 69 86.5 60 87.5 C51 86.5 43.5 79 40 71 C37 64 35.7 56 36.5 45 C37.5 31 46.5 21 60 21 Z" />
        </clipPath>
      </defs>

      {cue === "multiple" && (
        <g className="lsg-ghost" opacity="0.45">
          <ellipse cx="100" cy="50" rx="11" ry="13.5" fill="#94a3b8" />
          <path d="M80 98 C82 80 90 73 100 73 C110 73 118 80 120 98 Z" fill="#64748b" />
        </g>
      )}

      <g className="lsg-all">
        {/* Shoulders, shirt, collar */}
        <path d="M6 121 C8 101 26 92.5 47 90.5 Q60 98 73 90.5 C94 92.5 112 101 114 121 Z" fill="url(#lsgShirt)" />
        <path d="M22 106 C28 99 38 95 47 93" fill="none" stroke="#5b6e8c" strokeWidth="1.2" opacity="0.5" filter="url(#lsgSoft)" />
        <path d="M98 106 C92 99 82 95 73 93" fill="none" stroke="#5b6e8c" strokeWidth="1.2" opacity="0.5" filter="url(#lsgSoft)" />
        {/* Neck */}
        <path d="M51 76 L50.4 92.5 Q60 98.5 69.6 92.5 L69 76 Z" fill="url(#lsgNeck)" />
        <path d="M47 90.6 Q50 96.5 56 103 L50.5 106 Q45.2 98.4 44 92.2 Z" fill="#e2e8f0" opacity="0.92" />
        <path d="M73 90.6 Q70 96.5 64 103 L69.5 106 Q74.8 98.4 76 92.2 Z" fill="#e2e8f0" opacity="0.92" />

        <g className="lsg-skull">
          {/* Hair behind the head */}
          <path d="M35 51 C32.5 31 44 16.5 61 16.5 C77.5 16.5 88 29 85.5 51 C84.5 44.5 83 39 80.5 35 L40 35 C37.5 39 35.8 44.5 35 51 Z" fill="url(#lsgHair)" />
          {/* Ears */}
          <g className="lsg-ear lsg-ear-l">
            <path d="M38.2 49.5 C33.6 48.6 32 52.8 32.8 57.4 C33.6 62 36 64.6 39.2 63.8 Z" fill="#d89b76" />
            <path d="M37.4 52.4 C35 52.4 34.6 55.8 35.4 58.6 C36 60.6 37.2 61.4 38.2 61" fill="none" stroke="#a7684a" strokeWidth="1" strokeLinecap="round" opacity="0.8" />
          </g>
          <g className="lsg-ear lsg-ear-r">
            <path d="M81.8 49.5 C86.4 48.6 88 52.8 87.2 57.4 C86.4 62 84 64.6 80.8 63.8 Z" fill="#d89b76" />
            <path d="M82.6 52.4 C85 52.4 85.4 55.8 84.6 58.6 C84 60.6 82.8 61.4 81.8 61" fill="none" stroke="#a7684a" strokeWidth="1" strokeLinecap="round" opacity="0.8" />
          </g>

          {/* Face */}
          <path className="lsg-face" d="M60 21 C73.5 21 82.5 31 83.5 45 C84.3 56 83 64 80 71 C76.5 79 69 86.5 60 87.5 C51 86.5 43.5 79 40 71 C37 64 35.7 56 36.5 45 C37.5 31 46.5 21 60 21 Z" fill="url(#lsgSkin)" />

          {/* Soft shading (painted look) */}
          <g clipPath="url(#lsgFaceClip)">
            <path d="M36 44 C36.5 60 39.5 71 46 80 C42.5 70 41 59 42 45 Z" fill="#9a5f40" opacity="0.38" filter="url(#lsgSofter)" />
            <path d="M84 44 C83.5 60 80.5 71 74 80 C77.5 70 79 59 78 45 Z" fill="#9a5f40" opacity="0.38" filter="url(#lsgSofter)" />
            <ellipse cx="60" cy="35" rx="13" ry="6" fill="#fff4ea" opacity="0.32" filter="url(#lsgSofter)" />
            <ellipse cx="50.5" cy="51.5" rx="7" ry="3.8" fill="#a3684a" opacity="0.28" filter="url(#lsgSoft)" />
            <ellipse cx="69.5" cy="51.5" rx="7" ry="3.8" fill="#a3684a" opacity="0.28" filter="url(#lsgSoft)" />
            <ellipse cx="45.5" cy="66" rx="5.5" ry="3.2" fill="#b0704f" opacity="0.28" filter="url(#lsgSoft)" />
            <ellipse cx="74.5" cy="66" rx="5.5" ry="3.2" fill="#b0704f" opacity="0.28" filter="url(#lsgSoft)" />
            <ellipse cx="60" cy="82" rx="6" ry="2.6" fill="#fff4ea" opacity="0.2" filter="url(#lsgSoft)" />
          </g>

          <g className="lsg-feat">
            <ellipse cx="47" cy="62" rx="5" ry="2.8" fill="#f08f7f" opacity="0.13" filter="url(#lsgSoft)" />
            <ellipse cx="73" cy="62" rx="5" ry="2.8" fill="#f08f7f" opacity="0.13" filter="url(#lsgSoft)" />
            {/* Brows */}
            <path d="M43.6 47.4 C46.6 45 51 44.3 55.6 45.5 L55.4 46.8 C51 46.1 47 46.7 44 48.3 Z" fill="#24170f" />
            <path d="M76.4 47.4 C73.4 45 69 44.3 64.4 45.5 L64.6 46.8 C69 46.1 73 46.7 76 48.3 Z" fill="#24170f" />
            <g className="lsg-eyes">
              <Eye cx={50.5} side="l" />
              <Eye cx={69.5} side="r" />
            </g>
            {/* Nose */}
            <g className="lsg-nose">
              <path d="M58.2 50 Q57.1 57.5 55.8 63.2" fill="none" stroke="#a5664a" strokeWidth="2.2" strokeLinecap="round" opacity="0.4" filter="url(#lsgSoft)" />
              <path d="M61.2 50.5 L61.6 60.5" stroke="#fff1e6" strokeWidth="1.3" strokeLinecap="round" opacity="0.45" filter="url(#lsgSoft)" />
              <ellipse cx="60.6" cy="62.6" rx="2" ry="1.4" fill="#fff1e6" opacity="0.35" filter="url(#lsgSoft)" />
              <path d="M56 63.8 Q55.2 66.4 57.6 66.9 Q60 67.9 62.4 66.9 Q64.8 66.4 64 63.8" fill="none" stroke="#9a5d42" strokeWidth="1.1" strokeLinecap="round" opacity="0.85" />
              <ellipse cx="57.9" cy="66.4" rx="1.05" ry="0.55" fill="#7d4733" opacity="0.6" />
              <ellipse cx="62.1" cy="66.4" rx="1.05" ry="0.55" fill="#7d4733" opacity="0.6" />
              <ellipse cx="60" cy="68.4" rx="4" ry="1.1" fill="#8e553b" opacity="0.3" filter="url(#lsgSoft)" />
            </g>
            {/* Mouth */}
            <g className="lsg-mouth-n">
              <path d="M54 72.4 C55.8 71 57.8 70.6 60 71.4 C62.2 70.6 64.2 71 66 72.4 C63.5 73.2 56.5 73.2 54 72.4 Z" fill="#a4554b" />
              <path d="M54.4 72.6 C56.5 75.9 63.5 75.9 65.6 72.6 C62.5 73.6 57.5 73.6 54.4 72.6 Z" fill="url(#lsgLip)" />
              <path d="M54.2 72.5 C57 73.3 63 73.3 65.8 72.5" fill="none" stroke="#6e2f29" strokeWidth="0.7" strokeLinecap="round" opacity="0.7" />
              <ellipse cx="60" cy="74.1" rx="2.6" ry="0.7" fill="#fff" opacity="0.22" filter="url(#lsgSoft)" />
            </g>
            <g className="lsg-mouth-s">
              <path d="M52.8 71.4 C56 77.4 64 77.4 67.2 71.4 C63.5 72.8 56.5 72.8 52.8 71.4 Z" fill="#6f2a26" />
              <path d="M54.4 72 C57 74.6 63 74.6 65.6 72 C62.6 72.8 57.4 72.8 54.4 72 Z" fill="#f8fafc" />
              <path d="M52.8 71.4 C56 70.2 58 70 60 70.7 C62 70 64 70.2 67.2 71.4" fill="none" stroke="#a4554b" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M49.5 66 Q50.5 70.5 52.6 72" fill="none" stroke="#9a5d42" strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
              <path d="M70.5 66 Q69.5 70.5 67.4 72" fill="none" stroke="#9a5d42" strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
            </g>
            <ellipse cx="60" cy="77.2" rx="4" ry="1.2" fill="#8e553b" opacity="0.28" filter="url(#lsgSoft)" />
            {cue === "glasses" && (
              <g fill="rgba(186,224,255,0.16)" stroke="#0f172a" strokeWidth="1.5">
                <rect x="43.6" y="48.4" width="13.6" height="9.6" rx="3.6" />
                <rect x="62.8" y="48.4" width="13.6" height="9.6" rx="3.6" />
                <path d="M57.2 52.4 Q60 50.8 62.8 52.4 M43.6 51.6 L38.2 50.6 M76.4 51.6 L81.8 50.6" fill="none" />
              </g>
            )}
          </g>

          {/* Hair in front: side part, volume, sideburns */}
          <path className="lsg-hair" d="M36.4 47 C35.2 30.5 45 18.4 60 18 C75.5 17.6 86 28.5 84.2 46 C82.8 38 78.6 31.6 71.8 28.8 C65.6 31.8 56.6 33.2 49 31.6 C44.6 33.8 40.4 38.6 36.4 47 Z" fill="url(#lsgHair)" />
          <path className="lsg-hair" d="M49 31.6 C54 26.5 62 23.2 70 22.6 M52 30.6 C57.5 27 64.5 25.2 72 25.6 M44 36 C47 30 52 25.5 58 22.5" fill="none" stroke="#5c4232" strokeWidth="0.9" strokeLinecap="round" opacity="0.65" />
          <path className="lsg-hair" d="M58 20.6 C64 19.6 71 20.6 76 23.6" fill="none" stroke="#7a5a45" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" filter="url(#lsgSoft)" />
          {cue === "headwear" && (
            <g>
              <path d="M35 44 C35 25 46 14 60 14 C74 14 85 25 85 44 Z" fill="url(#lsgCap)" />
              <path d="M33 44 Q60 51 94 41.5 L95.5 45.5 Q60 56 31.5 48 Z" fill="#14234f" />
              <path d="M60 14.5 L60 44" stroke="#3b5bbf" strokeWidth="0.8" opacity="0.6" />
            </g>
          )}
        </g>
      </g>
    </svg>
  );
}

/** The head on its own, in a glowing ring above the camera. */
export function GuideHeadCoin({ cue }) {
  if (!cue) return null;
  const tone = cueTone(cue);
  const badge = cue === "click" ? "ok" : (cue === "glasses" || cue === "headwear" || cue === "multiple") ? "bad" : cue === "light" ? "sun" : null;
  return (
    <div className={`lsg-coin lsg-coin-${tone}`} aria-hidden="true">
      <div className="lsg-coin-ring" />
      <div className="lsg-coin-face" key={cue}>
        <GuideHead cue={cue} />
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
/* Head in its own soft circle */
.lsg-coin { position: relative; width: 112px; height: 112px; margin: 0 auto; }
.lsg-coin-ring { position: absolute; inset: 0; border-radius: 50%; border: 3px solid var(--lsg-ring, #cbd5e1); transition: border-color 0.3s; }
.lsg-coin-action { --lsg-ring: #4da3ff; }
.lsg-coin-warn { --lsg-ring: #f5a623; }
.lsg-coin-ok { --lsg-ring: var(--wise-green, #9fe870); }
.lsg-coin-action .lsg-coin-ring, .lsg-coin-ok .lsg-coin-ring { animation: lsg-ringpulse 1.8s ease-out infinite; }
.lsg-coin-face { position: absolute; inset: 6px; border-radius: 50%; overflow: hidden;
  background: radial-gradient(circle at 50% 30%, #f3faee 0%, #dcefd2 100%); box-shadow: inset 0 -8px 18px rgba(22,51,0,0.08);
  animation: lsg-pop 0.35s cubic-bezier(.2,1.3,.4,1); }
.lsg-head { width: 100%; height: 100%; display: block; }
.lsg-head .lsg-all, .lsg-head .lsg-skull, .lsg-head .lsg-face, .lsg-head .lsg-lid, .lsg-head .lsg-eye, .lsg-head .lsg-nose, .lsg-head .lsg-ghost { transform-box: fill-box; transform-origin: center; }
.lsg-head .lsg-all { transform-origin: 50% 100%; }
.lsg-head .lsg-skull { transform-origin: 50% 90%; }
.lsg-head .lsg-lid { transform-origin: 50% 0%; transform: scaleY(0); animation: lsg-blink 4.8s ease-in-out infinite; }
.lsg-head .lsg-mouth-s { opacity: 0; }
.lsg-badge { position: absolute; right: 2px; bottom: 4px; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 900; border: 3px solid var(--bg-primary, #fff); animation: lsg-pop 0.45s cubic-bezier(.2,1.6,.4,1); }
.lsg-badge-ok { background: var(--wise-green, #9fe870); color: var(--wise-dark-green, #163300); }
.lsg-badge-bad { background: #ef4444; color: #fff; }
.lsg-badge-sun { background: #fbbf24; color: #3b2a00; }

/* Head animations — the preview is mirrored, so "your left" is the left of the screen */
.lsg-h-turnL .lsg-feat { animation: lsg-turnL 2.6s ease-in-out infinite; }
.lsg-h-turnL .lsg-hair { animation: lsg-hairL 2.6s ease-in-out infinite; }
.lsg-h-turnL .lsg-skull { animation: lsg-tiltL 2.6s ease-in-out infinite; }
.lsg-h-turnL .lsg-ear-l { animation: lsg-earHide 2.6s ease-in-out infinite; }
.lsg-h-turnL .lsg-eye-l { animation: lsg-squish 2.6s ease-in-out infinite; }
.lsg-h-turnL .lsg-nose { animation: lsg-noseL 2.6s ease-in-out infinite; }
.lsg-h-turnR .lsg-feat { animation: lsg-turnR 2.6s ease-in-out infinite; }
.lsg-h-turnR .lsg-hair { animation: lsg-hairR 2.6s ease-in-out infinite; }
.lsg-h-turnR .lsg-skull { animation: lsg-tiltR 2.6s ease-in-out infinite; }
.lsg-h-turnR .lsg-ear-r { animation: lsg-earHide 2.6s ease-in-out infinite; }
.lsg-h-turnR .lsg-eye-r { animation: lsg-squish 2.6s ease-in-out infinite; }
.lsg-h-turnR .lsg-nose { animation: lsg-noseR 2.6s ease-in-out infinite; }
.lsg-h-front .lsg-feat { animation: lsg-settle 1.8s ease-in-out infinite; }
.lsg-h-blink .lsg-lid { animation: lsg-blink 1.5s ease-in-out infinite; }
.lsg-h-eyes .lsg-lid { animation: none; }
.lsg-h-eyes .lsg-eye { animation: lsg-wide 1.4s ease-in-out infinite; }
.lsg-h-smile .lsg-mouth-n { animation: lsg-fadeOut 2.2s ease-in-out infinite; }
.lsg-h-smile .lsg-mouth-s { animation: lsg-fadeIn 2.2s ease-in-out infinite; }
.lsg-h-happy .lsg-mouth-n { opacity: 0; }
.lsg-h-happy .lsg-mouth-s { opacity: 1; }
.lsg-h-closer .lsg-all { animation: lsg-grow 1.8s ease-in-out infinite; }
.lsg-h-farther .lsg-all { animation: lsg-shrink 1.8s ease-in-out infinite; }
.lsg-h-moveL .lsg-all { animation: lsg-nudgeL 1.6s ease-in-out infinite; }
.lsg-h-moveR .lsg-all { animation: lsg-nudgeR 1.6s ease-in-out infinite; }
.lsg-h-moveU .lsg-all { animation: lsg-nudgeU 1.6s ease-in-out infinite; }
.lsg-h-moveD .lsg-all { animation: lsg-nudgeD 1.6s ease-in-out infinite; }
.lsg-h-search .lsg-all { animation: lsg-search 2s ease-in-out infinite; }
.lsg-h-multi .lsg-ghost { animation: lsg-ghost 1.6s ease-in-out infinite; }
.lsg-h-idle .lsg-all { animation: lsg-breathe 3.2s ease-in-out infinite; }

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

@keyframes lsg-turnL { 0%, 12% { transform: translateX(0); } 40%, 70% { transform: translateX(-6.5px); } 94%, 100% { transform: translateX(0); } }
@keyframes lsg-turnR { 0%, 12% { transform: translateX(0); } 40%, 70% { transform: translateX(6.5px); } 94%, 100% { transform: translateX(0); } }
@keyframes lsg-hairL { 0%, 12% { transform: translateX(0); } 40%, 70% { transform: translateX(-3px); } 94%, 100% { transform: translateX(0); } }
@keyframes lsg-hairR { 0%, 12% { transform: translateX(0); } 40%, 70% { transform: translateX(3px); } 94%, 100% { transform: translateX(0); } }
@keyframes lsg-tiltL { 0%, 12% { transform: rotate(0) scaleX(1); } 40%, 70% { transform: rotate(-3deg) scaleX(0.96); } 94%, 100% { transform: rotate(0) scaleX(1); } }
@keyframes lsg-tiltR { 0%, 12% { transform: rotate(0) scaleX(1); } 40%, 70% { transform: rotate(3deg) scaleX(0.96); } 94%, 100% { transform: rotate(0) scaleX(1); } }
@keyframes lsg-squish { 0%, 12% { transform: scaleX(1); } 40%, 70% { transform: scaleX(0.72); } 94%, 100% { transform: scaleX(1); } }
@keyframes lsg-noseL { 0%, 12% { transform: translateX(0); } 40%, 70% { transform: translateX(-2px); } 94%, 100% { transform: translateX(0); } }
@keyframes lsg-noseR { 0%, 12% { transform: translateX(0); } 40%, 70% { transform: translateX(2px); } 94%, 100% { transform: translateX(0); } }
@keyframes lsg-earHide { 0%, 12% { opacity: 1; } 40%, 70% { opacity: 0; } 94%, 100% { opacity: 1; } }
@keyframes lsg-settle { 0% { transform: translateX(-3px); } 28% { transform: translateX(2px); } 55%, 100% { transform: translateX(0); } }
@keyframes lsg-blink { 0%, 42%, 54%, 100% { transform: scaleY(0); } 47%, 49% { transform: scaleY(1); } }
@keyframes lsg-wide { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.18); } }
@keyframes lsg-fadeOut { 0%, 20%, 90%, 100% { opacity: 1; } 35%, 75% { opacity: 0; } }
@keyframes lsg-fadeIn { 0%, 20%, 90%, 100% { opacity: 0; } 35%, 75% { opacity: 1; } }
@keyframes lsg-grow { 0%, 100% { transform: scale(0.86); } 55% { transform: scale(1.06); } }
@keyframes lsg-shrink { 0%, 100% { transform: scale(1.06); } 55% { transform: scale(0.86); } }
@keyframes lsg-nudgeL { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-6px); } }
@keyframes lsg-nudgeR { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(6px); } }
@keyframes lsg-nudgeU { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
@keyframes lsg-nudgeD { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(5px); } }
@keyframes lsg-search { 0%, 100% { opacity: 0.55; transform: scale(0.97); } 50% { opacity: 1; transform: scale(1); } }
@keyframes lsg-ghost { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.8; } }
@keyframes lsg-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.025); } }
@keyframes lsg-bubble { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
@keyframes lsg-push { 0%, 100% { transform: translateX(2px); } 50% { transform: translateX(-3px); } }
@keyframes lsg-pop { 0% { transform: scale(0.75); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
@keyframes lsg-rise { 0% { transform: translateY(5px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
@keyframes lsg-ringpulse { 0% { box-shadow: 0 0 0 0 var(--lsg-ring); } 100% { box-shadow: 0 0 0 10px rgba(0,0,0,0); } }
@keyframes lsg-dot { 0% { box-shadow: 0 0 0 0 var(--lsg-accent); } 100% { box-shadow: 0 0 0 7px rgba(0,0,0,0); } }
@keyframes lsg-speak { 0% { box-shadow: 0 0 0 0 rgba(159,232,112,0.7); } 100% { box-shadow: 0 0 0 9px rgba(159,232,112,0); } }
@keyframes lsg-load { 0% { transform: translateX(-100%); } 100% { transform: translateX(230%); } }

@media (prefers-reduced-motion: reduce) {
  .lsg-coin-ring, .lsg-head *, .lsg-speaker, .lsg-pulse, .lsg-seg-active::after, .lsg-bubble, .lsg-arrow { animation: none !important; }
}
`;
