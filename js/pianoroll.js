// Rounded-rect helper (avoids CanvasRenderingContext2D.roundRect browser compat issues)
function _rr(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2
  if (h < 2 * r) r = h / 2
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y,     x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x,     y + h, r)
  ctx.arcTo(x,     y + h, x,     y,     r)
  ctx.arcTo(x,     y,     x + w, y,     r)
  ctx.closePath()
}

class PianoRoll {
  constructor() {
    this.canvas   = null
    this.ctx      = null
    this.notes    = []       // the note sequence (strings like 'C4')
    this.allNotes = []       // full scale range, high → low (for row display)
    this.bpm      = 120
    this.pianoW   = 90       // piano keys width in px
    this.noteW    = 40       // pixels per note step (scrolling view)
    this.rowH     = 0        // height of each pitch row
    this._animId  = null
    this._running = false
    this._active  = new Set() // notes currently at the piano (visually "playing")
  }

  init(canvasEl) {
    this.canvas = canvasEl
    this.ctx    = canvasEl.getContext('2d')
  }

  // Call this before start() or drawStatic() whenever notes / settings change.
  setup(notes, allNotes, bpm) {
    this.notes    = notes
    // allNotes from Converter is low→high; reverse so top row = highest pitch
    this.allNotes = allNotes.slice().reverse()
    this.bpm      = bpm
    this.rowH     = this.canvas.height / this.allNotes.length
    // Show ~18 note-columns in the visible window
    this.noteW = Math.max(16, Math.min(60,
      Math.round((this.canvas.width - this.pianoW) / 18)
    ))
  }

  // Begin the animation loop (call after Tone.js transport has started).
  start() {
    this._running = true
    this._tick()
  }

  // Halt animation and draw the at-rest state.
  stop() {
    this._running = false
    this._active.clear()
    if (this._animId) { cancelAnimationFrame(this._animId); this._animId = null }
    // Redraw in static mode so the canvas isn't frozen mid-scroll
    if (this.notes.length) this._drawStatic()
  }

  // Show all notes laid out from left to right (no scroll).
  drawStatic() {
    if (this.notes.length) this._drawStatic()
  }

  /* ── private ─────────────────────────────────────────────── */

  _tick() {
    if (!this._running) return
    this._drawFrame(Tone.getTransport().seconds, true, this.noteW)
    this._animId = requestAnimationFrame(() => this._tick())
  }

  _drawStatic() {
    // Scale noteW down so every note fits in one screen
    const maxNW = Math.max(4,
      Math.floor((this.canvas.width - this.pianoW) / this.notes.length)
    )
    this._drawFrame(0, false, Math.min(this.noteW, maxNW))
  }

  _drawFrame(t, playing, nw) {
    const ctx = this.ctx
    const W   = this.canvas.width
    const H   = this.canvas.height
    const pw  = this.pianoW
    const dur = (60 / this.bpm) / 2         // 8th note duration in seconds
    const scrollX = playing ? t * nw / dur : 0

    this._active.clear()

    // ── background ──────────────────────────────────────────
    ctx.fillStyle = '#07070e'
    ctx.fillRect(0, 0, W, H)

    // ── pitch row backgrounds ────────────────────────────────
    this.allNotes.forEach((note, idx) => {
      const y     = idx * this.rowH
      const isBlk = note.includes('#')
      ctx.fillStyle = isBlk ? '#09090f' : '#0d0d1a'
      ctx.fillRect(pw, y, W - pw, this.rowH)

      // Horizontal separator at each C
      if (!isBlk && note[0] === 'C') {
        ctx.strokeStyle = '#1c1c32'
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(pw, y); ctx.lineTo(W, y); ctx.stroke()
      }
    })

    // ── note blocks ──────────────────────────────────────────
    this.notes.forEach((note, i) => {
      const idx = this.allNotes.indexOf(note)
      if (idx === -1) return

      const nx  = pw + i * nw - scrollX
      if (nx + nw < pw || nx > W) return

      const ny      = idx * this.rowH
      const atPiano = nx <= pw && nx + nw > pw
      if (atPiano) this._active.add(note)

      const x1 = Math.max(pw + 1, nx)
      const w1 = Math.min(nx + nw - 2, W - 1) - x1
      if (w1 < 1) return

      ctx.fillStyle = atPiano ? '#c4b8ff' : '#5c52b8'
      _rr(ctx, x1, ny + 2, w1, this.rowH - 4, 3)
      ctx.fill()
    })

    // ── piano keys (drawn on top so they never get covered) ──
    this._drawKeys()

    // ── playhead line ────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth   = 1.5
    ctx.beginPath(); ctx.moveTo(pw, 0); ctx.lineTo(pw, H); ctx.stroke()
  }

  _drawKeys() {
    const ctx = this.ctx
    const pw  = this.pianoW
    const rh  = this.rowH

    this.allNotes.forEach((note, idx) => {
      const y      = idx * rh
      const isBlk  = note.includes('#')
      const active = this._active.has(note)

      if (isBlk) {
        // Full-width dark background
        ctx.fillStyle = active ? '#8878e8' : '#111124'
        ctx.fillRect(0, y, pw - 8, rh)
        // Black-key raised portion
        ctx.fillStyle = active ? '#c4b8ff' : '#1c1c38'
        ctx.fillRect(pw - 24, y + 1, 15, rh - 2)
      } else {
        ctx.fillStyle = active ? '#a090ff' : '#181830'
        ctx.fillRect(0, y, pw - 1, rh)
      }

      // Key border
      ctx.strokeStyle = '#0b0b1e'
      ctx.lineWidth   = 0.5
      ctx.strokeRect(0, y, pw - 1, rh)

      // Label: always show C notes; show others when row is tall enough
      if (rh >= 9) {
        const isC = !isBlk && note[0] === 'C'
        if (isC || rh >= 13) {
          ctx.fillStyle    = active ? '#ffffff' : (isBlk ? '#44446a' : '#55557a')
          ctx.font         = `${Math.min(11, Math.floor(rh * 0.62))}px monospace`
          ctx.textAlign    = 'right'
          ctx.textBaseline = 'middle'
          ctx.fillText(note, pw - 5, y + rh / 2)
        }
      }
    })
  }
}
