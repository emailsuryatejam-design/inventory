import { fullDemoGuide } from './fullDemoGuide'
import { navigationGuides } from './navigationGuides'
import { ordersGuides } from './ordersGuides'
import { stockGuides } from './stockGuides'
import { posGuides } from './posGuides'
import { operationsGuides } from './operationsGuides'

// Master list of all guides — full demo featured first
export const allGuides = [
  fullDemoGuide,
  ...navigationGuides,
  ...ordersGuides,
  ...stockGuides,
  ...posGuides,
  ...operationsGuides,
]

/**
 * Search guides by query string.
 * Matches against title, description, and keywords.
 */
export function searchGuides(query) {
  const q = query.toLowerCase().trim()
  if (!q) return allGuides

  return allGuides.filter(guide => {
    const titleMatch = guide.title.toLowerCase().includes(q)
    const descMatch = guide.description.toLowerCase().includes(q)
    const keywordMatch = guide.keywords.some(k => k.toLowerCase().includes(q))
    return titleMatch || descMatch || keywordMatch
  }).sort((a, b) => {
    // Prioritize title matches, then keywords, then description
    const aTitle = a.title.toLowerCase().includes(q) ? 2 : 0
    const bTitle = b.title.toLowerCase().includes(q) ? 2 : 0
    const aKey = a.keywords.some(k => k.toLowerCase().includes(q)) ? 1 : 0
    const bKey = b.keywords.some(k => k.toLowerCase().includes(q)) ? 1 : 0
    return (bTitle + bKey) - (aTitle + aKey)
  })
}

/**
 * Group guides by category.
 * Returns { 'Navigation': [...], 'Orders': [...], ... }
 */
export function getGuidesByCategory() {
  const grouped = {}
  for (const guide of allGuides) {
    if (!grouped[guide.category]) {
      grouped[guide.category] = []
    }
    grouped[guide.category].push(guide)
  }
  return grouped
}
