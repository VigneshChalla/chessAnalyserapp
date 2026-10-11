export const CLASS_META = {
  book: { label: 'Book', color: '#3b82f6', symbol: 'B' },
  brilliant: { label: 'Brilliant', color: '#10b981', symbol: '!!' },
  great: { label: 'Great', color: '#3b82f6', symbol: '!' },
  best: { label: 'Best', color: '#22c55e', symbol: '*' },
  excellent: { label: 'Excellent', color: '#84cc16', symbol: '+' },
  good: { label: 'Good', color: '#a3e635', symbol: 'g' },
  inaccuracy: { label: 'Inaccuracy', color: '#fbbf24', symbol: '?!' },
  mistake: { label: 'Mistake', color: '#fb923c', symbol: '?' },
  blunder: { label: 'Blunder', color: '#ef4444', symbol: '??' }
}

export const CLASS_ORDER = [
  'brilliant', 'great', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder', 'book'
]

const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }

export function whiteEvalFromScore(score, turn) {
  const sign = turn === 'w' ? 1 : -1
  if (score.mate != null) {
    const m = score.mate
    const base = m > 0 ? 10000 - m * 10 : -(10000 + m * 10)
    return sign * base
  }
  return sign * score.cp
}

export function formatEval(cp) {
  if (cp == null) return '—'
  if (Math.abs(cp) >= 9000) {
    const mateIn = Math.max(1, Math.round((10000 - Math.abs(cp)) / 10))
    return cp > 0 ? `M${mateIn}` : `-M${mateIn}`
  }
  const v = cp / 100
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}`
}

export function resultLabel(whiteEval) {
  if (whiteEval == null) return 'Not analyzed'
  if (whiteEval >= 9000) return 'White mates'
  if (whiteEval <= -9000) return 'Black mates'
  const a = Math.abs(whiteEval)
  const side = whiteEval > 0 ? 'White' : 'Black'
  if (a < 30) return 'Equal position'
  if (a < 100) return `${side} is slightly better`
  if (a < 300) return `${side} is better`
  if (a < 700) return `${side} is winning`
  return `${side} is completely winning`
}

export function accuracyFromLoss(loss) {
  if (loss == null || Number.isNaN(loss)) return 100
  const l = Math.max(0, loss)
  if (l <= 2) return 100
  return Math.round(Math.max(0, Math.min(100, 100 - l * 0.3)) * 10) / 10
}

function materialOf(chess) {
  let m = 0
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq) continue
      m += (PIECE_VALUES[sq.type] || 0) * (sq.color === 'w' ? 1 : -1)
    }
  }
  return m
}

export function detectSacrifice(chessBefore, playedMove, pvSan) {
  try {
    const c = chessBefore.clone()
    const mover = playedMove.color
    const before = materialOf(c)
    c.move(playedMove)
    for (const san of (pvSan || []).slice(0, 4)) {
      const r = c.move(san)
      if (!r) break
    }
    const after = materialOf(c)
    const delta = mover === 'w' ? after - before : before - after
    return delta <= -200
  } catch {
    return false
  }
}

export function classifyMove({ loss, playedIsBest, isBook, sacrifice, whiteEvalAfter, mover }) {
  if (isBook) return 'book'
  if (loss != null && loss <= 1.5) return 'best'
  const sideEval = mover === 'w' ? whiteEvalAfter : -whiteEvalAfter
  if (sacrifice && loss != null && loss <= 25 && sideEval > -80) return 'brilliant'
  if (loss == null) return 'good'
  if (loss <= 15) return playedIsBest ? 'best' : 'great'
  if (loss <= 30) return 'excellent'
  if (loss <= 60) return 'good'
  if (loss <= 130) return 'inaccuracy'
  if (loss <= 280) return 'mistake'
  return 'blunder'
}

export function moveReason(move) {
  if (move.san.includes('#')) return 'Delivers checkmate.'
  if (move.flags.includes('k') || move.flags.includes('q')) return 'Castles to safety and connects the rooks.'
  if (move.san.includes('+')) return 'Gives check and gains time.'
  if (move.promotion) return 'Promotes to a powerful piece.'
  if (move.captured) return 'Captures material or forces a favorable trade.'
  if ((move.piece === 'n' || move.piece === 'b')) {
    const back = move.color === 'w' ? ['b1', 'c1', 'f1', 'g1'] : ['b8', 'c8', 'f8', 'g8']
    if (back.includes(move.from)) return 'Develops a piece toward the center.'
  }
  if (move.piece === 'p') return 'Claims space in the center.'
  if (move.piece === 'r') return 'Places the rook on a useful file.'
  return 'A solid, improving move.'
}

export function explainMove({ classification, bestSan, playedSan, openingName, sacrifice }) {
  const best = bestSan && bestSan !== playedSan ? ` ${bestSan} was the engine's choice.` : ''
  switch (classification) {
    case 'book':
      return `Opening book move${openingName ? ` in the ${openingName}` : ''}. Standard theory.`
    case 'brilliant':
      return `Brilliant${sacrifice ? ' sacrifice' : ''}! The engine fully approves and the advantage is kept.`
    case 'great':
      return `Great move — one of the few that holds the position.${best}`
    case 'best':
      return "The engine's top choice."
    case 'excellent':
      return `Excellent — almost as strong as the best line.${best}`
    case 'good':
      return `Good, playable move.${best}`
    case 'inaccuracy':
      return `Slight inaccuracy. It gives back some advantage.${best}`
    case 'mistake':
      return `Mistake — the position gets noticeably worse.${best}`
    case 'blunder':
      return `Blunder! This seriously damages the position.${best}`
    default:
      return ''
  }
}

export function explainBest({ uci, san, cp, turn }) {
  const pieceNames = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }
  const side = turn === 'w' ? 'White' : 'Black'
  const evalStr = formatEval(cp)
  const name = san || uci
  if (cp != null && Math.abs(cp) >= 9000) {
    return `${side} has a forced mate (${evalStr}). The engine recommends ${name}.`
  }
  const pieceName = uci ? pieceNames[uci[0]] : null
  return pieceName
    ? `The ${pieceName} move ${name} is the strongest continuation, evaluated at ${evalStr} for ${side}.`
    : `${name} is the strongest continuation, evaluated at ${evalStr} for ${side}.`
}

export function bookMatch(movesSan, openings) {
  let best = null
  for (const op of openings) {
    const line = (op.moves || '').trim().split(/\s+/).filter(Boolean)
    if (line.length === 0) continue
    let i = 0
    while (i < line.length && i < movesSan.length && line[i] === movesSan[i]) i++
    if (i >= 1 && (!best || i > best.matchLen)) {
      best = { opening: op, matchLen: i, full: i >= line.length }
    }
  }
  return best
}

export function countClassifications(moves) {
  const counts = {}
  for (const k of Object.keys(CLASS_META)) counts[k] = 0
  for (const m of moves || []) {
    if (counts[m.classification] != null) counts[m.classification]++
  }
  return counts
}

export function averageAccuracy(moves) {
  if (!moves || moves.length === 0) return 0
  let sum = 0
  for (const m of moves) sum += m.accuracy ?? 100
  return Math.round((sum / moves.length) * 10) / 10
}

export { PIECE_VALUES }
