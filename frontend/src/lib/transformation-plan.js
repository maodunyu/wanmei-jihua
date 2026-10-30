/**
 * Free, deterministic 90-day planning foundation.
 *
 * This is deliberately a conservative planning aid, not a medical or dietetic prescription.
 * It never sends data over the network. Estimates are labelled, bounded and withheld when
 * essential inputs or safety checks are missing.
 */

const finite = value => value !== '' && value != null && Number.isFinite(Number(value))
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const round = n => Math.round(n)
const DAY = 86400000

export const PLAN_VERSION = 1
export const PLAN_DAYS = 90

export function normalizeAssessment(input = {}) {
  const p = { ...input }
  const unit = p.weightUnit === 'lb' ? 'lb' : 'kg'
  const heightUnit = p.heightUnit === 'in' ? 'in' : 'cm'
  const weight = finite(p.weight) ? Number(p.weight) * (unit === 'lb' ? 0.45359237 : 1) : null
  const height = finite(p.height) ? Number(p.height) * (heightUnit === 'in' ? 2.54 : 1) : null
  return {
    ...p,
    age: finite(p.age) ? Number(p.age) : null,
    weightKg: weight,
    heightCm: height,
    waistCm: finite(p.waist) ? Number(p.waist) * (p.measureUnit === 'in' ? 2.54 : 1) : null,
    targetWeightKg: finite(p.targetWeight) ? Number(p.targetWeight) * (unit === 'lb' ? 0.45359237 : 1) : null,
    daysPerWeek: clamp(Math.round(Number(p.daysPerWeek) || 3), 1, 6),
    sessionMin: clamp(Math.round(Number(p.sessionMin) || 45), 15, 180),
  }
}

export function assessSafety(p) {
  const reasons = []
  if (p.age != null && p.age < 18) reasons.push('under_18')
  if (p.pregnantOrPostpartum === true) reasons.push('pregnancy_or_postpartum')
  if (p.eatingDisorderHistory === true) reasons.push('eating_disorder_history')
  if (p.medicalRestriction === true) reasons.push('medical_restriction')
  if (p.unexplainedSymptoms === true) reasons.push('unexplained_symptoms')
  if (p.injuryOrPain === true) reasons.push('injury_or_pain_review')
  return { requiresProfessionalReview: reasons.some(x => x !== 'injury_or_pain_review'), reasons }
}

function activityFactor(level) {
  return ({ sedentary: 1.2, light: 1.35, moderate: 1.5, high: 1.7 })[level] || null
}

function energyEstimate(p) {
  // Mifflin-St Jeor is an estimate; a neutral midpoint is not silently assumed when
  // the formula parameter is unknown. A range is shown instead.
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age
  if (p.formulaSex === 'male') return { bmr: base + 5, confidence: 'estimated' }
  if (p.formulaSex === 'female') return { bmr: base - 161, confidence: 'estimated' }
  return { bmrRange: [base - 161, base + 5], confidence: 'wide_estimate' }
}

export function generate90DayPlan(input = {}, { now = new Date() } = {}) {
  const p = normalizeAssessment(input)
  const missing = []
  if (p.age == null || p.age < 18) missing.push('age')
  if (!(p.weightKg > 0)) missing.push('weight')
  if (!(p.heightCm > 0)) missing.push('height')
  if (!p.goal) missing.push('goal')
  const safety = assessSafety({ ...p, ...input })
  if (missing.length || safety.requiresProfessionalReview) {
    return {
      version: PLAN_VERSION, status: safety.requiresProfessionalReview ? 'professional_review' : 'needs_more_info',
      missing, safety, generatedAt: now.toISOString(), durationDays: PLAN_DAYS,
      message: safety.requiresProfessionalReview
        ? 'Please seek qualified professional guidance before an automated exercise or nutrition prescription.'
        : 'Add the missing basic information to create a useful plan.',
    }
  }

  const bmi = p.weightKg / ((p.heightCm / 100) ** 2)
  const flags = []
  if (bmi < 18.5) flags.push('bmi_below_reference_range')
  if (bmi >= 35) flags.push('high_bmi_review_context')
  if (p.targetWeightKg && p.goal === 'fatloss' && p.targetWeightKg < p.weightKg * 0.85) flags.push('ambitious_weight_target')
  if (flags.includes('bmi_below_reference_range')) {
    return {
      version: PLAN_VERSION, status: 'professional_review', missing: [], safety,
      flags, bmi: round(bmi * 10) / 10, generatedAt: now.toISOString(), durationDays: PLAN_DAYS,
      message: 'Weight-loss targets are not generated from BMI alone. Please review the goal with a qualified professional.',
    }
  }

  const activity = activityFactor(p.activityLevel)
  const energy = energyEstimate(p)
  const tdeeRange = energy.bmr != null
    ? [energy.bmr * (activity || 1.35), energy.bmr * (activity || 1.35)]
    : energy.bmrRange.map(v => v * (activity || 1.35))
  let calorieRange = null
  if (activity && p.goal === 'fatloss') calorieRange = [Math.max(1200, round(tdeeRange[0] - 300)), Math.max(1400, round(tdeeRange[1] - 200))]
  if (activity && ['muscle', 'strength'].includes(p.goal)) calorieRange = [round(tdeeRange[0]), round(tdeeRange[1] + 200)]
  if (activity && ['general', 'endurance', 'maintain'].includes(p.goal)) calorieRange = [round(tdeeRange[0] - 100), round(tdeeRange[1] + 100)]

  const protein = [round(p.weightKg * 1.2), round(p.weightKg * 1.6)]
  const goalLabel = p.goal === 'fatloss' ? 'fat_loss' : p.goal
  const phases = [
    { id: 'baseline', days: [1, 14], focus: 'Build a baseline, learn movements, establish sustainable habits.' },
    { id: 'consistency', days: [15, 42], focus: 'Build consistency and gradually increase training stimulus.' },
    { id: 'progression', days: [43, 70], focus: 'Progress gradually when recovery and technique are good.' },
    { id: 'review', days: [71, 90], focus: 'Review trends, consolidate habits and prepare the next block.' },
  ]
  const daysPerWeek = p.daysPerWeek
  const sessions = Array.from({ length: daysPerWeek }, (_, i) => ({
    day: i + 1,
    type: daysPerWeek <= 2 ? 'full_body' : daysPerWeek <= 4 ? ['full_body', 'upper', 'lower', 'full_body'][i] : ['upper', 'lower', 'conditioning', 'upper', 'lower', 'conditioning'][i],
    durationMin: p.sessionMin,
    intensity: 'moderate',
    note: 'Leave repetitions in reserve; stop if pain or unusual symptoms occur.',
  }))
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start.getTime() + (PLAN_DAYS - 1) * DAY)

  return {
    version: PLAN_VERSION, status: 'ready', generatedAt: now.toISOString(),
    startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10), durationDays: PLAN_DAYS,
    profile: {
      goal: goalLabel, age: p.age, heightCm: p.heightCm, weightKg: p.weightKg,
      waistCm: p.waistCm, bmi: round(bmi * 10) / 10, bmiIsScreeningOnly: true,
      activityLevel: p.activityLevel || 'not_provided',
    },
    estimate: {
      energy: calorieRange ? { dailyKcalRange: calorieRange, method: 'Mifflin-St Jeor × activity factor, then a modest goal adjustment', confidence: energy.confidence } : null,
      proteinGramsPerDayRange: protein,
      note: 'Estimates are starting points, not medical advice. If formula inputs or activity level are unknown, calorie targets are withheld.',
    },
    schedule: { daysPerWeek, sessions, restDaysPerWeek: 7 - daysPerWeek },
    phases,
    flags,
    adjustmentRules: [
      'Use consistent weigh-in conditions and compare multi-week trends, not single-day changes.',
      'Review adherence, waist trend, training performance, sleep and recovery before changing the plan.',
      'Do not reduce food intake or increase exercise solely because of a short-term scale fluctuation.',
      'Pause or modify exercise if pain, dizziness, chest pain or unusual breathlessness occurs.',
    ],
    requiresUserConfirmation: true,
  }
}
