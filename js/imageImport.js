/* Convert an uploaded image into line-strokes that the existing
   converter pipeline can turn into piano notes.

   Algorithm (no external deps):
   1. Fit the image into the canvas (contain) on a white background.
   2. Threshold luma → mark dark pixels as "line".
   3. Scan rows + columns at `step` interval, emitting a polyline stroke
      for every contiguous run of dark pixels ≥ minRun.
   4. Draw strokes onto the active layer and push them into the strokes
      array so the existing converter and undo system see them. */

class ImageImporter {
  constructor(canvasMgr, layerMgr) {
    this.cm = canvasMgr
    this.lm = layerMgr
  }

  async loadFile(file) {
    const img = await this.loadImageOnly(file)
    return this.importImage(img)
  }

  /* Load + decode the file into an Image object but DO NOT touch the
     canvas or layer state. Caller decides when to actually call
     importImage(img) — typically after the user confirms in a preview. */
  async loadImageOnly(file) {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      throw new Error('not-image')
    }
    const dataUrl = await this._fileToDataUrl(file)
    return this._loadImage(dataUrl)
  }

  _fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload  = () => resolve(r.result)
      r.onerror = reject
      r.readAsDataURL(file)
    })
  }

  _loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload  = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
  }

  importImage(img, opts = {}) {
    const { width, height } = this.cm.getSize()
    const threshold  = opts.threshold  ?? 130
    const step       = opts.step       ?? 5
    const minRun     = opts.minRun     ?? 3
    const maxStrokes = opts.maxStrokes ?? 3000

    const off    = document.createElement('canvas')
    off.width    = width
    off.height   = height
    const offCtx = off.getContext('2d', { willReadFrequently: true })

    // White background so transparent areas are treated as "light"
    offCtx.fillStyle = '#ffffff'
    offCtx.fillRect(0, 0, width, height)

    // Contain-fit
    const scale = Math.min(width / img.width, height / img.height)
    const dw = Math.round(img.width  * scale)
    const dh = Math.round(img.height * scale)
    const dx = Math.round((width  - dw) / 2)
    const dy = Math.round((height - dh) / 2)
    offCtx.drawImage(img, dx, dy, dw, dh)

    const data = offCtx.getImageData(0, 0, width, height).data
    const isDark = (x, y) => {
      const i = (y * width + x) * 4
      if (data[i + 3] < 30) return false
      const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      return luma < threshold
    }

    const strokes = []
    const emitH = (y, x1, x2) => {
      const len = x2 - x1
      const n = Math.max(2, Math.min(8, Math.round(len / 8)))
      const pts = []
      for (let i = 0; i <= n; i++) {
        pts.push({ x: x1 + (len * i) / n, y })
      }
      strokes.push(pts)
    }
    const emitV = (x, y1, y2) => {
      const len = y2 - y1
      const n = Math.max(2, Math.min(8, Math.round(len / 8)))
      const pts = []
      for (let i = 0; i <= n; i++) {
        pts.push({ x, y: y1 + (len * i) / n })
      }
      strokes.push(pts)
    }

    // Row scan
    for (let y = 0; y < height && strokes.length < maxStrokes; y += step) {
      let runStart = -1
      for (let x = 0; x <= width; x++) {
        const dark = x < width && isDark(x, y)
        if (dark && runStart === -1) runStart = x
        else if (!dark && runStart !== -1) {
          if (x - runStart >= minRun) emitH(y, runStart, x)
          runStart = -1
          if (strokes.length >= maxStrokes) break
        }
      }
    }

    // Column scan (for pitch variety)
    for (let x = 0; x < width && strokes.length < maxStrokes; x += step) {
      let runStart = -1
      for (let y = 0; y <= height; y++) {
        const dark = y < height && isDark(x, y)
        if (dark && runStart === -1) runStart = y
        else if (!dark && runStart !== -1) {
          if (y - runStart >= minRun) emitV(x, runStart, y)
          runStart = -1
          if (strokes.length >= maxStrokes) break
        }
      }
    }

    if (strokes.length === 0) {
      return { strokes: 0 }
    }

    // Commit to active layer
    const layer = this.lm.active
    const ctx   = layer.ctx
    ctx.save()
    ctx.strokeStyle = this.cm.brushColor || '#222'
    ctx.lineWidth   = Math.max(1, Math.round((this.cm.brushSize || 4) * 0.45))
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    for (const pts of strokes) {
      layer.strokes.push(pts.map(p => ({ x: p.x, y: p.y })))
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
      ctx.stroke()
    }
    ctx.restore()

    // Snapshot history + recomposite + notify
    this.lm.pushHistory()
    this.lm.composite(this.cm.ctx)
    this.cm._refreshEmptyHint()
    this.cm._notifyHistoryChange()

    return { strokes: strokes.length }
  }
}
