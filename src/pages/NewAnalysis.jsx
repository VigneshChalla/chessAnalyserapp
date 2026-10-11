import { useMemo, useRef, useState } from 'react'
import {
  ClipboardPaste, Image as ImageIcon, Wand2, Play, X, Layers, Cpu
} from 'lucide-react'
import { Chess } from 'chess.js'
import { useStore } from '../store.jsx'
import { Board, MoveNav } from '../components/board'
import { BestMovePanel, MoveList } from '../components/panels'
import { ClassificationPanel } from '../components/charts'
import { ImageUpload } from '../components/imageupload'
import { analyzeGame, analyzePosition, requestCancel } from '../engine/analyze'
import {
  parsePgnSafe, uid
} from '../utils/chessUtils'
import {
  countClassifications, averageAccuracy, resultLabel, formatEval, explainBest
} from '../engine/classify'

const START_FEN = new Chess().fen()

export function NewAnalysis({ onNavigate }) {
  const { prefs, allBookOpenings, saveAnalysis, showToast, profile, user, authLoading } = useStore()
  const [mode, setMode] = useState('pgn')
  const [pgn, setPgn] = useState('')
  const [parsed, setParsed] = useState(null)
  const [parseError, setParseError] = useState(null)
  const [game, setGame] = useState(null)
  const [index, setIndex] = useState(0)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(null)
  const [posResult, setPosResult] = useState(null)
  const [posRunning, setPosRunning] = useState(false)
  const fileRef = useRef(null)

  const depth = prefs.depth || 20
  const orientation = prefs.orientation || 'white'

  const currentFen = useMemo(() => {
    if (game) {
      if (index === 0) return game.startFen
      const pm = game.perMove[index - 1]
      return pm ? pm.fenAfter : game.startFen
    }
    if (parsed) {
      const c = new Chess()
      for (let i = 0; i < index && i < parsed.moves.length; i++) c.move(parsed.moves[i])
      return c.fen()
    }
    return START_FEN
  }, [game, parsed, index])

  const lastMoveInfo = useMemo(() => {
    const sans = game ? game.sans.slice(0, index) : (parsed ? parsed.moves.slice(0, index) : [])
    if (sans.length === 0) return null
    const c = new Chess()
    let last = null
    for (const san of sans) last = c.move(san)
    return last ? { from: last.from, to: last.to } : null
  }, [game, parsed, index])

  const displayMoves = useMemo(() => {
    if (game) return game.perMove.map((m) => ({ san: m.san, classification: m.classification }))
    if (parsed) return parsed.moves.map((san) => ({ san }))
    return []
  }, [game, parsed])

  const totalMoves = displayMoves.length
  const currentMove = index > 0 ? displayMoves[index - 1] : null
  const currentPm = game && index > 0 ? game.perMove[index - 1] : null

  const counts = useMemo(() => (game ? countClassifications(game.perMove) : {}), [game])
  const analyzed = !!game

  const gameEvalCp = currentPm
    ? (index === 0 ? currentPm.whiteEvalBefore : currentPm.whiteEvalAfter)
    : posResult
      ? posResult.whiteEval
      : null

  const moveNoLabel = currentMove
    ? `${Math.floor((index - 1) / 2) + 1}${(index - 1) % 2 === 0 ? '.' : '...'}`
    : null

  function handleAutoDetect() {
    setParseError(null)
    const res = parsePgnSafe(pgn)
    if (res.error) {
      setParseError(res.error)
      setParsed(null)
      return
    }
    setParsed(res)
    setGame(null)
    setIndex(0)
    setPosResult(null)
    showToast(`Detected ${res.moveCount} moves.`)
  }

  async function handleAnalyzeGame() {
    if (!parsed) {
      handleAutoDetect()
      return
    }
    setRunning(true)
    setProgress({ done: 0, total: parsed.moveCount + 1 })
    try {
      const headers = parsed.headers || {}
      const result = await analyzeGame({
        pgn,
        depth,
        openings: allBookOpenings,
        onProgress: (done, total) => setProgress({ done, total })
      })
      const startFen = new Chess().fen()
      const topAccuracy = averageAccuracy(result.perMove)
      const lastEval = result.perMove.length
        ? result.perMove[result.perMove.length - 1].whiteEvalAfter
        : null
      setGame({
        ...result,
        startFen,
        headers,
        id: uid(),
        name:
          headers.Event && headers.Event !== '?'
            ? headers.Event
            : (result.openingName || 'Untitled Analysis'),
        counts: countClassifications(result.perMove),
        topAccuracy,
        finalEval: lastEval,
        resultText: result.summary.result,
        depth
      })
      setIndex(result.perMove.length)
      if (result.cancelled) showToast('Analysis stopped early.', 'error')
      else showToast('Analysis complete.')
    } catch (err) {
      showToast(err.message || 'Analysis failed.', 'error')
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }

  function handleCancel() {
    requestCancel()
  }

  function handleSave() {
    if (!game) return
    if (!authLoading && !user) {
      showToast('Sign in to save analyses to your account.', 'error')
      onNavigate('auth')
      return
    }
    const record = {
      id: game.id || uid(),
      name: game.name,
      date: new Date().toISOString(),
      pgn,
      sans: game.sans,
      opening: game.openingName,
      depth: game.depth,
      counts: game.counts,
      perMove: game.perMove.map((m) => ({
        san: m.san,
        from: m.from,
        to: m.to,
        promotion: m.promotion,
        color: m.color,
        classification: m.classification,
        loss: m.loss,
        accuracy: m.accuracy,
        whiteEvalBefore: m.whiteEvalBefore,
        whiteEvalAfter: m.whiteEvalAfter,
        bestSan: m.bestSan,
        explain: m.explain,
        sacrifice: m.sacrifice
      })),
      summary: {
        result: game.resultText,
        finalEval: game.finalEval,
        moveCount: game.perMove.length,
        topAccuracy: game.topAccuracy
      },
      favorite: false,
      author: profile.name
    }
    saveAnalysis(record)
    showToast('Analysis saved to history.')
  }

  async function handleAnalyzePosition(fen) {
    setPosRunning(true)
    try {
      const r = await analyzePosition(fen, depth)
      setPosResult({
        ...r,
        explain: explainBest({ uci: r.bestUci, san: r.bestSan, cp: r.whiteEval, turn: r.turn }),
        evalText: resultLabel(r.whiteEval)
      })
      showToast('Position analyzed.')
    } catch (err) {
      showToast(err.message || 'Position analysis failed.', 'error')
    } finally {
      setPosRunning(false)
    }
  }

  function importImageFenNote() {
    setMode('photo')
  }

  return (
    <div className="content">
      <div className="card card-pad">
        <div className="section-title"><Layers /> New Analysis</div>

        <div className="pgn-tabs">
          <button className={mode === 'pgn' ? 'active' : ''} onClick={() => setMode('pgn')}>
            <ClipboardPaste /> Paste PGN
          </button>
          <button className={mode === 'photo' ? 'active' : ''} onClick={importImageFenNote}>
            <ImageIcon /> Upload board photo
          </button>
        </div>

        {mode === 'pgn' ? (
          <div className="analysis-grid">
            <div>
              <div className="bold small mb-10">Paste Moves / PGN</div>
              <textarea
                className="pgn-box"
                placeholder={'1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 ...'}
                value={pgn}
                onChange={(e) => setPgn(e.target.value)}
              />
              <button className="btn btn-primary btn-block mt-10" onClick={handleAutoDetect}>
                <Wand2 /> Auto-detect
              </button>
              {parseError && (
                <div className="hint" style={{ color: 'var(--danger)' }}>{parseError}</div>
              )}
              {parsed && (
                <div className="hint">
                  Detected: <strong>{parsed.moveCount} moves</strong>
                  {parsed.headers?.White && parsed.headers?.Black
                    ? ` · ${parsed.headers.White} vs ${parsed.headers.Black}`
                    : ''}
                </div>
              )}

              <div className="mt-14" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {!running ? (
                  <button className="btn btn-primary btn-block" onClick={handleAnalyzeGame}>
                    <Play /> Analyze Game (depth {depth})
                  </button>
                ) : (
                  <button className="btn btn-danger-ghost btn-block" onClick={handleCancel}>
                    <X /> Stop analysis
                  </button>
                )}
              </div>

              {progress && (
                <div className="progress-wrap mt-10">
                  <div className="progress-head">
                    <span><Cpu size={13} style={{ verticalAlign: -2 }} /> Stockfish {depth}</span>
                    <span>{progress.done} / {progress.total}</span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="bold small mb-10">
                {game?.openingName || (parsed ? 'Parsed Game' : 'Board')}
              </div>
              <Board
                fen={currentFen}
                orientation={orientation}
                lastMove={lastMoveInfo}
              />
              <MoveNav
                index={index}
                total={totalMoves}
                onFirst={() => setIndex(0)}
                onPrev={() => setIndex((i) => Math.max(0, i - 1))}
                onNext={() => setIndex((i) => Math.min(totalMoves, i + 1))}
                onLast={() => setIndex(totalMoves)}
                onJump={(n) => setIndex(n)}
              />
              <div className="mt-14">
                <MoveList
                  moves={displayMoves}
                  index={index}
                  onJump={(n) => setIndex(n)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <BestMovePanel
                analyzed={analyzed || !!posResult}
                moveNo={moveNoLabel}
                playedSan={currentMove?.san || posResult?.bestSan}
                classification={currentPm?.classification || (posResult ? 'best' : null)}
                evalCp={gameEvalCp}
                bestSan={currentPm?.bestSan || posResult?.bestSan}
                explain={currentPm?.explain || posResult?.explain}
                openingName={game?.openingName}
                onSave={handleSave}
                canSave={analyzed}
              />
            </div>
          </div>
        ) : (
          <div className="analysis-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <ImageUpload onAnalyze={handleAnalyzePosition} analyzing={posRunning} depth={depth} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <BestMovePanel
                analyzed={!!posResult}
                moveNo={null}
                playedSan={posResult?.bestSan}
                classification={posResult ? 'best' : null}
                evalCp={posResult?.whiteEval}
                bestSan={posResult?.bestSan}
                explain={posResult?.explain}
                onSave={() => {}}
                canSave={false}
              />
              {posResult && (
                <div className="card card-pad">
                  <div className="section-title">Position summary</div>
                  <div className="pos-result">
                    <div className="line">
                      <span className="k">Evaluation</span>
                      <span className="v">{formatEval(posResult.whiteEval)}</span>
                    </div>
                    <div className="line">
                      <span className="k">Assessment</span>
                      <span className="v">{posResult.evalText || resultLabel(posResult.whiteEval)}</span>
                    </div>
                    <div className="line">
                      <span className="k">Best line</span>
                      <span className="v">{(posResult.pv || []).slice(0, 8).join(' ') || '—'}</span>
                    </div>
                    <div className="line">
                      <span className="k">Depth</span>
                      <span className="v">{posResult.depth}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {analyzed && (
        <div className="card card-pad">
          <div className="section-title"><Cpu /> Move Classification</div>
          <ClassificationPanel counts={counts} />
          <div className="hint">
            Top accuracy: <strong>{game.topAccuracy}%</strong> · Depth {game.depth} ·{' '}
            {game.resultText}
          </div>
        </div>
      )}
    </div>
  )
}
