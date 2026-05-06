const INSTRUMENTS = {
  piano: {
    label: '钢琴',
    reverbWet: 0.25,
    factory: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle8' },
      envelope: { attack: 0.02, decay: 0.25, sustain: 0.08, release: 1.4 },
      volume: -8
    })
  },
  epiano: {
    label: '电钢琴',
    reverbWet: 0.30,
    factory: () => new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3,
      modulationIndex: 10,
      envelope: { attack: 0.01, decay: 0.4, sustain: 0.2, release: 1.5 },
      volume: -8
    })
  },
  organ: {
    label: '风琴',
    reverbWet: 0.12,
    factory: () => new Tone.PolySynth(Tone.AMSynth, {
      harmonicity: 3,
      oscillator: { type: 'square' },
      envelope: { attack: 0.06, decay: 0.1, sustain: 0.9, release: 0.3 },
      volume: -12
    })
  },
  strings: {
    label: '弦乐',
    reverbWet: 0.40,
    factory: () => new Tone.PolySynth(Tone.AMSynth, {
      harmonicity: 3.5,
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.35, decay: 0.1, sustain: 0.8, release: 1.2 },
      volume: -11
    })
  },
  pluck: {
    label: '拨弦',
    reverbWet: 0.15,
    isPluck: true,
    factory: () => new Tone.PluckSynth({
      attackNoise: 1.5,
      dampening: 4000,
      resonance: 0.98,
      volume: -4
    })
  },
  bell: {
    label: '钟声',
    reverbWet: 0.45,
    factory: () => new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 8,
      modulationIndex: 5,
      envelope: { attack: 0.001, decay: 1.2, sustain: 0, release: 1.5 },
      volume: -6
    })
  },
  marimba: {
    label: '马林巴',
    reverbWet: 0.20,
    factory: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.35 },
      volume: -6
    })
  },
  xylophone: {
    label: '木琴',
    reverbWet: 0.18,
    factory: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.2 },
      volume: -5
    })
  }
}

class Player {
  constructor() {
    this.synth       = null
    this.reverb      = null
    this.sequence    = null
    this.isPlaying   = false
    this.bpm         = 120
    this._ready      = false
    this._instrument = 'piano'
    this._trigger    = null
    this.onStop      = null
  }

  warmup() { this._init().catch(() => {}) }

  async setInstrument(name) {
    this._instrument = name
    if (this._ready) await this._createSynth()
  }

  async _init() {
    if (this._ready) return
    await Tone.start()
    this.reverb = new Tone.Reverb({ decay: 2.5, wet: 0.25 })
    await this.reverb.ready
    this.reverb.toDestination()
    await this._createSynth()
    this._ready = true
  }

  async _createSynth() {
    if (this.synth) {
      this.synth.disconnect()
      this.synth.dispose()
    }
    const cfg = INSTRUMENTS[this._instrument] || INSTRUMENTS.piano
    this.synth = cfg.factory()
    this.synth.connect(this.reverb)
    this.reverb.wet.value = cfg.reverbWet

    // PluckSynth has a different triggerAttackRelease signature (no duration)
    this._trigger = cfg.isPluck
      ? (note, dur, time) => this.synth.triggerAttackRelease(note, time)
      : (note, dur, time) => this.synth.triggerAttackRelease(note, dur, time)
  }

  async play(notes) {
    await this._init()
    this.stop()
    if (notes.length === 0) return

    Tone.getTransport().bpm.value = this.bpm

    const dur  = '8n'
    const step = Tone.Time(dur).toSeconds()

    this.sequence = new Tone.Sequence(
      (time, note) => { this._trigger(note, dur, time) },
      notes,
      dur
    )
    this.sequence.loop = false
    this.sequence.start(0)
    Tone.getTransport().start()
    this.isPlaying = true

    const totalTime = notes.length * step + 2
    Tone.getTransport().scheduleOnce(() => {
      this._cleanup()
      if (this.onStop) this.onStop()
    }, `+${totalTime}`)
  }

  stop() {
    this._cleanup()
    if (this.onStop) this.onStop()
  }

  _cleanup() {
    Tone.getTransport().stop()
    Tone.getTransport().cancel()
    if (this.sequence) {
      this.sequence.stop()
      this.sequence.dispose()
      this.sequence = null
    }
    if (this.synth) this.synth.releaseAll?.()
    this.isPlaying = false
  }

  setBPM(bpm) {
    this.bpm = bpm
    if (this.isPlaying) Tone.getTransport().bpm.value = bpm
  }
}
