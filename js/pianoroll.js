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

/* ─── Theme-aware piano key palette ──────────────────────────── */

function _hexToRgb(hex) {
  const m = (hex || '').replace('#', '').trim()
  if (m.length === 3) {
    return {
      r: parseInt(m[0] + m[0], 16),
      g: parseInt(m[1] + m[1], 16),
      b: parseInt(m[2] + m[2], 16),
    }
  }
  if (m.length === 6) {
    return {
      r: parseInt(m.substr(0, 2), 16),
      g: parseInt(m.substr(2, 2), 16),
      b: parseInt(m.substr(4, 2), 16),
    }
  }
  return { r: 128, g: 128, b: 128 }
}

function _luminance(hex) {
  const { r, g, b } = _hexToRgb(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

function _mixHex(a, b, t) {
  const A = _hexToRgb(a)
  const B = _hexToRgb(b)
  const r = Math.round(A.r * (1 - t) + B.r * t)
  const g = Math.round(A.g * (1 - t) + B.g * t)
  const bl = Math.round(A.b * (1 - t) + B.b * t)
  return `rgb(${r}, ${g}, ${bl})`
}

function _keyPalette(c) {
  const isDark = _luminance(c.bg) < 0.5
  if (isDark) {
    return {
      isDark,
      whiteKey:          _mixHex(c.text, c.surface2, 0.10),
      whiteKeyEdge:      c.surface,
      whiteKeyLabel:     c.surface,
      blackKeyTop:       c.bg,
      blackKeyMid:       _mixHex(c.bg, c.surface, 0.55),
      blackKeyBottom:    _mixHex(c.bg, c.surface, 0.95),
      blackKeyHighlight: 'rgba(255, 255, 255, 0.10)',
      blackKeyLabel:     c.text,
    }
  }
  return {
    isDark,
    whiteKey:          _mixHex(c.surface, '#ffffff', 0.45),
    whiteKeyEdge:      c.border,
    whiteKeyLabel:     c.textMuted,
    blackKeyTop:       c.text,
    blackKeyMid:       _mixHex(c.text, c.textMuted, 0.3),
    blackKeyBottom:    _mixHex(c.text, c.textMuted, 0.55),
    blackKeyHighlight: 'rgba(255, 255, 255, 0.14)',
    blackKeyLabel:     '#ffffff',
  }
}

class PianoRoll {
  constructor() {
    this.canvas      = null
    this.ctx         = null
    this.noteEvents  = []
    this.allNotes    = []
    this.bpm         = 120
    this.canvasW     = 1
    this.canvasH     = 1
    this.pianoW      = 90
    this.rowH        = 0
    this.totalTime   = 0
    this._animId     = null
    this._running    = false
    this._active     = new Set()
  }

  init(canvasEl) {
    this.canvas = canvasEl
    this.ctx    = canvasEl.getContext('2d')
  }

  setup(noteEvents, allNotes, bpm, canvasW, canvasH, totalTime) {
    this.noteEvents = noteEvents
    this.allNotes   = allNotes.slice().reverse()
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

    // note blocks (slightly smaller than workspace's editable blocks)
    const bw = Math.max(4, Math.min(this.rowH * 0.55, 9))
    const bh = Math.max(3, this.rowH * 0.55)

    this.noteEvents.forEach(evt => {
      const noteIdx = this.allNotes.indexOf(evt.note)
      if (noteIdx === -1) return

      const baseX = pw + (evt.x / this.canvasW) * rollW
      const nx    = baseX - scrollX
      if (nx < pw - bw || nx > W + bw) return

      const ny      = noteIdx * this.rowH + this.rowH / 2
      const atPiano = nx <= pw + bw / 2 && nx >= pw - bw * 1.5
      if (atPiano) this._active.add(evt.note)

      ctx.fillStyle = atPiano ? c.accentH : c.accent
      _rr(ctx, nx - bw / 2, ny - bh / 2, bw, bh, Math.min(2, bw / 3))
      ctx.fill()
    })

    // piano keys (drawn on top)
    this._drawKeys(c)

    // playhead
    ctx.strokeStyle = c.border
    ctx.globalAlpha = 0.4
    ctx.lineWidth   = 1.5
    ctx.beginPath(); ctx.moveTo(pw, 0); ctx.lineTo(pw, H); ctx.stroke()
    ctx.globalAlpha = 1
  }

  _drawKeys(c) {
    const ctx   = this.ctx
    const pw    = this.pianoW
    const rh    = this.rowH
    const H     = this.canvas.height
    const bkW   = pw * 0.62
    const bkPad = Math.max(0.5, rh * 0.07)
    const p     = _keyPalette(c)

    // White key base
    ctx.fillStyle = p.whiteKey
    ctx.fillRect(0, 0, pw, H)

    // White key separators + active highlights
    this.allNotes.forEach((note, idx) => {
      const y      = idx * rh
      const isBlk  = note.includes('#')
      const active = this._active.has(note)
      if (isBlk) return

      if (active) {
        ctx.fillStyle = c.accent + '44'
        ctx.fillRect(0, y, pw, rh)
      }
      ctx.strokeStyle = p.whiteKeyEdge
      ctx.lineWidth   = 0.5
      ctx.beginPath(); ctx.moveTo(0, y + rh); ctx.lineTo(pw, y + rh); ctx.stroke()
    })

    // Black keys
    this.allNotes.forEach((note, idx) => {
      const y      = idx * rh
      const isBlk  = note.includes('#')
      if (!isBlk) return
      const active = this._active.has(note)

      const grad = ctx.createLinearGradient(0, y, bkW, y)
      if (active) {
        grad.addColorStop(0, c.accent)
        grad.addColorStop(1, c.accentH)
      } else {
        grad.addColorStop(0,   p.blackKeyTop)
        grad.addColorStop(0.6, p.blackKeyMid)
        grad.addColorStop(1,   p.blackKeyBottom)
      }
      ctx.fillStyle = grad
      _rr(ctx, 0, y + bkPad, bkW, rh - bkPad * 2, 2)
      ctx.fill()

      if (!active) {
        ctx.fillStyle = p.blackKeyHighlight
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
          ? (active ? '#ffffff' : p.blackKeyLabel)
          : (active ? c.accent  : p.whiteKeyLabel)
        ctx.globalAlpha  = active ? 1 : (isBlk ? 0.75 : 1)
        ctx.font         = `${Math.min(10, Math.floor(rh * 0.60))}px monospace`
        ctx.textAlign    = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText(note, pw - 4, y + rh / 2)
        ctx.globalAlpha  = 1
      })
    }

    // Right border
    ctx.strokeStyle = c.border
    ctx.lineWidth   = 1
    ctx.beginPath(); ctx.moveTo(pw, 0); ctx.lineTo(pw, H); ctx.stroke()
  }
}
