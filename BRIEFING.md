# BRIEFING — Depois da Meia-Noite
> Documento para o Claude Code. Leia inteiro antes de executar qualquer comando.
> Última atualização: Junho de 2026 (reflete o estado atual do código, não o plano original).

---

## O que é este projeto

**"Depois da Meia-Noite"** é um jogo de aventura/escape room em primeira pessoa,
ponto-e-clique, com cenários fotográficos 2D (não 3D). Roda 100% no navegador
como um único arquivo HTML estático. O jogo está **completo, funcional e em
produção** (Vercel).

- **Engine:** HTML/CSS/JS puro, sem framework e sem Three.js. Cenários são
  fotos (`img/*.jpg`) renderizadas em `cover` com leve parallax 2D que segue
  o mouse (`PARA`/`layoutStage()`/`stageLoop()`), vinheta e grão de filme via
  CSS. Hotspots são `div`s posicionados em % sobre a imagem.
- **Áudio:** efeitos sonoros sintetizados via WebAudio (`AC`/`tone()`/`sfx`);
  trilha de fundo em loop (`audio/theme.mp3`, volume 0.18) com botão de
  ligar/desligar no HUD.
- **Arquivo principal:** `depois-da-meia-noite.html` (~2350 linhas).
- **Status:** jogo completo e publicado. Para o detalhamento de todos os atos,
  puzzles, itens, pistas e lampejos com o status de cada um, ver
  [`STATUS-IMPLEMENTACAO.md`](STATUS-IMPLEMENTACAO.md) (e a versão em PDF).
  [`CENARIOS.md`](CENARIOS.md) descreve os itens clicáveis de cada cenário.

---

## Stack em produção

| Camada | Tecnologia | Finalidade |
|---|---|---|
| Repositório | GitHub (`alexpawlow/depois-da-meia-noite`, branch `main`) | versionamento + fonte do deploy |
| Hosting | Vercel (`vercel.json`: `buildCommand: node build.js`, `outputDirectory: dist`) | deploy automático a cada push |
| Backend/DB | **Firebase Firestore** (não Supabase) | saves, placar, analytics |
| Autenticação | Firebase Auth anônimo (`signInAnonymously`) | identificar sessões sem login |
| Build | `build.js` (Node, usa `dotenv`) | injeta `FIREBASE_CONFIG` no lugar de `/* __FIREBASE_CONFIG__ */`, gera `dist/index.html`, copia `img/` e `audio/` para `dist/` |

> Nota histórica: a versão original deste briefing planejava Supabase +
> Three.js r128 (3D com raycasting). O projeto evoluiu para **Firebase +
> cenários fotográficos 2D**, que é o que está implementado e em produção
> hoje. Esta seção e as seguintes descrevem o estado real do código.

---

## Firebase — implementação atual

SDKs via CDN (`firebase-app-compat`, `firebase-auth-compat`,
`firebase-firestore-compat`, v10.13.0), inicializados perto do topo do
`<script>`:

```js
/* __FIREBASE_CONFIG__ */  // ← build.js substitui isso

const FB_APP = (typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG.apiKey && window.firebase)
  ? firebase.initializeApp(FIREBASE_CONFIG)
  : null;
const DB   = FB_APP ? firebase.firestore() : null;
const AUTH = FB_APP ? firebase.auth() : null;
```

### Funções de persistência (já implementadas)
- `dbInit()` — autentica anonimamente (`AUTH.signInAnonymously()`), guarda
  `SESSION_ID = user.uid`.
- `dbSave()` — `DB.collection('saves').doc(SESSION_ID).set({...}, merge)`
  com `scene`, `inv`, `clues`, `lamps`, `slots`, `f`, `saved_at` (server
  timestamp). Chamado fire-and-forget após eventos relevantes (linha ~869).
- `dbLoad()` — lê `saves/{SESSION_ID}`, restaura `S`.
- `dbDeleteSave()` — apaga o save (ex.: ao terminar o jogo / "Jogar de novo").
- `dbScore(playerName, endingType)` — grava em `scores` (final, lampejos,
  linha do tempo, tempo, etc.) com `finished_at` server timestamp.
- `dbPuzzleEvent(puzzleId, event, attempt)` — grava em `puzzle_events` para
  analytics de onde os jogadores travam.
- `dbLeaderboard()` — lê top 20 de `scores` ordenado por `score_value desc`
  (linha ~884, usado pelo Hall da Fama no HUD).

### Coleções Firestore
- `saves` — 1 doc por `SESSION_ID` (uid anônimo), upsert.
- `scores` — Hall da Fama público (leitura pública, escrita só da própria
  sessão).
- `puzzle_events` — analytics, sem leitura pública.

Regras de segurança completas em [`firestore.rules`](firestore.rules).

### Variáveis de ambiente

`.env` (não commitado, configurado também no Vercel):
```
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...
```
`build.js` monta o objeto `FIREBASE_CONFIG` a partir dessas variáveis e
substitui o placeholder `/* __FIREBASE_CONFIG__ */` no HTML final.

---

## Engine 2D — implementação atual

- **Cenários (`SCENES`):** `apt`, `bar`, `rua`, `rodo`, `aptN`, `plat`. Cada
  cena tem `time`, `enter()` (diálogo único de entrada) e `hots()` (lista de
  hotspots retangulares definidos em % da imagem: `{x,y,w,h,l,fn,done}`).
- **Imagens de fundo (`SCENE_ART`):** `img/apt.jpg`, `img/aptN.jpg`,
  `img/bar.jpg`, `img/rua.jpg`, `img/rodo.jpg`, `img/plat.jpg` — fotos 16:9,
  renderizadas em `cover`.
- **Parallax (`PARA`, `initStage()`, `layoutStage()`, `stageLoop()`):**
  desloca levemente a imagem conforme a posição do mouse, com vinheta e grão
  de filme via CSS (`ar:16/9`).
- **Hotspots (`renderHotspots()`):** `div`s posicionados em % sobre a cena,
  com label e clique → `fn()`.
- **Diálogo (`dialog()`/`stepDlg()`):** fila de falas com retrato + nome +
  texto, suporta `choices` ramificadas.
- **Modal genérico (`modal()`/`closeModal()`):** usado por inventário,
  caderno, memórias, celular, mapa e todos os puzzles. Suporta callback
  `onModalClose`.

---

## Conteúdo do jogo (resumo — ver STATUS-IMPLEMENTACAO.md para detalhes)

- **5 atos + Final**, 6 cenários fotográficos.
- **10 puzzles** completos com dicas progressivas (carregador, padrão,
  fragmentos de áudio, cupom, setlist/jukebox, conto do pasteleiro, protocolo
  da farmácia, taxímetro, armário/cadeado, correia + melodia).
- **12 lampejos** (8 obrigatórios + 4 opcionais) — Quadro de Memórias com 12
  posições na linha do tempo.
- **Inventário** (14 itens) com "examinar a fundo" e combinação de itens.
- **Caderno de Hipóteses** (24 pistas, `COMBOS` de deduções).
- **Mapa "Ir para…"** — lista de locais + tela "Ver mapa" com imagem
  ilustrada (`img/mapa.jpg`) e overlays clicáveis para viagem rápida entre
  locais já liberados.
- **Trilha sonora de fundo** (`audio/theme.mp3`, loop, toggle no HUD).
- **3 finais** (A, B, C) + Hall da Fama (placar via Firestore).
- **Red herrings** todos implementados com resolução.

### Estado do jogo (variável `S` no JS)
```js
S = {
  scene: "apt",        // cena atual
  night: false,        // virou a noite?
  inv: {},             // itens no inventário
  clues: {},           // pistas coletadas
  lamps: {},           // lampejos desbloqueados
  slots: Array(12),    // posições na linha do tempo
  f: { /* ~34 flags de progresso */ }
}
```

---

## Estrutura de arquivos

```
depois-da-meia-noite/
├── depois-da-meia-noite.html   ← fonte principal (não editar dist)
├── build.js                    ← injeta FIREBASE_CONFIG, copia img/ e audio/
├── package.json
├── .env                         ← NUNCA commitar (já no .gitignore)
├── .env.example                 ← commitar (sem valores)
├── .gitignore
├── vercel.json
├── firestore.rules
├── README.md
├── BRIEFING.md                  ← este arquivo
├── CENARIOS.md                  ← itens clicáveis por cenário
├── STATUS-IMPLEMENTACAO.md/.pdf ← estado atual de toda a implementação
├── img/                          ← 16 imagens (cenários, avatares, mapa, story)
├── audio/                        ← theme.mp3 (trilha de fundo)
└── dist/
    └── index.html              ← gerado pelo build, servido pelo Vercel
```

---

## Contexto narrativo (resumo para referência)

O jogo segue **Gabriel Loreto**, ~50 anos, roqueiro que acorda sem memória de
10 horas com um bilhete no bolso: `"MARINA — 7-41-25 / GVRC"`. O jogador
reconstrói a noite explorando o apartamento, o Bar Subsolo, um quarteirão
(food truck + farmácia + ponto de táxi), a Rodoviária Central, e chega (ou
não) à Plataforma 12 antes do ônibus das 7h.

Os 3 finais:
- **Final A** ("Depois da Meia-Noite"): chegou a tempo, linha do tempo 100%
  completa, música terminada, carta antiga lida → reencontro pleno.
- **Final B** ("Plataforma 12"): chegou, mas com progresso incompleto →
  reencontro inconcluso.
- **Final C** ("O suporte vazio"): desistiu (escolheu dormir no Ato 5) →
  galeria do que não foi visto.

---

## Notas importantes para futuras sessões

- O jogo **não usa cookies** — `localStorage` guarda preferências (ex.:
  `dmn_music`) e o save principal vive no Firestore, indexado pelo uid
  anônimo do Firebase Auth.
- O save é **automático** (fire-and-forget após eventos relevantes), não
  manual.
- O Hall da Fama é **público** (leitura pública no Firestore) — qualquer um
  vê.
- O arquivo `depois-da-meia-noite.html` é a **única fonte da verdade** —
  nunca edite `dist/` diretamente; rode `node build.js` para gerar o dist.
- Antes de testar localmente, confirme que `.env` tem as chaves
  `FIREBASE_*` (peça ao usuário se faltar) — sem elas o jogo roda igual, mas
  sem persistência (`DB`/`AUTH` ficam `null`).
- Para o detalhamento puzzle-a-puzzle, item-a-item e o changelog de mudanças
  recentes, consulte sempre [`STATUS-IMPLEMENTACAO.md`](STATUS-IMPLEMENTACAO.md)
  primeiro — é o documento mais atualizado.
