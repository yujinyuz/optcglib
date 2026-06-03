import type { CardFilters } from '../types'

export function getActiveFilterCount(filters: CardFilters): number {
  let count = 0
  if (filters.search) count++
  if (filters.colors.length > 0) count++
  if (filters.categories.length > 0) count++
  if (filters.rarities.length > 0) count++
  if (filters.attributes.length > 0) count++
  if (filters.sets.length > 0) count++
  if (filters.blockMin != null || filters.blockMax != null) count++
  if (filters.costMin != null || filters.costMax != null) count++
  if (filters.powerMin != null || filters.powerMax != null) count++
  if (filters.counterMin != null || filters.counterMax != null) count++
  return count
}
