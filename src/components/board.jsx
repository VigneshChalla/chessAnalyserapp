import { GLYPHS, boardArray, coordsToSquare } from '../utils/chessUtils'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1']

export function Board({
  fen,
  grid: gridProp = null,
  orientation = 'white',
  lastMove = null,
  onSquareClick = null,
  highlighted = []
}) {
  let grid = gridProp
  if (!grid) {
    try {
      grid = boardArray(fen, orientation)
    } catch {
      grid = Array.from({ length: 8 }, () => Array(8).fill(null))
    }
  } else if (orientation === 'black') {
    grid = [...grid].reverse().map((row) => [...row].reverse())
  }
  const cells = []

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = coordsToSquare(col, row, orientation)
      const piece = grid[row][col]
      const isLight = (row + col) % 2 === 0
      const isLast = lastMove && (lastMove.from === square || lastMove.to === square)
      const isHl = highlighted.includes(square)

      cells.push(
        <div
          key={square}
          className={[
            'square',
            isLight ? 'light' : 'dark',
            isLast ? 'last' : '',
            isHl ? 'hl' : '',
            onSquareClick ? 'clickable' : ''
          ].filter(Boolean).join(' ')}
          onClick={onSquareClick ? () => onSquareClick(square) : undefined}
          data-square={square}
        >
          {piece && (
            <span className={`piece ${piece.color === 'w' ? 'white' : 'black'}`}>
              {GLYPHS[piece.type]}
            </span>
          )}
          {row === 7 && (
            <span className="coord file">{orientation === 'white' ? FILES[col] : FILES[7 - col]}</span>
          )}
          {col === 0 && (
            <span className="coord rank">{orientation === 'white' ? RANKS[row] : RANKS[7 - row]}</span>
          )}
        </div>
      )
    }
  }

  return (
    <div className="board-wrap">
      <div className="board-grid">{cells}</div>
    </div>
  )
}

export function MoveNav({ index, total, onFirst, onPrev, onNext, onLast, onJump }) {
  return (
    <div className="move-nav">
      <button onClick={onFirst} disabled={index <= 0} title="First position">
        ⏮ First
      </button>
      <button onClick={onPrev} disabled={index <= 0} title="Previous move">
        ◀ Prev
      </button>
      <button
        className="move-counter"
        onClick={() => {
          const v = window.prompt(`Jump to move (0–${total})`, String(index))
          if (v != null && onJump) {
            const n = parseInt(v, 10)
            if (!Number.isNaN(n)) onJump(Math.max(0, Math.min(total, n)))
          }
        }}
        title="Click to jump"
      >
        {index} / {total}
      </button>
      <button onClick={onNext} disabled={index >= total} title="Next move">
        Next ▶
      </button>
      <button onClick={onLast} disabled={index >= total} title="Last position">
        Last ⏭
      </button>
    </div>
  )
}
