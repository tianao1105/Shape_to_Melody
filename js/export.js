/* ── MIDI export ──────────────────────────────────────────── */

function exportMidi(notes, bpm, canvasWidth) {
  if (!notes.length) return

  const NOTE_SEMITONES = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 }

  function noteToMidi(name) {
    const m = name.match(/^([A-G])(#?)(-?\d+)$/)
    if (!m) return null
    const n = NOTE_SEMITONES[m[1]] + (m[2] ? 1 : 0) + (parseInt(m[3]) + 1) * 12
    return (n >= 0 && n <= 127) ? n : null
  }

  function vlq(n) {
    if (n < 0x80) return [n]
    const out = []
    while (n > 0) { out.unshift(n & 0x7F); n >>= 7 }
    for (let i = 0; i < out.length - 1; i++) out[i] |= 0x80
    return out
  }

  const PPQ       = 128
  const tempoUs   = Math.round(60_000_000 / bpm)
  const noteTicks = PPQ / 2
  const totalTicks = notes.length * noteTicks

  const events = []
  notes.forEach(evt => {
    const pitch = noteToMidi(evt.note)
    if (pitch === null) return
    const tick = Math.max(0, Math.round((evt.x / canvasWidth) * totalTicks))
    events.push({ tick,               pitch, on: true  })
    events.push({ tick: tick + noteTicks, pitch, on: false })
  })
  events.sort((a, b) => a.tick - b.tick || (a.on ? 1 : -1))

  const track = []
  track.push(...vlq(0), 0xFF, 0x51, 0x03,
    (tempoUs >> 16) & 0xFF, (tempoUs >> 8) & 0xFF, tempoUs & 0xFF)

  let lastTick = 0
  events.forEach(({ tick, pitch, on }) => {
    const delta = tick - lastTick; lastTick = tick
    track.push(...vlq(delta), on ? 0x90 : 0x80, pitch, on ? 80 : 0)
  })
  track.push(0x00, 0xFF, 0x2F, 0x00)

  const tl = track.length
  const bytes = new Uint8Array([
    0x4D,0x54,0x68,0x64, 0x00,0x00,0x00,0x06, 0x00,0x00, 0x00,0x01, 0x00,PPQ,
    0x4D,0x54,0x72,0x6B,
    (tl>>24)&0xFF,(tl>>16)&0xFF,(tl>>8)&0xFF,tl&0xFF,
    ...track
  ])
  _download(new Blob([bytes], { type: 'audio/midi' }), 'shape-to-melody.mid')
}

/* ── Audio export (WAV / MP3) ─────────────────────────────── */

async function exportAudio(layers, bpm, canvasWidth, format, onStatus) {
  const allNotes = layers.flatMap(l => l.notes)
  if (!allNotes.length) return

  onStatus('rendering')

  const stepSec  = 60 / bpm / 2
  const totalSec = allNotes.length * stepSec
  const duration = totalSec + 4

  let toneBuffer
  try {
    toneBuffer = await Tone.Offline(async ({ transport }) => {
      const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.25 }).toDestination()
      await reverb.ready

      for (const layer of layers.filter(l => l.notes.length > 0)) {
        const cfg   = INSTRUMENTS[layer.instrument] || INSTRUMENTS.piano
        const synth = cfg.factory()
        const vol   = new Tone.Volume(_linearToDb(layer.volume ?? 0.8))
        synth.connect(vol)
        vol.connect(reverb)

        layer.notes.forEach(evt => {
          const t = (evt.x / canvasWidth) * totalSec
          if (cfg.isPluck) {
            transport.schedule(at => synth.triggerAttackRelease(evt.note, at), t)
          } else {
            transport.schedule(at => synth.triggerAttackRelease(evt.note, '8n', at), t)
          }
        })
      }
      transport.start()
    }, duration)
  } catch (err) {
    onStatus('error')
    console.error('Offline render failed:', err)
    return
  }

  const ab = toneBuffer.get()   // native AudioBuffer

  if (format === 'wav') {
    _download(_encodeWav(ab), 'shape-to-melody.wav')
  } else if (format === 'mp3') {
    onStatus('encoding')
    const blob = _encodeMp3(ab)
    if (blob) _download(blob, 'shape-to-melody.mp3')
    else onStatus('error')
  }

  onStatus('done')
}

/* ── WAV encoder ──────────────────────────────────────────── */

function _encodeWav(ab) {
  const ch   = ab.numberOfChannels
  const sr   = ab.sampleRate
  const len  = ab.length
  const bps  = 2                            // 16-bit PCM
  const data = new ArrayBuffer(44 + len * ch * bps)
  const v    = new DataView(data)

  const ws = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)) }
  ws(0,  'RIFF'); v.setUint32(4,  36 + len * ch * bps, true)
  ws(8,  'WAVE'); ws(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1,  true)                // PCM
  v.setUint16(22, ch, true)
  v.setUint32(24, sr, true)
  v.setUint32(28, sr * ch * bps, true)
  v.setUint16(32, ch * bps, true)
  v.setUint16(34, 16, true)
  ws(36, 'data'); v.setUint32(40, len * ch * bps, true)

  let off = 44
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, ab.getChannelData(c)[i]))
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
      off += 2
    }
  }
  return new Blob([data], { type: 'audio/wav' })
}

/* ── MP3 encoder (requires lamejs) ───────────────────────── */

function _encodeMp3(ab) {
  if (typeof lamejs === 'undefined') {
    alert('MP3 encoder not loaded. Please check your connection.')
    return null
  }
  const ch    = ab.numberOfChannels
  const sr    = ab.sampleRate
  const enc   = new lamejs.Mp3Encoder(ch, sr, 128)
  const chunk = 1152
  const toI16 = f32 => { const a = new Int16Array(f32.length); for (let i=0;i<f32.length;i++) a[i]=Math.max(-32768,Math.min(32767,f32[i]*32767)); return a }
  const L = toI16(ab.getChannelData(0))
  const R = ch > 1 ? toI16(ab.getChannelData(1)) : L
  const parts = []
  for (let i = 0; i < L.length; i += chunk) {
    const buf = enc.encodeBuffer(L.subarray(i, i+chunk), R.subarray(i, i+chunk))
    if (buf.length) parts.push(buf)
  }
  const end = enc.flush()
  if (end.length) parts.push(end)
  return new Blob(parts, { type: 'audio/mpeg' })
}

/* ── Helpers ──────────────────────────────────────────────── */

function _linearToDb(v) {
  if (v <= 0) return -Infinity
  return 20 * Math.log10(Math.max(v, 0.001))
}

function _download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a   = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
