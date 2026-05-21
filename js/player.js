const INSTRUMENTS = {
  piano: {
    label: '钢琴', reverbWet: 0.25,
    factory: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle8' },
      envelope: { attack: 0.02, decay: 0.25, sustain: 0.08, release: 1.4 },
      volume: -8
    })
  },
  epiano: {
    label: '电钢琴', reverbWet: 0.30,
    factory: () => new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3, modulationIndex: 10,
      envelope: { attack: 0.01, decay: 0.4, sustain: 0.2, release: 1.5 },
      volume: -8
    })
  },
  organ: {
    label: '风琴', reverbWet: 0.12,
    factory: () => new Tone.PolySynth(Tone.AMSynth, {
      harmonicity: 3, oscillator: { type: 'square' },
      envelope: { attack: 0.06, decay: 0.1, sustain: 0.9, release: 0.3 },
      volume: -12
    })
  },
  strings: {
    label: '弦乐', reverbWet: 0.40,
    factory: () => new Tone.PolySynth(Tone.AMSynth, {
      harmonicity: 3.5, oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.35, decay: 0.1, sustain: 0.8, release: 1.2 },
      volume: -11
    })
  },
  pluck: {
    label: '拨弦', reverbWet: 0.15, isPluck: true,
    factory: () => new Tone.PluckSynth({ attackNoise: 1.5, dampening: 4000, resonance: 0.98, volume: -4 })
  },
  bell: {
    label: '钟声', reverbWet: 0.45,
    factory: () => new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 8, modulationIndex: 5,
      envelope: { attack: 0.001, decay: 1.2, sustain: 0, release: 1.5 },
      volume: -6
    })
  },
  marimba: {
    label: '马林巴', reverbWet: 0.20,
    factory: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.35 },
      volume: -6
    })
  },
  xylophone: {
    label: '木琴', reverbWet: 0.18,
    factory: () => new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.2 },
      volume: -5
    })
  }
}

function _linearToDb(v) {
  if (v <= 0) return -Infinity
  return 20 * Math.log10(Math.max(v, 0.001))
}

class Player {
  constructor() {
    this.reverb     = null
    this._synths    = []   // [{synth, vol}] created per play call
    this.isPlaying  = false
    this.bpm        = 120
    this._ready     = false
    this._totalTime = 0
    this.onStop     = null
  }

  warmup() { this._init().catch(() => {}) }

  async _init() {
    if (this._ready) return
    await Tone.start()
    this.reverb = new Tone.Reverb({ decay: 2.5, wet: 0.25 })
    await this.reverb.ready
    this.reverb.toDestination()
    this._ready = true
  }

  // layers: array of layer objects with {notes[], instrument, volume}
  async play(layers, canvasWidth) {
    await this._init()
    this.stop()

    const active = layers.filter(l => l.notes.length > 0)
    if (!active.length) return

    Tone.Transport.bpm.value = this.bpm
    const dur     = '8n'
    const stepSec = Tone.Time(dur).toSeconds()
    this._totalTime = active.flatMap(l => l.notes).length * stepSec

    for (const layer of active) {
      const cfg   = INSTRUMENTS[layer.instrument] || INSTRUMENTS.piano
      const synth = cfg.factory()
      const vol   = new Tone.Volume(_linearToDb(layer.volume ?? 0.8))
      synth.connect(vol)
      vol.connect(this.reverb)
      this.reverb.wet.value = cfg.reverbWet
      this._synths.push({ synth, vol })

      const trigger = cfg.isPluck
        ? (note, _d, time) => synth.triggerAttackRelease(note, time)
        : (note, d,  time) => synth.triggerAttackRelease(note, d, time)

      layer.notes.forEach(evt => {
        const t = (evt.x / canvasWidth) * this._totalTime
        Tone.Transport.schedule(at => trigger(evt.note, dur, at), t)
      })
    }

    Tone.Transport.start()
    this.isPlaying = true

    Tone.Transport.scheduleOnce(() => {
      this._cleanup()
      if (this.onStop) this.onStop()
    }, `+${this._totalTime + 2}`)
  }

  getTotalTime() { return this._totalTime }

  stop() {
    this._cleanup()
    if (this.onStop) this.onStop()
  }

  _cleanup() {
    Tone.Transport.stop()
    Tone.Transport.cancel()
    this._synths.forEach(({ synth, vol }) => {
      synth.releaseAll?.()
      synth.disconnect(); synth.dispose()
      vol.disconnect();   vol.dispose()
    })
    this._synths = []
    this.isPlaying = false
  }

  setBPM(bpm) {
    this.bpm = bpm
    if (this.isPlaying) Tone.Transport.bpm.value = bpm
  }
}
