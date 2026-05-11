class Workspace {
  constructor() {
    this.canvas   = null
    this.ctx      = null
    this.pianoW   = 90
    this.rowH     = 0
    this.layers   = []
    this.allNotes = []   // high → low
    this.canvasW  = 1
    this._sel     = null  // {layerIdx, noteIdx}
    this._drag    = null
    this.onChange = null  // called after note edit
  }

  init(canvasEl) {
    this.canvas = canvasEl
    this.ctx    = canvasEl.getContext('2d')
    this._bindEvents()
  }

  setup(layers, scaleNotes, canvasW) {
    this.layers   = layers
    this.allNotes = [...scaleNotes].reverse()   // high → low for display
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

    // Notes per layer
    this.layers.forEach((layer, li) => {
      layer.notes.forEach((evt, ni) => {
        const ri = this.allNotes.indexOf(evt.note)
        if (ri === -1) return
        const nx     = pw + (evt.x / this.canvasW) * rollW
        const ny     = ri * rh
        const isSel  = this._sel?.layerIdx === li && this._sel?.noteIdx === ni

        ctx.globalAlpha = isSel ? 1 : 0.82
        ctx.fillStyle   = layer.color
        _rr(ctx, nx - noteW / 2, ny + 1, noteW, rh - 2, 3)
        ctx.fill()

        if (isSel) {
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      })
    })

    // Layer legend (top-right)
    if (this.layers.length > 1) {
      this.layers.forEach((layer, li) => {
        const lx = W - 8 - (this.layers.length - li) * 38
        ctx.fillStyle = layer.color
        ctx.fillRect(lx, 5, 10, 10)
        ctx.fillStyle    = c.textMuted
        ctx.font         = '10px monospace'
        ctx.textAlign    = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(layer.name, lx + 13, 10)
      })
    }

    // Empty hint
    if (this.layers.every(l => l.notes.length === 0)) {
      ctx.fillStyle    = c.textMuted
      ctx.font         = '13px sans-serif'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('先转换图层，再来这里编辑', pw + rollW / 2, H / 2)
    }

    this._drawPianoKeys()

    // Separator
    ctx.strokeStyle = c.border; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(pw, 0); ctx.lineTo(pw, H); ctx.stroke()
  }

  _drawPianoKeys() {
    const ctx  = this.ctx
    const pw   = this.pianoW
    const rh   = this.rowH
    const H    = this.canvas.height
    const bkW  = pw * 0.62
    const bkPad = Math.max(0.5, rh * 0.07)

    ctx.fillStyle = '#f5f0e6'
    ctx.fillRect(0, 0, pw, H)

    this.allNotes.forEach((_, idx) => {
      ctx.strokeStyle = '#c9bfab'; ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(0, idx * rh + rh); ctx.lineTo(pw, idx * rh + rh); ctx.stroke()
    })

    this.allNotes.forEach((note, idx) => {
      if (!note.includes('#')) return
      const y    = idx * rh
      const grad = ctx.createLinearGradient(0, y, bkW, y)
      grad.addColorStop(0, '#1c1c1c'); grad.addColorStop(1, '#484848')
      ctx.fillStyle = grad
      _rr(ctx, 0, y + bkPad, bkW, rh - bkPad * 2, 2)
      ctx.fill()
    })

    if (rh >= 9) {
      this.allNotes.forEach((note, idx) => {
        const isBlk = note.includes('#')
        if (!(!isBlk && note[0] === 'C') && rh < 13) return
        ctx.fillStyle    = isBlk ? 'rgba(255,255,255,0.55)' : '#8a7c68'
        ctx.font         = `${Math.min(10, Math.floor(rh * 0.60))}px monospace`
        ctx.textAlign    = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText(note, pw - 4, idx * rh + rh / 2)
      })
    }
  }

  /* ── Interaction ──────────────────────────────────────────── */

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
      bg: g('--bg'), surface: g('--surface'), border: g('--border'),
      accent: g('--accent'), text: g('--text'), textMuted: g('--text-muted'),
    }
  }
}
