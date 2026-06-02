/* Auto-demo tutorial — runs the whole flow on its own. */

class Tutorial {
  constructor() {
    this.overlay  = document.getElementById('tutorial-overlay')
    this.bubble   = document.getElementById('tutorial-bubble')
    this.arrow    = document.getElementById('tutorial-arrow')
    this.hole     = document.getElementById('tut-hole')
    this.ring     = document.getElementById('tut-ring')
    this.idx      = 0
    this._resizeH = null
    this._finished = false
    this.steps = [
      // Tighter selector for step 1: the canvas itself, not the whole container
      // (the container also holds the dropzone, hints, partial overlay, etc.)
      { sel: '#main-canvas',                                   titleKey: 'tut-1-title', bodyKey: 'tut-1-body', place: 'top',   radius: 16, pad: 8  },
      { sel: '#sidebar-left .panel:first-child',               titleKey: 'tut-2-title', bodyKey: 'tut-2-body', place: 'right', radius: 16, pad: 6  },
      { sel: '#mode-toggle',                                   titleKey: 'tut-3-title', bodyKey: 'tut-3-body', place: 'right', radius: 14, pad: 4  },
      { sel: '#play-controls',                                 titleKey: 'tut-4-title', bodyKey: 'tut-4-body', place: 'left',  radius: 16, pad: 8  },
      // Final step is interactive — user clicks the highlighted Drawing view
      // tab to return to the canvas. interactive:true lets clicks pass through.
      { sel: '#view-toggle .view-btn[data-view="drawing"]',    titleKey: 'tut-5-title', bodyKey: 'tut-5-body', place: 'left',  radius: 12, pad: 4, interactive: true },
    ]
  }
  async start() {
    if (!this.overlay) return
    if (localStorage.getItem('s2m-tutorial-done-v5') === 'yes') return
    this._run()
  }
  // Manual re-trigger (from help button) — bypasses localStorage flag
  forceStart() {
    if (!this.overlay) return
    this._run()
  }
  _run() {
    this._finished = false
    this.overlay.classList.remove('hidden')
    document.body.classList.add('tut-locked')
    this._resizeH = () => this._position()
    window.addEventListener('resize', this._resizeH)
    const skipBtn = document.getElementById('tut-skip')
    skipBtn.textContent = (typeof t === 'function') ? t('tut-skip-btn') : '跳过'
    skipBtn.onclick = () => this._finish()
    const nx = document.getElementById('tut-next')
    if (nx) nx.style.display = 'none'
    // Tutorial steps assume the drawing canvas is visible. If the user
    // triggered the tutorial from the Score view (via the ? button), the
    // main-canvas would be display:none and its bounding rect would be
    // 0×0 — pinning the spotlight to the screen's top-left corner.
    this._ensureDrawingView()
    ;(async () => {
      try { await this._runFlow() } catch (e) { console.error('tutorial flow', e) }
      this._finish()
    })()
  }

  _ensureDrawingView() {
    const app = window.app
    if (!app || !app._switchView) return
    try {
      document.querySelectorAll('.view-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.view === 'drawing')
      })
      app._switchView('drawing')
    } catch (e) { console.warn('tutorial switchToDrawing', e) }
  }
  async _runFlow() {
    this._goto(0); await this._sleep(700)
    await this._autoDraw(); await this._sleep(900)
    if (this._finished) return
    this._goto(1); await this._sleep(2400)
    if (this._finished) return
    this._goto(2); await this._sleep(2400)
    if (this._finished) return
    this._goto(3); await this._sleep(500)
    this._autoConvert(); await this._sleep(700)
    // Switch to Score view so user sees the piano-roll animation during playback
    this._switchToScore()
    await this._sleep(300)
    const played = await this._autoPlay()
    // Only wait for playback to finish if it actually started. On first page
    // load the browser blocks audio until a user gesture, so playback may be
    // silently skipped — in that case we just pause briefly and move on
    // instead of stalling here forever.
    if (played) await this._waitForPlaybackEnd(20000)
    else        await this._sleep(1400)
    if (this._finished) return
    // Final step: highlight the Drawing view bookmark and wait for the user
    // to actually click it.
    this._goto(4)
    await this._waitForUserClick(25000)
  }
  _sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
  _goto(i) { this.idx = i; this._render() }
  _render() {
    const s = this.steps[this.idx]
    const T = (typeof t === 'function') ? t : (k => k)
    this.bubble.querySelector('.tut-step').textContent  = `${this.idx + 1} / ${this.steps.length}`
    this.bubble.querySelector('.tut-title').textContent = T(s.titleKey)
    this.bubble.querySelector('.tut-body').textContent  = T(s.bodyKey)
    // Toggle click-through on the overlay so the user can actually click the
    // highlighted target on interactive steps.
    this.overlay.classList.toggle('tut-interactive', !!s.interactive)
    requestAnimationFrame(() => this._position())
  }
  _switchToScore() {
    const app = window.app
    if (!app || !app._switchView) return
    try {
      document.querySelectorAll('.view-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.view === 'pianoroll')
      })
      app._switchView('pianoroll')
    } catch (e) { console.warn('tutorial switchToScore', e) }
  }
  _waitForPlaybackEnd(maxMs = 20000) {
    // NOTE: player.isPlaying isn't a reliable cue here — player.js schedules
    // its stop at `+${totalTime + 2}`, so isPlaying stays true for 2 extra
    // seconds AFTER the last audible note. Polling it would mean ~2s of dead
    // air before step 5 appears. Use the known totalTime instead and add a
    // short ring-out tail so we advance as soon as the music is done.
    return new Promise(resolve => {
      const p = window.app && window.app.player
      const total = (p && p.getTotalTime && p.getTotalTime()) || 4
      const waitMs = Math.min(maxMs, Math.max(600, total * 1000 + 500))
      const finish = () => { clearInterval(poll); resolve() }
      const timer = setTimeout(finish, waitMs)
      // Watchdog: if the user hits skip mid-wait, _finished flips and we bail
      // out immediately instead of stalling for the full waitMs.
      const poll = setInterval(() => {
        if (this._finished) { clearTimeout(timer); clearInterval(poll); resolve() }
      }, 150)
    })
  }
  _waitForUserClick(maxMs = 25000) {
    return new Promise(resolve => {
      const target = document.querySelector(this.steps[this.idx].sel)
      if (!target) { resolve(); return }
      let done = false
      const cleanup = () => {
        if (done) return; done = true
        target.removeEventListener('click', onClick, true)
        clearTimeout(timer)
        resolve()
      }
      const onClick = () => { cleanup(); this._finish() }
      // capture-phase so we catch the click even if a parent handler stops propagation
      target.addEventListener('click', onClick, true)
      const timer = setTimeout(() => { cleanup(); if (!this._finished) this._finish() }, maxMs)
    })
  }
  async _autoDraw() {
    const cm = window.app && window.app.canvas
    if (!cm || !cm.lm) return
    const { width, height } = cm.getSize()
    const N = 100, pts = []
    for (let i = 0; i <= N; i++) {
      const tt = i / N
      const x = 80 + tt * (width - 160)
      const y = height / 2
        + Math.sin(tt * Math.PI * 3.5) * (height * 0.22)
        + Math.cos(tt * Math.PI * 1.7) * (height * 0.07)
      pts.push({ x, y })
    }
    const layer = cm.lm.active
    layer.strokes.push(pts.map(p => ({ x: p.x, y: p.y })))
    cm._refreshEmptyHint()
    const ctx = layer.ctx
    ctx.save()
    ctx.strokeStyle = cm.brushColor || '#ffffff'
    ctx.lineWidth   = Math.max(5, cm.brushSize || 6)
    ctx.lineCap     = 'round'; ctx.lineJoin = 'round'
    for (let i = 1; i < pts.length; i++) {
      if (this._finished) { ctx.restore(); return }
      const a = pts[i - 1], b = pts[i]
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      cm.lm.composite(cm.ctx)
      await this._sleep(14)
    }
    ctx.restore()
    cm.lm.pushHistory()
    cm._notifyHistoryChange()
  }
  _autoConvert() {
    const app = window.app
    if (!app || !app._convert) return
    if (app.canvas.lm && app.canvas.lm.isEmpty()) return
    try { app._convert() } catch (e) { console.warn(e) }
  }
  async _autoPlay() {
    const app = window.app
    if (!app || !app._play) return false
    // First-page-load trap: the browser's autoplay policy keeps the audio
    // context suspended until the user actually clicks something. The intro
    // animation + tutorial both run automatically, so on a fresh visit there's
    // been zero user gesture by the time we get here. In that state
    // `await Tone.start()` (and the one inside player._init) NEVER resolves —
    // it sits there forever waiting for a gesture, freezing the whole flow
    // at step 4. Detect that case up front and ask the user for one click;
    // the click itself is the gesture that unlocks audio, then we play.
    try {
      const ctx = (window.Tone && Tone.context) ? Tone.context : null
      if (ctx && ctx.state !== 'running') {
        const clicked = await this._waitForUnlockClick(12000)
        if (!clicked) return false
      }
      if (window.Tone && Tone.start) await Tone.start()
      await app._play()
      return true
    } catch (e) { console.warn('tutorial autoplay', e); return false }
  }
  _waitForUnlockClick(maxMs = 12000) {
    // Inject a "click to play" button into the current bubble and wait for
    // the user to click it. Resolves true on click, false on timeout.
    return new Promise(resolve => {
      const body = this.bubble.querySelector('.tut-body')
      if (!body) { resolve(false); return }
      const T = (typeof t === 'function') ? t : (k => k)
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'tut-play-btn'
      btn.textContent = T('tut-play-prompt')
      body.appendChild(btn)
      let done = false
      const cleanup = (ok) => {
        if (done) return; done = true
        clearTimeout(timer)
        clearInterval(poll)
        btn.removeEventListener('click', onClick)
        btn.remove()
        resolve(ok)
      }
      const onClick = () => cleanup(true)
      btn.addEventListener('click', onClick)
      const timer = setTimeout(() => cleanup(false), maxMs)
      // If the user hits Skip while the play button is showing, bail out
      // immediately instead of stalling here for the full timeout.
      const poll = setInterval(() => {
        if (this._finished) cleanup(false)
      }, 150)
    })
  }
  _position() {
    const s = this.steps[this.idx]
    const target = document.querySelector(s.sel)
    if (!target) return
    const r   = target.getBoundingClientRect()
    const pad = s.pad ?? 6
    const rad = s.radius ?? 12

    // If the target hasn't been laid out yet (display:none, font-load reflow,
    // canvas still 0×0, etc.), the rect is all zeros and the spotlight would
    // pin to the top-left corner. Retry once after a paint, then again on a
    // short timer in case layout settles more slowly.
    if (r.width < 4 || r.height < 4) {
      if (!this._positionRetried) {
        this._positionRetried = true
        requestAnimationFrame(() => this._position())
        setTimeout(() => this._position(), 120)
      }
      return
    }
    this._positionRetried = false

    // Position the hole + ring around the target's bounding box
    if (this.hole) {
      this.hole.style.left          = (r.left - pad) + 'px'
      this.hole.style.top           = (r.top  - pad) + 'px'
      this.hole.style.width         = (r.width  + pad * 2) + 'px'
      this.hole.style.height        = (r.height + pad * 2) + 'px'
      this.hole.style.borderRadius  = rad + 'px'
    }
    if (this.ring) {
      this.ring.style.left          = (r.left - pad) + 'px'
      this.ring.style.top           = (r.top  - pad) + 'px'
      this.ring.style.width         = (r.width  + pad * 2) + 'px'
      this.ring.style.height        = (r.height + pad * 2) + 'px'
      this.ring.style.borderRadius  = rad + 'px'
    }

    const vw = window.innerWidth, vh = window.innerHeight
    const bW = this.bubble.offsetWidth, bH = this.bubble.offsetHeight
    const margin = 24
    let bL, bT
    if (s.place === 'right') { bL = r.right + 80; bT = r.top + r.height/2 - bH/2 }
    else if (s.place === 'left') { bL = r.left - 80 - bW; bT = r.top + r.height/2 - bH/2 }
    else if (s.place === 'top') { bL = r.left + r.width/2 - bW/2; bT = r.top - 60 - bH }
    else { bL = r.left + r.width/2 - bW/2; bT = r.bottom + 60 }
    bL = Math.max(margin, Math.min(vw - bW - margin, bL))
    bT = Math.max(margin, Math.min(vh - bH - margin, bT))
    this.bubble.style.left = bL + 'px'
    this.bubble.style.top  = bT + 'px'

    // Position arrow in the gap between bubble's nearest edge and target.
    // Computing from the bubble's ACTUAL placement (after viewport clamping)
    // prevents the arrow from landing inside the bubble's text on small screens.
    // Arrow box = 36x36 -> half = 18.
    const aE = this.arrow
    const half = 18
    const bRight = bL + bW, bBottom = bT + bH
    const bCX = bL + bW / 2, bCY = bT + bH / 2
    let ax, ay, rot, show = true

    if (s.place === 'top') {
      // bubble above target -> arrow centered in the vertical gap, pointing DOWN
      const gap = r.top - bBottom
      if (gap < 24) show = false
      ay  = bBottom + (gap - 36) / 2
      ax  = bCX - half
      rot = '90deg'
    } else if (s.place === 'bottom') {
      const gap = bT - r.bottom
      if (gap < 24) show = false
      ay  = r.bottom + (gap - 36) / 2
      ax  = bCX - half
      rot = '-90deg'
    } else if (s.place === 'left') {
      // bubble to the left of target -> arrow in horizontal gap, pointing RIGHT
      const gap = r.left - bRight
      if (gap < 24) show = false
      ax  = bRight + (gap - 36) / 2
      ay  = bCY - half
      rot = '0deg'
    } else { /* right */
      const gap = bL - r.right
      if (gap < 24) show = false
      ax  = r.right + (gap - 36) / 2
      ay  = bCY - half
      rot = '180deg'
    }

    if (show) {
      aE.style.display   = 'block'
      aE.style.left      = ax + 'px'
      aE.style.top       = ay + 'px'
      aE.style.transform = `rotate(${rot})`
    } else {
      aE.style.display = 'none'
    }
  }
  _finish() {
    if (this._finished) return
    this._finished = true
    this.overlay.classList.add('hidden')
    this.overlay.classList.remove('tut-interactive')
    document.body.classList.remove('tut-locked')
    localStorage.setItem('s2m-tutorial-done-v5', 'yes')
    if (this._resizeH) window.removeEventListener('resize', this._resizeH)
  }
}
