import { Chess } from 'chess.js'
import { initEngine, analyzeFen, requestCancel, clearCancel, isCancelRequested, uciMovesToSan } from './stockfish'
import {
  whiteEvalFromScore, classifyMove, detectSacrifice, accuracyFromLoss,
  explainMove, bookMatch, resultLabel
} from './classify'

export async function analyzeGame({ pgn, depth = 20, openings = [], onProgress }) {
  clearCancel()
  await initEngine()

  const chess = new Chess()
  chess.loadPgn(pgn)
  const verbose = chess.history({ verbose: true })
  if (verbose.length === 0) throw new Error('No moves found in this PGN.')

  const replay = new Chess()
  const sans = verbose.map((m) => m.san)
  const book = bookMatch(sans, openings)
  const openingName = book?.opening?.name || null

  const evalCache = new Map()
  const positions = []
  const replay2 = new Chess()
  positions.push(replay2.fen())
  for (const m of verbose) {
    replay2.move(m.san)
    positions.push(replay2.fen())
  }

  const total = positions.length
  let done = 0

  async function getEval(fen) {
    if (evalCache.has(fen)) return evalCache.get(fen)
    const turn = fen.split(' ')[1]
    const raw = await analyzeFen(fen, depth)
    if (!raw || isCancelRequested()) return null
    const whiteEval = whiteEvalFromScore({ cp: raw.cp, mate: raw.mate }, turn)
    const result = { whiteEval, bestMoveUci: raw.bestMoveUci, pv: raw.pv, cp: raw.cp, mate: raw.mate, turn }
    evalCache.set(fen, result)
    done++
    if (onProgress) onProgress(done, total)
    return result
  }

  const perMove = []

  for (let i = 0; i < verbose.length; i++) {
    if (isCancelRequested()) break
    const move = verbose[i]
    const fenBefore = positions[i]
    const fenAfter = positions[i + 1]
    const before = await getEval(fenBefore)
    if (!before) break
    const after = await getEval(fenAfter)
    if (!after) break

    const mover = move.color
    const sideSign = mover === 'w' ? 1 : -1
    const loss = Math.max(0, sideSign * (before.whiteEval - after.whiteEval))
    const playedUci = move.from + move.to + (move.promotion || '')
    const playedIsBest = before.bestMoveUci === playedUci

    const isBook = book && i < book.matchLen
    const pvSan = uciMovesToSan(fenBefore, before.pv)
    const sacrifice = !isBook && detectSacrifice(new Chess(fenBefore), { san: move.san }, pvSan)

    const classification = classifyMove({
      loss, playedIsBest, isBook, sacrifice,
      whiteEvalAfter: after.whiteEval, mover
    })

    const bestSanList = uciMovesToSan(fenBefore, before.bestMoveUci ? [before.bestMoveUci] : [])
    const bestSan = bestSanList[0] || null
    const explain = explainMove({
      classification, bestSan, playedSan: move.san, openingName, sacrifice
    })

    perMove.push({
      san: move.san,
      from: move.from,
      to: move.to,
      promotion: move.promotion || null,
      color: mover,
      fenBefore,
      fenAfter,
      classification,
      loss: Math.round(loss),
      accuracy: accuracyFromLoss(loss),
      whiteEvalBefore: before.whiteEval,
      whiteEvalAfter: after.whiteEval,
      bestSan,
      bestUci: before.bestMoveUci,
      explain,
      sacrifice
    })
  }

  const cancelled = isCancelRequested()
  const lastEval = perMove.length > 0 ? perMove[perMove.length - 1].whiteEvalAfter : null
  const finalFen = perMove.length > 0 ? perMove[perMove.length - 1].fenAfter : positions[0]
  const finalChess = new Chess(finalFen)

  return {
    sans,
    perMove,
    openingName,
    cancelled,
    summary: {
      result: resultLabel(lastEval),
      finalEval: lastEval,
      moveCount: perMove.length,
      isCheckmate: finalChess.isCheckmate(),
      isDraw: finalChess.isDraw()
    }
  }
}

export async function analyzePosition(fen, depth = 20) {
  clearCancel()
  if (!fen || !fen.includes('k') || !fen.includes('K')) {
    throw new Error('Position needs both kings. Fix the board before analyzing.')
  }
  await initEngine()
  const raw = await analyzeFen(fen, depth)
  if (!raw) throw new Error('Engine returned no result.')
  const turn = fen.split(' ')[1]
  const whiteEval = whiteEvalFromScore({ cp: raw.cp, mate: raw.mate }, turn)
  const bestSanList = uciMovesToSan(fen, raw.bestMoveUci ? [raw.bestMoveUci] : [])
  return {
    whiteEval,
    evalText: raw.mate != null ? resultLabel(whiteEval) : null,
    bestSan: bestSanList[0] || raw.bestMoveUci,
    bestUci: raw.bestMoveUci,
    pv: uciMovesToSan(fen, raw.pv),
    turn,
    depth: raw.depth
  }
}

export { requestCancel, isCancelRequested }
