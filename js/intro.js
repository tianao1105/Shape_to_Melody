/* Intro animation. */

class IntroAnimation {
  constructor() {
    this.overlay = document.getElementById('intro-overlay')
    this.skipBtn = document.getElementById('intro-skip')
    this.wordsContainer = document.getElementById('intro-words')
    this.piano = document.getElementById('intro-piano')
    this.onDone = null
    this._timeouts = []
    this._finished = false
  }
  start() {
    if (!this.overlay) return
    if (this.skipBtn) this.skipBtn.addEventListener('click', () => this._finish())
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
  _t(fn, ms) { const id = setTimeout(fn, ms); this._timeouts.push(id); return id }
  _sequence() {
    this.letters.forEach((el, i) => this._t(() => el.classList.add('visible'), 120 + i * 45))
    this._t(() => this.piano.classList.add('visible'), 1500)
    const morphStart = 2050
    this.letters.forEach((el, i) => {
      if (el.classList.contains('space')) return
      this._t(() => el.classList.add('key'), morphStart + i * 18)
    })
    const visible = this.letters.filter(l => !l.classList.contains('space'))
    const flyStart = morphStart + 600
    const flyStep = 75
    visible.forEach((el, i) => this._t(() => this._fly(el, i), flyStart + i * flyStep))
    this._t(() => this._finish(), flyStart + visible.length * flyStep + 1100)
  }
  _fly(el, i) {
    const keys = this.piano.querySelectorAll('.white-keys rect')
    const k = keys[i % keys.length]
    const kR = k ? k.getBoundingClientRect() : this.piano.getBoundingClientRect()
    const lR = el.getBoundingClientRect()
    const dx = kR.left + kR.width / 2 - (lR.left + lR.width / 2)
    const dy = kR.top + kR.height / 2 - (lR.top + lR.height / 2)
    el.classList.add('flying')
    el.style.transform = `translate(${dx}px, ${dy}px) scale(0.45)`
    this._t(() => {
      el.classList.add('faded')
      if (k) { k.classList.add('hit'); setTimeout(() => k.classList.remove('hit'), 240) }
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
