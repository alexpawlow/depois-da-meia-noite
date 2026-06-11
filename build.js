// build.js — injeta config do Firebase no HTML e copia para dist/
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { config } from 'dotenv'
config()

const html = readFileSync('depois-da-meia-noite.html', 'utf8')
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || '',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.VITE_FIREBASE_APP_ID || ''
}
const out = html.replace(
  '/* __FIREBASE_CONFIG__ */',
  `const FIREBASE_CONFIG = ${JSON.stringify(firebaseConfig)};`
)
mkdirSync('dist', { recursive: true })
writeFileSync('dist/index.html', out)
console.log('Build ok →', 'dist/index.html')
