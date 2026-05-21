/* Opening animation: "WELCOME SHAPE TO MELODY" → letters morph into
   piano keys → fly leftward → strike the piano illustration.
   Followed by a transparent tutorial overlay highlighting key UI areas. */

class IntroAnimation {
  constructor() {
    this.overlay        = document.getElementById('intro-overlay')
    this.skipBtn        = document.getElementById('intro-skip')
    this.wordsContainer = document.getElementById('intro-words')
    this.piano          = document.getElementById('intro-piano')
    this.onDone         = null
    this._timeouts      = []
    this._finished      = false
  }

  start() {
    if (!this.overlay) return
    if (this.skipBtn) {
      this.skipBtn.addEventListener('click', () => this._finish())
    }
    this._buildLetters('WELCOME SHAPE TO MELODY')
    this._sequence()
  }

  _buildLetters(text) {
    this.wordsContainer.innerHTML = ''
    this.letters = []
    for (const ch of text) {
      const el = document.createElement('span')
      el.className = 'intro-letter'
      if (ch === ' ') el.classList.add('space')
      el.textContent = ch
      this.wordsContainer.appendChild(el)
      this.letters.push(el)
    }
  }

  _t(fn, ms) {
    const id = setTimeout(fn, ms)
    this._timeouts.push(id)
    return id
  }

  _sequence() {
    // Phase 1: letters fade in, staggered
    this.letters.forEach((el, i) => {
      this._t(() => el.classList.add('visible'), 120 + i * 45)
    })

    // Phase 2: piano slides in from the left
    this._t(() => this.piano.classList.add('visible'), 1500)

    // Phase 3: letters morph into keys
    const morphStart = 2050
    this.letters.forEach((el, i) => {
      if (el.classList.contains('space')) return
      this._t(() => el.classList.add('key'), morphStart + i * 18)
    })

    // Phase 4: letters fly left to the piano, sequentially (left-to-right)
    const visibleLetters = this.letters.filter(l => !l.classList.contains('space'))
    const flyStart = morphStart + 600
    const flyStep  = 75

    visibleLetters.forEach((el, i) => {
      const delay = flyStart + i * flyStep
      this._t(() => this._flyLetter(el, i, visibleLetters.length), delay)
    })

    // Phase 5: outro fade
    const outroAt = flyStart + visibleLetters.length * flyStep + 1100
    this._t(() => this._finish(), outroAt)
  }

  _flyLetter(el, i, total) {
    const pianoRect  = this.piano.getBoundingClientRect()
    const letterRect = el.getBoundingClientRect()
    const keys = this.piano.querySelectorAll('.white-keys rect')

    // Target a key inside the piano — cycle through keys for variety
    const k     = keys[i % keys.length]
    const kRect = k ? k.getBoundingClientRect() : pianoRect
    const dx = kRect.left + kRect.width  / 2 - (letterRect.left + letterRect.width  / 2)
    const dy = kRect.top  + kRect.height / 2 - (letterRect.top  + letterRect.height / 2)

    el.classList.add('flying')
    el.style.transform = `translate(${dx}px, ${dy}px) scale(0.45)`

    // After flight, flash the piano key and fade the letter
    this._t(() => {
      el.classList.add('faded')
      if (k) {
        k.classList.add('hit')
        setTimeout(() => k.classList.remove('hit'), 240)
      }
    }, 850)
  }

  _finish() {
    if (this._finished) return
    this._finished = true
    this._timeouts.forEach(clearTimeout)
    this.overlay.classList.add('outro')
    setTimeout(() => {
      this.overlay.style.display = 'none'
      if (this.onDone) this.onDone()
    }, 700)
  }
}

class Tutorial {
  constructor() {
    this.overlay = document.getElementById('tutorial-overlay')
    this.bubble  = document.getElementById('tutorial-bubble')
    this.arrow   = document.getElementById('tutorial-arrow')
    this.idx           = 0
    this._spotlightEl  = null
    this._resizeHandle = null

    // Steps live here so language can be swapped via i18n later
    this.steps = [
      {
        targetSelector: '#canvas-container',
        title: '欢迎使用',
        body:  '这里是你的画布。画一笔会变成一个音符，整张画就是一段旋律。',
        place: 'top',
      },
      {
        targetSelector: '#sidebar-left .panel:first-child',
        title: '挑笔触和颜色',
        body:  '左侧面板可以选画笔、形状、颜色。点击面板标题还能折叠。',
        place: 'right',
      },
      {
        targetSelector: '#mode-toggle',
        title: '上传图片',
        body:  '切换到「上传」可以拖入或浏览图片，自动转成线条与旋律。',
        place: 'right',
      },
      {
        targetSelector: '#play-controls',
        title: '转换 & 播放',
        body:  '画完按「转换」生成音符，再点「播放」听一下。可选 MIDI / WAV / MP3 导出。',
        place: 'left',
      },
    ]
  }

  start() {
    if (!this.overlay) return
    if (localStorage.getItem('s2m-tutorial-done-v2') === 'yes') return
    this.overlay.classList.remove('hidden')
    document.getElementById('tut-next').addEventListener('click', () => this._next())
    document.getElementById('tut-skip').addEventListener('click', () => this._finish())
    this._resizeHandle = () => this._position()
    window.addEventListener('resize', this._resizeHandle)
    this._render()
  }

  _next() {
    this.idx++
    if (this.idx >= this.steps.length) { this._finish(); return }
    this._render()
  }

  _render() {
    const step = this.steps[this.idx]
    this.bubble.querySelector('.tut-step').textContent  = `${this.idx + 1} / ${this.steps.length}`
    this.bubble.querySelector('.tut-title').textContent = step.title
    this.bubble.querySelector('.tut-body').textContent  = step.body

    const nextBtn = document.getElementById('tut-next')
    nextBtn.textContent = (this.idx === this.steps.length - 1) ? '完成' : '下一步'

    // Spotlight
    if (this._spotlightEl) this._spotlightEl.classList.remove('tut-spotlight')
    const target = document.querySelector(step.targetSelector)
    if (target) {
      target.classList.add('tut-spotlight')
      this._spotlightEl = target
    }
    requestAnimationFrame(() => this._position())
  }

  _position() {
    const step = this.steps[this.idx]
    const target = document.querySelector(step.targetSelector)
    if (!target) return
    const r   = target.getBoundingClientRect()
    const vw  = window.innerWidth
    const vh  = window.innerHeight
    const bW  = this.bubble.offsetWidth
    const bH  = this.bubble.offsetHeight
    const pad = 24

    let bL, bT
    switch (step.place) {
      case 'right':
        bL = r.right + 80
        bT = r.top + r.height / 2 - bH / 2
        break
      case 'left':
        bL = r.left - 80 - bW
        bT = r.top + r.height / 2 - bH / 2
        break
      case 'top':
        bL = r.left + r.width / 2 - bW / 2
        bT = r.top - 60 - bH
        break
      default: // bottom
        bL = r.left + r.width / 2 - bW / 2
        bT = r.bottom + 60
    }

    bL = Math.max(pad, Math.min(vw - bW - pad, bL))
    bT = Math.max(pad, Math.min(vh - bH - pad, bT))
    this.bubble.style.left = bL + 'px'
    this.bubble.style.top  = bT + 'px'

    // Arrow placement
    if (step.place === 'right') {
      this.arrow.style.left = (r.right + 6) + 'px'
      this.arrow.style.top  = (r.top + r.height / 2 - 40) + 'px'
      this.arrow.style.transform = 'scaleX(-1)'
    } else if (step.place === 'left') {
      this.arrow.style.left = (r.left - 86) + 'px'
      this.arrow.style.top  = (r.top + r.height / 2 - 40) + 'px'
      this.arrow.style.transform = 'none'
    } else if (step.place === 'top') {
      this.arrow.style.left = (r.left + r.width / 2 - 40) + 'px'
      this.arrow.style.top  = (r.top - 86) + 'px'
      this.arrow.style.transform = 'rotate(90deg)'
    } else {
      this.arrow.style.left = (r.left + r.width / 2 - 40) + 'px'
      this.arrow.style.top  = (r.bottom + 6) + 'px'
      this.arrow.style.transform = 'rotate(-90deg)'
    }
  }

  _finish() {
    if (this._spotlightEl) this._spotlightEl.classList.remove('tut-spotlight')
    this.overlay.classList.add('hidden')
    localStorage.setItem('s2m-tutorial-done-v2', 'yes')
    if (this._resizeHandle) window.removeEventListener('resize', this._resizeHandle)
  }
}
