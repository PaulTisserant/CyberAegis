import type { Report } from "@/lib/types"

function escapeCsvCell(value: string | number): string {
  const cell = String(value)
  const escaped = cell.replace(/"/g, '""')
  return /[";\n\r]/.test(escaped) ? `"${escaped}"` : escaped
}

function makeFileSafe(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
}

function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function downloadReportCsv(report: Report): void {
  const generatedAt = report.generatedAt.toDate()
  const isoDate = generatedAt.toISOString().slice(0, 10)
  const baseName = makeFileSafe(report.sessionName || "rapport")
  const filename = `rapport-${baseName}-${isoDate}.csv`

  const lines: string[] = []
  lines.push("Session;Type;Date generation;Joueurs;Completion;Score moyen;Duree moyenne (min);Flags total;Score max")
  lines.push(
    [
      report.sessionName,
      report.type,
      generatedAt.toLocaleString("fr-FR"),
      report.data.totalPlayers,
      `${report.data.completionRate}%`,
      report.data.averageScore,
      report.data.averageDuration,
      report.data.totalFlags,
      report.data.maxScore,
    ]
      .map(escapeCsvCell)
      .join(";")
  )

  lines.push("")
  lines.push("Joueur;Score;Progression;Flags trouves;Flags total;Duree (sec);Statut")

  const sortedPlayers = report.data.players.slice().sort((a, b) => b.score - a.score)
  for (const player of sortedPlayers) {
    lines.push(
      [
        player.displayName,
        player.score,
        `${player.progress}%`,
        player.flagsFound,
        player.totalFlags,
        player.durationSeconds,
        player.status,
      ]
        .map(escapeCsvCell)
        .join(";")
    )
  }

  downloadTextFile(filename, lines.join("\n"))
}