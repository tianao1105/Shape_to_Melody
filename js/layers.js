const LAYER_COLORS = ['#7c6fe0','#e05878','#40b8e0','#50cc70','#e09030','#cc50d0']
const HISTORY_LIMIT = 25

class LayerManager {
  constructor() {
    this.layers    = []
    this.activeIdx = 0
    this._w = 0
    this._h = 0
  }

  init(w, h) {
    this._w = w
    this._h = h
    if (!this.layers.length) this._create()
  }

  _create() {
    const id     = this.layers.length
    const canvas = document.createElement('canvas')
    canvas.width  = this._w
    canvas.height = this._h
    const ctx    = canvas.getContext('2d')
    const layer  = {
      id,
      name:       `L${id + 1}`,
      color:      LAYER_COLORS[id % LAYER_COLORS.length],
      canvas,
      ctx,
      strokes:    [],
      notes:      [],
      instrument: 'piano',
      volume:     0.8,
      history:    [],
      histIdx:    -1,
    }
    this.layers.push(layer)
    // Push the initial empty state as the baseline (histIdx = 0)
    this._pushSnapshotTo(layer)
    return layer
  }

  _captureSnapshot(layer) {
    return {
      imageData: layer.ctx.getImageData(0, 0, this._w, this._h),
      strokes:   layer.strokes.map(s => s.slice()),
    }
  }

  _restoreSnapshot(layer, snap) {
    layer.ctx.putImageData(snap.imageData, 0, 0)
    layer.strokes = snap.strokes.map(s => s.slice())
  }

  _pushSnapshotTo(layer) {
    // Truncate any redo branch
    layer.history.length = layer.histIdx + 1
    layer.history.push(this._captureSnapshot(layer))
    layer.histIdx++
    // Enforce cap — drop oldest, shift index back
    if (layer.history.length > HISTORY_LIMIT) {
      layer.history.shift()
      layer.histIdx--
    }
  }

  pushHistory()         { if (this.active) this._pushSnapshotTo(this.active) }
  canUndo()             { return !!this.active && this.active.histIdx > 0 }
  canRedo()             { return !!this.active && this.active.histIdx < this.active.history.length - 1 }

  undo() {
    const l = this.active
    if (!l || l.histIdx <= 0) return false
    l.histIdx--
    this._restoreSnapshot(l, l.history[l.histIdx])
    return true
  }

  redo() {
    const l = this.active
    if (!l || l.histIdx >= l.history.length - 1) return false
    l.histIdx++
    this._restoreSnapshot(l, l.history[l.histIdx])
    return true
  }

  isEmpty() {
    return this.layers.every(l => l.strokes.length === 0)
  }

  add() {
    const layer    = this._create()
    this.activeIdx = layer.id
    return layer
  }

  get active() { return this.layers[this.activeIdx] }

  setActive(idx) {
    this.activeIdx = Math.max(0, Math.min(idx, this.layers.length - 1))
  }

  composite(mainCtx) {
    mainCtx.clearRect(0, 0, this._w, this._h)
    this.layers.forEach(l => mainCtx.drawImage(l.canvas, 0, 0))
  }

  resize(w, h) {
    this._w = w; this._h = h
    this.layers.forEach(l => {
      const nc = document.createElement('canvas')
      nc.width = w; nc.height = h
      const nctx = nc.getContext('2d')
      nctx.drawImage(l.canvas, 0, 0, w, h)
      l.canvas = nc
      l.ctx    = nctx
      // Stored ImageData snapshots are at old dimensions → reset history baseline
      l.history = []
      l.histIdx = -1
      this._pushSnapshotTo(l)
    })
  }

  clearActive() {
    const l = this.active
    l.ctx.clearRect(0, 0, this._w, this._h)
    l.strokes = []
    l.notes   = []
  }

  allNotes() {
    return this.layers
      .flatMap(l => l.notes)
      .sort((a, b) => a.x - b.x)
  }
}
