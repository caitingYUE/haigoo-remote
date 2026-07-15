const TRUE_MATCH_HIDDEN_THRESHOLD = 55
const TRUE_MATCH_HIGH_THRESHOLD = 85
const MINIMUM_EVIDENCE_COVERAGE = 0.55

const DISPLAY_SCORE_HIDDEN_MIN = 0
const DISPLAY_SCORE_VISIBLE_MIN = 75
const DISPLAY_SCORE_COMMON_MAX = 89
const DISPLAY_SCORE_HIGH_MIN = 90
const DISPLAY_SCORE_HIGH_MAX = 100

export const MATCH_ALGORITHM_VERSION = 'evidence-score-v3'
export const MATCH_CALIBRATION_VERSION = 'display-score-v2-confidence-aware'

export const DISPLAY_BAND_HIDDEN = 'hidden'
export const DISPLAY_BAND_COMMON = 'common'
export const DISPLAY_BAND_HIGH = 'high'

const HIDDEN_ANCHORS = [
  [0, 0],
  [100, 0]
]

const COMMON_ANCHORS = [
  [55, 75],
  [65, 79],
  [69, 80],
  [70, 81],
  [78, 86],
  [84.999, 89]
]

const HIGH_ANCHORS = [
  [85, 90],
  [90, 93],
  [94, 96],
  [98, 98],
  [100, 99]
]

function clampScore(value, min = 0, max = 100) {
  const n = Number(value)
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, Math.round(n)))
}

function safeParseJson(value, fallback = {}) {
  if (value == null) return fallback
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch (_) {
    return fallback
  }
}

function normalizeConstraintFlags(constraintFlags = {}) {
  const raw = safeParseJson(constraintFlags, {}) || {}
  return {
    remoteOnlyMismatch: raw.remoteOnlyMismatch === true,
    strictLocationMismatch: raw.strictLocationMismatch === true,
    remoteRegionMismatch: raw.remoteRegionMismatch === true,
    timezoneMismatch: raw.timezoneMismatch === true,
    severeRoleMismatch: raw.severeRoleMismatch === true,
    severeSkillMismatch: raw.severeSkillMismatch === true,
    strongRoleAlignment: raw.strongRoleAlignment === true
  }
}

function hasBlockingConstraint(flags = {}) {
  return Boolean(
    flags.remoteOnlyMismatch ||
    flags.strictLocationMismatch ||
    flags.remoteRegionMismatch ||
    flags.timezoneMismatch ||
    flags.severeRoleMismatch ||
    flags.severeSkillMismatch
  )
}

function interpolateAnchors(score, anchors) {
  if (!Array.isArray(anchors) || anchors.length === 0) return clampScore(score)

  const n = Number(score) || 0
  if (n <= anchors[0][0]) return clampScore(anchors[0][1])

  for (let i = 1; i < anchors.length; i += 1) {
    const [x1, y1] = anchors[i]
    const [x0, y0] = anchors[i - 1]
    if (n <= x1) {
      const ratio = (n - x0) / Math.max(0.0001, x1 - x0)
      return clampScore(y0 + ((y1 - y0) * ratio))
    }
  }

  return clampScore(anchors[anchors.length - 1][1])
}

export function resolveDisplayBand(trueScore = 0, constraintFlags = {}, evidenceCoverage = 1) {
  const normalizedTrueScore = clampScore(trueScore)
  const flags = normalizeConstraintFlags(constraintFlags)
  const coverage = Math.max(0, Math.min(1, Number(evidenceCoverage) || 0))

  if (hasBlockingConstraint(flags)) return DISPLAY_BAND_HIDDEN
  if (coverage < MINIMUM_EVIDENCE_COVERAGE) return DISPLAY_BAND_HIDDEN
  if (normalizedTrueScore >= TRUE_MATCH_HIGH_THRESHOLD) return DISPLAY_BAND_HIGH
  if (normalizedTrueScore >= TRUE_MATCH_HIDDEN_THRESHOLD) return DISPLAY_BAND_COMMON
  return DISPLAY_BAND_HIDDEN
}

export function resolveMatchLevelFromDisplayBand(displayBand = '') {
  if (displayBand === DISPLAY_BAND_HIGH) return 'high'
  if (displayBand === DISPLAY_BAND_COMMON) return 'medium'
  return 'none'
}

export function calibrateDisplayScore({ trueScore = 0, constraintFlags = {}, evidenceCoverage = 1 } = {}) {
  const normalizedTrueScore = clampScore(trueScore)
  const flags = normalizeConstraintFlags(constraintFlags)
  const coverage = Math.max(0, Math.min(1, Number(evidenceCoverage) || 0))
  const displayBand = resolveDisplayBand(normalizedTrueScore, flags, coverage)

  let displayScore = DISPLAY_SCORE_HIDDEN_MIN
  if (displayBand === DISPLAY_BAND_HIGH) {
    displayScore = interpolateAnchors(normalizedTrueScore, HIGH_ANCHORS)
  } else if (displayBand === DISPLAY_BAND_COMMON) {
    displayScore = interpolateAnchors(normalizedTrueScore, COMMON_ANCHORS)
  } else {
    displayScore = interpolateAnchors(normalizedTrueScore, HIDDEN_ANCHORS)
  }

  return {
    trueScore: normalizedTrueScore,
    displayScore,
    displayBand,
    visible: displayBand !== DISPLAY_BAND_HIDDEN,
    matchLevel: resolveMatchLevelFromDisplayBand(displayBand),
    algorithmVersion: MATCH_ALGORITHM_VERSION,
    calibrationVersion: MATCH_CALIBRATION_VERSION,
    constraintFlags: flags,
    evidenceCoverage: coverage
  }
}

export const MATCH_SCORE_THRESHOLDS = {
  trueHidden: TRUE_MATCH_HIDDEN_THRESHOLD,
  trueHigh: TRUE_MATCH_HIGH_THRESHOLD,
  displayHiddenMin: DISPLAY_SCORE_HIDDEN_MIN,
  displayVisibleMin: DISPLAY_SCORE_VISIBLE_MIN,
  displayCommonMax: DISPLAY_SCORE_COMMON_MAX,
  displayHighMin: DISPLAY_SCORE_HIGH_MIN,
  displayHighMax: DISPLAY_SCORE_HIGH_MAX,
  minimumEvidenceCoverage: MINIMUM_EVIDENCE_COVERAGE
}
