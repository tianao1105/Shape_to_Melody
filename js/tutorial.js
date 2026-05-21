/* Auto-demo tutorial overlay shown after the intro animation. */

class Tutorial {
  constructor() {
    this.overlay = document.getElementById('tutorial-overlay')
    this.bubble  = document.getElementById('tutorial-bubble')
    this.arrow   = document.getElementById('tutorial-arrow')
    this.idx = 0
    this._spotEl = null
    this._resizeH = null
    this._finished = false
    this._demoDrawn = false
    this.steps = [
      { sel: '#canvas-container', title: '看，每一笔都是音符',
        body: '画的形状会自动变成旋律。我画一条波浪给你看看。',
        place: 'top', onEnter: () => this._autoDraw() },
      { sel: '#sidebar-left .panel:first-child', title: '挑笔触和颜色',
        body: '左侧有画笔、形状、颜色。点标题还可以折叠收起。',
        place: 'right' },
      { sel: '#mode-toggle', title: '也支持图片',
        body: '切到「上传」可拖入或浏览图片，会自动转成线条与旋律。',
        place: 'right' },
      { sel: '#play-controls', title: '转换 & 播放',
        body: '已经帮你转换好了。点「播放」就能听刚才那条波浪。',
        place: 'left', onEnter: () => this._autoConvert() },
    ]
  }
  start() {
    if (!this.overlay) return
    if (localStorage.getItem('s2m-tutorial-done-v3') === 'yes') return
    this.overlay.classList.remove('hidden')
    document.getElementById('tut-next').addEventListener('click', () => this._next())
    document.getElementById('tut-skip').addEventListener('click', () => this._finish())
    this._resizeH = () => this._position()
    window.addEventListener('resize', this._resizeH)
    this._render()
  }
  async _autoDraw() {
    if (this._demoDrawn) return
    this._demoDrawn = true
    const cm = window.app && window.app.canvas
    if (!cm || !cm.lm) return
    const { width, height } = cm.getSize()
    const N = 90, pts = []
    for (let i = 0; i <= N; i++) {
      const t = i / N
      const x = 70 + t * (width - 140)
      const y = height / 2
        + Math.sin(t * Math.PI * 3.5) * (height * 0.20)
        + Math.cos(t * Math.PI * 1.7) * (height * 0.06)
      pts.push({ x, y })
    }
    const layer = cm.lm.active
    const ctx = layer.ctx
    ctx.save()
    ctx.strokeStyle = cm.brushColor || '#fff'
    ctx.lineWidth = Math.max(4, cm.brushSize || 6)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i]
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      cm.lm.composite(cm.ctx)
      await new Promise(r => setTimeout(r, 14))
      if (this._finished) { ctx.restore(); return }
    }
    ctx.restore()
    layer.strokes.push(pts.map(p => ({ x: p.x, y: p.y })))
    cm.lm.pushHistory()
    cm._refreshEmptyHint()
    cm._notifyHistoryChange()
  }
  _autoConvert() {
    const app = window.app
    if (!app || !app._convert) return
    if (app.canvas.lm && app.canvas.lm.isEmpty()) return
    try { app._convert() } catch (e) {}
  }
  _next() {
    this.idx++
    if (this.idx >= this.steps.length) { this._finish(); return }
    this._render()
  }
  _render() {
    const s = this.steps[this.idx]
    this.bubble.querySelector('.tut-step').textContent = `${this.idx + 1} / ${this.steps.length}`
    this.bubble.querySelector('.tut-title').textContent = s.title
    this.bubble.querySelector('.tut-body').textContent = s.body
    const nx = document.getElementById('tut-next')
    nx.textContent = (this.idx === this.steps.length - 1) ? '完成' : '下一步'
    if (this._spotEl) this._spotEl.classList.remove('tut-spotlight')
    const t = document.querySelector(s.sel)
    if (t) { t.classList.add('tut-spotlight'); this._spotEl = t }
    requestAnimationFrame(() => this._position())
    if (s.onEnter) { try { s.onEnter() } catch (e) {} }
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
    this.bubble.style.top = bT + 'px'
    if (s.place === 'right') {
      this.arrow.style.left = (r.right + 6) + 'px'
      this.arrow.style.top = (r.top + r.height/2 - 40) + 'px'
      this.arrow.style.transform = 'scaleX(-1)'
    } else if (s.place === 'left') {
      this.arrow.style.left = (r.left - 86) + 'px'
      this.arrow.style.top = (r.top + r.height/2 - 40) + 'px'
      this.arrow.style.transform = 'none'
    } else if (s.place === 'top') {
      this.arrow.style.left = (r.left + r.width/2 - 40) + 'px'
      this.arrow.style.top = (r.top - 86) + 'px'
      this.arrow.style.transform = 'rotate(90deg)'
    } else {
      this.arrow.style.left = (r.left + r.width/2 - 40) + 'px'
      this.arrow.style.top = (r.bottom + 6) + 'px'
      this.arrow.style.transform = 'rotate(-90deg)'
    }
  }
  _finish() {
    this._finished = true
    if (this._spotEl) this._spotEl.classList.remove('tut-spotlight')
    this.overlay.classList.add('hidden')
    localStorage.setItem('s2m-tutorial-done-v3', 'yes')
    if (this._resizeH) window.removeEventListener('resize', this._resizeH)
  }
}
