# Depois da Meia-Noite

Jogo de aventura narrativa / escape room em primeira pessoa, inspirado em *The White Room 3D*. Roda 100% no navegador como um único arquivo HTML estático, com Three.js (CDN) e WebAudio nativa.

## Stack

- **Hosting:** Vercel (build estático)
- **Backend/DB:** Supabase (saves, placar, analytics)
- **Engine:** Three.js r128 via CDN, zero dependências locais

## Desenvolvimento local

```bash
npm install
npm run dev
```

Abre o jogo sem persistência (sem `SUPABASE_URL`/`SUPABASE_ANON_KEY` o jogo roda normalmente, apenas sem save na nuvem).

## Build de produção

```bash
cp .env.example .env   # preencha com suas credenciais Supabase
npm install
npm run build           # gera dist/index.html com as credenciais injetadas
```

## Deploy

O projeto está configurado para deploy automático no Vercel (`vercel.json`). Configure as variáveis de ambiente no painel do Vercel:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Banco de dados (Supabase)

O schema (tabelas `sessions`, `saves`, `scores`, `puzzle_events`, view `leaderboard` e políticas RLS) está documentado em `BRIEFING.md`.

## Estrutura

```
depois-da-meia-noite/
├── depois-da-meia-noite.html   ← fonte principal (não editar dist)
├── build.js                    ← injeta env vars
├── package.json
├── .env.example                ← template de variáveis (não commitar .env real)
├── vercel.json
└── dist/                       ← gerado pelo build, servido pelo Vercel
```
