# Depois da Meia-Noite

Jogo de aventura narrativa / point-and-click com cenários fotográficos cinematográficos. Roda 100% no navegador como HTML estático + imagens, com WebAudio nativa, hotspots clicáveis e parallax sutil de câmera.

## Stack

- **Hosting:** Vercel (build estático)
- **Backend/DB:** Firebase (Auth anônimo + Firestore — saves, placar, analytics)
- **Engine:** motor próprio de cenas 2D (backdrops em `img/` + hotspots em %), zero dependências locais

## Desenvolvimento local

```bash
npm install
npm run dev
```

Abre o jogo sem persistência (sem as variáveis `VITE_FIREBASE_*` o jogo roda normalmente, apenas sem save na nuvem).

## Build de produção

```bash
cp .env.example .env   # preencha com a config do seu projeto Firebase
npm install
npm run build           # gera dist/index.html com a config injetada
```

## Deploy

O projeto está configurado para deploy automático no Vercel (`vercel.json`). Configure as variáveis de ambiente no painel do Vercel:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

## Banco de dados (Firebase)

Projeto: **depois-da-meia-noite**. Habilite no console do Firebase:

1. **Authentication → Sign-in method → Anônimo** (identifica sessões sem login)
2. **Firestore Database** (modo produção), com as collections:
   - `saves/{sessionId}` — um documento por sessão (uid do auth anônimo), upsert a cada progresso
   - `scores` — um documento por finalização (Final A ou B), com `score_value` para ordenar o leaderboard
   - `puzzle_events` — analytics opcional de tentativas/dicas por puzzle

As regras de segurança estão em `firestore.rules` (publique com `firebase deploy --only firestore:rules` ou cole no console em Firestore → Regras).

## Estrutura

```
depois-da-meia-noite/
├── depois-da-meia-noite.html   ← fonte principal (não editar dist)
├── img/                        ← cenários fotográficos e avatares (apt, aptN, bar, rua, rodo, plat…)
├── build.js                    ← injeta env vars e copia img/ para dist/
├── package.json
├── .env.example                ← template de variáveis (não commitar .env real)
├── vercel.json
└── dist/                       ← gerado pelo build, servido pelo Vercel
```
