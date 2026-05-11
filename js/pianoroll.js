function _rr(ctx, x, y, w, h, r) {
  if (w < 2*r) r = w/2
  if (h < 2*r) r = h/2
  ctx.beginPath()
  ctx.moveTo(x+r, y)
  ctx.arcTo(x+w, y, x+w, y+h, r)
  ctx.arcTo(x+w, y+h, x, y+h, r)
  ctx.arcTo(x, y+h, x, y, r)
  ctx.arcTo(x, y, x+w, y, r)
  ctx.closePath()
}

class PianoRoll {
  constructor() {
    this.canvas      = null
    this.ctx         = null
    this.noteEvents  = []   // [{note, x, y}, ...]
    this.allNotes    = []   // full scale, high → low
    this.bpm         = 120
    this.canvasW     = 1
    this.canvasH     = 1
    this.pianoW      = 90
    this.rowH        = 0
    this.totalTime   = 0    // seconds, provided by player
    this._animId     = null
    this._running    = false
    this._active     = new Set()
  }

  init(canvasEl) {
    this.canvas = canvasEl
    this.ctx    = canvasEl.getContext('2d')
  }

  // noteEvents: [{note, x, y}]
  // allNotes:   converter.notes (low → high), will be reversed here
  // totalTime:  player.getTotalTime() — sync scroll speed to audio
  setup(noteEvents, allNotes, bpm, canvasW, canvasH, totalTime) {
    this.noteEvents = noteEvents
    this.allNotes   = allNotes.slice().reverse()   // high → low for display
    this.bpm        = bpm
    this.canvasW    = canvasW
    this.canvasH    = canvasH
    this.totalTime  = totalTime || noteEvents.length * ((60 / bpm) / 2)
    this.rowH       = this.canvas.height / this.allNotes.length
  }

  start() {
    this._running = true
    this._tick()
  }

  stop() {
    this._running = false
    this._active.clear()
    if (this._animId) { cancelAnimationFrame(this._animId); this._animId = null }
    if (this.noteEvents.length) this._drawFrame(0, false)
  }

  drawStatic() {
    if (this.noteEvents.length) this._drawFrame(0, false)
  }

  /* ── private ──────────────────────────────────────────────── */

  _tc() {
    const s = getComputedStyle(document.documentElement)
    const g = p => s.getPropertyValue(p).trim()
    return {
      bg:        g('--bg'),
      surface:   g('--surface'),
      surface2:  g('--surface2'),
      border:    g('--border'),
      accent:    g('--accent'),
      accentH:   g('--accent-h'),
      text:      g('--text'),
      textMuted: g('--text-muted'),
    }
  }

  _tick() {
    if (!this._running) return
    this._drawFrame(Tone.getTransport().seconds, true)
    this._animId = requestAnimationFrame(() => this._tick())
  }

  _drawFrame(t, playing) {
    const ctx   = this.ctx
    const W     = this.canvas.width
    const H     = this.canvas.height
    const pw    = this.pianoW
    const rollW = W - pw
    const c     = this._tc()

    const scrollX = playing ? (t / this.totalTime) * rollW : 0

    this._active.clear()

    // background
    ctx.fillStyle = c.bg
    ctx.fillRect(0, 0, W, H)

    // row backgrounds
    this.allNotes.forEach((note, idx) => {
      const y = idx * this.rowH
      ctx.fillStyle = note.includes('#') ? c.bg : c.surface
      ctx.fillRect(pw, y, rollW, this.rowH)
      if (!note.includes('#') && note[0] === 'C') {
        ctx.strokeStyle = c.border
        ctx.lineWidth   = 1
        ctx.beginPath(); ctx.moveTo(pw, y); ctx.lineTo(W, y); ctx.stroke()
      }
    })

    // note dots
    const dotR = Math.max(2, Math.min(this.rowH / 2 - 1, 5))

    this.noteEvents.forEach(evt => {
      const noteIdx = this.allNotes.indexOf(evt.note)
      if (noteIdx === -1) return

      const baseX   = pw + (evt.x / this.canvasW) * rollW
      const nx      = baseX - scrollX
      if (nx < pw - dotR * 2 || nx > W + dotR) return

      const ny      = noteIdx * this.rowH + this.rowH / 2
      const atPiano = nx <= pw + dotR && nx >= pw - dotR * 3
      if (atPiano) this._active.add(evt.note)

      ctx.fillStyle = atPiano ? c.accentH : c.accent
      ctx.beginPath()
      ctx.arc(nx, ny, dotR, 0, Math.PI * 2)
      ctx.fill()
    })

    // piano keys (drawn on top)
    this._drawKeys(c)

    // playhead
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth   = 1.5
    ctx.beginPath(); ctx.moveTo(pw, 0); ctx.lineTo(pw, H); ctx.stroke()
  }

  _drawKeys(c) {
    const ctx = this.ctx
    const pw  = this.pianoW
    const rh  = this.rowH

    this.allNotes.forEach((note, idx) => {
      const y      = idx * rh
      const isBlk  = note.includes('#')
      const active = this._active.has(note)

      if (isBlk) {
        ctx.fillStyle = c.bg
        ctx.fillRect(0, y, pw - 8, rh)
        ctx.fillStyle = active ? c.accentH : c.surface
        ctx.fillRect(pw - 24, y + 1, 15, rh - 2)
      } else {
        ctx.fillStyle = active ? c.accent : c.surface2
        ctx.fillRect(0, y, pw - 1, rh)
      }

      ctx.strokeStyle = c.bg
      ctx.lineWidth   = 0.5
      ctx.strokeRect(0, y, pw - 1, rh)

      if (rh >= 9) {
        const isC = !isBlk && note[0] === 'C'
        if (isC || rh >= 13) {
          ctx.fillStyle    = active ? c.text : c.textMuted
          ctx.font         = `${Math.min(11, Math.floor(rh * 0.62))}px monospace`
          ctx.textAlign    = 'right'
          ctx.textBaseline = 'middle'
          ctx.fillText(note, pw - 5, y + rh / 2)
        }
      }
    })
  }
}
