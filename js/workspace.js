class Workspace {
  constructor() {
    this.canvas   = null
    this.ctx      = null
    this.pianoW   = 90
    this.rowH     = 0
    this.layers   = []
    this.allNotes = []
    this.canvasW  = 1
    this._sel     = null
    this._drag    = null
    this.onChange = null
  }

  init(canvasEl) {
    this.canvas = canvasEl
    this.ctx    = canvasEl.getContext('2d')
    this._bindEvents()
  }

  setup(layers, scaleNotes, canvasW) {
    this.layers   = layers
    this.allNotes = [...scaleNotes].reverse()
    this.canvasW  = canvasW
    this.rowH     = this.canvas.height / this.allNotes.length
    this._sel     = null
    this._drag    = null
  }

  draw() {
    const ctx   = this.ctx
    const W     = this.canvas.width
    const H     = this.canvas.height
    const pw    = this.pianoW
    const rollW = W - pw
    const c     = this._tc()
    const rh    = this.rowH
    const noteW = Math.max(6, rh * 0.75)

    // Background
    ctx.fillStyle = c.bg
    ctx.fillRect(0, 0, W, H)

    // Row backgrounds
    this.allNotes.forEach((note, idx) => {
      ctx.fillStyle = note.includes('#') ? c.bg : c.surface
      ctx.fillRect(pw, idx * rh, rollW, rh)
    })

    // C-note grid lines
    this.allNotes.forEach((note, idx) => {
      if (note[0] === 'C' && !note.includes('#')) {
        ctx.strokeStyle = c.border; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(pw, idx * rh); ctx.lineTo(W, idx * rh); ctx.stroke()
      }
    })

    // Notes per layer — colors derive from the current theme so blocks
    // follow the palette. Multi-layer cases get distinct shades.
    this.layers.forEach((layer, li) => {
      const blockColor = this._blockColor(li, c, layer)
      layer.notes.forEach((evt, ni) => {
        const ri = this.allNotes.indexOf(evt.note)
        if (ri === -1) return
        const nx     = pw + (evt.x / this.canvasW) * rollW
        const ny     = ri * rh
        const isSel  = this._sel?.layerIdx === li && this._sel?.noteIdx === ni

        ctx.globalAlpha = isSel ? 1 : 0.85
        ctx.fillStyle   = blockColor
        _rr(ctx, nx - noteW / 2, ny + 1, noteW, rh - 2, 3)
        ctx.fill()

        if (isSel) {
          ctx.strokeStyle = c.text
          ctx.lineWidth   = 1.5
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      })
    })

    // Layer legend (top-right) — matches block colors
    if (this.layers.length > 1) {
      this.layers.forEach((layer, li) => {
        const lx = W - 8 - (this.layers.length - li) * 38
        ctx.fillStyle = this._blockColor(li, c, layer)
        ctx.fillRect(lx, 5, 10, 10)
        ctx.fillStyle    = c.textMuted
        ctx.font         = '10px monospace'
        ctx.textAlign    = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(layer.name, lx + 13, 10)
      })
    }

    this._drawPianoKeys(c)

    // Separator
    ctx.strokeStyle = c.border; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(pw, 0); ctx.lineTo(pw, H); ctx.stroke()
  }

  _drawPianoKeys(c) {
    const ctx   = this.ctx
    const pw    = this.pianoW
    const rh    = this.rowH
    const H     = this.canvas.height
    const bkW   = pw * 0.62
    const bkPad = Math.max(0.5, rh * 0.07)
    const p     = _keyPalette(c)

    ctx.fillStyle = p.whiteKey
    ctx.fillRect(0, 0, pw, H)

    this.allNotes.forEach((_, idx) => {
      ctx.strokeStyle = p.whiteKeyEdge; ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(0, idx * rh + rh); ctx.lineTo(pw, idx * rh + rh); ctx.stroke()
    })

    this.allNotes.forEach((note, idx) => {
      if (!note.includes('#')) return
      const y    = idx * rh
      const grad = ctx.createLinearGradient(0, y, bkW, y)
      grad.addColorStop(0,   p.blackKeyTop)
      grad.addColorStop(0.6, p.blackKeyMid)
      grad.addColorStop(1,   p.blackKeyBottom)
      ctx.fillStyle = grad
      _rr(ctx, 0, y + bkPad, bkW, rh - bkPad * 2, 2)
      ctx.fill()

      ctx.fillStyle = p.blackKeyHighlight
      _rr(ctx, 2, y + bkPad + 1, bkW - 4, (rh - bkPad * 2) * 0.28, 1)
      ctx.fill()
    })

    if (rh >= 9) {
      this.allNotes.forEach((note, idx) => {
        const isBlk = note.includes('#')
        const isC   = !isBlk && note[0] === 'C'
        if (!isC && rh < 13) return
        ctx.fillStyle    = isBlk ? p.blackKeyLabel : p.whiteKeyLabel
        ctx.globalAlpha  = isBlk ? 0.75 : 1
        ctx.font         = `${Math.min(10, Math.floor(rh * 0.60))}px monospace`
        ctx.textAlign    = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText(note, pw - 4, idx * rh + rh / 2)
        ctx.globalAlpha  = 1
      })
    }
  }

  _pos(e) {
    const r = this.canvas.getBoundingClientRect()
    return {
      cx: (e.clientX - r.left) * (this.canvas.width  / r.width),
      cy: (e.clientY - r.top)  * (this.canvas.height / r.height),
    }
  }

  _hitTest(cx, cy) {
    if (cx < this.pianoW) return null
    const rollW = this.canvas.width - this.pianoW
    const noteW = Math.max(6, this.rowH * 0.75)

    for (let li = this.layers.length - 1; li >= 0; li--) {
      const layer = this.layers[li]
      for (let ni = 0; ni < layer.notes.length; ni++) {
        const evt = layer.notes[ni]
        const ri  = this.allNotes.indexOf(evt.note)
        if (ri === -1) continue
        const nx = this.pianoW + (evt.x / this.canvasW) * rollW
        const ny = ri * this.rowH
        if (Math.abs(cx - nx) <= noteW / 2 + 2 && cy >= ny && cy < ny + this.rowH) {
          return { layerIdx: li, noteIdx: ni }
        }
      }
    }
    return null
  }

  _bindEvents() {
    const cv = this.canvas

    cv.addEventListener('mousedown', e => {
      const { cx, cy } = this._pos(e)
      const hit = this._hitTest(cx, cy)
      if (hit) {
        this._sel  = hit
        const evt  = this.layers[hit.layerIdx].notes[hit.noteIdx]
        this._drag = { ...hit, startCX: cx, startCY: cy, origX: evt.x, origNote: evt.note }
      } else {
        this._sel  = null
        this._drag = null
      }
      this.draw()
    })

    cv.addEventListener('mousemove', e => {
      if (!this._drag) return
      const { cx, cy } = this._pos(e)
      const rollW = cv.width - this.pianoW
      const evt   = this.layers[this._drag.layerIdx].notes[this._drag.noteIdx]

      evt.x    = Math.max(0, Math.min(this.canvasW,
        this._drag.origX + (cx - this._drag.startCX) / rollW * this.canvasW))
      const ri = Math.max(0, Math.min(this.allNotes.length - 1, Math.floor(cy / this.rowH)))
      evt.note = this.allNotes[ri]

      this.draw()
      if (this.onChange) this.onChange()
    })

    cv.addEventListener('mouseup',    () => { this._drag = null })
    cv.addEventListener('mouseleave', () => { this._drag = null })

    document.addEventListener('keydown', e => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && this._sel) {
        if (this.canvas.classList.contains('hidden')) return
        const { layerIdx, noteIdx } = this._sel
        this.layers[layerIdx].notes.splice(noteIdx, 1)
        this._sel = null; this._drag = null
        this.draw()
        if (this.onChange) this.onChange()
      }
    })
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

  /* Theme-aware block color per layer index. Layer 0 = accent, layer 1
     = accent-h; layer 2+ falls back to LAYER_COLORS so multi-layer
     projects still get visual differentiation. */
  _blockColor(li, c, layer) {
    if (li === 0) return c.accent
    if (li === 1) return c.accentH
    return (layer && layer.color) ? layer.color : c.accent
  }
}
