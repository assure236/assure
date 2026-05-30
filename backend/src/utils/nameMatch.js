// Fuzzy name comparison utility for KYC.
// Tolerates initials, middle-name omission, ordering, casing, punctuation.
// Returns a normalized similarity score in [0, 1] and a verdict.

function normalizeName(input) {
  if (!input) return '';
  return String(input)
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokensOf(name) {
  const n = normalizeName(name);
  if (!n) return [];
  return n.split(' ').filter(Boolean);
}

// Expand "P DHANUSH" → tokens [P, DHANUSH]; "DHANUSH P" → [DHANUSH, P]
// Initials (length 1) are flagged.
function classifyTokens(tokens) {
  const initials = tokens.filter((t) => t.length === 1);
  const words = tokens.filter((t) => t.length > 1);
  return { initials, words };
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }
  return prev[b.length];
}

function wordSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return 1 - dist / maxLen;
}

// Token-set ratio: how many words from the shorter set fuzzy-match a word in the longer.
function tokenSetScore(aWords, bWords) {
  if (!aWords.length || !bWords.length) return 0;
  const [small, large] = aWords.length <= bWords.length ? [aWords, bWords] : [bWords, aWords];
  let matched = 0;
  const usedLargeIdx = new Set();
  for (const w of small) {
    let bestIdx = -1;
    let bestScore = 0;
    for (let i = 0; i < large.length; i += 1) {
      if (usedLargeIdx.has(i)) continue;
      const s = wordSimilarity(w, large[i]);
      if (s > bestScore) {
        bestScore = s;
        bestIdx = i;
      }
    }
    if (bestScore >= 0.7) {
      matched += bestScore;
      if (bestIdx >= 0) usedLargeIdx.add(bestIdx);
    }
  }
  return matched / small.length;
}

// Initial-token compatibility: "P DHANUSH" vs "PADARTI DHANUSH" → P aligns with PADARTI[0]
function initialsCompatible(aTokens, bTokens) {
  const a = classifyTokens(aTokens);
  const b = classifyTokens(bTokens);
  if (!a.initials.length && !b.initials.length) return null; // no initials to compare
  const initialsFrom = a.initials.length ? a.initials : b.initials;
  const wordsFrom = a.initials.length ? b.words : a.words;
  if (!wordsFrom.length) return false;
  for (const init of initialsFrom) {
    const ok = wordsFrom.some((w) => w.startsWith(init));
    if (!ok) return false;
  }
  return true;
}

/**
 * Compare two names with KYC-friendly tolerance.
 * @returns {{ score:number, match:boolean, reason:string }}
 *  match=true when score >= 0.75 OR (score >= 0.6 with initials-compatible OR shared-first-word).
 */
function compareNames(a, b) {
  const aTokens = tokensOf(a);
  const bTokens = tokensOf(b);

  if (!aTokens.length || !bTokens.length) {
    return { score: 0, match: false, reason: 'One of the names is empty.' };
  }

  if (normalizeName(a) === normalizeName(b)) {
    return { score: 1, match: true, reason: 'Exact match.' };
  }

  const aWords = aTokens.filter((t) => t.length > 1);
  const bWords = bTokens.filter((t) => t.length > 1);

  const setScore = tokenSetScore(aWords, bWords);
  const initOk = initialsCompatible(aTokens, bTokens);

  // Bonus: if at least one full word matches strongly, raise the floor.
  let bestWordPair = 0;
  for (const w1 of aWords) {
    for (const w2 of bWords) {
      const s = wordSimilarity(w1, w2);
      if (s > bestWordPair) bestWordPair = s;
    }
  }

  let score = setScore;
  if (initOk === true) score = Math.max(score, 0.78);
  if (bestWordPair >= 0.85) score = Math.max(score, 0.7 + 0.3 * setScore);

  score = Math.max(0, Math.min(1, score));

  let match = false;
  let reason = '';
  if (score >= 0.75) {
    match = true;
    reason = 'Strong name similarity.';
  } else if (score >= 0.6 && (initOk === true || bestWordPair >= 0.85)) {
    match = true;
    reason = 'Acceptable name similarity (initials/partial match).';
  } else {
    reason = 'Names differ too much to accept automatically.';
  }

  return { score: Number(score.toFixed(3)), match, reason };
}

module.exports = {
  normalizeName,
  tokensOf,
  compareNames,
};
