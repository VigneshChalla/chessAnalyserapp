import { Chess } from 'chess.js'

export const GLYPHS = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' }

export function squareToCoords(square, orientation = 'white') {
  const file = square.charCodeAt(0) - 97
  const rank = parseInt(square[1], 10) - 1
  if (orientation === 'white') return { col: file, row: 7 - rank }
  return { col: 7 - file, row: rank }
}

export function coordsToSquare(col, row, orientation = 'white') {
  if (orientation === 'white') {
    return String.fromCharCode(97 + col) + String(8 - row)
  }
  return String.fromCharCode(97 + (7 - col)) + String(row + 1)
}

export function boardArray(fen, orientation = 'white') {
  const chess = new Chess(fen)
  const grid = Array.from({ length: 8 }, () => Array(8).fill(null))
  for (const row of chess.board()) {
    for (const cell of row) {
      if (!cell) continue
      const { col, row: r } = squareToCoords(cell.square, orientation)
      grid[r][col] = { type: cell.type, color: cell.color }
    }
  }
  return grid
}

export function lastMoveSquares(fen, sansUpTo) {
  if (!sansUpTo || sansUpTo.length === 0) return null
  const chess = new Chess()
  let last = null
  for (const san of sansUpTo) {
    last = chess.move(san)
  }
  return last ? { from: last.from, to: last.to } : null
}

export function sanitizeGrid(grid) {
  const g = grid.map((row) => row.map((c) => (c ? { ...c } : null)))
  for (const color of ['w', 'b']) {
    let kings = 0
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = g[r][c]
        if (cell && cell.type === 'k' && cell.color === color) {
          kings++
          if (kings > 1) g[r][c] = null
        }
      }
    }
  }
  for (let c = 0; c < 8; c++) {
    if (g[0][c]?.type === 'p') g[0][c] = null
    if (g[7][c]?.type === 'p') g[7][c] = null
  }
  return g
}

export function buildFenFromBoard(grid, turn = 'w', castling = 'KQkq') {
  const rows = []
  for (let r = 0; r < 8; r++) {
    let empty = 0
    let row = ''
    for (let c = 0; c < 8; c++) {
      const cell = grid[r][c]
      if (!cell) {
        empty++
        continue
      }
      if (empty > 0) {
        row += empty
        empty = 0
      }
      row += cell.color === 'w' ? cell.type.toUpperCase() : cell.type
    }
    if (empty > 0) row += empty
    rows.push(row)
  }
  const placement = rows.join('/')
  const castle = castling && castling.length > 0 ? castling : '-'
  return `${placement} ${turn} ${castle} - 0 1`
}

export function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'Just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(iso).toLocaleDateString()
}

export function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
  })
}

export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export function extractMovesFromPgn(pgn) {
  const chess = new Chess()
  chess.loadPgn(pgn)
  return chess.history()
}

export function parsePgnSafe(pgn) {
  try {
    const chess = new Chess()
    chess.loadPgn(pgn)
    const headers = chess.getHeaders ? chess.getHeaders() : {}
    const moves = chess.history()
    if (moves.length === 0) return { error: 'No moves detected. Paste a valid PGN.' }
    return { moves, headers, moveCount: moves.length }
  } catch (err) {
    return { error: err.message || 'Could not parse this PGN.' }
  }
}

export function startFenGrid(orientation = 'white') {
  return boardArray(new Chess().fen(), orientation)
}
