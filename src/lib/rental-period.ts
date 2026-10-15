export function getInclusiveRentalDays(startDate: string, endDate?: string | null): number {
  if (!startDate) return 1

  const effectiveEndDate = endDate || startDate
  const start = Date.parse(`${startDate}T00:00:00Z`)
  const end = Date.parse(`${effectiveEndDate}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 1

  return Math.floor((end - start) / 86_400_000) + 1
}
