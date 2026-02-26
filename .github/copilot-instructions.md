# CyberAegis — Instructions GitHub Copilot

## Présentation du projet

CyberAegis est une **plateforme SaaS d'escape game cybersécurité** destinée aux entreprises souhaitant sensibiliser leurs équipes aux risques informatiques. Le produit permet de créer et gérer des scénarios d'escape game (phishing, ransomware, forensics, etc.), d'organiser des sessions de formation et de suivre les performances des joueurs via des rapports détaillés.

---

## Stack technique

| Couche | Technologies |
|---|---|
| Framework | **Next.js 16** (App Router, `src/` non utilisé) |
| Langage | **TypeScript 5** strict |
| UI | **React 19**, **Tailwind CSS v4**, **shadcn/ui** (Radix UI) |
| Forms | **React Hook Form** + **Zod** (validation schéma) |
| Graphiques | **Recharts** |
| Icônes | **Lucide React** |
| Base de données | **Firebase Firestore** (NoSQL) |
| Authentification | **Firebase Authentication** |
| Déploiement | **Vercel** (`@vercel/analytics`) |
| Package manager | **pnpm** |

---

## Architecture des dossiers

```
app/
├── layout.tsx              # Root layout (Geist font, Analytics)
├── page.tsx                # Landing page publique
├── globals.css
├── app/                    # Zone protégée (dashboard)
│   ├── layout.tsx          # Layout dashboard (sidebar)
│   ├── AppLayoutClient.tsx # Sidebar + navigation client
│   ├── page.tsx            # Dashboard principal
│   ├── scenarios/          # CRUD scénarios
│   ├── sessions/           # CRUD sessions + lancement
│   │   └── [id]/           # Détail d'une session
│   ├── users/              # Gestion des utilisateurs
│   ├── reports/            # Rapports et analytics
│   │   └── [id]/           # Détail d'un rapport
│   └── player/
│       └── session/[sessionId]/ # Vue joueur en live
├── auth/                   # Pages publiques auth
│   ├── login/
│   └── register/
├── contact/
├── features/
├── pricing/
└── security/
components/
├── ui/                     # Composants shadcn/ui (NE PAS modifier)
└── theme-provider.tsx
lib/
├── firebase.ts             # (À créer) init Firebase app
├── firestore/              # (À créer) services Firestore par collection
│   ├── scenarios.ts
│   ├── sessions.ts
│   ├── users.ts
│   └── reports.ts
├── hooks/                  # (À créer) custom React hooks
├── mock-data.ts            # Données de test (à remplacer par Firebase)
└── utils.ts                # cn() helper Tailwind
```

---

## Modèles de données Firebase (Firestore)

### Collection `scenarios`
```typescript
interface Scenario {
  id: string                  // Firestore document ID
  name: string
  description: string
  difficulty: "Débutant" | "Intermédiaire" | "Avancé"
  tags: string[]
  duration: number            // minutes
  createdAt: Timestamp
  updatedAt: Timestamp
  organizationId: string      // multi-tenant
  isActive: boolean
}
```

### Collection `sessions`
```typescript
interface Session {
  id: string
  name: string
  scenarioId: string
  scenarioName: string        // dénormalisé pour affichage
  date: string                // ISO 8601
  status: "PLANNED" | "RUNNING" | "FINISHED"
  players: number             // compteur dénormalisé
  organizationId: string
  createdBy: string           // uid Firebase Auth
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### Collection `sessions/{sessionId}/players` (sous-collection)
```typescript
interface Player {
  id: string
  userId: string
  displayName: string
  email: string
  score: number
  progress: number            // 0-100
  joinedAt: Timestamp
  completedAt?: Timestamp
  status: "WAITING" | "PLAYING" | "FINISHED"
}
```

### Collection `users`
```typescript
interface User {
  id: string                  // === Firebase Auth uid
  firstName: string
  lastName: string
  email: string
  position: string
  role: "ADMIN" | "MANAGER" | "ANIMATOR" | "PLAYER"
  organizationId: string
  createdAt: Timestamp
  lastLogin?: Timestamp
  isActive: boolean
}
```

### Collection `reports`
```typescript
interface Report {
  id: string
  sessionId: string
  sessionName: string
  organizationId: string
  type: "Session" | "Joueur"
  generatedAt: Timestamp
  data: {
    totalPlayers: number
    completionRate: number
    averageScore: number
    averageDuration: number
  }
}
```

### Collection `organizations`
```typescript
interface Organization {
  id: string
  name: string
  plan: "starter" | "professional" | "enterprise"
  maxUsers: number
  maxSessions: number
  createdAt: Timestamp
  isActive: boolean
}
```

---

## Règles de code

### Composants React
- **Server Components par défaut** — ajouter `"use client"` uniquement si le composant utilise des hooks, des événements ou de l'état local
- Nommer les composants avec **PascalCase**
- Les **modales** sont des composants séparés dans le même dossier (ex. `CreateScenarioModal.tsx`)
- Passer des props typées avec des interfaces TypeScript (pas de `any`)

### Firebase / Firestore
- **Toujours** utiliser les services dans `lib/firestore/` — ne jamais appeler `db` directement depuis un composant
- Utiliser `onSnapshot` pour les données temps réel (sessions en cours)
- Utiliser `getDocs` / `getDoc` pour les lectures ponctuelles (rapports, listes)
- **Filtrer par `organizationId`** dans toutes les queries (multi-tenant)
- Gérer les erreurs avec `try/catch` et afficher un toast via `sonner`

### Formulaires
- Utiliser **React Hook Form** avec `useForm<T>()` typé
- Schéma de validation avec **Zod** (`z.object({...})`)
- `zodResolver` depuis `@hookform/resolvers/zod`
- Afficher les erreurs avec `{errors.field?.message}`

### Styling
- Utiliser **uniquement Tailwind CSS** (pas de CSS inline ni de style objects)
- Utiliser `cn()` de `lib/utils.ts` pour combiner les classes conditionnelles
- Couleurs sémantiques : `bg-background`, `text-foreground`, `text-muted-foreground`, `bg-primary`
- Variantes de Badge pour les statuts :
  - `RUNNING` / "En cours" → `bg-green-100 text-green-800`
  - `PLANNED` / "Planifiée" → `bg-gray-100 text-gray-800`
  - `FINISHED` / "Terminée" → `bg-red-100 text-red-800`
  - `Débutant` → `bg-green-100 text-green-800`
  - `Intermédiaire` → `bg-yellow-100 text-yellow-800`
  - `Avancé` → `bg-red-100 text-red-800`

### TypeScript
- **Pas de `any`** — utiliser `unknown` puis narrowing ou des types précis
- Exporter les interfaces depuis `lib/types.ts`
- Utiliser les types `Timestamp` de `firebase/firestore` pour les dates

---

## Patterns récurrents

### Service Firestore (pattern standard)
```typescript
// lib/firestore/scenarios.ts
import { db } from "@/lib/firebase"
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, where, orderBy, Timestamp
} from "firebase/firestore"
import type { Scenario } from "@/lib/types"

const COL = "scenarios"

export async function getScenarios(organizationId: string): Promise<Scenario[]> {
  const q = query(
    collection(db, COL),
    where("organizationId", "==", organizationId),
    where("isActive", "==", true),
    orderBy("createdAt", "desc")
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Scenario))
}

export async function createScenario(
  data: Omit<Scenario, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })
  return ref.id
}
```

### Hook custom Firestore (temps réel)
```typescript
// lib/hooks/useSessions.ts
import { useEffect, useState } from "react"
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Session } from "@/lib/types"

export function useSessions(organizationId: string) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query(
      collection(db, "sessions"),
      where("organizationId", "==", organizationId),
      orderBy("createdAt", "desc")
    )
    const unsub = onSnapshot(q,
      (snap) => {
        setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Session)))
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [organizationId])

  return { sessions, loading, error }
}
```

### Affichage d'erreur / chargement
```tsx
if (loading) return <div className="flex items-center justify-center h-64"><span className="text-muted-foreground">Chargement...</span></div>
if (error) return <div className="text-destructive">{error}</div>
```

---

## Contexte métier

- **Organisation** : unité multi-tenant (entreprise cliente)
- **Administrateur** : crée les scénarios, gère les utilisateurs, consulte tous les rapports
- **Manager** : crée et lance des sessions, consulte les rapports de son équipe
- **Animateur** : anime une session en live, voit les scores en temps réel
- **Joueur** : participe à une session via `/app/player/session/[sessionId]`
- Les sessions passent par les états : `PLANNED → RUNNING → FINISHED`
- Les scénarios ont 3 niveaux de difficulté : `Débutant`, `Intermédiaire`, `Avancé`
- L'UI est **entièrement en français**

---

## Ce qu'il faut éviter

- Ne pas utiliser `localStorage` ou `sessionStorage` pour persister les données métier
- Ne pas appeler Firestore directement dans les Server Components sans `async/await` approprié
- Ne pas créer de nouveaux composants UI de base — utiliser ceux de `components/ui/`
- Ne pas utiliser `fetch()` pour les données internes — utiliser Firestore
- Ne pas coder en dur des `organizationId` — toujours les récupérer depuis le contexte auth
- Ne pas oublier les règles de sécurité Firestore (chaque query doit filtrer par `organizationId`)
