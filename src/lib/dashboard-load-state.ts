export type DashboardLoadError = 'offline' | 'paused' | 'unavailable'

export function classifyDashboardLoadError(status: number, isOnline: boolean): DashboardLoadError {
  if (!isOnline) return 'offline'
  if (status === 540) return 'paused'
  return 'unavailable'
}
