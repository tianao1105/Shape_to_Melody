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

    this.strokes        = []
    this._currentStroke = []
    this._shapeStart    = null
    this._snapshot      = null
    this._rainbowHue    = 0

    this.onResize = null

    this._initSize()
    this._bindEvents()
    this._bindResize()
  }

  _initSize() {
    const area = document.getElementById('canvas-area')
    const maxW = area.clientWidth  - 32
    const maxH = area.clientHeight - 32
    let w = maxW, h = Math.round(w * 5 / 9)
    if (h > maxH) { h = maxH; w = Math.round(h * 9 / 5) }
    this.canvas.width  = Math.max(w, 1)
    this.canvas.height = Math.max(h, 1)
  }

  _bindResize() {
    new ResizeObserver(() => {
      if (this.strokes.length === 0 && !this.isDrawing) {
        this._initSize()
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
    return ['freehand', 'neon', 'spray', 'calligraphy', 'rainbow'].includes(this.drawTool)
  }

  /* ── Event handlers ──────────────────────────────────────── */

  _onStart(e) {
    this.isDrawing = true
    const p = this._pos(e)
    this.lastX = p.x
    this.lastY = p.y

    if (this._isFreehand()) {
      this._currentStroke = [{ x: p.x, y: p.y }]
      this._strokeSegment(p.x, p.y, p.x, p.y)
    } else {
      this._shapeStart = p
      this._snapshot = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
    }
  }

  _onMove(e) {
    if (!this.isDrawing) return
    const p = this._pos(e)

    if (this._isFreehand()) {
      this._strokeSegment(this.lastX, this.lastY, p.x, p.y)
      this._currentStroke.push({ x: p.x, y: p.y })
    } else {
      this.ctx.putImageData(this._snapshot, 0, 0)
      this._renderShape(this._shapeStart, p)
    }

    this.lastX = p.x
    this.lastY = p.y
  }

  _onEnd() {
    if (!this.isDrawing) return

    if (this._isFreehand()) {
      if (this._currentStroke.length > 0) {
        const W = this.canvas.width, H = this.canvas.height
        const s = this._currentStroke
        this.strokes.push([...s])
        if (this.mode === 'symmetric') {
          this.strokes.push(s.map(p => ({ x: W - p.x, y: p.y })))
        }
        if (this.mode === 'kaleidoscope') {
          this.strokes.push(s.map(p => ({ x: W - p.x, y:     p.y })))
          this.strokes.push(s.map(p => ({ x:     p.x, y: H - p.y })))
          this.strokes.push(s.map(p => ({ x: W - p.x, y: H - p.y })))
        }
      }
      this._currentStroke = []
    } else if (this._shapeStart) {
      const end = { x: this.lastX, y: this.lastY }
      const dx = Math.abs(end.x - this._shapeStart.x)
      const dy = Math.abs(end.y - this._shapeStart.y)

      if (dx > 5 || dy > 5) {
        this.ctx.putImageData(this._snapshot, 0, 0)
        const allPts = this._renderShape(this._shapeStart, end)
        allPts.forEach(s => this.strokes.push(s))
      }
      this._shapeStart = null
      this._snapshot   = null
    }

    this.isDrawing = false
  }

  /* ── Freehand stroke ─────────────────────────────────────── */

  _strokeSegment(x1, y1, x2, y2) {
    const W = this.canvas.width, H = this.canvas.height
    const pairs = [[x1, y1, x2, y2]]
    if (this.mode === 'symmetric') {
      pairs.push([W-x1, y1, W-x2, y2])
    }
    if (this.mode === 'kaleidoscope') {
      pairs.push([W-x1,   y1, W-x2,   y2])
      pairs.push([  x1, H-y1,   x2, H-y2])
      pairs.push([W-x1, H-y1, W-x2, H-y2])
    }

    switch (this.drawTool) {
      case 'neon':        return this._strokeNeon(pairs)
      case 'spray':       return this._strokeSpray(pairs)
      case 'calligraphy': return this._strokeCalligraphy(pairs)
      case 'rainbow':     return this._strokeRainbow(pairs)
      default:
        this.ctx.save()
        this.ctx.strokeStyle = this.brushColor
        this.ctx.lineWidth   = this.brushSize
        this.ctx.lineCap     = 'round'
        this.ctx.lineJoin    = 'round'
        for (const [ax1,ay1,ax2,ay2] of pairs) {
          this.ctx.beginPath(); this.ctx.moveTo(ax1,ay1); this.ctx.lineTo(ax2,ay2); this.ctx.stroke()
        }
        this.ctx.restore()
    }
  }

  _strokeNeon(pairs) {
    this.ctx.save()
    this.ctx.lineCap     = 'round'
    this.ctx.lineJoin    = 'round'
    this.ctx.strokeStyle = this.brushColor
    this.ctx.shadowColor = this.brushColor
    // outer bloom
    this.ctx.lineWidth   = this.brushSize * 4
    this.ctx.globalAlpha = 0.07
    this.ctx.shadowBlur  = this.brushSize * 10
    for (const [x1,y1,x2,y2] of pairs) {
      this.ctx.beginPath(); this.ctx.moveTo(x1,y1); this.ctx.lineTo(x2,y2); this.ctx.stroke()
    }
    // inner glow
    this.ctx.lineWidth   = this.brushSize * 1.5
    this.ctx.globalAlpha = 0.35
    this.ctx.shadowBlur  = this.brushSize * 4
    for (const [x1,y1,x2,y2] of pairs) {
      this.ctx.beginPath(); this.ctx.moveTo(x1,y1); this.ctx.lineTo(x2,y2); this.ctx.stroke()
    }
    // bright core
    this.ctx.lineWidth   = this.brushSize * 0.5
    this.ctx.globalAlpha = 1
    this.ctx.shadowBlur  = this.brushSize * 2
    for (const [x1,y1,x2,y2] of pairs) {
      this.ctx.beginPath(); this.ctx.moveTo(x1,y1); this.ctx.lineTo(x2,y2); this.ctx.stroke()
    }
    this.ctx.restore()
  }

  _strokeSpray(pairs) {
    const r       = this.brushSize * 2.5
    const density = 22
    this.ctx.save()
    this.ctx.fillStyle = this.brushColor
    for (const [,,ax2,ay2] of pairs) {
      for (let i = 0; i < density; i++) {
        const angle = Math.random() * Math.PI * 2
        const dist  = Math.sqrt(Math.random()) * r
        this.ctx.globalAlpha = Math.random() * 0.55 + 0.3
        this.ctx.beginPath()
        this.ctx.arc(
          ax2 + Math.cos(angle) * dist,
          ay2 + Math.sin(angle) * dist,
          Math.random() * 1.2 + 0.4, 0, Math.PI * 2
        )
        this.ctx.fill()
      }
    }
    this.ctx.restore()
  }

  _strokeCalligraphy(pairs) {
    const nibAngle = Math.PI / 4   // 45° nib
    this.ctx.save()
    this.ctx.strokeStyle = this.brushColor
    this.ctx.lineCap     = 'round'
    this.ctx.lineJoin    = 'round'
    for (const [x1,y1,x2,y2] of pairs) {
      const angle  = Math.atan2(y2 - y1, x2 - x1)
      const factor = Math.abs(Math.sin(angle - nibAngle))
      this.ctx.lineWidth = Math.max(this.brushSize * 0.3 + factor * this.brushSize * 2.5, 0.5)
      this.ctx.beginPath(); this.ctx.moveTo(x1,y1); this.ctx.lineTo(x2,y2); this.ctx.stroke()
    }
    this.ctx.restore()
  }

  _strokeRainbow(pairs) {
    this._rainbowHue = (this._rainbowHue + 4) % 360
    this.ctx.save()
    this.ctx.strokeStyle = `hsl(${this._rainbowHue}, 100%, 55%)`
    this.ctx.lineWidth   = this.brushSize
    this.ctx.lineCap     = 'round'
    this.ctx.lineJoin    = 'round'
    for (const [x1,y1,x2,y2] of pairs) {
      this.ctx.beginPath(); this.ctx.moveTo(x1,y1); this.ctx.lineTo(x2,y2); this.ctx.stroke()
    }
    this.ctx.restore()
  }

  /* ── Shape tools ─────────────────────────────────────────── */

  _renderShape(start, end) {
    const pts = this._shapePoints(start, end)
    if (pts.length === 0) return []

    const W = this.canvas.width, H = this.canvas.height
    this.ctx.save()
    this.ctx.strokeStyle = this.brushColor
    this.ctx.lineWidth   = this.brushSize
    this.ctx.lineCap     = 'round'
    this.ctx.lineJoin    = 'round'

    const drawPath = (mapped) => {
      this.ctx.beginPath()
      this.ctx.moveTo(mapped[0].x, mapped[0].y)
      for (let i = 1; i < mapped.length; i++) this.ctx.lineTo(mapped[i].x, mapped[i].y)
      this.ctx.stroke()
    }

    const allStrokes = [pts]
    if (this.mode === 'symmetric') {
      allStrokes.push(pts.map(p => ({ x: W - p.x, y: p.y })))
    }
    if (this.mode === 'kaleidoscope') {
      allStrokes.push(pts.map(p => ({ x: W - p.x, y:     p.y })))
      allStrokes.push(pts.map(p => ({ x:     p.x, y: H - p.y })))
      allStrokes.push(pts.map(p => ({ x: W - p.x, y: H - p.y })))
    }
    allStrokes.forEach(drawPath)
    this.ctx.restore()
    return allStrokes
  }

  _shapePoints(start, end) {
    const cx = (start.x + end.x) / 2
    const cy = (start.y + end.y) / 2
    const rx = Math.abs(end.x - start.x) / 2
    const ry = Math.abs(end.y - start.y) / 2

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
    return Array.from({ length: n + 1 }, (_, i) => ({
      x: s.x + (e.x - s.x) * i / n,
      y: s.y + (e.y - s.y) * i / n
    }))
  }

  _rectPts(s, e, n = 30) {
    const x1 = Math.min(s.x,e.x), x2 = Math.max(s.x,e.x)
    const y1 = Math.min(s.y,e.y), y2 = Math.max(s.y,e.y)
    const lerp = (a, b, t) => a + (b-a)*t
    const pts = []
    for (let i=0;i<=n;i++) pts.push({ x: lerp(x1,x2,i/n), y: y1 })
    for (let i=0;i<=n;i++) pts.push({ x: x2, y: lerp(y1,y2,i/n) })
    for (let i=0;i<=n;i++) pts.push({ x: lerp(x2,x1,i/n), y: y2 })
    for (let i=0;i<=n;i++) pts.push({ x: x1, y: lerp(y2,y1,i/n) })
    return pts
  }

  _ellipsePts(cx, cy, rx, ry, n = 100) {
    return Array.from({ length: n + 1 }, (_, i) => {
      const a = (i / n) * Math.PI * 2
      return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }
    })
  }

  _heartPts(cx, cy, r, n = 100) {
    if (r < 2) return []
    const s = r / 16
    return Array.from({ length: n + 1 }, (_, i) => {
      const t = (i / n) * Math.PI * 2
      const x = 16 * Math.pow(Math.sin(t), 3)
      const y = 13*Math.cos(t) - 5*Math.cos(2*t) - 2*Math.cos(3*t) - Math.cos(4*t)
      return { x: cx + x * s, y: cy - (y + 2.75) * s }
    })
  }

  _trianglePts(s, e, n = 30) {
    const x1 = Math.min(s.x,e.x), x2 = Math.max(s.x,e.x)
    const y1 = Math.min(s.y,e.y), y2 = Math.max(s.y,e.y)
    const top = { x: (x1+x2)/2, y: y1 }
    const bl  = { x: x1, y: y2 }
    const br  = { x: x2, y: y2 }
    const lerp = (a, b, t) => ({ x: a.x+(b.x-a.x)*t, y: a.y+(b.y-a.y)*t })
    const pts = []
    for (let i=0;i<=n;i++) pts.push(lerp(top, br, i/n))
    for (let i=0;i<=n;i++) pts.push(lerp(br,  bl, i/n))
    for (let i=0;i<=n;i++) pts.push(lerp(bl, top, i/n))
    return pts
  }

  _starPts(cx, cy, r, arms = 5, n = 30) {
    if (r < 2) return []
    const innerR = r * 0.42
    const total  = arms * 2
    const verts = []
    for (let i = 0; i <= total; i++) {
      const angle  = (i / total) * Math.PI * 2 - Math.PI / 2
      const radius = i % 2 === 0 ? r : innerR
      verts.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) })
    }
    const pts = []
    for (let i = 0; i < verts.length - 1; i++) {
      const a = verts[i], b = verts[i + 1]
      for (let k = 0; k < n; k++) {
        const t = k / n
        pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
      }
    }
    pts.push(verts[verts.length - 1])
    return pts
  }

  /* ── Public API ──────────────────────────────────────────── */

  setMode(mode)        { this.mode = mode }
  setDrawTool(tool)    { this.drawTool = tool }
  setBrushSize(size)   { this.brushSize = size }
  setBrushColor(color) { this.brushColor = color }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.strokes = []
    this._currentStroke = []
    this._shapeStart = null
    this._snapshot   = null
    this._rainbowHue = 0
  }

  getStrokes() { return this.strokes }
  getSize()    { return { width: this.canvas.width, height: this.canvas.height } }
}
