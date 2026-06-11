# BRIEFING — Depois da Meia-Noite
> Documento para o Claude Code. Leia inteiro antes de executar qualquer comando.

---

## O que é este projeto

**"Depois da Meia-Noite"** é um jogo de aventura narrativa / escape room em primeira pessoa, inspirado em The White Room 3D. Roda 100% no navegador como um único arquivo HTML estático (~170kb). Foi desenvolvido inteiramente nesta conversa e está funcional e completo.

- **Engine:** Three.js r128 (CDN), WebAudio API nativa, zero dependências locais
- **Arquivo principal:** `depois-da-meia-noite.html`
- **Tamanho atual:** ~170kb, ~2300 linhas
- **Status:** jogo completo, validado, pronto para publicação

---

## Stack desejada

| Camada | Tecnologia | Finalidade |
|---|---|---|
| Repositório | GitHub | versionamento + fonte do deploy |
| Hosting | Vercel | deploy automático a cada push |
| Backend/DB | Supabase | saves, placar, analytics |
| Autenticação | Supabase Auth (anônimo) | identificar sessões sem login |

---

## O que o jogo faz hoje

### Mecânicas implementadas
- **5 atos, 6 cenários 3D** em primeira pessoa com raycasting (Three.js)
- **10 puzzles** completos com dicas progressivas
- **12 lampejos** (fragmentos de memória) colecionáveis
- **Quadro de Memórias** — linha do tempo posicionável
- **Inventário** com "examinar a fundo" e combinação de itens
- **Caderno de Hipóteses** — combinar pistas para deduções
- **3 finais** (A, B, C) dependentes das escolhas do jogador
- **Síntese de áudio** via WebAudio (tons, efeitos, melodia jogável)
- **Red herrings** todos implementados com resolução

### Cenários 3D
1. **Apartamento (dia)** — quarto com suporte vazio de guitarra, celular, jaqueta, calça, carta antiga
2. **Bar Subsolo** — palco com bateria, jukebox, balcão neon, Tonho
3. **O Quarteirão** — food truck do Edmilson, farmácia 24h, ponto de táxi
4. **Rodoviária Central** — guarda-volumes, armário 7, painel de partidas
5. **Apartamento (noite)** — rádio do pai, guitarra recuperada, melodia
6. **Plataforma 12** — amanhecer, ônibus, cena final

### Estado do jogo (variável `S` no JS)
```js
S = {
  scene: "apt",        // cena atual
  inv: {},             // itens no inventário
  clues: {},           // pistas coletadas
  lamps: {},           // lampejos desbloqueados
  slots: Array(12),    // posições na linha do tempo
  f: { /* ~40 flags de progresso */ }
}
```

---

## O que precisa ser implementado

### 1. Supabase — Schema do banco

Execute este SQL no Supabase SQL Editor após criar o projeto:

```sql
-- Sessões anônimas
create table sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  last_seen timestamptz default now(),
  device_hint text -- user agent resumido
);

-- Saves de progresso (um por sessão, upsert)
create table saves (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  saved_at timestamptz default now(),
  scene text,
  inventory jsonb default '{}',
  clues jsonb default '{}',
  lamps jsonb default '{}',
  slots jsonb default '[]',
  flags jsonb default '{}',
  act_reached int default 1,  -- 1-5, para analytics
  unique(session_id)           -- só 1 save por sessão (upsert)
);

-- Placar / Hall da Fama
create table scores (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  player_name text not null check(length(player_name) between 1 and 32),
  ending text not null check(ending in ('A','B','C')),
  lamps_count int default 0,
  timeline_perfect boolean default false,
  music_completed boolean default false,
  old_letter_read boolean default false,
  time_seconds int,            -- segundos do início ao fim
  finished_at timestamptz default now()
);

-- Analytics de puzzles (para saber onde os jogadores travam)
create table puzzle_events (
  id bigserial primary key,
  session_id uuid references sessions(id) on delete cascade,
  puzzle_id text not null,    -- "charger", "pattern", "audio", etc.
  event text not null,        -- "attempt", "hint_used", "solved"
  attempt_number int default 1,
  ts timestamptz default now()
);

-- Views úteis
create view leaderboard as
  select
    row_number() over (order by
      case ending when 'A' then 3 when 'B' then 2 else 1 end desc,
      lamps_count desc,
      (timeline_perfect::int + music_completed::int + old_letter_read::int) desc,
      time_seconds asc nulls last
    ) as rank,
    player_name,
    ending,
    lamps_count,
    timeline_perfect,
    music_completed,
    time_seconds,
    finished_at
  from scores
  order by rank
  limit 100;

-- RLS: sessão só acessa seus próprios dados
alter table saves enable row level security;
alter table puzzle_events enable row level security;
create policy "session owns save" on saves
  for all using (session_id = current_setting('app.session_id', true)::uuid);
create policy "session owns events" on puzzle_events
  for all using (session_id = current_setting('app.session_id', true)::uuid);
-- scores e leaderboard são públicos (leitura)
alter table scores enable row level security;
create policy "scores public read" on scores for select using (true);
create policy "session inserts score" on scores
  for insert with check (session_id = current_setting('app.session_id', true)::uuid);
```

### 2. Variáveis de ambiente necessárias

Criar arquivo `.env` (e configurar no Vercel):
```
VITE_SUPABASE_URL=https://XXXX.supabase.co
VITE_SUPABASE_ANON_KEY=eyJXXXX...
```

> **Atenção:** o projeto atual é HTML puro sem bundler. Há duas opções:
> - **Opção A (simples):** substituir as variáveis diretamente no HTML no momento do deploy via script de build
> - **Opção B (melhor):** adicionar um `build.js` minimalista que injeta as env vars e gera o `dist/index.html`

Recomendo a **Opção B**. Veja o script abaixo.

### 3. Script de build (`build.js`)

```js
// build.js — injeta env vars no HTML e copia para dist/
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { config } from 'dotenv'
config()

const html = readFileSync('depois-da-meia-noite.html', 'utf8')
const out = html.replace(
  '/* __SUPABASE_CONFIG__ */',
  `const SUPABASE_URL = "${process.env.VITE_SUPABASE_URL}";
   const SUPABASE_ANON_KEY = "${process.env.VITE_SUPABASE_ANON_KEY}";`
)
mkdirSync('dist', { recursive: true })
writeFileSync('dist/index.html', out)
console.log('Build ok →', 'dist/index.html')
```

### 4. Código Supabase a injetar no jogo

No `depois-da-meia-noite.html`, logo após `<script src="three.min.js">`, adicionar:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
```

E no início do script do jogo, após `"use strict";`, adicionar o módulo de persistência:

```js
/* __SUPABASE_CONFIG__ */  // ← build.js substitui isso

/* ---------- SUPABASE ---------- */
const DB = (typeof SUPABASE_URL !== 'undefined')
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

let SESSION_ID = localStorage.getItem('dmn_session');

async function dbInit() {
  if (!DB) return;
  if (!SESSION_ID) {
    const { data } = await DB.from('sessions').insert({
      device_hint: navigator.userAgent.slice(0, 80)
    }).select('id').single();
    SESSION_ID = data?.id;
    localStorage.setItem('dmn_session', SESSION_ID);
  } else {
    await DB.from('sessions').update({ last_seen: new Date() }).eq('id', SESSION_ID);
  }
}

async function dbSave() {
  if (!DB || !SESSION_ID) return;
  await DB.from('saves').upsert({
    session_id: SESSION_ID,
    saved_at: new Date(),
    scene: S.scene,
    inventory: S.inv,
    clues: S.clues,
    lamps: S.lamps,
    slots: S.slots,
    flags: S.f,
    act_reached: getActNumber()
  }, { onConflict: 'session_id' });
}

async function dbLoad() {
  if (!DB || !SESSION_ID) return false;
  const { data } = await DB.from('saves')
    .select('*').eq('session_id', SESSION_ID).single();
  if (!data) return false;
  Object.assign(S.inv, data.inventory);
  Object.assign(S.clues, data.clues);
  Object.assign(S.lamps, data.lamps);
  S.slots = data.slots;
  Object.assign(S.f, data.flags);
  return data.scene;
}

async function dbScore(playerName, endingType) {
  if (!DB || !SESSION_ID) return;
  await DB.from('scores').insert({
    session_id: SESSION_ID,
    player_name: playerName,
    ending: endingType,
    lamps_count: lampCount(),
    timeline_perfect: timelinePerfect(),
    music_completed: S.f.musica,
    old_letter_read: S.f.cartaAntiga,
    time_seconds: Math.floor((Date.now() - gameStartTime) / 1000)
  });
}

async function dbPuzzleEvent(puzzleId, event, attempt = 1) {
  if (!DB || !SESSION_ID) return;
  await DB.from('puzzle_events').insert({
    session_id: SESSION_ID,
    puzzle_id: puzzleId,
    event,
    attempt_number: attempt
  });
}

async function dbLeaderboard() {
  if (!DB) return [];
  const { data } = await DB.from('leaderboard').select('*').limit(20);
  return data || [];
}

function getActNumber() {
  if (S.f.rodoOpen) return 4;
  if (S.f.ruaOpen) return 3;
  if (S.f.barOpen) return 2;
  return 1;
}

let gameStartTime = Date.now();
```

### 5. Pontos de integração no código do jogo

Após ter o módulo acima, adicione estas chamadas nos pontos certos:

```js
// No startBtn.onclick — após remover a tela de título:
await dbInit();
const savedScene = await dbLoad();
if (savedScene) {
  // mostrar modal "Continuar de onde parou?"
  showContinueModal(savedScene);
} else {
  gameStartTime = Date.now();
  actCard("ATO 1", ...);
}

// Após cada puzzle resolvido — chamar dbSave():
// ex: no final de setlistDone(), puzzleTaxi(), openLocker(), etc.
dbSave(); // não precisa await, fire-and-forget

// No ending() — antes de mostrar o card final:
if (tipo !== 'C') {
  const name = await promptPlayerName();
  await dbScore(name, tipo);
}

// Chamar dbPuzzleEvent nos puzzles principais:
// ex: no início de puzzleArmario(): dbPuzzleEvent('armario', 'attempt', ++tentativas)
// ex: quando acerta: dbPuzzleEvent('armario', 'solved', tentativas)
```

### 6. Modal de placar (adicionar ao HTML)

```js
async function openLeaderboard() {
  const rows = await dbLeaderboard();
  const html = `
    <table style="width:100%;border-collapse:collapse;font-family:var(--mono);font-size:13px">
      <tr style="color:var(--dim)"><th>#</th><th>Nome</th><th>Final</th><th>Lampejos</th><th>Tempo</th></tr>
      ${rows.map(r => `
        <tr style="border-top:1px solid var(--line)">
          <td style="color:var(--neon);padding:8px 4px">${r.rank}</td>
          <td style="padding:8px 4px">${r.player_name}</td>
          <td style="padding:8px 4px;color:${r.ending==='A'?'var(--ok)':r.ending==='B'?'var(--warm)':'var(--dim)'}">${r.ending==='A'?'★ A':r.ending==='B'?'B':'C'}</td>
          <td style="padding:8px 4px">${r.lamps_count}/12</td>
          <td style="padding:8px 4px;color:var(--dim)">${r.time_seconds?Math.floor(r.time_seconds/60)+'m':'-'}</td>
        </tr>`).join('')}
    </table>`;
  modal('🏆 Hall da Fama', html, 'top 20 jogadores');
}
```

---

## Estrutura de arquivos após o build

```
depois-da-meia-noite/
├── depois-da-meia-noite.html   ← fonte principal (não editar dist)
├── build.js                    ← injeta env vars
├── package.json
├── .env                        ← NUNCA commitar (já no .gitignore)
├── .env.example                ← commitar (sem valores)
├── .gitignore
├── vercel.json
├── README.md
└── dist/
    └── index.html              ← gerado pelo build, servido pelo Vercel
```

### `package.json`
```json
{
  "name": "depois-da-meia-noite",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "node build.js",
    "dev": "npx serve . -p 3000"
  },
  "devDependencies": {
    "dotenv": "^16.0.0"
  }
}
```

### `vercel.json`
```json
{
  "buildCommand": "node build.js",
  "outputDirectory": "dist",
  "installCommand": "npm install"
}
```

### `.gitignore`
```
.env
node_modules/
dist/
```

### `.env.example`
```
VITE_SUPABASE_URL=https://XXXX.supabase.co
VITE_SUPABASE_ANON_KEY=eyJXXXX...
```

---

## Roteiro de execução para o Claude Code

Execute nesta ordem exata:

1. **Criar estrutura do projeto**
   - Criar `package.json`, `vercel.json`, `.gitignore`, `.env.example`, `build.js`
   - Confirmar que `depois-da-meia-noite.html` está na raiz

2. **Criar repositório GitHub**
   ```bash
   gh repo create depois-da-meia-noite --public --source=. --remote=origin --push
   ```

3. **Criar projeto Supabase** (via CLI ou pedir URL/key ao usuário)
   ```bash
   npx supabase init
   # ou pedir ao usuário para criar em supabase.com e fornecer URL + anon key
   ```

4. **Criar as tabelas** — rodar o SQL da seção "Schema do banco" acima

5. **Configurar `.env`** com as credenciais do Supabase

6. **Injetar o módulo Supabase no HTML**
   - Adicionar `<script src="cdn supabase">` após o Three.js
   - Adicionar o bloco `/* ---------- SUPABASE ---------- */` no início do script
   - Adicionar o placeholder `/* __SUPABASE_CONFIG__ */` no HTML
   - Integrar `dbSave()` após cada puzzle resolvido
   - Integrar `dbLoad()` no `startBtn.onclick`
   - Integrar `dbScore()` e placar no `ending()`
   - Adicionar botão "🏆 Hall da Fama" no HUD

7. **Testar o build**
   ```bash
   npm install
   npm run build
   # abrir dist/index.html no navegador e verificar
   ```

8. **Deploy no Vercel**
   ```bash
   npx vercel --prod
   # ou conectar o repo no dashboard vercel.com
   ```

9. **Configurar env vars no Vercel**
   ```bash
   vercel env add VITE_SUPABASE_URL
   vercel env add VITE_SUPABASE_ANON_KEY
   vercel --prod  # redeploy com as vars
   ```

10. **Push final**
    ```bash
    git add -A && git commit -m "feat: Supabase saves, leaderboard e analytics" && git push
    ```

---

## Contexto narrativo (resumo para referência)

O jogo segue **Gabriel Loreto**, 32 anos, que acorda sem memória de 10 horas com um bilhete no bolso: `"MARINA — 7-41-25 / GVRC"`. O jogador reconstrói a noite explorando o apartamento, o Bar Subsolo, um food truck, uma farmácia 24h, a Rodoviária Central, e chega (ou não) à Plataforma 12 antes do ônibus das 7h.

Os 3 finais:
- **Final A** (melhor): chegou a tempo, linha do tempo 100% completa, música terminada, carta antiga lida → ela perde o ônibus de propósito
- **Final B**: chegou, mas com progresso incompleto → reencontro inconcluso
- **Final C**: desistiu/não chegou → guitarra devolvida pelo correio semanas depois

---

## Notas importantes

- O jogo **não usa cookies** — `localStorage` para session_id é suficiente
- O save é **automático** (fire-and-forget após cada puzzle), não manual
- O leaderboard é **público** (anon read no Supabase) — qualquer um vê
- Os nomes no placar são inseridos pelo jogador ao terminar (Final A ou B)
- O arquivo `depois-da-meia-noite.html` é a **única fonte da verdade** — nunca edite `dist/` diretamente
- Three.js vem do CDN (r128) — sem necessidade de npm install para a engine

