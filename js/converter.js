const SCALES = {
  pentatonic: ['C', 'D', 'E', 'G', 'A'],
  major:      ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  minor:      ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  chromatic:  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
}

class Converter {
  constructor() {
    this.scaleName = 'pentatonic'
    this.octaveMin = 3
    this.octaveMax = 6
    this._buildNoteArray()
  }

  _buildNoteArray() {
    const scale = SCALES[this.scaleName]
    this.notes = []
    for (let oct = this.octaveMin; oct <= this.octaveMax; oct++) {
      for (const note of scale) this.notes.push(note + oct)
    }
  }

  setScale(name) {
    this.scaleName = name
    this._buildNoteArray()
  }

  // Returns [{note, x, y}, ...] — original canvas coordinates preserved
  convert(strokes, canvasHeight, mode, options = {}) {
    this._h = canvasHeight
    if (!strokes || strokes.length === 0) return []
    switch (mode) {
      case 'partial': return this._partialConvert(strokes, options)
      case 'random':  return this._randomConvert(strokes, options)
      default:        return this._fullConvert(strokes, options)
    }
  }

  _fullConvert(strokes, { interval = 5 } = {}) {
    return strokes.flatMap(s => this._strokeToNotes(s, interval, 0, this._h))
  }

  _partialConvert(strokes, { interval = 5, yMin = 0, yMax = null } = {}) {
    const y2 = yMax ?? this._h
    return strokes.flatMap(s => this._strokeToNotes(s, interval, yMin, y2))
  }

  _randomConvert(strokes, { count = 32, interval = 5 } = {}) {
    const pool = strokes.flatMap(s => this._strokeToNotes(s, interval, 0, this._h))
    if (pool.length === 0) return []
    return Array.from({ length: count }, () => pool[Math.floor(Math.random() * pool.length)])
  }

  _strokeToNotes(stroke, interval, yMin, yMax) {
    if (stroke.length === 0) return []

    // Normalize open strokes to left-to-right
    const first = stroke[0], last = stroke[stroke.length - 1]
    const pts = last.x < first.x - 10 ? [...stroke].reverse() : stroke

    // Cumulative arc-length table
    const cum = [0]
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i-1].x
      const dy = pts[i].y - pts[i-1].y
      cum.push(cum[i-1] + Math.sqrt(dx*dx + dy*dy))
    }
    const total = cum[cum.length - 1]

    // Single dot
    if (total < 1) {
      const p = pts[0]
      return (p.y >= yMin && p.y < yMax)
        ? [{ note: this._yToNote(p.y, yMin, yMax), x: p.x, y: p.y }]
        : []
    }

    const result = []
    let target = 0, j = 0
    while (target <= total + 0.001) {
      while (j < cum.length - 1 && cum[j+1] < target) j++
      const p = pts[j]
      if (p.y >= yMin && p.y < yMax) {
        result.push({ note: this._yToNote(p.y, yMin, yMax), x: p.x, y: p.y })
      }
      target += interval
    }
    return result
  }

  _yToNote(y, yMin, yMax) {
    const t   = 1 - (y - yMin) / (yMax - yMin)
    const idx = Math.round(t * (this.notes.length - 1))
    return this.notes[Math.max(0, Math.min(this.notes.length - 1, idx))]
  }
}
