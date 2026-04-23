# Documentation — Escape Game SaaS · Proxmox + Next.js
## Guide complet pour l'IA chargée de l'implémentation

---

## 0. Contexte du projet

### Ce qu'on construit
Une plateforme **Escape Game SaaS** où :
- Des **scénarios** sont définis dans une base de données. Chaque scénario est associé à un
  **template de VM Proxmox** (VM marquée `template: 1`).
- Un joueur choisit un scénario → le système **clone automatiquement** le template en une
  nouvelle VM dédiée à sa session → démarre la VM → ouvre un **flux vidéo VNC interactif**
  dans le navigateur.
- À la fin de la partie (chrono = 0 ou joueur part), la VM clonée est **détruite**.

### Preuve de concept existante (référence fonctionnelle)
Le code qui **fonctionne déjà** dans ce workspace (`serveur.py` + `escape-game.html`) fait :
- `serveur.py` : serveur Flask Python, proxy WebSocket VNC, variables Proxmox **codées en dur**
- `escape-game.html` : client VNC complet en JS vanilla, dessine les pixels RFB sur `<canvas>`

Les variables actuellement codées en dur dans `serveur.py` sont :
```python
PROXMOX_HOST  = "82.66.108.121:7000"
NODE          = "pve"
VMID          = "103"                  # ← sera dynamique (VM clonée à la volée)
PROXMOX_TOKEN = "PVEAPIToken=admin_cyberaegis@pam!admin_prov=fa3cff4d-0614-48ac-aa93-54adca766fa4"
```

Dans Next.js ces valeurs viennent de la **base de données** (sauf `PROXMOX_HOST` et
`PROXMOX_TOKEN` qui sont en variables d'environnement serveur). Le `VMID` est **généré
dynamiquement** lors du clone, puis stocké en base dans la session de jeu.

---

## 1. Architecture générale

```
┌─────────────────────────────────────────────────────────────────┐
│  Navigateur (React / Next.js Client)                            │
│                                                                 │
│  1. GET /api/game/start?scenarioId=X  → crée la session en DB  │
│  2. Polling GET /api/game/status      → attend statut "running" │
│  3. WS  ws://monapp/api/vnc-proxy?sessionId=Y → flux vidéo     │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTP REST + WebSocket
┌───────────────────────▼─────────────────────────────────────────┐
│  Next.js Server (Node.js)                                       │
│                                                                 │
│  /api/game/start     → Phase 1+2 : découverte + clone + start  │
│  /api/game/status    → Phase 2   : poll statut VM              │
│  /api/vnc-proxy      → Phase 3   : proxy WebSocket VNC         │
│  /api/game/end       → Phase 4   : stop + delete VM            │
│                                                                 │
│  Lit en DB : proxmox_host, proxmox_token, template_vmid        │
│  Écrit en DB : vmid_clone, statut_session                      │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTPS REST + WSS (cert auto-signé)
┌───────────────────────▼─────────────────────────────────────────┐
│  Proxmox VE  (82.66.108.121:7000)                               │
│  Node : pve                                                     │
│  Templates : VM avec template=1 (ex: vmid 102 = scénario Linux) │
│  Clones    : VM créées à la volée (ex: vmid 200, 201, ...)     │
└─────────────────────────────────────────────────────────────────┘
```

Il y a **deux WebSockets** lors du gameplay :
1. **Navigateur ↔ Next.js** : connexion locale, sans authentification (le proxy la neutralise)
2. **Next.js ↔ Proxmox** : connexion `wss://` avec token + ticket VNC éphémère (60s)

---

## 2. Modèle de données (Firebase Firestore - NoSQL)

> **Important** : Le projet utilise Firebase Firestore. Il ne s'agit pas de tables SQL mais de collections NoSQL.

### Collection `proxmox_servers`
Stocke les credentials du/des serveurs Proxmox. Non exposée au client.
```ts
interface ProxmoxServer {
  id: string          // ID du document Firebase
  host: string        // ex: "82.66.108.121:7000"
  token: string       // ex: "PVEAPIToken=admin_cyberaegis@pam!admin_prov=fa3cff4d-..."
  node: string        // ex: "pve"
}
```

### Collection `scenarios`
Un scénario = un template Proxmox + une description de jeu.
```ts
interface Scenario {
  id: string              // ID du document Firebase
  name: string            // ex: "Intrusion Linux niveau 1"
  description: string
  template_vmid: number   // vmid de la VM template sur Proxmox (ex: 102)
  proxmox_id: string      // référence au document proxmox_servers
  duration_sec: number    // durée de la partie en secondes (ex: 3600)
}
```

### Collection `game_sessions`
Une session = une partie en cours ou terminée.
```ts
interface GameSession {
  id: string              // ID du document Firebase
  scenario_id: string     // référence au document scenarios
  player_id: string       // référence au document users
  clone_vmid?: number     // vmid de la VM clonée (généré lors du clone, undefined avant)
  clone_node?: string     // node sur lequel le clone a été créé
  status: "pending" | "cloning" | "starting" | "running" | "ended" | "error"
  started_at: Timestamp   // depuis firebase/firestore
  ended_at: Timestamp     // depuis firebase/firestore
}
```

---

## 3. Credentials Proxmox

### 3.1 Format du token API

Proxmox utilise des **tokens API** au format :
```
PVEAPIToken=<user>@<realm>!<tokenid>=<secret>
```

Token de référence (celui utilisé dans `serveur.py`) :
```
PVEAPIToken=admin_cyberaegis@pam!admin_prov=fa3cff4d-0614-48ac-aa93-54adca766fa4
```

Ce token doit être envoyé dans le header `Authorization` de **toutes** les requêtes vers
l'API Proxmox (REST et WebSocket).

### 3.2 Variables d'environnement serveur (`.env.local`)

```env
# -- Proxmox par défaut (fallback si pas en DB) --
PROXMOX_HOST=82.66.108.121:7000
PROXMOX_TOKEN=PVEAPIToken=admin_cyberaegis@pam!admin_prov=fa3cff4d-0614-48ac-aa93-54adca766fa4
PROXMOX_NODE=pve
```

> **Règle de sécurité** : aucune de ces variables ne porte le préfixe `NEXT_PUBLIC_`.
> Elles ne quittent jamais le processus Node.js serveur.

### 3.3 Certificat TLS auto-signé

Proxmox utilise un certificat TLS auto-signé. Côté Node.js il faut désactiver la vérification :
```ts
import https from 'https';
const httpsAgent = new https.Agent({ rejectUnauthorized: false });
// Utiliser cet agent dans tous les fetch() vers Proxmox
```

---

## 4. Phase 1 — Découverte Proxmox (au démarrage du backend)

Ces appels permettent de cartographier l'environnement. À appeler une seule fois au démarrage
ou lors de la synchronisation des scénarios.

### 4.1 Lister les nœuds
```http
GET https://{host}/api2/json/nodes
Authorization: PVEAPIToken=...
```
Réponse :
```json
{ "data": [{ "node": "pve", "status": "online", "cpu": 0.04, ... }] }
```
Utilité : récupérer dynamiquement le nom du nœud (`pve`) pour les requêtes suivantes.

### 4.2 Lister les VMs et trouver les templates
```http
GET https://{host}/api2/json/nodes/{node}/qemu
Authorization: PVEAPIToken=...
```
Réponse (extrait) :
```json
{
  "data": [
    { "vmid": 102, "name": "template-linux-ctf", "template": 1, "status": "stopped" },
    { "vmid": 200, "name": "escape-game-session-abc", "template": 0, "status": "running" }
  ]
}
```
Utilité : identifier les VM templates (`"template": 1`) et les associer aux scénarios en DB.

---

## 5. Phase 2 — Création d'une partie (joueur clique "Jouer")

### 5.1 Vue d'ensemble de la séquence

```
Joueur → POST /api/game/start?scenarioId=X
  │
  ├─ Next.js lit en DB : template_vmid, proxmox_host, proxmox_token, node
  │
  ├─ POST https://proxmox/nodes/{node}/qemu/{template_vmid}/clone
  │    → reçoit le nouveau vmid (clone_vmid)
  │    → écrit clone_vmid + status="cloning" en DB
  │
  ├─ POST https://proxmox/nodes/{node}/qemu/{clone_vmid}/status/start
  │    → écrit status="starting" en DB
  │
  └─ Retourne { sessionId, status: "starting" } au client
       ↓
Joueur → polling GET /api/game/status?sessionId=Y
  │
  ├─ Next.js → GET https://proxmox/nodes/{node}/qemu/{clone_vmid}/status/current
  │    → vérifie que "status" == "running"
  │
  └─ Quand running → retourne { status: "running", wsUrl: "/api/vnc-proxy?sessionId=Y" }
       ↓
Joueur ouvre le composant VNC avec wsUrl
```

### 5.2 Cloner le template

```http
POST https://{host}/api2/json/nodes/{node}/qemu/{template_vmid}/clone
Authorization: PVEAPIToken=...
Content-Type: application/x-www-form-urlencoded

newid=200&name=escape-session-abc123&full=0
```

Paramètres :

| Paramètre | Valeur         | Description                                                   |
|-----------|----------------|---------------------------------------------------------------|
| `newid`   | ex: 200, 201… | VMID de la VM clonée. Doit être unique. Générer dynamiquement. |
| `name`    | string unique  | Nom lisible (ex: `escape-{sessionId}`)                       |
| `full`    | `0`            | **Clone lié** (linked clone) = quasi-instantané (~2 sec). `1` = clone complet = lent. |

Réponse :
```json
{ "data": "UPID:pve:0000AB12:0123DEF:67890ABC:qmclone:200:admin_cyberaegis@pam:" }
```
La valeur `data` est un **UPID** (task ID Proxmox). Peut être ignoré si on poll le statut directement.

> **Important** : le `newid` doit être un entier libre sur Proxmox. Stratégie suggérée : utiliser
> un range réservé (ex: 1000–1999) et incrémenter un compteur atomique en DB ou Redis.

### 5.3 Démarrer la VM clonée

```http
POST https://{host}/api2/json/nodes/{node}/qemu/{clone_vmid}/status/start
Authorization: PVEAPIToken=...
```

Réponse :
```json
{ "data": "UPID:pve:..." }
```

### 5.4 Vérifier le statut de la VM (polling)

```http
GET https://{host}/api2/json/nodes/{node}/qemu/{clone_vmid}/status/current
Authorization: PVEAPIToken=...
```

Réponse :
```json
{
  "data": {
    "vmid": 200,
    "status": "running",   ← attendre cette valeur
    "name": "escape-session-abc123",
    "cpu": 0.02,
    "mem": 536870912,
    "uptime": 42
  }
}
```

Valeurs possibles de `status` : `"stopped"` | `"running"` | `"paused"` | `"unknown"`

Stratégie de polling recommandée :
- Intervalle : 2 secondes
- Timeout max : 60 secondes
- Si timeout → marquer session `status = "error"` en DB

---

## 6. Phase 3 — Connexion du joueur au flux vidéo

### 6.1 Obtenir un ticket VNC (côté serveur Next.js)

```http
POST https://{host}/api2/json/nodes/{node}/qemu/{clone_vmid}/vncproxy
Authorization: PVEAPIToken=...
Content-Type: application/x-www-form-urlencoded

websocket=1
```

Réponse :
```json
{
  "data": {
    "ticket": "PVEVNC:200:admin_cyberaegis@pam:AABBCCDD...",
    "port":   5901,
    "password": "encrypted_password_or_null",
    "user":   "admin_cyberaegis@pam",
    "cert":   "-----BEGIN CERTIFICATE-----...",
    "uid":    12345
  }
}
```

| Champ      | Usage                                                                      |
|------------|----------------------------------------------------------------------------|
| `ticket`   | Clé WebSocket (paramètre URL `vncticket`), peut aussi servir pour VNC Auth |
| `password` | **Préféré** pour l'authentification VNC DES (si présent)                   |
| `user`     | Fallback pour VNC Auth DES (si `password` absent)                          |
| `port`     | Port VNC assigné à cette session (ex: 5900–5999)                           |

> **Stratégie d'authentification** : utiliser `password || user || ticket` comme clé pour le chiffrement DES. Préférer `password` s'il est disponible, puis `user`, puis `ticket` en dernier recours.

> **Durée de vie du ticket** : **60 secondes**. La connexion WebSocket doit être établie dans
> ce délai. Le ticket est à usage unique.

### 6.2 URL WebSocket Proxmox (côté serveur, jamais exposé au client)

```
wss://{host}/api2/json/nodes/{node}/qemu/{clone_vmid}/vncwebsocket?port={port}&vncticket={ticket_url_encoded}
```

Le ticket **doit être URL-encoded** (`encodeURIComponent` en JS, `urllib.parse.quote` en Python),
car il contient des caractères spéciaux (`:`, `@`, `+`, `/`).

---

## 7. Handshake RFB (protocole VNC) — Détail complet

Le protocole **RFB (Remote Framebuffer)** est le protocole VNC. Le proxy Node.js doit effectuer
ce handshake **côté serveur avec Proxmox** avant de proxifier vers le navigateur.

### 7.1 Échange de version
```
← Proxmox envoie : "RFB 003.008\n"   (12 bytes ASCII)
→ Proxy répond   : "RFB 003.008\n"
```

### 7.2 Négociation de sécurité
```
← Proxmox envoie : [N, type1, type2, ...]
  - Byte 0 = nombre de types proposés
  - Bytes suivants = types disponibles
→ Proxy répond : [type_choisi]  (1 byte)
```

| Type | Nom      | Action requise                         |
|------|----------|----------------------------------------|
| `1`  | None     | Aucun challenge, passer directement    |
| `2`  | VNC Auth | Challenge DES 16 bytes (voir §7.3)     |

**Proxmox propose généralement le type `2` (VNC Auth)** avec le ticket comme clé.

### 7.3 VNC Auth — Algorithme DES (critique)

```
← Proxmox envoie : 16 bytes challenge aléatoire
→ Proxy répond   : 16 bytes = DES_ECB_encrypt(challenge_16bytes, key_8bytes)
```

Construction de la **clé DES** à partir de la valeur d'authentification :
1. Déterminer la chaîne à utiliser : **préférer** `password` du `/vncproxy`, puis `user`, enfin `ticket` en fallback
2. Prendre les 8 premiers bytes de cette chaîne (en UTF-8), padder avec `0x00` si plus court
3. **Inverser l'ordre des bits** de chaque byte (bit 0 ↔ bit 7, bit 1 ↔ bit 6, etc.)
4. Chiffrer avec DES en mode ECB

```ts
function vncDesEncrypt(challenge: Buffer, passwordToUse: string): Buffer {
  // passwordToUse = password || user || ticket
  const key = Buffer.alloc(8);
  for (let i = 0; i < 8; i++) {
    const byte = i < passwordToUse.length ? passwordToUse.charCodeAt(i) : 0;
    let rev = 0;
    for (let bit = 0; bit < 8; bit++) rev = (rev << 1) | ((byte >> bit) & 1);
    key[i] = rev;
  }
  // npm install node-forge
  const forge = require('node-forge');
  const c = forge.cipher.createCipher('DES-ECB', forge.util.createBuffer(key.toString('binary')));
  c.start();
  c.update(forge.util.createBuffer(challenge.toString('binary')));
  c.finish();
  return Buffer.from(c.output.getBytes(), 'binary');
}
```

> **Important** : les trois champs (`password`, `user`, `ticket`) peuvent être utilisés comme clé DES. La plupart des serveurs Proxmox retournent `password` ; c'est le choix recommandé.

### 7.4 SecurityResult
```
← Proxmox envoie : 4 bytes big-endian uint32
  0x00000000 = succès
  autre      = échec (VM pas running, ticket expiré, etc.)
```

### 7.5 ClientInit
```
→ Proxy envoie : [0x01]   (shared=1 : ne pas déconnecter les autres sessions)
```

### 7.6 ServerInit
```
← Proxmox envoie :
  Bytes  0-1  : framebuffer_width  (uint16 BE)  ex: 1024
  Bytes  2-3  : framebuffer_height (uint16 BE)  ex: 768
  Bytes  4-19 : PixelFormat (16 bytes) :
    [4]    bits_per_pixel    ex: 32
    [5]    depth             ex: 24
    [6]    big_endian_flag   0 ou 1
    [7]    true_colour_flag  1
    [8-9]  red_max           255
    [10-11] green_max        255
    [12-13] blue_max         255
    [14]   red_shift         ex: 16
    [15]   green_shift       ex: 8
    [16]   blue_shift        ex: 0
    [17-19] padding
  Bytes 20-23 : name_length (uint32 BE)
  Bytes 24+   : name (ASCII)
```

> **Attention (Fusion TCP)** : Fréquemment, Proxmox envoie le `SecurityResult` (4 bytes) et ce `ServerInit` (24+ bytes) concaténés en une seule trame WebSocket de $\ge 28$ bytes. Le proxy doit extraire le `ServerInit` à partir du message du SecurityResult si ce dernier fait $28$ octets ou plus, sans faire de nouvel `await`.

> **Ce buffer ServerInit est conservé** par le proxy et retransmis tel quel au navigateur.

### 7.7 Mini-handshake proxy → navigateur (No Auth)

Le proxy présente une session **sans authentification** au navigateur :
```
→ Proxy → Nav  : "RFB 003.008\n"
← Nav   → Proxy: "RFB 003.008\n"
→ Proxy → Nav  : [0x01, 0x01]            (1 type proposé : type 1 = None)
← Nav   → Proxy: [0x01]                  (navigateur choisit None)
→ Proxy → Nav  : [0x00, 0x00, 0x00, 0x00] (SecurityResult OK)
← Nav   → Proxy: [0x01]                  (ClientInit shared=1)
→ Proxy → Nav  : <ServerInit de Proxmox>  (retransmet le vrai ServerInit)
```

Après cela : **tunnel pur** dans les deux sens, aucune transformation.

---

## 8. Format vidéo RFB reçu de Proxmox

### FramebufferUpdate (type 0) — message le plus fréquent
```
Byte 0    : 0  (type = FramebufferUpdate)
Byte 1    : 0  (padding)
Bytes 2-3 : nombre de rectangles (uint16 BE)

Pour chaque rectangle :
  Bytes 0-1  : x  (uint16 BE)
  Bytes 2-3  : y  (uint16 BE)
  Bytes 4-5  : width  (uint16 BE)
  Bytes 6-7  : height (uint16 BE)
  Bytes 8-11 : encoding (int32 BE)

  Si encoding == 0 (Raw) :
    width * height * 4 bytes de pixels BGRA little-endian
    → byte[0]=B, byte[1]=G, byte[2]=R, byte[3]=A (ignoré, toujours 255)

  Si encoding == 1 (CopyRect) :
    2 bytes srcX + 2 bytes srcY
    → copier depuis la zone (srcX,srcY,w,h) du canvas vers (x,y,w,h)

  Si encoding == -223 (DesktopSize pseudo-rect) :
    Pas de données pixel.
    → Mettre à jour fb_width et fb_height.
```

### Autres messages serveur RFB
| Type | Nom                  | Parsing                                              |
|------|----------------------|------------------------------------------------------|
| `1`  | SetColourMapEntries  | Skip : `6 + (buf[4]<<8|buf[5]) * 6` bytes           |
| `2`  | Bell                 | Skip : 1 byte (juste l'octet type)                  |
| `3`  | ServerCutText        | Skip : `8 + uint32_BE(buf[4..7])` bytes             |

---

## 9. Messages RFB envoyés par le client (navigateur)

### FramebufferUpdateRequest (type 3)
```
[3] [incremental] [x_hi][x_lo] [y_hi][y_lo] [w_hi][w_lo] [h_hi][h_lo]
incremental: 0 = refresh complet, 1 = diff seulement
```
À envoyer : après le ServerInit (incremental=0), puis après **chaque** FramebufferUpdate reçu (incremental=1).

### SetEncodings (type 2)
```
[2][0] [count_hi][count_lo] [enc1 4bytes BE] [enc2 4bytes BE] ...
```
Encodages à déclarer : `0` (Raw), `1` (CopyRect), `0xFFFFFF21` = `-223` (DesktopSize pseudo-encoding).

### KeyEvent (type 4)
```
[4] [down=1/up=0] [0][0] [keysym_b3][keysym_b2][keysym_b1][keysym_b0]
```
Keysyms courants (codes X11) :
```
Enter=0xFF0D  Backspace=0xFF08  Tab=0xFF09  Escape=0xFF1B  Delete=0xFFFF
ArrowUp=0xFF52  ArrowDown=0xFF54  ArrowLeft=0xFF51  ArrowRight=0xFF53
Ctrl_L=0xFFE3  Alt_L=0xFFE9  Shift_L=0xFFE1
F1=0xFFBE ... F12=0xFFC9
Caractères ASCII : charCodeAt(0)
```

### PointerEvent (type 5)
```
[5] [button_mask] [x_hi][x_lo] [y_hi][y_lo]
button_mask : bit 0 = clic gauche, bit 1 = milieu, bit 2 = droit
```

---

## 10. Phase 4 — Fin de partie et nettoyage

### Stratégie A : Destruction totale (recommandée pour clones liés)

```http
# Étape 1 : Arrêter la VM de force
POST https://{host}/api2/json/nodes/{node}/qemu/{clone_vmid}/status/stop
Authorization: PVEAPIToken=...
```

```http
# Étape 2 : Supprimer la VM (attendre ~2s après stop)
DELETE https://{host}/api2/json/nodes/{node}/qemu/{clone_vmid}
Authorization: PVEAPIToken=...
```

Après suppression : mettre `status = "ended"` et `ended_at = NOW()` en DB.

### Stratégie B : Snapshot / Rollback (si VM réutilisée)

```http
# Créer un snapshot "état de départ" (à faire une fois après clone)
POST https://{host}/api2/json/nodes/{node}/qemu/{vmid}/snapshot
Content-Type: application/x-www-form-urlencoded
Body: snapname=start&description=Etat+initial+escape+game
```

```http
# Restaurer l'état de départ (reset entre deux parties)
POST https://{host}/api2/json/nodes/{node}/qemu/{vmid}/snapshot/start/rollback
```

---

## 11. Implémentation Next.js

### 11.1 Limitation WebSocket dans Next.js

**L'App Router Next.js ne supporte pas les WebSockets natifs dans les API Routes.**
Il faut un **serveur custom Node.js**.

#### Solution recommandée : `server.ts` à la racine

```ts
// server.ts (à la racine du projet Next.js)
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import { handleVncProxy } from './lib/vncProxy';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res, parse(req.url!, true));
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url!);
    if (pathname === '/api/vnc-proxy') {
      wss.handleUpgrade(req, socket as any, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws, req) => {
    const { query } = parse(req.url!, true);
    const sessionId = query.sessionId as string;
    handleVncProxy(ws, sessionId);
  });

  server.listen(3000, () => console.log('> Ready on http://localhost:3000'));
});
```

Modifier `package.json` :
```json
"scripts": {
  "dev": "ts-node server.ts",
  "build": "next build",
  "start": "NODE_ENV=production ts-node server.ts"
}
```

### 11.2 Structure des fichiers à créer

```
/app
  /api
    /game
      /start/route.ts     ← Phase 1+2 : clone + start VM
      /status/route.ts    ← Phase 2 : poll statut VM
      /end/route.ts       ← Phase 4 : stop + delete VM
  /play
    /[sessionId]/page.tsx ← Page gameplay avec VncViewer
  /scenarios
    /page.tsx             ← Liste des scénarios disponibles
/components
  VncViewer.tsx           ← Canvas + RFB decoder + inputs
/lib
  vncProxy.ts             ← Proxy WebSocket serveur (RFB handshake + tunnel)
  proxmoxApi.ts           ← Helpers fetch vers l'API Proxmox REST
  vncAuth.ts              ← DES encrypt pour VNC Auth
server.ts                 ← Serveur custom HTTP + WebSocket
```

### 11.3 `lib/proxmoxApi.ts` — Client REST Proxmox dynamique

```ts
import https from 'https';

const agent = new https.Agent({ rejectUnauthorized: false });

// Les credentials Proxmox viennent de la DB ou des envars
export function makeProxmoxHeaders(token: string) {
  return { Authorization: token };
}

export async function proxmoxFetch(
  host: string,
  token: string,
  path: string,
  options: RequestInit = {}
) {
  const url = `https://${host}/api2/json${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...makeProxmoxHeaders(token), ...(options.headers ?? {}) },
    // @ts-ignore — node-fetch agent
    agent,
  });
  if (!res.ok) throw new Error(`Proxmox ${options.method ?? 'GET'} ${path} → HTTP ${res.status}`);
  return res.json();
}

// Phase 1 : Lister les nœuds
export async function listNodes(host: string, token: string) {
  const { data } = await proxmoxFetch(host, token, '/nodes');
  return data as Array<{ node: string; status: string }>;
}

// Phase 1 : Lister les VMs d'un nœud
export async function listVMs(host: string, token: string, node: string) {
  const { data } = await proxmoxFetch(host, token, `/nodes/${node}/qemu`);
  return data as Array<{ vmid: number; name: string; template?: number; status: string }>;
}

// Phase 2 : Cloner un template
export async function cloneTemplate(
  host: string, token: string, node: string,
  templateVmid: number, newVmid: number, sessionId: string
) {
  const body = new URLSearchParams({
    newid: String(newVmid),
    name: `escape-${sessionId.slice(0, 8)}`,
    full: '0',
  });
  return proxmoxFetch(host, token, `/nodes/${node}/qemu/${templateVmid}/clone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
}

// Phase 2 : Démarrer une VM
export async function startVM(host: string, token: string, node: string, vmid: number) {
  return proxmoxFetch(host, token, `/nodes/${node}/qemu/${vmid}/status/start`, {
    method: 'POST',
  });
}

// Phase 2 : Vérifier le statut d'une VM
export async function getVMStatus(host: string, token: string, node: string, vmid: number) {
  const { data } = await proxmoxFetch(host, token, `/nodes/${node}/qemu/${vmid}/status/current`);
  return data as { status: string; vmid: number; uptime: number };
}

// Phase 3 : Obtenir un ticket VNC
export async function getVNCTicket(host: string, token: string, node: string, vmid: number) {
  const body = new URLSearchParams({ websocket: '1' });
  const { data } = await proxmoxFetch(host, token, `/nodes/${node}/qemu/${vmid}/vncproxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  return data as { ticket: string; port: number; user: string };
}

// Phase 4 : Arrêter une VM
export async function stopVM(host: string, token: string, node: string, vmid: number) {
  return proxmoxFetch(host, token, `/nodes/${node}/qemu/${vmid}/status/stop`, { method: 'POST' });
}

// Phase 4 : Supprimer une VM
export async function deleteVM(host: string, token: string, node: string, vmid: number) {
  return proxmoxFetch(host, token, `/nodes/${node}/qemu/${vmid}`, { method: 'DELETE' });
}
```

### 11.4 `/api/game/start/route.ts` — Démarre une partie

```ts
import { NextRequest, NextResponse } from 'next/server';
import { cloneTemplate, startVM } from '@/lib/proxmoxApi';
import { db } from '@/lib/db'; // votre client DB (Prisma, Drizzle, etc.)

export async function POST(req: NextRequest) {
  const { scenarioId, playerId } = await req.json();

  // 1. Charger le scénario et le serveur Proxmox depuis la DB
  const scenario = await db.scenario.findUnique({
    where: { id: scenarioId },
    include: { proxmoxServer: true },
  });
  if (!scenario) return NextResponse.json({ error: 'Scénario introuvable' }, { status: 404 });

  const { host, token, node } = scenario.proxmoxServer;

  // 2. Générer un VMID unique (ex: 1000 + auto-incr en DB ou séquence)
  const newVmid = await db.getNextVmid(); // implémenter selon votre DB

  // 3. Créer la session en DB
  const session = await db.gameSession.create({
    data: { scenarioId, playerId, cloneVmid: newVmid, cloneNode: node, status: 'cloning' },
  });

  try {
    // 4. Cloner le template
    await cloneTemplate(host, token, node, scenario.templateVmid, newVmid, session.id);

    // 5. Attendre ~2s (le clone lié est quasi-instantané)
    await new Promise(r => setTimeout(r, 2000));

    // 6. Démarrer la VM
    await startVM(host, token, node, newVmid);
    await db.gameSession.update({ where: { id: session.id }, data: { status: 'starting' } });

    return NextResponse.json({ sessionId: session.id, status: 'starting' });
  } catch (err: any) {
    await db.gameSession.update({ where: { id: session.id }, data: { status: 'error' } });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

### 11.5 `/api/game/status/route.ts` — Polling statut VM

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getVMStatus } from '@/lib/proxmoxApi';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId')!;

  const session = await db.gameSession.findUnique({
    where: { id: sessionId },
    include: { scenario: { include: { proxmoxServer: true } } },
  });
  if (!session) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 });

  const { host, token } = session.scenario.proxmoxServer;
  const vmStatus = await getVMStatus(host, token, session.cloneNode, session.cloneVmid);

  if (vmStatus.status === 'running') {
    await db.gameSession.update({ where: { id: sessionId }, data: { status: 'running' } });
    return NextResponse.json({
      status: 'running',
      wsUrl: `/api/vnc-proxy?sessionId=${sessionId}`,
    });
  }

  return NextResponse.json({ status: vmStatus.status });
}
```

### 11.6 `lib/vncProxy.ts` — Proxy WebSocket complet

```ts
import WebSocket from 'ws';
import https from 'https';
import { getVNCTicket } from './proxmoxApi';
import { db } from './db';

const agent = new https.Agent({ rejectUnauthorized: false });

export async function handleVncProxy(clientWs: WebSocket, sessionId: string) {
  let proxmoxWs: WebSocket | null = null;

  try {
    // Charger les infos de session depuis la DB
    const session = await db.gameSession.findUnique({
      where: { id: sessionId },
      include: { scenario: { include: { proxmoxServer: true } } },
    });
    if (!session || session.status !== 'running') {
      clientWs.close(1008, 'Session invalide ou VM non prête');
      return;
    }

    const { host, token } = session.scenario.proxmoxServer;
    const { cloneNode: node, cloneVmid: vmid } = session;

    // ── Phase 3.1 : Ticket VNC ──────────────────────────────────────────
    const { ticket, port } = await getVNCTicket(host, token, node, vmid);

    // ── Phase 3.2 : Connexion WebSocket Proxmox ─────────────────────────
    const wsUrl = `wss://${host}/api2/json/nodes/${node}/qemu/${vmid}/vncwebsocket`
                + `?port=${port}&vncticket=${encodeURIComponent(ticket)}`;

    proxmoxWs = new WebSocket(wsUrl, { headers: { Authorization: token }, agent } as any);

    await new Promise<void>((resolve, reject) => {
      proxmoxWs!.once('open', resolve);
      proxmoxWs!.once('error', reject);
    });

    // ── Phase 3.3 : Handshake RFB avec Proxmox ──────────────────────────
    const serverInit = await performRfbHandshake(proxmoxWs, ticket);

    // ── Phase 3.4 : Handshake RFB avec le navigateur (No Auth) ──────────
    await performBrowserHandshake(clientWs, serverInit);

    // ── Mode tunnel ───────────────────────────────────────────────────────
    proxmoxWs.on('message', (data) => {
      if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data);
    });
    clientWs.on('message', (data) => {
      if (proxmoxWs!.readyState === WebSocket.OPEN) proxmoxWs!.send(data);
    });

    const cleanup = () => { proxmoxWs?.close(); };
    proxmoxWs.on('close', cleanup);
    clientWs.on('close', cleanup);

  } catch (err) {
    console.error('[VNC Proxy]', err);
    clientWs.close(1011, 'Erreur proxy');
    proxmoxWs?.close();
  }
}

// ─── Helpers RFB ──────────────────────────────────────────────────────────────

function recvBinary(ws: WebSocket, minBytes = 1): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    ws.once('message', (data) => {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as string, 'binary');
      if (buf.length < minBytes) reject(new Error(`Reçu ${buf.length}B, attendu ${minBytes}B`));
      else resolve(buf);
    });
    ws.once('error', reject);
    ws.once('close', () => reject(new Error('WebSocket fermé pendant handshake')));
  });
}

async function performRfbHandshake(proxWs: WebSocket, ticket: string): Promise<Buffer> {
  await recvBinary(proxWs, 12);                          // version Proxmox
  proxWs.send(Buffer.from('RFB 003.008\n'));             // notre version

  const secData = await recvBinary(proxWs, 2);
  const numTypes = secData[0];
  const types = [...secData.slice(1, 1 + numTypes)];

  if (types.includes(1)) {
    proxWs.send(Buffer.from([1]));                       // choisir None
    await recvBinary(proxWs, 4);                         // SecurityResult
  } else if (types.includes(2)) {
    proxWs.send(Buffer.from([2]));                       // choisir VNC Auth
    const challenge = await recvBinary(proxWs, 16);      // challenge 16 bytes
    proxWs.send(vncDesEncrypt(challenge, ticket));        // réponse DES
    const result = await recvBinary(proxWs, 4);
    if (result.readUInt32BE(0) !== 0) throw new Error('VNC Auth échouée (ticket expiré ?)');
  } else {
    throw new Error(`Types sécurité non supportés : ${types}`);
  }

  proxWs.send(Buffer.from([1]));                         // ClientInit shared=1
  return recvBinary(proxWs, 24);                         // ServerInit
}

async function performBrowserHandshake(clientWs: WebSocket, serverInit: Buffer) {
  clientWs.send(Buffer.from('RFB 003.008\n'));
  await recvBinary(clientWs, 12);
  clientWs.send(Buffer.from([1, 1]));                    // 1 type: None
  await recvBinary(clientWs, 1);
  clientWs.send(Buffer.from([0, 0, 0, 0]));             // SecurityResult OK
  await recvBinary(clientWs, 1);                        // ClientInit
  clientWs.send(serverInit);                            // ServerInit Proxmox
}

function vncDesEncrypt(challenge: Buffer, ticket: string): Buffer {
  const key = Buffer.alloc(8);
  for (let i = 0; i < 8; i++) {
    const byte = i < ticket.length ? ticket.charCodeAt(i) : 0;
    let rev = 0;
    for (let bit = 0; bit < 8; bit++) rev = (rev << 1) | ((byte >> bit) & 1);
    key[i] = rev;
  }
  const forge = require('node-forge');
  const c = forge.cipher.createCipher('DES-ECB', forge.util.createBuffer(key.toString('binary')));
  c.start();
  c.update(forge.util.createBuffer(challenge.toString('binary')));
  c.finish();
  return Buffer.from(c.output.getBytes(), 'binary');
}
```

### 11.7 `components/VncViewer.tsx` — Composant React complet

```tsx
'use client';
import { useCallback, useEffect, useRef } from 'react';

const KEY_MAP: Record<string, number> = {
  Enter:0xFF0D, Backspace:0xFF08, Tab:0xFF09, Escape:0xFF1B, Delete:0xFFFF,
  Insert:0xFF63, Home:0xFF50, End:0xFF57, PageUp:0xFF55, PageDown:0xFF56,
  ArrowUp:0xFF52, ArrowDown:0xFF54, ArrowLeft:0xFF51, ArrowRight:0xFF53,
  F1:0xFFBE,F2:0xFFBF,F3:0xFFC0,F4:0xFFC1,F5:0xFFC2,F6:0xFFC3,
  F7:0xFFC4,F8:0xFFC5,F9:0xFFC6,F10:0xFFC7,F11:0xFFC8,F12:0xFFC9,
  Control:0xFFE3, Alt:0xFFE9, Shift:0xFFE1, Meta:0xFFEB, ' ':0x0020,
};

interface Props { sessionId: string; wsUrl: string; }

export default function VncViewer({ sessionId, wsUrl }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef     = useRef<WebSocket | null>(null);
  const stateRef  = useRef('handshake_version');
  const bufRef    = useRef(new Uint8Array(0));
  const fmt       = useRef({ w:0, h:0, bpp:32, bigEndian:0, rS:16, gS:8, bS:0 });

  const getCtx = () => canvasRef.current?.getContext('2d') ?? null;
  const append = (a: Uint8Array, b: Uint8Array) => {
    const t = new Uint8Array(a.length + b.length); t.set(a); t.set(b, a.length); return t;
  };

  const send = useCallback((data: Uint8Array | string) => {
    wsRef.current?.readyState === WebSocket.OPEN && wsRef.current.send(data);
  }, []);

  const sendFBU = useCallback((inc: boolean) => {
    const { w, h } = fmt.current;
    send(new Uint8Array([3, inc?1:0, 0,0,0,0, (w>>8)&0xFF,w&0xFF, (h>>8)&0xFF,h&0xFF]));
  }, [send]);

  const drawRaw = useCallback((x:number,y:number,w:number,h:number,px:Uint8Array) => {
    const c = getCtx(); if (!c || !w || !h) return;
    const img = c.createImageData(w, h);
    for (let p = 0; p < w*h; p++) {
      // Proxmox : BGRA little-endian
      img.data[p*4]   = px[p*4+2];
      img.data[p*4+1] = px[p*4+1];
      img.data[p*4+2] = px[p*4+0];
      img.data[p*4+3] = 255;
    }
    c.putImageData(img, x, y);
  }, []);

  const parseFBU = useCallback((): boolean => {
    const buf = bufRef.current;
    if (buf.length < 4) return false;
    const nr = (buf[2]<<8)|buf[3]; let off = 4;
    for (let i = 0; i < nr; i++) {
      if (buf.length < off+12) return false;
      const x=(buf[off]<<8)|buf[off+1], y=(buf[off+2]<<8)|buf[off+3];
      const w=(buf[off+4]<<8)|buf[off+5], h=(buf[off+6]<<8)|buf[off+7];
      const enc = new DataView(buf.buffer, buf.byteOffset+off+8, 4).getInt32(0, false);
      off += 12;
      if (enc === 0) {                             // Raw
        const plen = w*h*4;
        if (buf.length < off+plen) return false;
        drawRaw(x, y, w, h, buf.slice(off, off+plen)); off += plen;
      } else if (enc === 1) {                      // CopyRect
        if (buf.length < off+4) return false;
        const sx=(buf[off]<<8)|buf[off+1], sy=(buf[off+2]<<8)|buf[off+3];
        getCtx()?.drawImage(canvasRef.current!, sx, sy, w, h, x, y, w, h);
        off += 4;
      } else if (enc === -223) {                   // DesktopSize
        fmt.current.w = w; fmt.current.h = h;
        if (canvasRef.current) { canvasRef.current.width=w; canvasRef.current.height=h; }
      } else { return false; }
    }
    bufRef.current = buf.slice(off);
    sendFBU(true);
    return true;
  }, [drawRaw, sendFBU]);

  const parseMsg = useCallback((): boolean => {
    const buf = bufRef.current;
    if (!buf.length) return false;
    if (buf[0]===0) return parseFBU();
    if (buf[0]===2) { bufRef.current=buf.slice(1); return true; }
    if (buf[0]===1) {
      if (buf.length<6) return false;
      const n=(buf[4]<<8)|buf[5]; if (buf.length<6+n*6) return false;
      bufRef.current=buf.slice(6+n*6); return true;
    }
    if (buf[0]===3) {
      if (buf.length<8) return false;
      const len=new DataView(buf.buffer,buf.byteOffset+4,4).getUint32(0,false);
      if (buf.length<8+len) return false;
      bufRef.current=buf.slice(8+len); return true;
    }
    return false;
  }, [parseFBU]);

  const processRFB = useCallback((data: Uint8Array) => {
    const state = stateRef.current;
    if (state==='handshake_version') {
      send(new TextEncoder().encode('RFB 003.008\n'));
      stateRef.current = 'handshake_security';
    } else if (state==='handshake_security') {
      send(new Uint8Array([1]));
      stateRef.current = 'handshake_secresult';
    } else if (state==='handshake_secresult') {
      if (new DataView(data.buffer,data.byteOffset).getUint32(0,false)!==0) return;
      send(new Uint8Array([1]));
      stateRef.current = 'handshake_serverinit';
      if (data.length>4) processRFB(data.slice(4));
    } else if (state==='handshake_serverinit') {
      if (data.length<4) return;
      const dv = new DataView(data.buffer, data.byteOffset);
      const w=dv.getUint16(0,false), h=dv.getUint16(2,false);
      fmt.current = { w, h, bpp:data[4], bigEndian:data[6], rS:data[14], gS:data[15], bS:data[16] };
      if (canvasRef.current) { canvasRef.current.width=w; canvasRef.current.height=h; }
      // SetEncodings : Raw(0) + CopyRect(1) + DesktopSize(-223=0xFFFFFF21)
      send(new Uint8Array([2,0,0,3, 0,0,0,0, 0,0,0,1, 0xFF,0xFF,0xFF,0x21]));
      stateRef.current = 'connected';
      bufRef.current = new Uint8Array(0);
      sendFBU(false);
    } else if (state==='connected') {
      bufRef.current = append(bufRef.current, data);
      let cont = true;
      while (cont && bufRef.current.length>0) cont = parseMsg();
    }
  }, [send, sendFBU, parseMsg]);

  useEffect(() => {
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;
    stateRef.current = 'handshake_version';
    ws.onmessage = (e) => processRFB(new Uint8Array(e.data));
    ws.onerror = () => console.error('[VNC] WebSocket erreur');
    ws.onclose = (e) => console.log('[VNC] Fermé', e.code, e.reason);
    return () => ws.close();
  }, [wsUrl, processRFB]);

  const sendKey = (key: string, down: boolean) => {
    const k = KEY_MAP[key] ?? (key.length===1 ? key.charCodeAt(0) : 0);
    if (!k) return;
    send(new Uint8Array([4, down?1:0, 0,0, (k>>24)&0xFF,(k>>16)&0xFF,(k>>8)&0xFF,k&0xFF]));
  };
  const sendPtr = (x:number, y:number, mask:number) =>
    send(new Uint8Array([5, mask, (x>>8)&0xFF,x&0xFF, (y>>8)&0xFF,y&0xFF]));

  return (
    <canvas
      ref={canvasRef}
      tabIndex={0}
      style={{ display:'block', cursor:'crosshair', background:'#000' }}
      onMouseMove={e => { const r=e.currentTarget.getBoundingClientRect(); sendPtr(Math.round(e.clientX-r.left),Math.round(e.clientY-r.top),0); }}
      onMouseDown={e => { const r=e.currentTarget.getBoundingClientRect(); sendPtr(Math.round(e.clientX-r.left),Math.round(e.clientY-r.top),1<<e.button); }}
      onMouseUp={e   => { const r=e.currentTarget.getBoundingClientRect(); sendPtr(Math.round(e.clientX-r.left),Math.round(e.clientY-r.top),0); }}
      onContextMenu={e => e.preventDefault()}
      onKeyDown={e => { e.preventDefault(); sendKey(e.key, true); }}
      onKeyUp={e   => { e.preventDefault(); sendKey(e.key, false); }}
    />
  );
}
```

### 11.8 Page gameplay `/app/play/[sessionId]/page.tsx`

```tsx
'use client';
import { useEffect, useState } from 'react';
import VncViewer from '@/components/VncViewer';

export default function PlayPage({ params }: { params: { sessionId: string } }) {
  const [wsUrl, setWsUrl]   = useState<string | null>(null);
  const [status, setStatus] = useState('Démarrage de la VM...');

  useEffect(() => {
    let attempts = 0;
    const poll = async () => {
      const res = await fetch(`/api/game/status?sessionId=${params.sessionId}`);
      const data = await res.json();
      if (data.status === 'running') {
        setWsUrl(data.wsUrl);
        setStatus('Connecté');
      } else if (++attempts < 30) {
        setStatus(`VM en cours de démarrage... (${data.status})`);
        setTimeout(poll, 2000);
      } else {
        setStatus('Timeout : VM non disponible');
      }
    };
    poll();
  }, [params.sessionId]);

  return (
    <div style={{ background: '#000', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {!wsUrl ? (
        <p style={{ color: '#00ff00', fontFamily: 'monospace' }}>{status}</p>
      ) : (
        <VncViewer sessionId={params.sessionId} wsUrl={wsUrl} />
      )}
    </div>
  );
}
```

---

## 12. Dépendances npm

```bash
npm install ws node-forge
npm install -D @types/ws ts-node typescript
```

| Package      | Usage                                          |
|--------------|------------------------------------------------|
| `ws`         | Serveur + client WebSocket côté Node.js        |
| `node-forge` | Chiffrement DES pour VNC Auth                  |

---

## 13. Récapitulatif de la chaîne complète

```
[Joueur]    POST /api/game/start?scenarioId=X
              ↳ Lit DB : template_vmid, proxmox_host, proxmox_token, node
              ↳ Proxmox POST /clone → newVmid
              ↳ Proxmox POST /status/start
              ↳ Écrit en DB : cloneVmid, status="starting"
              ↳ Retourne { sessionId }

[Joueur]    polling GET /api/game/status?sessionId=Y  (toutes les 2s)
              ↳ Proxmox GET /status/current → attend "running"
              ↳ Retourne { wsUrl: "/api/vnc-proxy?sessionId=Y" }

[Joueur]    Ouvre VncViewer → WebSocket ws://app/api/vnc-proxy?sessionId=Y
              ↳ Next.js lit DB : host, token, node, cloneVmid
              ↳ Proxmox POST /vncproxy → ticket (60s)
              ↳ Proxmox WSS /vncwebsocket?port=X&vncticket=ticket_encodé
              ↳ Handshake RFB avec Proxmox (version + VNC Auth DES)
              ↳ Mini-handshake RFB avec navigateur (No Auth)
              ↳ Tunnel binaire bidirectionnel actif

[Fin partie] POST /api/game/end?sessionId=Y
              ↳ Proxmox POST /status/stop
              ↳ Proxmox DELETE /{cloneVmid}
              ↳ Écrit en DB : status="ended", ended_at=NOW()
```

---

## 14. Checklist pour l'IA implémentant ce projet

- [ ] `.env.local` : `PROXMOX_HOST`, `PROXMOX_TOKEN`, `PROXMOX_NODE`
- [ ] Schéma DB : tables `proxmox_servers`, `scenarios`, `game_sessions`
- [ ] `server.ts` : serveur custom HTTP + WebSocketServer sur `/api/vnc-proxy`
- [ ] `lib/proxmoxApi.ts` : toutes les fonctions REST Proxmox (dynamiques)
- [ ] `lib/vncProxy.ts` : proxy WebSocket (lit session en DB, handshake RFB, tunnel)
- [ ] `/api/game/start` : clone + start + écriture session en DB
- [ ] `/api/game/status` : polling statut VM Proxmox
- [ ] `/api/game/end` : stop + delete VM + maj DB
- [ ] `components/VncViewer.tsx` : canvas + décodeur RFB + clavier + souris
- [ ] `/app/play/[sessionId]/page.tsx` : polling status → affichage VNC
- [ ] Vérifier que la VM template (`template=1`) existe sur Proxmox
- [ ] Vérifier que le token a les droits `VM.Clone`, `VM.PowerMgmt`, `VM.Console`, `VM.Audit`
