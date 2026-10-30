import { describe, expect, it } from 'vitest'
import { assessSafety, generate90DayPlan, normalizeAssessment } from './transformation-plan.js'

const base = {
  age: 30, height: 175, heightUnit: 'cm', weight: 80, weightUnit: 'kg',
  goal: 'fatloss', daysPerWeek: 3, sessionMin: 45,
  formulaSex: 'male', activityLevel: 'light',
}

describe('90-day offline transformation planner', () => {
  it('normalizes imperial inputs to canonical metric values', () => {
    const p = normalizeAssessment({ ...base, weight: 176.37, weightUnit: 'lb', height: 68.9, heightUnit: 'in' })
    expect(p.weightKg).toBeCloseTo(80, 1)
    expect(p.heightCm).toBeCloseTo(175, 0)
  })

  it('asks for essential data instead of inventing a profile', () => {
    const plan = generate90DayPlan({ goal: 'fatloss' })
    expect(plan.status).toBe('needs_more_info')
    expect(plan.missing).toEqual(expect.arrayContaining(['age', 'weight', 'height']))
  })

  it('requires professional review for minors and medical risk flags', () => {
    const minor = generate90DayPlan({ ...base, age: 17 })
    expect(minor.status).toBe('professional_review')
    const medical = generate90DayPlan({ ...base, medicalRestriction: true })
    expect(medical.status).toBe('professional_review')
    expect(assessSafety({ injuryOrPain: true }).reasons).toContain('injury_or_pain_review')
  })

  it('creates a bounded 90-day plan and marks estimates transparently', () => {
    const plan = generate90DayPlan(base, { now: new Date('2026-10-30T12:00:00Z') })
    expect(plan.status).toBe('ready')
    expect(plan.durationDays).toBe(90)
    expect(plan.phases).toHaveLength(4)
    expect(plan.schedule.sessions).toHaveLength(3)
    expect(plan.estimate.energy.dailyKcalRange[0]).toBeGreaterThan(0)
    expect(plan.requiresUserConfirmation).toBe(true)
    expect(plan.profile.bmiIsScreeningOnly).toBe(true)
  })

  it('withholds calorie targets when activity level is unknown', () => {
    const plan = generate90DayPlan({ ...base, activityLevel: null })
    expect(plan.status).toBe('ready')
    expect(plan.estimate.energy).toBeNull()
  })

  it('does not produce an automated weight-loss plan below the BMI reference range', () => {
    const plan = generate90DayPlan({ ...base, weight: 48, height: 180 })
    expect(plan.status).toBe('professional_review')
    expect(plan.flags).toContain('bmi_below_reference_range')
  })
})
