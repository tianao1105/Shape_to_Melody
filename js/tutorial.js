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
      { sel: '#canvas-container', title: '看，每一笔都是音符',
        body: '我画一条波浪给你看 — 你画的形状会自动变成旋律。',
        place: 'top' },
      { sel: '#sidebar-left .panel:first-child', title: '挑笔触和颜色',
        body: '左侧有画笔、形状、颜色。点标题还能折叠收起。',
        place: 'right' },
      { sel: '#mode-toggle', title: '也支持图片',
        body: '切到「上传」可以拖入或浏览图片，自动转成线条与旋律。',
        place: 'right' },
      { sel: '#play-controls', title: '转换 & 播放',
        body: '我已经帮你转换好了，正在播放你刚才画的波浪。',
        place: 'left' },
    ]
  }

  async start() {
    if (!this.overlay) return
    if (localStorage.getItem('s2m-tutorial-done-v4') === 'yes') return
    this.overlay.classList.remove('hidden')
    document.body.classList.add('tut-locked')
    this._resizeH = () => this._position()
    window.addEventListener('resize', this._resizeH)
    document.getElementById('tut-skip').addEventListener('click', () => this._finish())
    const nx = document.getElementById('tut-next')
    nx.style.display = 'none'  // auto-advancing; hide manual Next

    try {
      await this._runFlow()
    } catch (e) {
      console.error('tutorial flow error', e)
    }
    this._finish()
  }

  async _runFlow() {
    // Step 1: canvas + animated draw
    this._goto(0)
    await this._sleep(700)
    await this._autoDraw()
    await this._sleep(900)
    if (this._finished) return

    // Step 2: brush panel
    this._goto(1)
    await this._sleep(2400)
    if (this._finished) return

    // Step 3: upload mode
    this._goto(2)
    await this._sleep(2400)
    if (this._finished) return

    // Step 4: convert + play
    this._goto(3)
    await this._sleep(500)
    this._autoConvert()
    await this._sleep(700)
    await this._autoPlay()
    await this._sleep(800)
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

  _goto(i) {
    this.idx = i
    this._render()
  }

  _render() {
    const s = this.steps[this.idx]
    this.bubble.querySelector('.tut-step').textContent  = `${this.idx + 1} / ${this.steps.length}`
    this.bubble.querySelector('.tut-title').textContent = s.title
    this.bubble.querySelector('.tut-body').textContent  = s.body
    if (this._spotEl) this._spotEl.classList.remove('tut-spotlight')
    const t = document.querySelector(s.sel)
    if (t) { t.classList.add('tut-spotlight'); this._spotEl = t }
    requestAnimationFrame(() => this._position())
  }

  async _autoDraw() {
    const cm = window.app && window.app.canvas
    if (!cm || !cm.lm) return
    const { width, height } = cm.getSize()
    const N = 100, pts = []
    for (let i = 0; i <= N; i++) {
      const t = i / N
      const x = 80 + t * (width - 160)
      const y = height / 2
        + Math.sin(t * Math.PI * 3.5) * (height * 0.22)
        + Math.cos(t * Math.PI * 1.7) * (height * 0.07)
      pts.push({ x, y })
    }
    const layer = cm.lm.active
    // Commit stroke first so resize observers don't see an empty canvas
    layer.strokes.push(pts.map(p => ({ x: p.x, y: p.y })))
    cm._refreshEmptyHint()

    const ctx = layer.ctx
    ctx.save()
    ctx.strokeStyle = cm.brushColor || '#ffffff'
    ctx.lineWidth   = Math.max(5, cm.brushSize || 6)
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
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
    const t = document.querySelector(s.sel)
    if (!t) return
    const r = t.getBoundingClientRect()
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
    if (s.place === 'right') {
      this.arrow.style.left = (r.right + 6) + 'px'
      this.arrow.style.top  = (r.top + r.height/2 - 40) + 'px'
      this.arrow.style.transform = 'scaleX(-1)'
    } else if (s.place === 'left') {
      this.arrow.style.left = (r.left - 86) + 'px'
      this.arrow.style.top  = (r.top + r.height/2 - 40) + 'px'
      this.arrow.style.transform = 'none'
    } else if (s.place === 'top') {
      this.arrow.style.left = (r.left + r.width/2 - 40) + 'px'
      this.arrow.style.top  = (r.top - 86) + 'px'
      this.arrow.style.transform = 'rotate(90deg)'
    } else {
      this.arrow.style.left = (r.left + r.width/2 - 40) + 'px'
      this.arrow.style.top  = (r.bottom + 6) + 'px'
      this.arrow.style.transform = 'rotate(-90deg)'
    }
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
