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
export type ReportType = "Session" | "Joueur"
export type OrgPlan = "starter" | "professional" | "enterprise"

// ─── Collections Firestore ─────────────────────────────────────────────────

export interface Scenario {
  id: string
  name: string
  description: string
  difficulty: Difficulty
  tags: string[]
  duration: number // minutes
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
  completionRate: number // 0-100
  averageScore: number
  averageDuration: number // minutes
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
