function exportMidi(notes, bpm, canvasWidth) {
  if (!notes.length) return

  const NOTE_SEMITONES = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 }

  function noteToMidi(name) {
    const m = name.match(/^([A-G])(#?)(-?\d+)$/)
    if (!m) return null
    const n = NOTE_SEMITONES[m[1]] + (m[2] ? 1 : 0) + (parseInt(m[3]) + 1) * 12
    return (n >= 0 && n <= 127) ? n : null
  }

  // Variable-length quantity encoding
  function vlq(n) {
    if (n < 0x80) return [n]
    const out = []
    while (n > 0) { out.unshift(n & 0x7F); n >>= 7 }
    for (let i = 0; i < out.length - 1; i++) out[i] |= 0x80
    return out
  }

  const PPQ       = 128
  const tempoUs   = Math.round(60_000_000 / bpm)
  const noteTicks = PPQ / 2                          // 8th note, matches player
  const totalTicks = notes.length * noteTicks

  // Build note-on / note-off event list
  const events = []
  notes.forEach(evt => {
    const pitch = noteToMidi(evt.note)
    if (pitch === null) return
    const tick = Math.max(0, Math.round((evt.x / canvasWidth) * totalTicks))
    events.push({ tick,                  pitch, on: true  })
    events.push({ tick: tick + noteTicks, pitch, on: false })
  })
  // Sort by tick; note-off before note-on at same tick
  events.sort((a, b) => a.tick - b.tick || (a.on ? 1 : -1))

  // Build track body
  const track = []
  // Tempo meta event
  track.push(...vlq(0), 0xFF, 0x51, 0x03,
    (tempoUs >> 16) & 0xFF, (tempoUs >> 8) & 0xFF, tempoUs & 0xFF)

  let lastTick = 0
  events.forEach(({ tick, pitch, on }) => {
    const delta = tick - lastTick
    lastTick = tick
    track.push(...vlq(delta), on ? 0x90 : 0x80, pitch, on ? 80 : 0)
  })
  track.push(0x00, 0xFF, 0x2F, 0x00)  // end of track

  const tl = track.length
  const bytes = new Uint8Array([
    // MThd header
    0x4D, 0x54, 0x68, 0x64,
    0x00, 0x00, 0x00, 0x06,
    0x00, 0x00,               // format 0
    0x00, 0x01,               // 1 track
    0x00, PPQ,
    // MTrk chunk
    0x4D, 0x54, 0x72, 0x6B,
    (tl >> 24) & 0xFF, (tl >> 16) & 0xFF, (tl >> 8) & 0xFF, tl & 0xFF,
    ...track
  ])

  const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/midi' }))
  const a   = Object.assign(document.createElement('a'), { href: url, download: 'shape-to-melody.mid' })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
