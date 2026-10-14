import { describe, expect, it } from 'vitest'
import { classifyDashboardLoadError } from '../dashboard-load-state'

describe('classifyDashboardLoadError', () => {
  it('identifies a paused Supabase project', () => {
    expect(classifyDashboardLoadError(540, true)).toBe('paused')
  })

  it('prioritizes an offline connection', () => {
    expect(classifyDashboardLoadError(540, false)).toBe('offline')
    expect(classifyDashboardLoadError(0, false)).toBe('offline')
  })

  it('treats other server failures as temporarily unavailable', () => {
    expect(classifyDashboardLoadError(500, true)).toBe('unavailable')
    expect(classifyDashboardLoadError(0, true)).toBe('unavailable')
  })
})
