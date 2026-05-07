class App {
  constructor() {
    this.canvas     = new CanvasManager('main-canvas')
    this.converter  = new Converter()
    this.player     = new Player()
    this.pianoRoll  = new PianoRoll()

    this.convertMode      = 'full'
    this.samplingInterval = 5
    this._currentView     = 'drawing'
    this._lastNotes       = []   // [{note, x, y}, ...]

    this._partialDragging = false
    this._bandStartY      = 0
    this._bandStartTop    = 0

    // Piano roll canvas matches main canvas size
    const prCanvas = document.getElementById('piano-roll-canvas')
    const { width, height } = this.canvas.getSize()
    prCanvas.width  = width
    prCanvas.height = height
    this.pianoRoll.init(prCanvas)

    this.player.warmup()

    this.player.onStop = () => {
      this.pianoRoll.stop()
      this._setStatus('')
    }

    this._bindUI()
    this._bindPartialBand()
    this._bindViewToggle()
  }

  /* ── UI bindings ─────────────────────────────────────────── */

  _bindUI() {
    this._bindModeGroup('tool-btns',         mode => this.canvas.setDrawTool(mode), 'tool-btn')
    this._bindModeGroup('canvas-mode-btns',  mode => this.canvas.setMode(mode))
    this._bindModeGroup('convert-mode-btns', mode => {
      this.convertMode = mode
      this._togglePartialOverlay(mode === 'partial')
    })

    const brushSlider = document.getElementById('brush-size')
    brushSlider.addEventListener('input', () => {
      document.getElementById('brush-size-val').textContent = brushSlider.value
      this.canvas.setBrushSize(Number(brushSlider.value))
    })

    document.querySelectorAll('.color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'))
        sw.classList.add('active')
        this.canvas.setBrushColor(sw.dataset.color)
      })
    })

    document.getElementById('btn-clear').addEventListener('click', () => {
      this.canvas.clear()
      this.player.stop()
    })

    const sampSlider = document.getElementById('sampling-interval')
    sampSlider.addEventListener('input', () => {
      this.samplingInterval = Number(sampSlider.value)
      document.getElementById('sampling-val').textContent = sampSlider.value
    })

    document.getElementById('instrument-select').addEventListener('change', e => {
      this.player.setInstrument(e.target.value)
      this._refreshPianoRoll()
    })

    document.getElementById('scale-select').addEventListener('change', e => {
      this.converter.setScale(e.target.value)
      if (this._lastNotes.length > 0) this._convert()
      else this._refreshPianoRoll()
    })

    const bpmSlider = document.getElementById('bpm')
    bpmSlider.addEventListener('input', () => {
      document.getElementById('bpm-val').textContent = bpmSlider.value
      this.player.setBPM(Number(bpmSlider.value))
    })

    document.getElementById('btn-convert').addEventListener('click', () => this._convert())
    document.getElementById('btn-play').addEventListener('click',   () => this._play())
    document.getElementById('btn-stop').addEventListener('click',   () => {
      this.player.stop()
      this._setStatus('')
    })
  }

  _bindModeGroup(groupId, onChange, cls = 'mode-btn') {
    document.querySelectorAll(`#${groupId} .${cls}`).forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll(`#${groupId} .${cls}`).forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        onChange(btn.dataset.mode)
      })
    })
  }

  /* ── View toggle ─────────────────────────────────────────── */

  _bindViewToggle() {
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        this._switchView(btn.dataset.view)
      })
    })
  }

  _showViewToggle() {
    document.getElementById('view-toggle').classList.remove('hidden')
  }

  _switchView(view) {
    this._currentView = view
    const mainCanvas = document.getElementById('main-canvas')
    const prCanvas   = document.getElementById('piano-roll-canvas')

    if (view === 'pianoroll') {
      mainCanvas.classList.add('hidden')
      prCanvas.classList.remove('hidden')
      document.getElementById('partial-overlay').classList.add('hidden')
      if (this._lastNotes.length > 0 && !this.player.isPlaying) {
        this._setupPianoRoll()
        this.pianoRoll.drawStatic()
      }
    } else {
      prCanvas.classList.add('hidden')
      mainCanvas.classList.remove('hidden')
      if (this.convertMode === 'partial') this._togglePartialOverlay(true)
    }
  }

  /* ── Partial band drag ───────────────────────────────────── */

  _bindPartialBand() {
    const band      = document.getElementById('partial-band')
    const container = document.getElementById('canvas-container')

    band.addEventListener('mousedown', e => {
      this._partialDragging = true
      this._bandStartY      = e.clientY
      this._bandStartTop    = band.offsetTop
      e.preventDefault()
    })
    document.addEventListener('mousemove', e => {
      if (!this._partialDragging) return
      const maxTop = container.clientHeight - band.offsetHeight
      const newTop = Math.max(0, Math.min(maxTop, this._bandStartTop + e.clientY - this._bandStartY))
      band.style.top = newTop + 'px'; band.style.transform = 'none'
    })
    document.addEventListener('mouseup', () => { this._partialDragging = false })
  }

  _togglePartialOverlay(show) {
    const overlay = document.getElementById('partial-overlay')
    if (show && this._currentView !== 'pianoroll') {
      overlay.classList.remove('hidden'); overlay.classList.add('active')
    } else {
      overlay.classList.add('hidden'); overlay.classList.remove('active')
    }
  }

  _getPartialRange() {
    const band      = document.getElementById('partial-band')
    const container = document.getElementById('canvas-container')
    const { height } = this.canvas.getSize()
    const ratio = height / container.clientHeight
    return {
      yMin: Math.floor(band.offsetTop * ratio),
      yMax: Math.floor((band.offsetTop + band.offsetHeight) * ratio)
    }
  }

  /* ── Piano roll helpers ──────────────────────────────────── */

  _setupPianoRoll(totalTime) {
    const { width, height } = this.canvas.getSize()
    this.pianoRoll.setup(
      this._lastNotes,
      this.converter.notes,
      this.player.bpm,
      width, height,
      totalTime ?? this.player.getTotalTime()
    )
  }

  _refreshPianoRoll() {
    if (this._currentView !== 'pianoroll' || this._lastNotes.length === 0) return
    this._setupPianoRoll()
    if (!this.player.isPlaying) this.pianoRoll.drawStatic()
  }

  /* ── Convert ────────────────────────────────────────────── */

  _convert() {
    const strokes = this.canvas.getStrokes()
    const { height } = this.canvas.getSize()

    const options = { interval: this.samplingInterval }
    if (this.convertMode === 'partial') {
      const { yMin, yMax } = this._getPartialRange()
      options.yMin = yMin; options.yMax = yMax
    }

    const notes = this.converter.convert(strokes, height, this.convertMode, options)

    if (notes.length === 0) {
      this._setStatus('画布是空的，请先绘画', 'error')
      return
    }

    this._lastNotes = notes
    this._showViewToggle()
    document.getElementById('btn-play').disabled = false

    if (this._currentView === 'pianoroll') {
      this._setupPianoRoll()
      this.pianoRoll.drawStatic()
    }

    this._setStatus(`已转换 ${notes.length} 个音符，点击播放`, '')
  }

  /* ── Play ───────────────────────────────────────────────── */

  async _play() {
    if (this._lastNotes.length === 0) return

    this._setStatus(`播放中… ${this._lastNotes.length} 个音符`, 'playing')

    const { width } = this.canvas.getSize()
    await this.player.play(this._lastNotes, width)

    if (this._currentView === 'pianoroll') {
      this._setupPianoRoll(this.player.getTotalTime())
      this.pianoRoll.start()
    }
  }

  _setStatus(msg, type = '') {
    const bar = document.getElementById('status-bar')
    bar.textContent = msg
    bar.className   = type
  }
}

window.addEventListener('load', () => { window.app = new App() })
