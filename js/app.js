class App {
  constructor() {
    this.canvas        = new CanvasManager('main-canvas')
    this.converter     = new Converter()
    this.player        = new Player()
    this.pianoRoll     = new PianoRoll()
    this.workspace     = new Workspace()
    this.layerManager  = new LayerManager()

    this.convertMode      = 'full'
    this.samplingInterval = 60
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
      // After playback ends, swap pianoroll → workspace in the Score view
      if (this._currentView === 'pianoroll') {
        document.getElementById('piano-roll-canvas').classList.add('hidden')
        document.getElementById('workspace-canvas').classList.remove('hidden')
        this._setupWorkspace()
        this.workspace.draw()
      }
    }

    this._canvasMode      = 'draw'
    this._imageImporter   = null

    this._renderLayerTabs()
    this._bindUI()
    this._bindLayerProps()
    this._bindPartialBand()
    this._bindViewToggle()
    this._bindCanvasModeToggle()
    this._bindUpload()
    this._bindCollapse()
    this._bindThemeChange()
  }

  /* Re-draw the score canvases when the user picks a new theme so the
     piano-key colors and note blocks immediately follow the palette.
     The drawing canvas keeps the user's painted strokes at their
     original colors. */
  _bindThemeChange() {
    window.addEventListener('themechange', () => {
      const prCanvas = document.getElementById('piano-roll-canvas')
      const wsCanvas = document.getElementById('workspace-canvas')
      // Score-edit view (not playing): re-render workspace once.
      if (wsCanvas && !wsCanvas.classList.contains('hidden')) {
        this.workspace.draw()
      }
      // Static pianoroll (paused mid-song, frame 0 visible): re-render.
      // While actively playing, the animation loop's next frame will
      // already pick up the new CSS vars — no manual call needed.
      if (prCanvas && !prCanvas.classList.contains('hidden') && !this.player.isPlaying) {
        this.pianoRoll.drawStatic()
      }
    })
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
    const dropzone   = document.getElementById('upload-dropzone')
    const modeToggle = document.getElementById('mode-toggle')

    mainCanvas.classList.add('hidden')
    prCanvas.classList.add('hidden')
    wsCanvas.classList.add('hidden')
    this._togglePartialOverlay(false)

    // Hide dropzone + left mode toggle when not on the drawing view
    if (view !== 'drawing') {
      if (dropzone) dropzone.classList.add('hidden')
      if (modeToggle) modeToggle.style.visibility = 'hidden'
    } else {
      if (modeToggle) modeToggle.style.visibility = ''
      if (this._canvasMode === 'upload' && dropzone) dropzone.classList.remove('hidden')
    }

    if (view === 'drawing') {
      mainCanvas.classList.remove('hidden')
      if (this.convertMode === 'partial') this._togglePartialOverlay(true)

    } else if (view === 'pianoroll') {
      // Merged Score view:
      //  - while NOT playing → editable workspace (drag notes around)
      //  - while playing     → animated pianoroll scrolling
      const notes = this.layerManager.active.notes
      if (this.player.isPlaying) {
        prCanvas.classList.remove('hidden')
        if (notes.length > 0) {
          this._setupPianoRoll(notes)
          this.pianoRoll.start()
        }
      } else {
        wsCanvas.classList.remove('hidden')
        this._setupWorkspace()
        this.workspace.draw()
      }
    }
  }

  /* ── Canvas mode (Draw / Upload) ─────────────────────────── */

  _bindCanvasModeToggle() {
    document.querySelectorAll('.mode-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-tab').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        this._switchCanvasMode(btn.dataset.canvasMode)
      })
    })
  }

  _switchCanvasMode(mode) {
    this._canvasMode = mode
    const container = document.getElementById('canvas-container')
    const dropzone  = document.getElementById('upload-dropzone')
    const hint      = document.getElementById('canvas-hint')
    if (mode === 'upload') {
      dropzone.classList.remove('hidden')
      container.classList.add('upload-mode')
      if (hint) hint.style.opacity = '0'
    } else {
      dropzone.classList.add('hidden')
      container.classList.remove('upload-mode')
      if (hint) hint.style.opacity = ''
    }
  }

  /* ── Upload (click + drag-drop) ──────────────────────────── */

  _bindUpload() {
    const dropzone = document.getElementById('upload-dropzone')
    const input    = document.getElementById('image-input')
    if (!dropzone || !input) return

    dropzone.addEventListener('click', () => input.click())
    dropzone.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click() }
    })

    const preventAndOver = e => { e.preventDefault(); dropzone.classList.add('drag-over') }
    const clearOver      = e => { e.preventDefault(); dropzone.classList.remove('drag-over') }
    dropzone.addEventListener('dragenter', preventAndOver)
    dropzone.addEventListener('dragover',  preventAndOver)
    dropzone.addEventListener('dragleave', clearOver)
    dropzone.addEventListener('drop', e => {
      clearOver(e)
      const file = e.dataTransfer?.files?.[0]
      if (file) this._handleImageFile(file)
    })

    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (file) {
        this._handleImageFile(file)
        input.value = ''
      }
    })

    // Allow dragging anywhere on the window when in upload mode
    window.addEventListener('dragover', e => {
      if (this._canvasMode !== 'upload') return
      e.preventDefault()
    })
    window.addEventListener('drop', e => {
      if (this._canvasMode !== 'upload') return
      e.preventDefault()
      if (e.target.closest('#upload-dropzone')) return // already handled
      const file = e.dataTransfer?.files?.[0]
      if (file) this._handleImageFile(file)
    })
  }

  async _handleImageFile(file) {
    if (!this._imageImporter) {
      this._imageImporter = new ImageImporter(this.canvas, this.layerManager)
    }
    this._setStatus(t('status-loading'), '')
    try {
      const result = await this._imageImporter.loadFile(file)
      if (result.strokes > 0) {
        // Image is now strokes on the canvas. Tell the user to tweak settings
        // and click the right-side Convert button to generate notes.
        this._setStatus(t('status-imported', { n: result.strokes }), '')
        const drawTab = document.querySelector('.mode-tab[data-canvas-mode="draw"]')
        if (drawTab) drawTab.click()
        this._pulseConvertButton()
      } else {
        this._setStatus(t('status-noimport'), 'error')
      }
      this._refreshUndoRedo()
    } catch (err) {
      console.error('Image import failed:', err)
      this._setStatus(t('status-noimport'), 'error')
    }
  }

  _pulseConvertButton() {
    const btn = document.getElementById('btn-convert')
    if (!btn) return
    btn.classList.remove('attention-pulse')
    // Force reflow so re-adding the class restarts the animation
    void btn.offsetWidth
    btn.classList.add('attention-pulse')
    clearTimeout(this._pulseTimer)
    this._pulseTimer = setTimeout(() => btn.classList.remove('attention-pulse'), 6500)
    btn.addEventListener('click', () => {
      btn.classList.remove('attention-pulse')
      clearTimeout(this._pulseTimer)
    }, { once: true })
  }

  /* ── Panel collapse ──────────────────────────────────────── */

  _bindCollapse() {
    document.querySelectorAll('.panel[data-collapse-key]').forEach(panel => {
      const key      = panel.dataset.collapseKey
      const storeKey = 's2m-collapse-' + key
      if (localStorage.getItem(storeKey) === 'yes') panel.classList.add('collapsed')

      const h3 = panel.querySelector('h3')
      if (!h3) return
      h3.style.cursor     = 'pointer'
      h3.style.userSelect = 'none'
      h3.addEventListener('click', e => {
        // Avoid triggering when interacting with a chip / input inside the title
        if (e.target.tagName === 'INPUT') return
        panel.classList.toggle('collapsed')
        localStorage.setItem(storeKey, panel.classList.contains('collapsed') ? 'yes' : 'no')
      })
    })
  }

  /* ── Partial band drag ───────────────────────────────────── */

  _bindPartialBand() {
    const band      = document.getElementById('partial-band')
    const container = document.getElementById('canvas-container')
    const MIN_H     = 24

    let mode        = null
    let startY      = 0
    let startTop    = 0
    let startHeight = 0

    band.addEventListener('mousedown', e => {
      const cls = e.target.classList
      if      (cls.contains('band-handle-top'))    mode = 'resize-top'
      else if (cls.contains('band-handle-bottom')) mode = 'resize-bottom'
      else                                         mode = 'move'

      this._partialDragging = true
      startY      = e.clientY
      startTop    = band.offsetTop
      startHeight = band.offsetHeight
      e.preventDefault()
      e.stopPropagation()
    })

    document.addEventListener('mousemove', e => {
      if (!this._partialDragging) return
      const dy   = e.clientY - startY
      const maxH = container.clientHeight
      let newTop = startTop
      let newH   = startHeight

      if (mode === 'move') {
        newTop = Math.max(0, Math.min(maxH - startHeight, startTop + dy))
      } else if (mode === 'resize-top') {
        // Top handle: top moves with cursor, height shrinks/grows opposite.
        const desiredTop = startTop + dy
        newTop = Math.max(0, Math.min(startTop + startHeight - MIN_H, desiredTop))
        newH   = startHeight - (newTop - startTop)
      } else if (mode === 'resize-bottom') {
        // Bottom handle: top stays, height tracks cursor.
        newH = Math.max(MIN_H, Math.min(maxH - startTop, startHeight + dy))
      }

      band.style.top       = newTop + 'px'
      band.style.height    = newH + 'px'
      band.style.transform = 'none'
    })

    document.addEventListener('mouseup', () => {
      this._partialDragging = false
      mode = null
    })
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
      // Hand off from editable workspace → animated pianoroll
      document.getElementById('workspace-canvas').classList.add('hidden')
      document.getElementById('piano-roll-canvas').classList.remove('hidden')
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
    if (r) r.disabled = !this.canvas.canRedo()
  }
}

window.addEventListener('load', () => {
  window.app = new App()

  // Opening animation, then transparent tutorial overlay
  const intro = new IntroAnimation()
  intro.onDone = () => {
    const tut = new Tutorial()
    window.app._tutorial = tut
    setTimeout(() => tut.start(), 250)
  }
  intro.start()

  // Help button — re-runs the tutorial regardless of localStorage flag
  const help = document.getElementById('btn-help')
  if (help) {
    help.addEventListener('click', () => {
      const tut = (window.app && window.app._tutorial) || new Tutorial()
      window.app._tutorial = tut
      tut._finished = false
      tut.forceStart()
    })
  }

  // Update help button tooltip when language changes
  const langBtn = document.getElementById('lang-toggle')
  if (langBtn && help) {
    const refreshHelpTip = () => { help.title = (typeof t === 'function') ? t('tut-help-tip') : '重新观看教程' }
    refreshHelpTip()
    langBtn.addEventListener('click', () => setTimeout(refreshHelpTip, 0))
  }
})
