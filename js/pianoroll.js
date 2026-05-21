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
    this._drawFrame(Tone.Transport.seconds, true)
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
    const ctx  = this.ctx
    const pw   = this.pianoW
    const rh   = this.rowH
    const H    = this.canvas.height
    const bkW  = pw * 0.62          // black key width
    const bkPad = Math.max(0.5, rh * 0.07)

    // White key base
    ctx.fillStyle = '#f5f0e6'
    ctx.fillRect(0, 0, pw, H)

    // White key separators and active highlights
    this.allNotes.forEach((note, idx) => {
      const y      = idx * rh
      const isBlk  = note.includes('#')
      const active = this._active.has(note)
      if (isBlk) return

      if (active) {
        ctx.fillStyle = c.accent + '44'
        ctx.fillRect(0, y, pw, rh)
      }
      // Bottom edge line between white keys
      ctx.strokeStyle = '#c9bfab'
      ctx.lineWidth   = 0.5
      ctx.beginPath(); ctx.moveTo(0, y + rh); ctx.lineTo(pw, y + rh); ctx.stroke()
    })

    // Black keys (drawn on top of white key base)
    this.allNotes.forEach((note, idx) => {
      const y      = idx * rh
      const isBlk  = note.includes('#')
      if (!isBlk) return
      const active = this._active.has(note)

      // Body gradient
      const grad = ctx.createLinearGradient(0, y, bkW, y)
      if (active) {
        grad.addColorStop(0,   '#555')
        grad.addColorStop(1,   '#888')
      } else {
        grad.addColorStop(0,   '#1c1c1c')
        grad.addColorStop(0.6, '#2d2d2d')
        grad.addColorStop(1,   '#484848')
      }
      ctx.fillStyle = grad
      _rr(ctx, 0, y + bkPad, bkW, rh - bkPad * 2, 2)
      ctx.fill()

      // Top highlight strip
      if (!active) {
        ctx.fillStyle = 'rgba(255,255,255,0.14)'
        _rr(ctx, 2, y + bkPad + 1, bkW - 4, (rh - bkPad * 2) * 0.28, 1)
        ctx.fill()
      }
    })

    // Note labels
    if (rh >= 9) {
      this.allNotes.forEach((note, idx) => {
        const y      = idx * rh
        const isBlk  = note.includes('#')
        const active = this._active.has(note)
        const isC    = !isBlk && note[0] === 'C'
        if (!isC && rh < 13) return

        ctx.fillStyle    = isBlk
          ? (active ? '#fff' : 'rgba(255,255,255,0.55)')
          : (active ? c.accent : '#8a7c68')
        ctx.font         = `${Math.min(10, Math.floor(rh * 0.60))}px monospace`
        ctx.textAlign    = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText(note, pw - 4, y + rh / 2)
      })
    }

    // Right border
    ctx.strokeStyle = c.border
    ctx.lineWidth   = 1
    ctx.beginPath(); ctx.moveTo(pw, 0); ctx.lineTo(pw, H); ctx.stroke()
  }
}
