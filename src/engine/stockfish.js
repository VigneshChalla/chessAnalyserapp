import { Chess } from 'chess.js'

let worker = null
let readyPromise = null
let listeners = new Set()
let lineBuffer = []

function workerUrl() {
  const base = import.meta.env.BASE_URL || '/'
  const js = `${base}stockfish/stockfish.js`
  return `${js}#stockfish.wasm`
}

function emit(line) {
  lineBuffer.push(line)
  if (lineBuffer.length > 400) lineBuffer.shift()
  for (const fn of listeners) {
    try { fn(line) } catch { /* ignore */ }
  }
}

export function initEngine() {
  if (readyPromise) return readyPromise
  readyPromise = new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        reject(new Error('Engine failed to start (timeout). Try reloading the page.'))
      }
    }, 60000)

    try {
      worker = new Worker(workerUrl())
    } catch (err) {
      clearTimeout(timer)
      reject(err)
      return
    }

    worker.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data)
      emit(line)
      if (!settled && line === 'uciok') {
        worker.postMessage('isready')
      }
      if (!settled && line === 'readyok') {
        settled = true
        clearTimeout(timer)
        worker.postMessage('setoption name Threads value 1')
        worker.postMessage('setoption name Hash value 128')
        resolve()
      }
    }

    worker.onerror = (err) => {
      worker = null
      readyPromise = null
      if (!settled) {
        settled = true
        clearTimeout(timer)
        reject(new Error(`Engine error: ${err.message || 'failed to load WASM'}`))
      }
    }

    worker.postMessage('uci')
  })
  return readyPromise
}

export function onEngineLine(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getBufferedLines() {
  return [...lineBuffer]
}

let cancelRequested = false

export function requestCancel() {
  cancelRequested = true
  if (worker) worker.postMessage('stop')
}

export function clearCancel() {
  cancelRequested = false
}

export function isCancelRequested() {
  return cancelRequested
}

export function analyzeFen(fen, depth = 20) {
  return new Promise((resolve) => {
    if (!worker) {
      resolve(null)
      return
    }
    let best = null
    let stopped = false

    const listener = (line) => {
      if (stopped) return
      if (line.startsWith('info ') && line.includes(' pv ')) {
        const parsed = parseInfoLine(line)
        if (parsed) best = parsed
      } else if (line.startsWith('info ') && line.includes(' score ')) {
        const parsed = parseInfoLine(line)
        if (parsed && (!best || parsed.depth >= (best.depth || 0))) {
          best = { ...(best || {}), ...parsed, pv: best?.pv || [] }
        }
      }
      if (line.startsWith('bestmove')) {
        stopped = true
        off()
        const parts = line.split(/\s+/)
        const bm = parts[1]
        const cancelled = cancelRequested
        resolve({
          bestMoveUci: bm === '(none)' ? null : bm,
          cp: best?.cp ?? null,
          mate: best?.mate ?? null,
          depth: best?.depth ?? depth,
          pv: best?.pv || [],
          cancelled
        })
      }
    }

    const off = onEngineLine(listener)
    worker.postMessage('position fen ' + fen)
    worker.postMessage('go depth ' + depth)
  })
}

export function parseInfoLine(line) {
  const depthM = line.match(/depth (\d+)/)
  const cpM = line.match(/score cp (-?\d+)/)
  const mateM = line.match(/score mate (-?\d+)/)
  const pvM = line.match(/ pv (.+)$/)
  if (!cpM && !mateM) return null
  return {
    depth: depthM ? parseInt(depthM[1], 10) : 0,
    cp: cpM ? parseInt(cpM[1], 10) : null,
    mate: mateM ? parseInt(mateM[1], 10) : null,
    pv: pvM ? pvM[1].trim().split(/\s+/) : []
  }
}

export function uciMovesToSan(fen, uciMoves) {
  const san = []
  let chess
  try {
    chess = new Chess(fen)
  } catch {
    return san
  }
  for (const u of uciMoves) {
    try {
      const m = chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || 'q' })
      if (!m) break
      san.push(m.san)
    } catch {
      break
    }
  }
  return san
}
