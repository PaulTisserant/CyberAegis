import type { FlagDifficulty } from "@/lib/types"

/**
 * Grille de scoring des flags.
 * Modifier ces constantes pour rééquilibrer le scoring sur toute la plateforme.
 * Les valeurs sont figées dans SubmittedFlag à la soumission, donc les
 * modifications ultérieures n'affectent que les futures soumissions.
 */
export const BASE_POINTS = 50

export const FLAG_WEIGHTS: Record<FlagDifficulty, number> = {
  Facile: 1,
  Moyen: 2,
  Difficile: 4,
  Expert: 7,
}

export const FLAG_DIFFICULTIES: FlagDifficulty[] = [
  "Facile",
  "Moyen",
  "Difficile",
  "Expert",
]

export function computeFlagScore(difficulty: FlagDifficulty): {
  weight: number
  points: number
} {
  const weight = FLAG_WEIGHTS[difficulty]
  return { weight, points: weight * BASE_POINTS }
}

/** Classes Tailwind pour le Badge selon la difficulté d'un flag. */
export const FLAG_DIFFICULTY_BADGE: Record<FlagDifficulty, string> = {
  Facile: "bg-green-100 text-green-800",
  Moyen: "bg-yellow-100 text-yellow-800",
  Difficile: "bg-orange-100 text-orange-800",
  Expert: "bg-red-100 text-red-800",
}
