class CanvasManager {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId)
    this.ctx    = this.canvas.getContext('2d')
    this.mode      = 'normal'
    this.drawTool  = 'freehand'
    this.brushSize  = 6
    this.brushColor = '#ffffff'
    this.isDrawing  = false
    this.lastX = 0
    this.lastY = 0

    this.strokes        = []   // fallback when no lm
    this._currentStroke = []
    this._shapeStart    = null
    this._snapshot      = null  // main canvas snapshot (shape preview)
    this._layerSnap     = null  // active layer snapshot (shape commit)
    this._rainbowHue    = 0
    this.lm             = null  // LayerManager

    this.onResize = null

    this._initSize()
    this._bindEvents()
    this._bindResize()
  }

  setLayerManager(lm) { this.lm = lm }

  _initSize() {
    const area = document.getElementById('canvas-area')
    const maxW = area.clientWidth  - 32
    const maxH = area.clientHeight - 32
    let w = maxW, h = Math.round(w * 5 / 9)
    if (h > maxH) { h = maxH; w = Math.round(h * 9 / 5) }
    this.canvas.width  = Math.max(w, 1)
    this.canvas.height = Math.max(h, 1)
  }

  _canResize() {
    if (this.lm) return this.lm.layers.every(l => l.strokes.length === 0)
    return this.strokes.length === 0
  }

  _bindResize() {
    new ResizeObserver(() => {
      if (this._canResize() && !this.isDrawing) {
        this._initSize()
        if (this.lm) this.lm.resize(this.canvas.width, this.canvas.height)
        if (this.onResize) this.onResize()
      }
    }).observe(document.getElementById('canvas-area'))
  }

  _bindEvents() {
    this.canvas.addEventListener('mousedown',  e => this._onStart(e))
    this.canvas.addEventListener('mousemove',  e => this._onMove(e))
    this.canvas.addEventListener('mouseup',    () => this._onEnd())
    this.canvas.addEventListener('mouseleave', () => this._onEnd())
    this.canvas.addEventListener('touchstart', e => { e.preventDefault(); this._onStart(e.touches[0]) }, { passive: false })
    this.canvas.addEventListener('touchmove',  e => { e.preventDefault(); this._onMove(e.touches[0])  }, { passive: false })
    this.canvas.addEventListener('touchend',   () => this._onEnd())
  }

  _pos(e) {
    const r = this.canvas.getBoundingClientRect()
    return {
      x: (e.clientX - r.left) * (this.canvas.width  / r.width),
      y: (e.clientY - r.top)  * (this.canvas.height / r.height)
    }
  }

  _isFreehand() {
    return ['freehand','neon','spray','calligraphy','rainbow'].includes(this.drawTool)
  }

  _activeStrokes() { return this.lm ? this.lm.active.strokes : this.strokes }

  /* ── Event handlers ──────────────────────────────────────── */

  _onStart(e) {
    this.isDrawing = true
    document.getElementById('canvas-container')?.classList.add('has-drawn')
    const p = this._pos(e)
    this.lastX = p.x; this.lastY = p.y

    if (this._isFreehand()) {
      this._currentStroke = [{ x: p.x, y: p.y }]
      this._strokeSegment(p.x, p.y, p.x, p.y)
    } else {
      this._shapeStart = p
      this._snapshot   = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
      if (this.lm) {
        this._layerSnap = this.lm.active.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
      }
    }
  }

  _onMove(e) {
    if (!this.isDrawing) return
    const p = this._pos(e)

    if (this._isFreehand()) {
      this._strokeSegment(this.lastX, this.lastY, p.x, p.y)
      this._currentStroke.push({ x: p.x, y: p.y })
    } else {
      // Preview on main canvas only (restore composite snapshot)
      this.ctx.putImageData(this._snapshot, 0, 0)
      this._renderShape(this._shapeStart, p, this.ctx)
    }
    this.lastX = p.x; this.lastY = p.y
  }

  _onEnd() {
    if (!this.isDrawing) return

    let committed = false

    if (this._isFreehand()) {
      if (this._currentStroke.length > 0) {
        const W = this.canvas.width, H = this.canvas.height
        const s = this._currentStroke
        const target = this._activeStrokes()
        target.push([...s])
        if (this.mode === 'symmetric') target.push(s.map(p => ({ x: W - p.x, y: p.y })))
        if (this.mode === 'kaleidoscope') {
          target.push(s.map(p => ({ x: W - p.x, y:     p.y })))
          target.push(s.map(p => ({ x:     p.x, y: H - p.y })))
          target.push(s.map(p => ({ x: W - p.x, y: H - p.y })))
        }
        committed = true
      }
      this._currentStroke = []
      if (this.lm) this.lm.composite(this.ctx)

    } else if (this._shapeStart) {
      const end = { x: this.lastX, y: this.lastY }
      const dx  = Math.abs(end.x - this._shapeStart.x)
      const dy  = Math.abs(end.y - this._shapeStart.y)

      if (dx > 5 || dy > 5) {
        if (this.lm) {
          // Commit shape to active layer canvas
          this.lm.active.ctx.putImageData(this._layerSnap, 0, 0)
          const allPts = this._renderShape(this._shapeStart, end, this.lm.active.ctx)
          allPts.forEach(s => this.lm.active.strokes.push(s))
          this.lm.composite(this.ctx)
        } else {
          this.ctx.putImageData(this._snapshot, 0, 0)
          const allPts = this._renderShape(this._shapeStart, end, this.ctx)
          allPts.forEach(s => this.strokes.push(s))
        }
        committed = true
      } else {
        this.ctx.putImageData(this._snapshot, 0, 0)
      }
      this._shapeStart = null; this._snapshot = null; this._layerSnap = null
    }
    this.isDrawing = false

    if (committed && this.lm) {
      this.lm.pushHistory()
      this._notifyHistoryChange()
    }
  }

  /* ── Undo / Redo ──────────────────────────────────────────── */

  setOnHistoryChange(fn) { this._onHistoryChange = fn }
  _notifyHistoryChange() { if (this._onHistoryChange) this._onHistoryChange() }

  canUndo() { return !!this.lm && this.lm.canUndo() }
  canRedo() { return !!this.lm && this.lm.canRedo() }

  undo() {
    if (!this.lm || !this.lm.undo()) return false
    this.lm.composite(this.ctx)
    this._refreshEmptyHint()
    this._notifyHistoryChange()
    return true
  }

  redo() {
    if (!this.lm || !this.lm.redo()) return false
    this.lm.composite(this.ctx)
    this._refreshEmptyHint()
    this._notifyHistoryChange()
    return true
  }

  _refreshEmptyHint() {
    const container = document.getElementById('canvas-container')
    if (!container) return
    const empty = this.lm ? this.lm.isEmpty() : this.strokes.length === 0
    container.classList.toggle('has-drawn', !empty)
  }

  /* ── Freehand stroke ─────────────────────────────────────── */

  _strokeSegment(x1, y1, x2, y2) {
    const W = this.canvas.width, H = this.canvas.height
    const pairs = [[x1, y1, x2, y2]]
    if (this.mode === 'symmetric') pairs.push([W-x1, y1, W-x2, y2])
    if (this.mode === 'kaleidoscope') {
      pairs.push([W-x1, y1, W-x2, y2])
      pairs.push([x1, H-y1, x2, H-y2])
      pairs.push([W-x1, H-y1, W-x2, H-y2])
    }

    if (this.drawTool === 'rainbow') this._rainbowHue = (this._rainbowHue + 4) % 360

    // Draw to active layer canvas
    if (this.lm) this._drawStroke(this.lm.active.ctx, pairs)
    // Draw to main canvas for live preview
    this._drawStroke(this.ctx, pairs)
  }

  _drawStroke(ctx, pairs) {
    switch (this.drawTool) {
      case 'neon':        return this._strokeNeon(ctx, pairs)
      case 'spray':       return this._strokeSpray(ctx, pairs)
      case 'calligraphy': return this._strokeCalligraphy(ctx, pairs)
      case 'rainbow':     return this._strokeRainbow(ctx, pairs)
      default:
        ctx.save()
        ctx.strokeStyle = this.brushColor; ctx.lineWidth = this.brushSize
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'
        for (const [ax1,ay1,ax2,ay2] of pairs) {
          ctx.beginPath(); ctx.moveTo(ax1,ay1); ctx.lineTo(ax2,ay2); ctx.stroke()
        }
        ctx.restore()
    }
  }

  _strokeNeon(ctx, pairs) {
    ctx.save()
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.strokeStyle = this.brushColor; ctx.shadowColor = this.brushColor
    ctx.lineWidth = this.brushSize * 4; ctx.globalAlpha = 0.07; ctx.shadowBlur = this.brushSize * 10
    for (const [x1,y1,x2,y2] of pairs) { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke() }
    ctx.lineWidth = this.brushSize * 1.5; ctx.globalAlpha = 0.35; ctx.shadowBlur = this.brushSize * 4
    for (const [x1,y1,x2,y2] of pairs) { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke() }
    ctx.lineWidth = this.brushSize * 0.5; ctx.globalAlpha = 1; ctx.shadowBlur = this.brushSize * 2
    for (const [x1,y1,x2,y2] of pairs) { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke() }
    ctx.restore()
  }

  _strokeSpray(ctx, pairs) {
    const r = this.brushSize * 2.5, density = 22
    ctx.save(); ctx.fillStyle = this.brushColor
    for (const [,,ax2,ay2] of pairs) {
      for (let i = 0; i < density; i++) {
        const angle = Math.random() * Math.PI * 2
        const dist  = Math.sqrt(Math.random()) * r
        ctx.globalAlpha = Math.random() * 0.55 + 0.3
        ctx.beginPath()
        ctx.arc(ax2 + Math.cos(angle)*dist, ay2 + Math.sin(angle)*dist, Math.random()*1.2+0.4, 0, Math.PI*2)
        ctx.fill()
      }
    }
    ctx.restore()
  }

  _strokeCalligraphy(ctx, pairs) {
    const nibAngle = Math.PI / 4
    ctx.save(); ctx.strokeStyle = this.brushColor; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    for (const [x1,y1,x2,y2] of pairs) {
      const factor = Math.abs(Math.sin(Math.atan2(y2-y1, x2-x1) - nibAngle))
      ctx.lineWidth = Math.max(this.brushSize * 0.3 + factor * this.brushSize * 2.5, 0.5)
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke()
    }
    ctx.restore()
  }

  _strokeRainbow(ctx, pairs) {
    ctx.save()
    ctx.strokeStyle = `hsl(${this._rainbowHue}, 100%, 55%)`
    ctx.lineWidth = this.brushSize; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    for (const [x1,y1,x2,y2] of pairs) { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke() }
    ctx.restore()
  }

  /* ── Shape tools ─────────────────────────────────────────── */

  _renderShape(start, end, targetCtx = this.ctx) {
    const pts = this._shapePoints(start, end)
    if (!pts.length) return []

    const W = this.canvas.width, H = this.canvas.height
    targetCtx.save()
    targetCtx.strokeStyle = this.brushColor; targetCtx.lineWidth = this.brushSize
    targetCtx.lineCap = 'round'; targetCtx.lineJoin = 'round'

    const drawPath = pts => {
      targetCtx.beginPath(); targetCtx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) targetCtx.lineTo(pts[i].x, pts[i].y)
      targetCtx.stroke()
    }

    const all = [pts]
    if (this.mode === 'symmetric') all.push(pts.map(p => ({ x: W-p.x, y: p.y })))
    if (this.mode === 'kaleidoscope') {
      all.push(pts.map(p => ({ x: W-p.x, y:    p.y })))
      all.push(pts.map(p => ({ x:    p.x, y: H-p.y })))
      all.push(pts.map(p => ({ x: W-p.x, y: H-p.y })))
    }
    all.forEach(drawPath)
    targetCtx.restore()
    return all
  }

  _shapePoints(start, end) {
    const cx = (start.x + end.x) / 2, cy = (start.y + end.y) / 2
    const rx = Math.abs(end.x - start.x) / 2, ry = Math.abs(end.y - start.y) / 2
    switch (this.drawTool) {
      case 'line':     return this._linePts(start, end)
      case 'rect':     return this._rectPts(start, end)
      case 'circle':   return this._ellipsePts(cx, cy, rx, ry)
      case 'heart':    return this._heartPts(cx, cy, Math.min(rx, ry))
      case 'triangle': return this._trianglePts(start, end)
      case 'star':     return this._starPts(cx, cy, Math.min(rx, ry))
      default:         return []
    }
  }

  _linePts(s, e, n = 80) {
    return Array.from({ length: n+1 }, (_, i) => ({ x: s.x+(e.x-s.x)*i/n, y: s.y+(e.y-s.y)*i/n }))
  }

  _rectPts(s, e, n = 30) {
    const x1=Math.min(s.x,e.x), x2=Math.max(s.x,e.x), y1=Math.min(s.y,e.y), y2=Math.max(s.y,e.y)
    const L=(a,b,t)=>a+(b-a)*t, pts=[]
    for (let i=0;i<=n;i++) pts.push({x:L(x1,x2,i/n),y:y1})
    for (let i=0;i<=n;i++) pts.push({x:x2,y:L(y1,y2,i/n)})
    for (let i=0;i<=n;i++) pts.push({x:L(x2,x1,i/n),y:y2})
    for (let i=0;i<=n;i++) pts.push({x:x1,y:L(y2,y1,i/n)})
    return pts
  }

  _ellipsePts(cx, cy, rx, ry, n = 100) {
    return Array.from({length:n+1}, (_,i) => {
      const a=(i/n)*Math.PI*2; return {x:cx+rx*Math.cos(a),y:cy+ry*Math.sin(a)}
    })
  }

  _heartPts(cx, cy, r, n = 100) {
    if (r<2) return []
    const s=r/16
    return Array.from({length:n+1}, (_,i) => {
      const t=(i/n)*Math.PI*2
      return {x:cx+16*Math.pow(Math.sin(t),3)*s, y:cy-(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t)+2.75)*s}
    })
  }

  _trianglePts(s, e, n = 30) {
    const x1=Math.min(s.x,e.x),x2=Math.max(s.x,e.x),y1=Math.min(s.y,e.y),y2=Math.max(s.y,e.y)
    const top={x:(x1+x2)/2,y:y1},bl={x:x1,y:y2},br={x:x2,y:y2}
    const L=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}), pts=[]
    for (let i=0;i<=n;i++) pts.push(L(top,br,i/n))
    for (let i=0;i<=n;i++) pts.push(L(br,bl,i/n))
    for (let i=0;i<=n;i++) pts.push(L(bl,top,i/n))
    return pts
  }

  _starPts(cx, cy, r, arms=5, n=30) {
    if (r<2) return []
    const innerR=r*0.42, total=arms*2, verts=[]
    for (let i=0;i<=total;i++) {
      const a=(i/total)*Math.PI*2-Math.PI/2, rad=i%2===0?r:innerR
      verts.push({x:cx+rad*Math.cos(a),y:cy+rad*Math.sin(a)})
    }
    const pts=[]
    for (let i=0;i<verts.length-1;i++) {
      const a=verts[i],b=verts[i+1]
      for (let k=0;k<n;k++) { const t=k/n; pts.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}) }
    }
    pts.push(verts[verts.length-1])
    return pts
  }

  /* ── Public API ──────────────────────────────────────────── */

  setMode(mode)        { this.mode = mode }
  setDrawTool(tool)    { this.drawTool = tool }
  setBrushSize(size)   { this.brushSize = size }
  setBrushColor(color) { this.brushColor = color }

  clear() {
    if (this.lm) {
      this.lm.clearActive()
      this.lm.composite(this.ctx)
      this.lm.pushHistory()
    } else {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
      this.strokes = []
    }
    this._currentStroke = []; this._shapeStart = null
    this._snapshot = null; this._layerSnap = null; this._rainbowHue = 0
    // Only flip back to the empty-state hint if every layer is truly empty.
    // Clearing one of several layers should not re-show "draw something here"
    // while other layers still have visible strokes.
    this._refreshEmptyHint()
    this._notifyHistoryChange()
  }

  getStrokes() { return this.lm ? this.lm.active.strokes : this.strokes }
  getSize()    { return { width: this.canvas.width, height: this.canvas.height } }
}
