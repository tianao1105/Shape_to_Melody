const LAYER_COLORS = ['#7c6fe0','#e05878','#40b8e0','#50cc70','#e09030','#cc50d0']

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
    this.layers.push({
      id,
      name:       `L${id + 1}`,
      color:      LAYER_COLORS[id % LAYER_COLORS.length],
      canvas,
      ctx:        canvas.getContext('2d'),
      strokes:    [],
      notes:      [],
      instrument: 'piano',
      volume:     0.8,
    })
    return this.layers[id]
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
