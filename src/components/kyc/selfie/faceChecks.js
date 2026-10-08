/**
 * Per-frame selfie quality checks on top of MediaPipe Face Landmarker output.
 *
 * Landmark x/y are normalised to the raw (un-mirrored) camera frame, where the subject's
 * RIGHT side has the smaller x. Pixel checks run on a small down-scaled copy of the frame.
 *
 * All thresholds live in THRESHOLDS so they can be tuned after real-user testing.
 * clientChecks metrics are sent with each upload and stored in selfieDetails for that purpose.
 */

export const THRESHOLDS = {
  // Lighting (luma 0–255)
  // Measured on SKIN only (cheeks, nose bridge, forehead) so a beard / moustache never
  // makes a well-lit face look dark. Lighting is a tip only — it never blocks the selfie.
  faceTooDark: 50,
  faceTooBright: 215,
  backlightDelta: 80, // frame much brighter than the face skin
  backlightFaceMax: 90,
  unevenCheekRatio: 0.5, // darker cheek / brighter cheek
  minLumaForAppearance: 25, // below this (near pitch black) goggles / cap checks are skipped

  // Position relative to the on-screen oval
  minFaceToOval: 0.55, // face height / oval height
  maxFaceToOval: 1.0,
  centerToleranceX: 0.2, // fraction of oval width
  centerToleranceY: 0.16, // fraction of oval height

  // Pose (straight-ahead for the final photo)
  yawStraightMin: 0.38,
  yawStraightMax: 0.62,
  // Head turned left/right (used to require a straight photo) — a little more generous
  yawTurnedMin: 0.36,
  yawTurnedMax: 0.64,
  pitchStraightMin: 0.36,
  pitchStraightMax: 0.66,
  maxRollDeg: 14,
  eyesClosed: 0.5,
  maxMovement: 0.045, // nose travel between analyses, fraction of face width

  // Face counting: overlapping boxes are the same face; tiny boxes are spurious
  duplicateIoU: 0.3,
  duplicateCover: 0.5, // fraction of the smaller box covered by a kept face
  minExtraFaceWidth: 0.2, // second face must be at least 20% of the main face width

  // Eyewear
  // Goggles / sunglasses. Dark eyes, deep-set eyes or dark circles alone must NOT trigger this:
  // a real lens also covers the skin just BELOW the eye, so that strip must be dark and non-skin too.
  sunglassDarkRatio: 0.6, // eye area vs same-side cheek
  sunglassScleraFrac: 0.03, // visible eye white → not a lens
  sunglassUnderRatio: 0.5, // strip below the eye vs cheek (dark circles are ~0.65–0.85)
  sunglassUnderSkin: 0.5, // fraction of that strip that still looks like skin
  glassesBridgeEdge: 2.5,
  glassesRimEdge: 2.0,
  glassesSpecularFrac: 0.03,

  // Headwear (lower forehead band compared to cheek skin)
  capSkinFrac: 0.4,
  capDarkRatio: 0.5,
  capBrightRatio: 1.7,
  skinChromaDistance: 14,

  // Liveness challenge
  turnLeftYaw: 0.68,
  turnRightYaw: 0.32,
  blinkClosed: 0.55,
  blinkOpen: 0.3,
  // A normal smile passes: either a moderate smile score, or a clear rise from the user's own
  // neutral face during this step (people smile differently; no teeth needed)
  smile: 0.3,
  smileRise: 0.15,
  smileMin: 0.15,
};

// MediaPipe 478-point mesh indices
const LM = {
  forehead: 10,
  chin: 152,
  noseTip: 1,
  faceRightEdge: 234,
  faceLeftEdge: 454,
  rightEyeOuter: 33,
  rightEyeInner: 133,
  leftEyeInner: 362,
  leftEyeOuter: 263,
  rightCheek: 50,
  leftCheek: 280,
  rightBrowMid: 105,
  leftBrowMid: 334,
  noseBridgeTop: 168,
  noseBridgeMid: 6,
  foreheadCenter: 151,
};
const RIGHT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const LEFT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
const BROWS = [70, 63, 105, 66, 107, 46, 53, 52, 65, 55, 300, 293, 334, 296, 336, 276, 283, 282, 295, 285];

// ─── Oval geometry (shared by the overlay and the position check) ───────────
/** Oval in normalised frame coordinates for a frame of frameW × frameH pixels. */
// The preview is a compact portrait window (3:4, like the Digio popup). The camera frame is
// centre-cropped to it (object-fit: cover) and the saved photo is cropped the same way.
export const VIEW_ASPECT = 3 / 4;

/**
 * Oval for a camera frame of frameW x frameH px shown through the 3:4 preview window.
 *   cx, cy, w, h → oval in normalised FRAME coordinates (used by the checks)
 *   view         → visible part of the frame, normalised (faces outside it are ignored)
 *   overlay      → oval in percent of the PREVIEW window (used by the SVG overlay)
 */
export function getOvalGeometry(frameW, frameH, viewAspect = VIEW_ASPECT) {
  const aspect = 0.78; // oval width / height
  const visW = Math.min(frameW, frameH * viewAspect);
  const visH = Math.min(frameH, frameW / viewAspect);
  let ovalHpx = visH * 0.72;
  let ovalWpx = ovalHpx * aspect;
  if (ovalWpx > visW * 0.86) {
    ovalWpx = visW * 0.86;
    ovalHpx = ovalWpx / aspect;
  }
  const cyView = 0.47;
  const offX = (frameW - visW) / 2;
  const offY = (frameH - visH) / 2;
  return {
    cx: 0.5,
    cy: (offY + visH * cyView) / frameH,
    w: ovalWpx / frameW,
    h: ovalHpx / frameH,
    view: { x0: offX / frameW, x1: (offX + visW) / frameW, y0: offY / frameH, y1: (offY + visH) / frameH },
    overlay: { cx: 50, cy: cyView * 100, rx: (ovalWpx / visW) * 50, ry: (ovalHpx / visH) * 50 },
    crop: { sx: offX, sy: offY, sw: visW, sh: visH },
  };
}

// ─── Pixel helpers ──────────────────────────────────────────────────────────
function clampBox(img, box) {
  const x0 = Math.max(0, Math.floor(Math.min(box.x0, box.x1) * img.width));
  const x1 = Math.min(img.width - 1, Math.ceil(Math.max(box.x0, box.x1) * img.width));
  const y0 = Math.max(0, Math.floor(Math.min(box.y0, box.y1) * img.height));
  const y1 = Math.min(img.height - 1, Math.ceil(Math.max(box.y0, box.y1) * img.height));
  return { x0, x1, y0, y1 };
}

function lumaAt(d, i) {
  return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
}

/** Mean/std luma and mean chroma of a normalised box. */
function regionStats(img, box, opts = {}) {
  const { x0, x1, y0, y1 } = clampBox(img, box);
  const d = img.data;
  const w = img.width;
  let n = 0, sumY = 0, sumY2 = 0, sumCb = 0, sumCr = 0, bright = 0, above = 0;
  const brightLevel = opts.brightLevel ?? 245;
  const aboveLevel = opts.aboveLevel ?? Infinity;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * w + x) * 4;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const Y = 0.299 * r + 0.587 * g + 0.114 * b;
      sumY += Y;
      sumY2 += Y * Y;
      sumCb += 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      sumCr += 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      if (Y >= brightLevel) bright++;
      if (Y > aboveLevel) above++;
      n++;
    }
  }
  if (!n) return null;
  const mean = sumY / n;
  return {
    n,
    mean,
    std: Math.sqrt(Math.max(0, sumY2 / n - mean * mean)),
    cb: sumCb / n,
    cr: sumCr / n,
    brightFrac: bright / n,
    aboveFrac: above / n,
  };
}

/** Fraction of pixels whose chroma is close to the reference skin chroma. */
function skinFraction(img, box, ref) {
  const { x0, x1, y0, y1 } = clampBox(img, box);
  const d = img.data;
  const w = img.width;
  const maxDist2 = THRESHOLDS.skinChromaDistance ** 2;
  let n = 0, skin = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * w + x) * 4;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const Y = 0.299 * r + 0.587 * g + 0.114 * b;
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      const dist2 = (cb - ref.cb) ** 2 + (cr - ref.cr) ** 2;
      if (dist2 <= maxDist2 && Y > ref.mean * 0.35) skin++;
      n++;
    }
  }
  return n ? skin / n : 0;
}

/** Mean absolute vertical luma gradient (strength of horizontal edges, e.g. glasses rims). */
function horizontalEdgeEnergy(img, box) {
  const { x0, x1, y0, y1 } = clampBox(img, box);
  const d = img.data;
  const w = img.width;
  let n = 0, sum = 0;
  for (let y = Math.max(1, y0); y <= Math.min(img.height - 2, y1); y++) {
    for (let x = x0; x <= x1; x++) {
      const up = lumaAt(d, ((y - 1) * w + x) * 4);
      const down = lumaAt(d, ((y + 1) * w + x) * 4);
      sum += Math.abs(down - up);
      n++;
    }
  }
  return n ? sum / n : 0;
}

/** Frame-wide mean luma (sparse sample). */
function frameMeanLuma(img) {
  const d = img.data;
  let n = 0, sum = 0;
  for (let i = 0; i < d.length; i += 4 * 7) {
    sum += lumaAt(d, i);
    n++;
  }
  return n ? sum / n : 0;
}

// ─── Landmark helpers ───────────────────────────────────────────────────────
function bboxOf(lms, indices) {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  const list = indices || lms.map((_, i) => i);
  for (const idx of list) {
    const p = lms[idx];
    if (!p) continue;
    if (p.x < x0) x0 = p.x;
    if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

function overlapStats(a, b) {
  const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const inter = ix * iy;
  const areaA = a.w * a.h;
  const areaB = b.w * b.h;
  return {
    iou: inter / Math.max(1e-9, areaA + areaB - inter),
    coverSmaller: inter / Math.max(1e-9, Math.min(areaA, areaB)),
  };
}

/** Indices of distinct, real faces — largest first. Duplicate / tiny detections are dropped. */
function distinctFaces(faces, view) {
  const items = faces
    .map((lms, i) => ({ i, box: bboxOf(lms) }))
    // Only faces inside the visible preview window count (the photo is cropped to it)
    .filter((it) => !view || (it.box.cx >= view.x0 && it.box.cx <= view.x1 && it.box.cy >= view.y0 && it.box.cy <= view.y1))
    .sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h);
  if (!items.length) return [];
  const mainWidth = items[0].box.w;
  const kept = [];
  for (const item of items) {
    if (kept.length && item.box.w < mainWidth * THRESHOLDS.minExtraFaceWidth) continue;
    const duplicate = kept.some((k) => {
      const o = overlapStats(k.box, item.box);
      return o.iou > THRESHOLDS.duplicateIoU || o.coverSmaller > THRESHOLDS.duplicateCover;
    });
    if (!duplicate) kept.push(item);
  }
  return kept.map((k) => k.i);
}

function blendshapeMap(result, faceIndex = 0) {
  const map = {};
  const cats = result?.faceBlendshapes?.[faceIndex]?.categories || [];
  for (const c of cats) map[c.categoryName] = c.score;
  return map;
}

function squareBox(center, half, aspect) {
  // half is in normalised x units; aspect = frameW / frameH keeps the box square in pixels
  return { x0: center.x - half, x1: center.x + half, y0: center.y - half * aspect, y1: center.y + half * aspect };
}

// ─── Main analysis ──────────────────────────────────────────────────────────
/**
 * @param result   FaceLandmarker result for this frame
 * @param img      ImageData of the down-scaled frame (same aspect as the camera frame)
 * @param frameW   camera frame width in px
 * @param frameH   camera frame height in px
 * @param prevNose previous nose position {x,y} (for the "hold still" check) or null
 * @returns { faceCount, flags, metrics, pose, blend, nose }
 */
export function analyzeFrame(result, img, frameW, frameH, prevNose) {
  const faces = result?.faceLandmarks || [];
  // MediaPipe can report the same face twice (overlapping boxes) — count distinct faces only
  const oval = getOvalGeometry(frameW, frameH);
  const kept = distinctFaces(faces, oval.view);
  const faceCount = kept.length;
  const flags = {};
  const metrics = { faceCount, rawFaceCount: faces.length };

  if (faceCount === 0) {
    flags.noFace = true;
    return { faceCount, flags, metrics, pose: null, blend: {}, nose: null, box: null };
  }
  if (faceCount > 1) flags.multipleFaces = true;

  // The largest face is used for all other checks
  const mainIndex = kept[0];
  const lms = faces[mainIndex];
  const blend = blendshapeMap(result, mainIndex);
  const face = bboxOf(lms);
  const box = { cx: face.cx, cy: face.cy, w: face.w, h: face.h };
  const aspect = frameW / frameH;

  // ── Pose ──
  const nose = lms[LM.noseTip];
  const rightEdge = lms[LM.faceRightEdge];
  const leftEdge = lms[LM.faceLeftEdge];
  const top = lms[LM.forehead];
  const chin = lms[LM.chin];
  const yaw = (nose.x - rightEdge.x) / Math.max(1e-6, leftEdge.x - rightEdge.x);
  const pitch = (nose.y - top.y) / Math.max(1e-6, chin.y - top.y);
  const eyeR = lms[LM.rightEyeOuter];
  const eyeL = lms[LM.leftEyeOuter];
  const roll = (Math.atan2((eyeL.y - eyeR.y) / aspect, eyeL.x - eyeR.x) * 180) / Math.PI;
  const pose = { yaw, pitch, roll };
  metrics.yaw = round(yaw);
  metrics.pitch = round(pitch);
  metrics.roll = round(roll);

  if (yaw < THRESHOLDS.yawTurnedMin || yaw > THRESHOLDS.yawTurnedMax) flags.turned = true;
  if (
    yaw < THRESHOLDS.yawStraightMin || yaw > THRESHOLDS.yawStraightMax ||
    pitch < THRESHOLDS.pitchStraightMin || pitch > THRESHOLDS.pitchStraightMax ||
    Math.abs(roll) > THRESHOLDS.maxRollDeg
  ) {
    flags.notStraight = true;
  }

  const blinkL = blend.eyeBlinkLeft ?? 0;
  const blinkR = blend.eyeBlinkRight ?? 0;
  if (blinkL > THRESHOLDS.eyesClosed && blinkR > THRESHOLDS.eyesClosed) flags.eyesClosed = true;

  if (prevNose) {
    const move = Math.hypot(nose.x - prevNose.x, (nose.y - prevNose.y) / aspect) / Math.max(1e-6, face.w);
    metrics.movement = round(move);
    if (move > THRESHOLDS.maxMovement) flags.moving = true;
  }

  // ── Position vs oval ──
  const faceToOval = face.h / oval.h;
  metrics.faceToOval = round(faceToOval);
  if (faceToOval < THRESHOLDS.minFaceToOval) flags.tooFar = true;
  else if (faceToOval > THRESHOLDS.maxFaceToOval) flags.tooClose = true;
  if (
    Math.abs(face.cx - oval.cx) > oval.w * THRESHOLDS.centerToleranceX ||
    Math.abs(face.cy - oval.cy) > oval.h * THRESHOLDS.centerToleranceY
  ) {
    flags.notCentered = true;
  }

  // Pixel checks need the image
  if (!img) return { faceCount, flags, metrics, pose, blend, nose: { x: nose.x, y: nose.y }, box };

  // ── Lighting ──
  const inner = {
    x0: face.x0 + face.w * 0.2, x1: face.x1 - face.w * 0.2,
    y0: face.y0 + face.h * 0.2, y1: face.y1 - face.h * 0.15,
  };
  const faceStats = regionStats(img, inner, { brightLevel: 250 });
  const frameLuma = frameMeanLuma(img);
  const cheekHalf = face.w * 0.07;
  const rCheek = regionStats(img, squareBox(lms[LM.rightCheek], cheekHalf, aspect));
  const lCheek = regionStats(img, squareBox(lms[LM.leftCheek], cheekHalf, aspect));
  const noseSkin = regionStats(img, squareBox(lms[LM.noseBridgeMid], face.w * 0.04, aspect));
  const foreheadSkin = regionStats(img, squareBox(lms[LM.foreheadCenter], face.w * 0.06, aspect));

  // Skin brightness = median of the skin patches (beard, moustache and hair are excluded;
  // the median also ignores one patch covered by hair or a shadow)
  const skinMeans = [rCheek, lCheek, noseSkin, foreheadSkin].filter(Boolean).map((r) => r.mean).sort((a, b) => a - b);
  const skinLuma = skinMeans.length
    ? (skinMeans.length % 2 ? skinMeans[(skinMeans.length - 1) / 2] : (skinMeans[skinMeans.length / 2 - 1] + skinMeans[skinMeans.length / 2]) / 2)
    : null;

  if (skinLuma !== null) {
    metrics.faceLuma = Math.round(faceStats ? faceStats.mean : skinLuma);
    metrics.skinLuma = Math.round(skinLuma);
    metrics.frameLuma = Math.round(frameLuma);
    if (skinLuma < THRESHOLDS.faceTooDark) flags.tooDark = true;
    else if (frameLuma - skinLuma > THRESHOLDS.backlightDelta && skinLuma < THRESHOLDS.backlightFaceMax) flags.backlit = true;
    else if (skinLuma > THRESHOLDS.faceTooBright || (faceStats && faceStats.brightFrac > 0.25)) flags.tooBright = true;
  }
  if (rCheek && lCheek) {
    const ratio = Math.min(rCheek.mean, lCheek.mean) / Math.max(1, Math.max(rCheek.mean, lCheek.mean));
    metrics.cheekRatio = round(ratio);
    if (ratio < THRESHOLDS.unevenCheekRatio) flags.uneven = true;
  }

  // Darkness does not block the selfie, so the goggles / cap checks still run in dim light.
  // They are skipped only when the face is close to pitch black (pixel ratios become pure noise).
  const exposureOk = rCheek && lCheek && (rCheek.mean + lCheek.mean) / 2 >= THRESHOLDS.minLumaForAppearance;
  if (!exposureOk) return { faceCount, flags, metrics, pose, blend, nose: { x: nose.x, y: nose.y }, box };

  const skinRef = {
    mean: (rCheek.mean + lCheek.mean) / 2,
    cb: (rCheek.cb + lCheek.cb) / 2,
    cr: (rCheek.cr + lCheek.cr) / 2,
  };
  const cheekEdge = Math.max(
    3,
    (horizontalEdgeEnergy(img, squareBox(lms[LM.rightCheek], cheekHalf, aspect)) +
      horizontalEdgeEnergy(img, squareBox(lms[LM.leftCheek], cheekHalf, aspect))) / 2,
  );

  // ── Sunglasses / goggles: eye area much darker than the same-side cheek, no visible eye whites ──
  const eyeCheck = (eyeIdx, cheek) => {
    const b = bboxOf(lms, eyeIdx);
    // y offsets are scaled by aspect so they are proportional to the eye width in pixels
    // Eye area: the eye opening itself (kept tight so dark circles below do not count)
    const box = { x0: b.x0 - b.w * 0.1, x1: b.x1 + b.w * 0.1, y0: b.y0 - b.w * 0.1 * aspect, y1: b.y1 + b.w * 0.1 * aspect };
    // Strip just below the eye: skin for natural eyes, lens for sunglasses / goggles
    const under = { x0: b.x0, x1: b.x1, y0: b.y1 + b.w * 0.15 * aspect, y1: b.y1 + b.w * 0.5 * aspect };
    const s = regionStats(img, box, { aboveLevel: cheek.mean * 1.05 });
    const u = regionStats(img, under);
    if (!s || !u) return { dark: false, ratio: 1, sclera: 1, specular: 0, underRatio: 1, underSkin: 1, eyeBox: b };
    const ratio = s.mean / Math.max(1, cheek.mean);
    const underRatio = u.mean / Math.max(1, cheek.mean);
    const underSkin = skinFraction(img, under, skinRef);
    const dark =
      ratio < THRESHOLDS.sunglassDarkRatio &&
      s.aboveFrac < THRESHOLDS.sunglassScleraFrac &&
      underRatio < THRESHOLDS.sunglassUnderRatio &&
      underSkin < THRESHOLDS.sunglassUnderSkin;
    return { dark, ratio, sclera: s.aboveFrac, specular: s.brightFrac, underRatio, underSkin, eyeBox: b };
  };
  const rEye = eyeCheck(RIGHT_EYE, rCheek);
  const lEye = eyeCheck(LEFT_EYE, lCheek);
  metrics.eyeDarkR = round(rEye.ratio);
  metrics.underEyeR = round(rEye.underRatio);
  metrics.underSkinR = round(rEye.underSkin);
  metrics.eyeDarkL = round(lEye.ratio);
  if (rEye.dark && lEye.dark) flags.sunglasses = true;

  // ── Clear glasses: strong horizontal edges on the nose bridge and under the eyes (frame rims),
  //    and/or lens reflections. Needs two of the three signals. ──
  if (!flags.sunglasses) {
    const innerR = lms[LM.rightEyeInner];
    const innerL = lms[LM.leftEyeInner];
    const gap = Math.max(1e-6, innerL.x - innerR.x);
    const eyeTop = Math.min(rEye.eyeBox.y0, lEye.eyeBox.y0);
    const eyeMidY = (rEye.eyeBox.cy + lEye.eyeBox.cy) / 2;
    const bridgeBox = {
      x0: innerR.x + gap * 0.25, x1: innerL.x - gap * 0.25,
      y0: eyeTop - (eyeMidY - eyeTop) * 0.8, y1: eyeMidY,
    };
    const rimBox = (b) => ({ x0: b.x0, x1: b.x1, y0: b.y1 + b.w * 0.12 * aspect, y1: b.y1 + b.w * 0.42 * aspect });
    const bridgeEdge = horizontalEdgeEnergy(img, bridgeBox) / cheekEdge;
    const rimEdge = Math.max(
      horizontalEdgeEnergy(img, rimBox(rEye.eyeBox)),
      horizontalEdgeEnergy(img, rimBox(lEye.eyeBox)),
    ) / cheekEdge;
    const specular = Math.max(rEye.specular, lEye.specular);
    metrics.bridgeEdge = round(bridgeEdge);
    metrics.rimEdge = round(rimEdge);
    metrics.specular = round(specular);
    const signals =
      (bridgeEdge > THRESHOLDS.glassesBridgeEdge ? 1 : 0) +
      (rimEdge > THRESHOLDS.glassesRimEdge ? 1 : 0) +
      (specular > THRESHOLDS.glassesSpecularFrac ? 1 : 0);
    if (signals >= 2) flags.glasses = true;
  }

  // ── Cap / hat: the lower forehead band should look like the cheek skin ──
  const browTop = bboxOf(lms, BROWS).y0;
  const foreheadH = browTop - top.y;
  if (foreheadH > face.h * 0.04) {
    const band = {
      x0: lms[LM.rightBrowMid].x, x1: lms[LM.leftBrowMid].x,
      y0: browTop - foreheadH * 0.6, y1: browTop - foreheadH * 0.08,
    };
    const bandStats = regionStats(img, band);
    if (bandStats) {
      const skinFrac = skinFraction(img, band, skinRef);
      const lumRatio = bandStats.mean / Math.max(1, skinRef.mean);
      metrics.foreheadSkin = round(skinFrac);
      metrics.foreheadLum = round(lumRatio);
      if (
        skinFrac < THRESHOLDS.capSkinFrac ||
        lumRatio < THRESHOLDS.capDarkRatio ||
        lumRatio > THRESHOLDS.capBrightRatio
      ) {
        flags.headwear = true;
      }
    }
  }

  return { faceCount, flags, metrics, pose, blend, nose: { x: nose.x, y: nose.y }, box };
}

function round(v) {
  return Math.round(v * 1000) / 1000;
}

// ─── Temporal smoothing ─────────────────────────────────────────────────────
/**
 * Appearance checks (eyewear, headwear, uneven light) are voted over recent frames so a single
 * noisy frame cannot flip them. Geometric checks use the current frame only.
 */
const VOTED = { multipleFaces: 3, sunglasses: 5, glasses: 6, headwear: 5, uneven: 5 };
const WINDOW = 8;

export function createFlagSmoother() {
  let history = [];
  return {
    push(flags) {
      history.push(flags);
      if (history.length > WINDOW) history.shift();
      const out = { ...flags };
      for (const key of Object.keys(VOTED)) {
        const count = history.reduce((acc, f) => acc + (f[key] ? 1 : 0), 0);
        if (count >= VOTED[key]) out[key] = true;
        else delete out[key];
      }
      return out;
    },
    reset() {
      history = [];
    },
  };
}

// ─── Messages & checklist ───────────────────────────────────────────────────
/** Highest priority first — the first present flag is the message shown to the user. */
export const ISSUE_PRIORITY = [
  "noFace",
  "multipleFaces",
  "tooDark",
  "backlit",
  "tooBright",
  "uneven",
  "tooFar",
  "tooClose",
  "notCentered",
  "sunglasses",
  "glasses",
  "headwear",
  "turned",
  "notStraight",
  "eyesClosed",
  "moving",
  "needBlink",
];

export const ISSUE_MESSAGES = {
  noFace: "No face detected — look at the camera",
  multipleFaces: "Multiple faces detected — only you should be in the frame",
  tooDark: "Your face is too dark — move to a well-lit place",
  backlit: "Strong light behind you — face towards the light",
  tooBright: "Too much light on your face — avoid direct light",
  uneven: "Uneven light on your face — face the light directly",
  tooFar: "Move closer to the camera",
  tooClose: "Move a little further away",
  notCentered: "Place your face inside the oval",
  sunglasses: "Goggles detected — please remove them",
  glasses: "Please remove your glasses",
  headwear: "Cap / hat detected — please remove it",
  turned: "Look straight at the camera — not left or right",
  notStraight: "Look straight at the camera",
  eyesClosed: "Keep your eyes open",
  moving: "Hold still",
  needBlink: "Blink once to enable the button",
};

// The checks that block the selfie (position / pose are shown only as tips on the camera)
// Short "what we detected" labels for the alert row and the checklist
export const DETECTED_LABELS = {
  noFace: "No face detected",
  multipleFaces: "Multiple faces detected",
  sunglasses: "Goggles detected",
  headwear: "Cap / hat detected",
  turned: "Head turned — look straight",
};

export const CHECKLIST = [
  { key: "single", label: "Only you in frame", issues: ["noFace", "multipleFaces"] },
  { key: "eyewear", label: "No goggles", issues: ["sunglasses"] },
  { key: "headwear", label: "No cap / hat", issues: ["headwear"] },
  { key: "straight", label: "Looking straight", issues: ["turned"] },
];

export function orderedIssues(flags) {
  return ISSUE_PRIORITY.filter((k) => flags[k]);
}

// ─── Liveness challenge ─────────────────────────────────────────────────────
export const LOOK_STRAIGHT_TEXT = "Now look straight at the camera";

/** True when the head is facing the camera again after a turn (yaw back in the straight range). */
export function isFacingStraight(analysis) {
  const yaw = analysis?.pose?.yaw;
  return typeof yaw === "number" && yaw >= THRESHOLDS.yawStraightMin && yaw <= THRESHOLDS.yawStraightMax;
}

export const CHALLENGE_TEXT = {
  turn_left: "Slowly turn your head to your LEFT",
  turn_right: "Slowly turn your head to your RIGHT",
  blink: "Blink your eyes",
  smile: "Smile",
};

/**
 * Advances one challenge step. `state` is a mutable object kept by the caller per step.
 * Returns true when the step is complete.
 */
export function updateChallengeStep(step, analysis, state) {
  const { pose, blend } = analysis;
  if (!pose) {
    state.consec = 0;
    return false;
  }
  if (step === "turn_left" || step === "turn_right") {
    const hit = step === "turn_left" ? pose.yaw > THRESHOLDS.turnLeftYaw : pose.yaw < THRESHOLDS.turnRightYaw;
    state.consec = hit ? (state.consec || 0) + 1 : 0;
    return state.consec >= 2;
  }
  if (step === "blink") {
    const l = blend.eyeBlinkLeft ?? 0;
    const r = blend.eyeBlinkRight ?? 0;
    if (l > THRESHOLDS.blinkClosed && r > THRESHOLDS.blinkClosed) state.sawClosed = true;
    return Boolean(state.sawClosed && l < THRESHOLDS.blinkOpen && r < THRESHOLDS.blinkOpen);
  }
  if (step === "smile") {
    const s = ((blend.mouthSmileLeft ?? 0) + (blend.mouthSmileRight ?? 0)) / 2;
    state.minSmile = Math.min(state.minSmile ?? s, s);
    const hit = s >= THRESHOLDS.smile || (s >= THRESHOLDS.smileMin && s - state.minSmile >= THRESHOLDS.smileRise);
    state.consec = hit ? (state.consec || 0) + 1 : 0;
    return state.consec >= 2;
  }
  return false;
}
