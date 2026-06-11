// build.js — injeta env vars no HTML e copia para dist/
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { config } from 'dotenv'
config()

const html = readFileSync('depois-da-meia-noite.html', 'utf8')
const out = html.replace(
  '/* __SUPABASE_CONFIG__ */',
  `const SUPABASE_URL = "${process.env.VITE_SUPABASE_URL || ''}";
   const SUPABASE_ANON_KEY = "${process.env.VITE_SUPABASE_ANON_KEY || ''}";`
)
mkdirSync('dist', { recursive: true })
writeFileSync('dist/index.html', out)
console.log('Build ok →', 'dist/index.html')
