import type { Timestamp } from "firebase/firestore"

// ─── Authentification ──────────────────────────────────────────────────────

export interface AuthUser {
  uid: string
  email: string
  organizationId: string
  role: UserRole
  firstName: string
  lastName: string
  position: string
}

// ─── Énumérations ──────────────────────────────────────────────────────────

export type UserRole = "ADMIN" | "MANAGER" | "ANIMATOR" | "PLAYER"
export type SessionStatus = "PLANNED" | "RUNNING" | "FINISHED"
export type PlayerStatus = "WAITING" | "PLAYING" | "FINISHED"
export type Difficulty = "Débutant" | "Intermédiaire" | "Avancé"
export type FlagDifficulty = "Facile" | "Moyen" | "Difficile" | "Expert"
export type ReportType = "Session" | "Joueur"
export type OrgPlan = "starter" | "professional" | "enterprise"

// ─── Flags de scénario ─────────────────────────────────────────────────────

export interface ScenarioFlag {
  id: string // slug court ex: "first_blood"
  label: string // libellé visible ex: "Le secret du bureau"
  value: string // chaîne attendue ex: "FLAG{first_blood}" (jamais exposée au joueur)
  difficulty: FlagDifficulty
  weight: number // dérivé auto de difficulty
  points: number // dérivé auto = weight × BASE_POINTS
  hint?: string
  order: number // ordre d'affichage
}

// Vue publique d'un flag (sans `value`) — envoyée au client joueur
export type PublicScenarioFlag = Omit<ScenarioFlag, "value">

export interface SubmittedFlag {
  flagId: string
  submittedAt: Timestamp
  timeSincePrevious: number // secondes depuis le flag précédent (ou joinedAt pour le 1er)
  difficulty: FlagDifficulty // snapshot
  weight: number // snapshot
  points: number // snapshot — figé même si le scénario est modifié après
}

// ─── Collections Firestore ─────────────────────────────────────────────────

export interface ProxmoxServer {
  id: string
  host: string // ex: "82.66.108.121:7000"
  token: string // ex: "PVEAPIToken=admin_cyberaegis@pam!admin_prov=..."
  node: string // ex: "pve"
  organizationId: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface ProxmoxTemplate {
  id: string
  vmid: number // ex: 102 (VM template sur Proxmox)
  name: string // ex: "template-linux-ctf"
  description?: string
  organizationId: string
  proxmoxServerId: string // FK → ProxmoxServer
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Scenario {
  id: string
  name: string
  description: string
  difficulty: Difficulty
  tags: string[]
  duration: number // minutes
  proxmoxTemplateId: string // FK → ProxmoxTemplate
  flags?: ScenarioFlag[]
  createdAt: Timestamp
  updatedAt: Timestamp
  organizationId: string
  isActive: boolean
}

export interface Session {
  id: string
  name: string
  scenarioId: string
  scenarioName: string // dénormalisé pour affichage
  date: string // ISO 8601
  status: SessionStatus
  gameSessionId?: string // id de la session VM Proxmox
  vmStatus?: GameSessionStatus
  players: number // compteur dénormalisé
  organizationId: string
  createdBy: string // uid Firebase Auth
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Player {
  id: string
  userId: string
  displayName: string
  email: string
  score: number
  progress: number // 0-100
  joinedAt: Timestamp
  completedAt?: Timestamp
  status: PlayerStatus
  submittedFlags?: SubmittedFlag[]
  lastFlagAt?: Timestamp
  flagsTotal?: number // cache du nb total de flags du scénario
}

export interface User {
  id: string // === Firebase Auth uid
  firstName: string
  lastName: string
  email: string
  position: string
  role: UserRole
  organizationId: string
  createdAt: Timestamp
  lastLogin?: Timestamp
  isActive: boolean
}

export interface PlayerReportData {
  userId: string
  displayName: string
  score: number
  progress: number         // 0-100
  status: PlayerStatus
  flagsFound: number
  totalFlags: number
  durationSeconds: number  // temps depuis joinedAt jusqu'à completedAt (ou fin de session)
  submittedFlags: SubmittedFlag[]
}

export interface ReportFlagMeta {
  id: string
  label: string
  difficulty: FlagDifficulty
  points: number
  order: number
}

export interface Report {
  id: string
  sessionId: string
  sessionName: string
  organizationId: string
  type: ReportType
  generatedAt: Timestamp
  data: ReportData
}

export interface ReportData {
  totalPlayers: number
  completionRate: number   // 0-100 : % de joueurs FINISHED
  averageScore: number
  averageDuration: number  // minutes (moyenne de durationSeconds / 60)
  totalFlags: number       // nb total de flags du scénario
  maxScore: number         // score maximum atteignable
  flags: ReportFlagMeta[]  // métadonnées des flags (label, difficulté…)
  players: PlayerReportData[]
}

export interface Organization {
  id: string
  name: string
  plan: OrgPlan
  maxUsers: number
  maxSessions: number
  createdAt: Timestamp
  isActive: boolean
}

// ─── Sessions de jeu Proxmox (VM clonées) ────────────────────────────────

export type GameSessionStatus = "pending" | "cloning" | "starting" | "running" | "ended" | "error"

export interface GameSession {
  id: string
  scenarioId: string
  playerId: string // FK → users
  parentSessionId?: string // FK → sessions (ID du doc dans la collection sessions)
  cloneVmid?: number // générée lors du clone
  cloneNode?: string // nœud Proxmox où le clone réside
  status: GameSessionStatus
  startedAt?: Timestamp
  endedAt?: Timestamp
  organizationId: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
