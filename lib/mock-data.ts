export const mockScenarios = [
  {
    id: "1",
    name: "Phishing Attack Response",
    description: "Identifiez et répondez à une attaque phishing",
    difficulty: "Débutant",
    tags: ["Phishing", "Sensibilisation", "Email"],
  },
  {
    id: "2",
    name: "Ransomware Investigation",
    description: "Enquête sur une infection par ransomware",
    difficulty: "Intermédiaire",
    tags: ["Ransomware", "Réaction", "Incident"],
  },
  {
    id: "3",
    name: "Data Breach Forensics",
    description: "Analyse médico-légale d'une fuite de données",
    difficulty: "Avancé",
    tags: ["Forensics", "Données", "Analyse"],
  },
]

export const mockSessions = [
  {
    id: "1",
    name: "Session équipe IT - Janvier",
    scenario: "Phishing Attack Response",
    date: "2024-01-15",
    status: "FINISHED",
    players: 8,
  },
  {
    id: "2",
    name: "Formation CISO - Février",
    scenario: "Ransomware Investigation",
    date: "2024-02-20",
    status: "PLANNED",
    players: 5,
  },
  {
    id: "3",
    name: "Tous employés - Mars",
    scenario: "Phishing Attack Response",
    date: "2024-03-10",
    status: "RUNNING",
    players: 25,
  },
]

export const mockUsers = [
  {
    id: "1",
    firstName: "Marie",
    lastName: "Dupont",
    email: "marie.dupont@example.com",
    position: "Directrice IT",
    role: "ADMIN",
  },
  {
    id: "2",
    firstName: "Jean",
    lastName: "Martin",
    email: "jean.martin@example.com",
    position: "Responsable Sécurité",
    role: "MANAGER",
  },
  {
    id: "3",
    firstName: "Sophie",
    lastName: "Bernard",
    email: "sophie.bernard@example.com",
    position: "Animatrice",
    role: "ANIMATOR",
  },
]

export const mockReports = [
  {
    id: "1",
    sessionName: "Session équipe IT - Janvier",
    type: "Session",
    generatedAt: "2024-01-16",
  },
  {
    id: "2",
    sessionName: "Tous employés - Mars",
    type: "Joueur",
    generatedAt: "2024-03-11",
  },
]
