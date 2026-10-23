// The same pass / fail rules the onboarding portal uses (routes/digioRoutes.js), kept here so
// ReKYC can apply them without touching that file.

const MIN_FACE_MATCH = Number(process.env.SELFIE_MIN_FACE_MATCH || 60);
const MIN_BANK_NAME_MATCH = 90;

function cleanName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/^(mr\.?|mrs\.?|ms\.?|miss|dr\.?|shri|smt\.?|kumari)\s+/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 0–1 similarity of two names (Levenshtein), as in the onboarding penny-drop check. */
function nameSimilarity(a, b) {
  const s1 = cleanName(a);
  const s2 = cleanName(b);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  const matrix = [];
  for (let i = 0; i <= s1.length; i++) matrix[i] = [i];
  for (let j = 0; j <= s2.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  const max = Math.max(s1.length, s2.length);
  return (max - matrix[s1.length][s2.length]) / max;
}

/** Penny drop result → { verified, nameMatched, score, nameAtBank } */
function readPennyDrop(result, clientName) {
  const nameAtBank = result?.beneficiary_name_with_bank || result?.beneficiary_name || "";
  const local = nameSimilarity(clientName, nameAtBank) * 100;
  const digio = parseFloat(result?.name_match_score || result?.name_match_score_percentage || 0) || 0;
  const score = Math.round(Math.max(local, digio));
  return { verified: Boolean(result?.verified), nameMatched: score >= MIN_BANK_NAME_MATCH, score, nameAtBank };
}

/** Passive liveness result → { ok, error, score } */
function readLiveness(result) {
  const rawCount = result?.count ?? result?.face_count ?? result?.faces_count ?? result?.number_of_faces ?? result?.data?.count ?? null;
  const faceCount = rawCount === null || rawCount === "" ? NaN : Number(rawCount);
  if (Number.isFinite(faceCount) && faceCount === 0) return { ok: false, error: "No face detected in the selfie. Please try again." };
  if (Number.isFinite(faceCount) && faceCount > 1) return { ok: false, error: "Multiple faces detected. Please ensure only you are in the frame." };
  const verdict = String(result?.result ?? "").toUpperCase();
  if (verdict === "FAIL" || verdict === "UNKNOWN") {
    return { ok: false, error: "Liveness check failed. Please take a live selfie in good light (no photos or screens)." };
  }
  const num = Number(result?.score);
  return { ok: true, score: Number.isFinite(num) ? Math.round(num * (num <= 1 ? 100 : 1)) : null };
}

/** Face match result → { ok, score } (Digio's "not_matched" always fails) */
function readFaceMatch(result) {
  const verdict = String(result?.match_result ?? result?.result?.match_result ?? "").trim().toLowerCase();
  const matched = verdict === "matched" ? true : verdict === "not_matched" ? false : null;
  const isPercent = result?.confidence !== undefined || matched !== null;
  const raw = result?.confidence ?? result?.score ?? result?.similarity ?? result?.match_score ?? result?.face_match_score ?? result?.match_confidence ?? result?.data?.score ?? result?.result?.score;
  let score = null;
  if (raw !== undefined && raw !== null && raw !== "" && Number.isFinite(Number(raw))) {
    const num = Number(raw);
    score = Math.max(0, Math.min(100, Math.round(!isPercent && num <= 1 ? num * 100 : num)));
  }
  let ok;
  if (matched === false) ok = false;
  else if (score === null) ok = matched === true;
  else ok = score >= MIN_FACE_MATCH;
  return { ok, score, matched };
}

module.exports = { nameSimilarity, readPennyDrop, readLiveness, readFaceMatch, MIN_FACE_MATCH };
