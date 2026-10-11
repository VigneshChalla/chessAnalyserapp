import { useMemo } from 'react'
import {
  BarChart3, BookOpen, Star, ThumbsUp, Swords, Inbox
} from 'lucide-react'
import { useStore } from '../store.jsx'
import { StatCard, Donut, QualityLegend } from '../components/charts'
import { relativeTime } from '../utils/chessUtils'
import { CLASS_ORDER } from '../engine/classify'

export function Dashboard({ onNavigate }) {
  const { analyses, myOpenings } = useStore()

  const stats = useMemo(() => {
    const counts = {}
    for (const k of CLASS_ORDER) counts[k] = 0
    let totalMoves = 0
    for (const a of analyses) {
      for (const k of CLASS_ORDER) counts[k] += a.counts?.[k] || 0
      totalMoves += a.summary?.moveCount || 0
    }
    const accuracies = [...analyses]
      .slice(0, 12)
      .map((a) => a.summary?.topAccuracy || 0)
      .reverse()
    return {
      counts,
      totalMoves,
      brilliant: counts.brilliant,
      great: counts.great,
      accuracies
    }
  }, [analyses])

  const recent = analyses.slice(0, 5)

  return (
    <div className="content">
      <div className="hero">
        <div>
          <div className="hero-tag">Powered by Stockfish 16 NNUE</div>
          <h2>Chess Analyzer</h2>
          <p>
            Paste a PGN, upload a board photo, and get per-move classifications,
            engine evaluations, and accuracy stats — right in your browser.
          </p>
          <button
            className="btn btn-primary mt-10"
            onClick={() => onNavigate('analysis')}
          >
            <Swords /> Start a new analysis
          </button>
        </div>
        <div className="hero-pieces" aria-hidden="true">♜♞♝♛♚</div>
      </div>

      <div className="stats-grid">
        <StatCard
          icon={BarChart3}
          color="orange"
          label="Total Analyses"
          value={analyses.length}
          sub={analyses.length === 1 ? 'Game saved' : 'Games saved'}
          spark={stats.accuracies.length > 1 ? stats.accuracies : []}
        />
        <StatCard
          icon={BookOpen}
          color="blue"
          label="Openings Saved"
          value={myOpenings.length}
          sub="Total openings"
        />
        <StatCard
          icon={Star}
          color="green"
          label="Brilliant Moves"
          value={stats.brilliant}
          sub="In all analyses"
        />
        <StatCard
          icon={ThumbsUp}
          color="purple"
          label="Great Moves"
          value={stats.great}
          sub="In all analyses"
        />
      </div>

      <div className="two-col">
        <div className="card card-pad">
          <div className="section-title"><Swords /> Recent Activity</div>
          {recent.length === 0 ? (
            <div className="empty-state">
              <Inbox />
              <div>No analyses yet. Save your first game from the New Analysis page.</div>
            </div>
          ) : (
            <div className="recent-list">
              {recent.map((a) => (
                <div
                  className="recent-item"
                  key={a.id}
                  onClick={() => onNavigate('saved')}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="left">
                    <span className="recent-icon"><Swords size={16} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div className="title">{a.name}</div>
                      <div className="small muted">{a.summary?.result}</div>
                    </div>
                  </div>
                  <span className="time">{relativeTime(a.date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card card-pad">
          <div className="section-title"><BarChart3 /> Move Quality Overview</div>
          {analyses.length === 0 ? (
            <div className="empty-state">
              <BarChart3 />
              <div>Analyze a game to see the move-quality breakdown here.</div>
            </div>
          ) : (
            <div className="quality-wrap">
              <Donut counts={stats.counts} />
              <QualityLegend counts={stats.counts} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
