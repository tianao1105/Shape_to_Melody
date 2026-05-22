/* Auto-demo tutorial — runs the whole flow on its own. */

class Tutorial {
  constructor() {
    this.overlay  = document.getElementById('tutorial-overlay')
    this.bubble   = document.getElementById('tutorial-bubble')
    this.arrow    = document.getElementById('tutorial-arrow')
    this.idx      = 0
    this._spotEl  = null
    this._resizeH = null
    this._finished = false
    this.steps = [
      { sel: '#canvas-container',                titleKey: 'tut-1-title', bodyKey: 'tut-1-body', place: 'top' },
      { sel: '#sidebar-left .panel:first-child', titleKey: 'tut-2-title', bodyKey: 'tut-2-body', place: 'right' },
      { sel: '#mode-toggle',                     titleKey: 'tut-3-title', bodyKey: 'tut-3-body', place: 'right' },
      { sel: '#play-controls',                   titleKey: 'tut-4-title', bodyKey: 'tut-4-body', place: 'left' },
    ]
  }
  async start() {
    if (!this.overlay) return
    if (localStorage.getItem('s2m-tutorial-done-v4') === 'yes') return
    this._run()
  }
  // Manual re-trigger (from help button) — bypasses localStorage flag
  forceStart() {
    if (!this.overlay) return
    this._run()
  }
  _run() {
    this.overlay.classList.remove('hidden')
    document.body.classList.add('tut-locked')
    this._resizeH = () => this._position()
    window.addEventListener('resize', this._resizeH)
    const skipBtn = document.getElementById('tut-skip')
    skipBtn.textContent = (typeof t === 'function') ? t('tut-skip-btn') : '跳过'
    skipBtn.onclick = () => this._finish()
    const nx = document.getElementById('tut-next')
    if (nx) nx.style.display = 'none'
    ;(async () => {
      try { await this._runFlow() } catch (e) { console.error('tutorial flow', e) }
      this._finish()
    })()
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
    await this._autoPlay(); await this._sleep(800)
  }
  _sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
  _goto(i) { this.idx = i; this._render() }
  _render() {
    const s = this.steps[this.idx]
    const T = (typeof t === 'function') ? t : (k => k)
    this.bubble.querySelector('.tut-step').textContent  = `${this.idx + 1} / ${this.steps.length}`
    this.bubble.querySelector('.tut-title').textContent = T(s.titleKey)
    this.bubble.querySelector('.tut-body').textContent  = T(s.bodyKey)
    if (this._spotEl) this._spotEl.classList.remove('tut-spotlight')
    const el = document.querySelector(s.sel)
    if (el) { el.classList.add('tut-spotlight'); this._spotEl = el }
    requestAnimationFrame(() => this._position())
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
    if (!app || !app._play) return
    try {
      if (window.Tone && Tone.start) await Tone.start()
      await app._play()
    } catch (e) { console.warn('tutorial autoplay', e) }
  }
  _position() {
    const s = this.steps[this.idx]
    const target = document.querySelector(s.sel)
    if (!target) return
    const r = target.getBoundingClientRect()
    const vw = window.innerWidth, vh = window.innerHeight
    const bW = this.bubble.offsetWidth, bH = this.bubble.offsetHeight
    const pad = 24
    let bL, bT
    if (s.place === 'right') { bL = r.right + 80; bT = r.top + r.height/2 - bH/2 }
    else if (s.place === 'left') { bL = r.left - 80 - bW; bT = r.top + r.height/2 - bH/2 }
    else if (s.place === 'top') { bL = r.left + r.width/2 - bW/2; bT = r.top - 60 - bH }
    else { bL = r.left + r.width/2 - bW/2; bT = r.bottom + 60 }
    bL = Math.max(pad, Math.min(vw - bW - pad, bL))
    bT = Math.max(pad, Math.min(vh - bH - pad, bT))
    this.bubble.style.left = bL + 'px'
    this.bubble.style.top  = bT + 'px'

    // Position arrow as a chevron pointing TOWARD the target from the bubble side
    const aE = this.arrow
    aE.style.display = 'block'
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    let ax, ay, rot
    if (s.place === 'top')    { ax = cx - 24; ay = r.top - 50;       rot = '90deg' }
    else if (s.place === 'bottom') { ax = cx - 24; ay = r.bottom + 4; rot = '-90deg' }
    else if (s.place === 'left')   { ax = r.left - 56; ay = cy - 24;  rot = '0deg' }
    else /* right */               { ax = r.right + 4;  ay = cy - 24;  rot = '180deg' }
    aE.style.left = ax + 'px'
    aE.style.top  = ay + 'px'
    aE.style.transform = `rotate(${rot})`
  }
  _finish() {
    if (this._finished) return
    this._finished = true
    if (this._spotEl) this._spotEl.classList.remove('tut-spotlight')
    this.overlay.classList.add('hidden')
    document.body.classList.remove('tut-locked')
    localStorage.setItem('s2m-tutorial-done-v4', 'yes')
    if (this._resizeH) window.removeEventListener('resize', this._resizeH)
  }
}
