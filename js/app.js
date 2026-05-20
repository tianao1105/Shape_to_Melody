class App {
  constructor() {
    this.canvas        = new CanvasManager('main-canvas')
    this.converter     = new Converter()
    this.player        = new Player()
    this.pianoRoll     = new PianoRoll()
    this.workspace     = new Workspace()
    this.layerManager  = new LayerManager()

    this.convertMode      = 'full'
    this.samplingInterval = 5
    this._currentView     = 'drawing'

    this._partialDragging = false
    this._bandStartY      = 0
    this._bandStartTop    = 0

    // Init layer manager with canvas size
    const { width, height } = this.canvas.getSize()
    this.layerManager.init(width, height)
    this.canvas.setLayerManager(this.layerManager)

    // Piano roll canvas
    const prCanvas = document.getElementById('piano-roll-canvas')
    prCanvas.width  = width
    prCanvas.height = height
    this.pianoRoll.init(prCanvas)

    // Workspace canvas
    const wsCanvas = document.getElementById('workspace-canvas')
    wsCanvas.width  = width
    wsCanvas.height = height
    this.workspace.init(wsCanvas)
    this.workspace.onChange = () => this._refreshPianoRoll()

    // Sync all canvases on resize
    this.canvas.onResize = () => {
      const { width: w, height: h } = this.canvas.getSize()
      prCanvas.width = w; prCanvas.height = h
      wsCanvas.width = w; wsCanvas.height = h
      this.pianoRoll.init(prCanvas)
    }

    this.player.warmup()
    this.player.onStop = () => {
      this.pianoRoll.stop()
      this._setStatus('')
    }

    this._renderLayerTabs()
    this._bindUI()
    this._bindLayerProps()
    this._bindPartialBand()
    this._bindViewToggle()
  }

  /* ── Layer tabs ──────────────────────────────────────────── */

  _renderLayerTabs() {
    const container = document.getElementById('layer-tabs')
    container.querySelectorAll('.layer-tab').forEach(t => t.remove())
    const addBtn = document.getElementById('btn-add-layer')

    this.layerManager.layers.forEach((layer, idx) => {
      const btn = document.createElement('button')
      btn.className = 'layer-tab' + (idx === this.layerManager.activeIdx ? ' active' : '')
      btn.dataset.idx = idx

      const dot = document.createElement('span')
      dot.className = 'layer-dot'
      dot.style.background = layer.color

      const nameSpan = document.createElement('span')
      nameSpan.className = 'layer-tab-name'
      nameSpan.textContent = layer.name

      btn.appendChild(dot)
      btn.appendChild(nameSpan)

      btn.addEventListener('click', () => {
        this.layerManager.setActive(idx)
        this._renderLayerTabs()
        this._refreshUndoRedo()
      })

      btn.addEventListener('dblclick', e => {
        e.stopPropagation()
        const input = document.createElement('input')
        input.className = 'layer-name-input'
        input.value = layer.name
        nameSpan.replaceWith(input)
        input.focus()
        input.select()
        const save = () => {
          layer.name = input.value.trim() || layer.name
          this._renderLayerTabs()
        }
        input.addEventListener('blur', save)
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter')  { e.preventDefault(); input.blur() }
          if (e.key === 'Escape') { input.value = layer.name; input.blur() }
        })
      })

      container.insertBefore(btn, addBtn)
    })

    const sel = document.getElementById('layer-inst-select')
    if (sel && sel.options.length > 0) this._syncLayerProps()
  }

  /* ── Layer props bar ─────────────────────────────────────── */

  _bindLayerProps() {
    const sel = document.getElementById('layer-inst-select')
    Object.entries(INSTRUMENTS).forEach(([key]) => {
      const opt = document.createElement('option')
      opt.value = key
      opt.textContent = t(`inst-${key}`) || key
      sel.appendChild(opt)
    })
    sel.addEventListener('change', () => {
      this.layerManager.active.instrument = sel.value
    })

    const vol   = document.getElementById('layer-vol')
    const valEl = document.getElementById('layer-vol-val')
    vol.addEventListener('input', () => {
      this.layerManager.active.volume = vol.value / 100
      valEl.textContent = vol.value
    })

    this._syncLayerProps()
  }

  _syncLayerProps() {
    const layer = this.layerManager.active
    const sel   = document.getElementById('layer-inst-select')
    const vol   = document.getElementById('layer-vol')
    const valEl = document.getElementById('layer-vol-val')
    if (!sel) return
    sel.value = layer.instrument || 'piano'
    const v = Math.round((layer.volume ?? 0.8) * 100)
    vol.value = v
    valEl.textContent = v
  }

  /* ── UI bindings ─────────────────────────────────────────── */

  _bindUI() {
    this._bindToolGroups(['tool-btns', 'shape-btns'], mode => this.canvas.setDrawTool(mode))
    this._bindModeGroup('canvas-mode-btns',  mode => this.canvas.setMode(mode))
    this._bindModeGroup('convert-mode-btns', mode => {
      this.convertMode = mode
      this._togglePartialOverlay(mode === 'partial')
    })

    document.getElementById('btn-add-layer').addEventListener('click', () => {
      if (this.layerManager.layers.length >= 6) return
      this.layerManager.add()
      this._renderLayerTabs()
      this._refreshUndoRedo()
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
      if (this._currentView === 'workspace') {
        this._setupWorkspace()
        this.workspace.draw()
      }
    })

    // Undo / Redo
    const btnUndo = document.getElementById('btn-undo')
    const btnRedo = document.getElementById('btn-redo')
    btnUndo.addEventListener('click', () => { this.canvas.undo(); this._refreshUndoRedo() })
    btnRedo.addEventListener('click', () => { this.canvas.redo(); this._refreshUndoRedo() })
    this.canvas.setOnHistoryChange(() => this._refreshUndoRedo())
    this._refreshUndoRedo()

    document.addEventListener('keydown', e => {
      const tag = (e.target.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return
      const cmd = e.metaKey || e.ctrlKey
      if (!cmd) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) { e.preventDefault(); this.canvas.undo(); this._refreshUndoRedo() }
      else if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); this.canvas.redo(); this._refreshUndoRedo() }
    })

    const sampSlider = document.getElementById('sampling-interval')
    sampSlider.addEventListener('input', () => {
      this.samplingInterval = Number(sampSlider.value)
      document.getElementById('sampling-val').textContent = sampSlider.value
    })

    document.getElementById('scale-select').addEventListener('change', e => {
      this.converter.setScale(e.target.value)
      if (this.layerManager.allNotes().length > 0) this._convert()
    })

    const bpmSlider = document.getElementById('bpm')
    bpmSlider.addEventListener('input', () => {
      document.getElementById('bpm-val').textContent = bpmSlider.value
      this.player.setBPM(Number(bpmSlider.value))
    })

    document.getElementById('btn-convert').addEventListener('click', () => this._convert())
    document.getElementById('btn-play').addEventListener('click',    () => this._play())
    document.getElementById('btn-stop').addEventListener('click',    () => {
      this.player.stop()
      this._setStatus('')
    })

    document.getElementById('btn-export').addEventListener('click', async () => {
      const format = document.getElementById('export-format').value
      const { width } = this.canvas.getSize()
      const allNotes  = this.layerManager.allNotes()
      if (!allNotes.length) return
      if (format === 'midi') {
        exportMidi(allNotes, this.player.bpm, width)
      } else {
        const btn = document.getElementById('btn-export')
        btn.disabled = true
        await exportAudio(
          this.layerManager.layers, this.player.bpm, width,
          format,
          status => {
            if      (status === 'rendering') this._setStatus(t('status-rendering'), '')
            else if (status === 'encoding')  this._setStatus(t('status-encoding'),  '')
            else                             this._setStatus('', '')
          }
        )
        btn.disabled = false
      }
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

  _bindToolGroups(groupIds, onChange) {
    const allBtns = groupIds.flatMap(id => [...document.querySelectorAll(`#${id} .tool-btn`)])
    allBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        allBtns.forEach(b => b.classList.remove('active'))
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

  _switchView(view) {
    this._currentView = view
    const mainCanvas = document.getElementById('main-canvas')
    const prCanvas   = document.getElementById('piano-roll-canvas')
    const wsCanvas   = document.getElementById('workspace-canvas')

    mainCanvas.classList.add('hidden')
    prCanvas.classList.add('hidden')
    wsCanvas.classList.add('hidden')
    this._togglePartialOverlay(false)

    if (view === 'drawing') {
      mainCanvas.classList.remove('hidden')
      if (this.convertMode === 'partial') this._togglePartialOverlay(true)

    } else if (view === 'pianoroll') {
      prCanvas.classList.remove('hidden')
      const notes = this.layerManager.active.notes
      if (notes.length > 0 && !this.player.isPlaying) {
        this._setupPianoRoll(notes)
        this.pianoRoll.drawStatic()
      }

    } else if (view === 'workspace') {
      wsCanvas.classList.remove('hidden')
      this._setupWorkspace()
      this.workspace.draw()
    }
  }

  /* ── Partial band drag ───────────────────────────────────── */

  _bindPartialBand() {
    const band      = document.getElementById('partial-band')
    const container = document.getElementById('canvas-container')
    band.addEventListener('mousedown', e => {
      this._partialDragging = true
      this._bandStartY   = e.clientY
      this._bandStartTop = band.offsetTop
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
    if (show && this._currentView === 'drawing') {
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

  _setupPianoRoll(notes) {
    const { width, height } = this.canvas.getSize()
    this.pianoRoll.setup(
      notes ?? this.layerManager.active.notes,
      this.converter.notes,
      this.player.bpm,
      width, height,
      this.player.getTotalTime()
    )
  }

  _refreshPianoRoll() {
    if (this._currentView === 'pianoroll') {
      this._setupPianoRoll()
      if (!this.player.isPlaying) this.pianoRoll.drawStatic()
    }
  }

  /* ── Workspace helper ────────────────────────────────────── */

  _setupWorkspace() {
    const { width } = this.canvas.getSize()
    this.workspace.setup(this.layerManager.layers, this.converter.notes, width)
  }

  /* ── Convert ─────────────────────────────────────────────── */

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
      this._setStatus(t('status-empty'), 'error')
      return
    }

    // Store notes in active layer
    this.layerManager.active.notes = notes

    const allNotes = this.layerManager.allNotes()
    document.getElementById('btn-play').disabled   = false
    document.getElementById('btn-export').disabled = false

    if (this._currentView === 'pianoroll') {
      this._setupPianoRoll(notes)
      this.pianoRoll.drawStatic()
    } else if (this._currentView === 'workspace') {
      this._setupWorkspace()
      this.workspace.draw()
    }

    this._setStatus(t('status-converted', { n: allNotes.length }), '')
  }

  /* ── Play ───────────────────────────────────────────────── */

  async _play() {
    const allNotes = this.layerManager.allNotes()
    if (!allNotes.length) return

    this._setStatus(t('status-playing', { n: allNotes.length }), 'playing')

    const { width } = this.canvas.getSize()
    await this.player.play(this.layerManager.layers, width)

    if (this._currentView === 'pianoroll') {
      this._setupPianoRoll(this.layerManager.active.notes)
      this.pianoRoll.start()
    }
  }

  _setStatus(msg, type = '') {
    const bar = document.getElementById('status-bar')
    bar.textContent = msg
    bar.className   = type
  }

  _refreshUndoRedo() {
    const u = document.getElementById('btn-undo')
    const r = document.getElementById('btn-redo')
    if (u) u.disabled = !this.canvas.canUndo()
    if (r) r.disabled = !this.canvas.canRedo()
  }
}

window.addEventListener('load', () => { window.app = new App() })
