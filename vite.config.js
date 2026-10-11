import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the project at /chessAnalyserapp/, so asset paths
  // (including the Stockfish worker) must be prefixed. Local dev and other
  // hosts (Vercel/Netlify) serve at root — override via VITE_BASE_PATH.
  base: process.env.VITE_BASE_PATH || '/',
})
