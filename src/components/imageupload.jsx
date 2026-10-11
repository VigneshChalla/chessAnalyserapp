import { useRef, useState, useCallback } from 'react'
import { Upload, ScanLine, RotateCcw, Play, Eraser } from 'lucide-react'
import { Board } from './board'
import { GLYPHS, buildFenFromBoard, startFenGrid, sanitizeGrid } from '../utils/chessUtils'

const PALETTE = [
  { type: 'k', color: 'w' }, { type: 'q', color: 'w' },
  { type: 'r', color: 'w' }, { type: 'b', color: 'w' },
  { type: 'n', color: 'w' }, { type: 'p', color: 'w' },
  { type: 'k', color: 'b' }, { type: 'q', color: 'b' },
  { type: 'r', color: 'b' }, { type: 'b', color: 'b' },
  { type: 'n', color: 'b' }, { type: 'p', color: 'b' },
  null
]

function makeGlyphCanvases(size = 64) {
  const types = ['p', 'n', 'b', 'r', 'q', 'k']
  const templates = {}
  for (const t of types) {
    const c = document.createElement('canvas')
    c.width = size
    c.height = size
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, size, size)
    ctx.font = `${Math.floor(size * 0.82)}px "Segoe UI Symbol", "DejaVu Sans", serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(GLYPHS[t], size / 2, size / 2 + size * 0.04)
    const data = ctx.getImageData(0, 0, size, size).data
    const mask = new Float32Array(size * size)
    for (let i = 0; i < size * size; i++) {
      mask[i] = data[i * 4 + 3] / 255
    }
    templates[t] = normalizeMask(mask, size)
  }
  return templates
}

function normalizeMask(mask, size) {
  let minX = size, maxX = -1, minY = size, maxY = -1
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (mask[y * size + x] > 0.4) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  const w = maxX - minX + 1
  const h = maxY - minY + 1
  const N = 16
  const out = new Float32Array(N * N)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const sx = minX + Math.floor((x / N) * w)
      const sy = minY + Math.floor((y / N) * h)
      out[y * N + x] = mask[Math.min(size - 1, sy) * size + Math.min(size - 1, sx)]
    }
  }
  return out
}

function correlate(a, b) {
  if (!a || !b) return 0
  let num = 0, da = 0, db = 0
  for (let i = 0; i < a.length; i++) {
    num += a[i] * b[i]
    da += a[i] * a[i]
    db += b[i] * b[i]
  }
  return num / (Math.sqrt(da) * Math.sqrt(db) || 1)
}

function analyzeSquarePixels(img, sx, sy, sw, sh) {
  const data = img.data
  const width = img.width
  const x0 = Math.floor(sx + sw * 0.06)
  const y0 = Math.floor(sy + sh * 0.06)
  const w = Math.max(2, Math.floor(sw * 0.88))
  const h = Math.max(2, Math.floor(sh * 0.88))

  const cs = Math.max(2, Math.floor(Math.min(w, h) * 0.14))
  const cornerAvg = (cx, cy) => {
    let r = 0, g = 0, b = 0
    const n = cs * cs
    for (let y = 0; y < cs; y++) {
      for (let x = 0; x < cs; x++) {
        const idx = ((cy + y) * width + (cx + x)) * 4
        r += data[idx]
        g += data[idx + 1]
        b += data[idx + 2]
      }
    }
    return { r: r / n, g: g / n, b: b / n }
  }
  const corners = [
    cornerAvg(x0, y0),
    cornerAvg(x0 + w - cs, y0),
    cornerAvg(x0, y0 + h - cs),
    cornerAvg(x0 + w - cs, y0 + h - cs)
  ]
  const bg = {
    r: (corners[0].r + corners[1].r + corners[2].r + corners[3].r) / 4,
    g: (corners[0].g + corners[1].g + corners[2].g + corners[3].g) / 4,
    b: (corners[0].b + corners[1].b + corners[2].b + corners[3].b) / 4
  }
  const bgLum = 0.299 * bg.r + 0.587 * bg.g + 0.114 * bg.b

  const threshold = 38
  let whitePix = 0
  let blackPix = 0
  const N = 24
  const mask = new Float32Array(N * N)
  let pr = 0, pg = 0, pb = 0
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const px = x0 + Math.floor((x / N) * w)
      const py = y0 + Math.floor((y / N) * h)
      const idx = (py * width + px) * 4
      const dr = data[idx] - bg.r
      const dg = data[idx + 1] - bg.g
      const db2 = data[idx + 2] - bg.b
      const dist = Math.sqrt(dr * dr + dg * dg + db2 * db2)
      if (dist > threshold) {
        mask[y * N + x] = 1
        pr += data[idx]
        pg += data[idx + 1]
        pb += data[idx + 2]
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
        if (lum >= bgLum) whitePix++
        else blackPix++
      }
    }
  }

  const totalPix = whitePix + blackPix
  const fill = totalPix / (N * N)
  if (fill < 0.05) return null

  const pieceLum = totalPix > 0 ? (0.299 * pr + 0.587 * pg + 0.114 * pb) / totalPix : bgLum
  let color
  if (whitePix > blackPix * 1.5) color = 'w'
  else if (blackPix > whitePix * 1.5) color = 'b'
  else color = pieceLum >= 128 ? 'w' : 'b'

  return { mask: normalizeMask(mask, N), color, fill, pieceLum, bgLum }
}

function detectPieces(imageData, crop) {
  const templates = makeGlyphCanvases()
  const grid = startFenGrid('white')
  const { x, y, w, h } = crop
  const sqW = w / 8
  const sqH = h / 8

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const res = analyzeSquarePixels(
        imageData,
        x + col * sqW,
        y + row * sqH,
        sqW,
        sqH
      )
      if (!res) {
        grid[row][col] = null
        continue
      }
      let bestType = 'p'
      let bestScore = -1
      for (const [type, tmpl] of Object.entries(templates)) {
        let s = correlate(res.mask, tmpl)
        if (type === 'p' && res.fill < 0.28) s += 0.12
        if (type !== 'p' && res.fill > 0.42) s += 0.05
        if (s > bestScore) {
          bestScore = s
          bestType = type
        }
      }
      grid[row][col] = { type: bestType, color: res.color }
    }
  }
  return grid
}

export function ImageUpload({ onAnalyze, analyzing, depth }) {
  const [imgUrl, setImgUrl] = useState(null)
  const [imgEl, setImgEl] = useState(null)
  const [crop, setCrop] = useState(null)
  const [grid, setGrid] = useState(null)
  const [turn, setTurn] = useState('w')
  const [castling, setCastling] = useState({ K: true, Q: true, k: true, q: true })
  const [paletteSel, setPaletteSel] = useState({ type: 'q', color: 'w' })
  const [dragging, setDragging] = useState(null)
  const fileRef = useRef(null)
  const stageRef = useRef(null)

  const loadImage = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    const el = new Image()
    el.onload = () => {
      setImgUrl(url)
      setImgEl(el)
      setGrid(null)
      const ratio = Math.abs(el.width - el.height) / Math.max(el.width, el.height)
      const side = ratio < 0.06
        ? Math.min(el.width, el.height)
        : Math.floor(Math.min(el.width, el.height) * 0.85)
      setCrop({
        x: Math.floor((el.width - side) / 2),
        y: Math.floor((el.height - side) / 2),
        w: side,
        h: side,
        naturalW: el.width,
        naturalH: el.height
      })
    }
    el.src = url
  }, [])

  const onDrop = (e) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) loadImage(f)
  }

  const startDrag = (e, mode) => {
    e.preventDefault()
    e.stopPropagation()
    if (!imgEl || !crop) return
    const rect = stageRef.current.getBoundingClientRect()
    const scaleX = imgEl.width / rect.width
    const scaleY = imgEl.height / rect.height
    setDragging({
      mode,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...crop },
      scaleX,
      scaleY
    })
    e.target.setPointerCapture?.(e.pointerId)
  }

  const onMove = (e) => {
    if (!dragging) return
    const dx = (e.clientX - dragging.startX) * dragging.scaleX
    const dy = (e.clientY - dragging.startY) * dragging.scaleY
    setCrop((c) => {
      if (!c) return c
      if (dragging.mode === 'move') {
        return {
          ...c,
          x: Math.max(0, Math.min(c.naturalW - c.w, dragging.orig.x + dx)),
          y: Math.max(0, Math.min(c.naturalH - c.h, dragging.orig.y + dy))
        }
      }
      const size = Math.max(40, Math.min(
        c.naturalW - dragging.orig.x,
        c.naturalH - dragging.orig.y,
        dragging.orig.w + dx
      ))
      return { ...c, w: size, h: size }
    })
  }

  const endDrag = () => setDragging(null)

  const runDetect = () => {
    if (!imgEl || !crop) return
    const canvas = document.createElement('canvas')
    canvas.width = imgEl.width
    canvas.height = imgEl.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(imgEl, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const g = sanitizeGrid(detectPieces(imageData, crop))
    setGrid(g)
  }

  const resetBoard = () => setGrid(startFenGrid('white'))

  const onBoardSquare = (square) => {
    if (!grid) return
    const file = square.charCodeAt(0) - 97
    const rank = parseInt(square[1], 10) - 1
    const row = 7 - rank
    const col = file
    setGrid((g) => {
      const ng = g.map((r) => [...r])
      if (paletteSel === null) ng[row][col] = null
      else ng[row][col] = { ...paletteSel }
      return ng
    })
  }

  const castlingStr = Object.entries(castling)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join('')

  const fen = grid ? buildFenFromBoard(grid, turn, castlingStr) : null

  const displayCrop = crop && imgEl
    ? {
        left: `${(crop.x / crop.naturalW) * 100}%`,
        top: `${(crop.y / crop.naturalH) * 100}%`,
        width: `${(crop.w / crop.naturalW) * 100}%`,
        height: `${(crop.h / crop.naturalH) * 100}%`
      }
    : null

  return (
    <div>
      {!imgUrl ? (
        <div
          className="upload-zone"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <Upload />
          <div className="strong">Upload a chessboard photo or screenshot</div>
          <div className="small">Click or drop an image here (PNG, JPG). Works best on clear, upright board images.</div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => loadImage(e.target.files?.[0])}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="crop-stage" ref={stageRef} style={{ textAlign: 'center' }}
            onPointerMove={onMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <img src={imgUrl} alt="Uploaded board" />
            {displayCrop && (
              <div
                className="crop-rect"
                style={displayCrop}
                onPointerDown={(e) => startDrag(e, 'move')}
              >
                {grid && (
                  <div className="crop-grid">
                    {Array.from({ length: 64 }, (_, i) => <i key={i} />)}
                  </div>
                )}
                <div
                  className="crop-handle"
                  onPointerDown={(e) => startDrag(e, 'resize')}
                />
              </div>
            )}
          </div>

          <div className="row-8">
            <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
              <Upload /> Change image
            </button>
            <button className="btn btn-primary btn-sm" onClick={runDetect}>
              <ScanLine /> Detect pieces
            </button>
            <button className="btn btn-ghost btn-sm" onClick={resetBoard}>
              <RotateCcw /> Clear board
            </button>
            <span className="small muted grow" style={{ textAlign: 'right' }}>
              Drag the frame to fit the board, then detect.
            </span>
          </div>

          {grid && (
            <>
              <div className="card card-pad">
                <div className="section-title"><ScanLine /> Adjust detected position</div>
                <p className="small muted mb-10">
                  Click a square to place the selected piece. Pick the eraser to clear a square.
                </p>
                <div className="palette mb-14">
                  {PALETTE.map((p, i) => (
                    <button
                      key={i}
                      className={
                        (paletteSel === null && p === null) ||
                        (p && paletteSel && paletteSel.type === p.type && paletteSel.color === p.color)
                          ? 'sel'
                          : ''
                      }
                      onClick={() => setPaletteSel(p === null ? null : p)}
                      title={p ? `${p.color === 'w' ? 'White' : 'Black'} ${p.type}` : 'Erase'}
                    >
                      {p ? (
                        <span className={`piece ${p.color === 'w' ? 'white' : 'black'}`} style={{ fontSize: 22 }}>
                          {GLYPHS[p.type]}
                        </span>
                      ) : (
                        <Eraser size={16} />
                      )}
                    </button>
                  ))}
                </div>

                <div className="fen-row mb-10">
                  <label className="bold small">Side to move:</label>
                  <div className="seg">
                    <button className={turn === 'w' ? 'active' : ''} onClick={() => setTurn('w')}>White</button>
                    <button className={turn === 'b' ? 'active' : ''} onClick={() => setTurn('b')}>Black</button>
                  </div>
                </div>

                <div className="castle-toggles mb-14">
                  {['K', 'Q', 'k', 'q'].map((k) => (
                    <label key={k}>
                      <input
                        type="checkbox"
                        checked={castling[k]}
                        onChange={() => setCastling((c) => ({ ...c, [k]: !c[k] }))}
                      />
                      {k === 'K' ? 'White O-O' : k === 'Q' ? 'White O-O-O' : k === 'k' ? 'Black O-O' : 'Black O-O-O'}
                    </label>
                  ))}
                </div>

                <Board grid={grid} orientation="white" onSquareClick={onBoardSquare} />
                <div className="hint mono small mt-10" style={{ wordBreak: 'break-all' }}>{fen}</div>
              </div>

              <button
                className="btn btn-primary btn-block"
                onClick={() => onAnalyze(fen)}
                disabled={analyzing}
              >
                {analyzing ? <span className="spin" /> : <Play />}
                {analyzing ? `Analyzing at depth ${depth}…` : 'Analyze Position'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
