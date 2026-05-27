/* Persist & restore the full project state.
   Strategy: serialize each layer as (strokes + notes + meta) plus a PNG
   dataURL of its canvas — that way we don't need to replay every brush
   stroke on hydrate, the visual is pixel-perfect, and the strokes array
   stays available for the converter and for future re-conversion. */

const AUTOSAVE_KEY = 's2m-autosave'
const PROJECT_VERSION = 1

function serializeProject(app) {
  const cm = app.canvas
  const lm = app.layerManager
  const cv = cm.canvas
  return {
    version: PROJECT_VERSION,
    savedAt: Date.now(),
    canvas: {
      width:  cv.width,
      height: cv.height,
      mode:        cm.mode,
      drawTool:    cm.drawTool,
      brushSize:   cm.brushSize,
      brushColor:  cm.brushColor,
    },
    layers: lm.layers.map(L => ({
      name:       L.name,
      color:      L.color,
      instrument: L.instrument || 'piano',
      volume:     L.volume ?? 0.8,
      strokes:    L.strokes,
      notes:      L.notes,
      image:      L.canvas.toDataURL('image/png'),
    })),
    activeIdx: lm.activeIdx,
    settings: {
      convertMode:      app.convertMode,
      samplingInterval: app.samplingInterval,
      scale:            app.converter.scaleName,
      bpm:              Number((document.getElementById('bpm') || {}).value) || 120,
      theme:            localStorage.getItem('theme') || null,
    },
  }
}

function isProjectEmpty(data) {
  if (!data || !data.layers) return true
  return data.layers.every(L => (!L.strokes || L.strokes.length === 0))
}

async function hydrateProject(app, data) {
  if (!data || !data.layers) return false

  const lm  = app.layerManager
  const cm  = app.canvas

  // 1. Apply canvas size before rebuilding layers
  const W = (data.canvas && data.canvas.width)  || cm.canvas.width
  const H = (data.canvas && data.canvas.height) || cm.canvas.height
  cm.canvas.width  = W
  cm.canvas.height = H
  const prCanvas = document.getElementById('piano-roll-canvas')
  const wsCanvas = document.getElementById('workspace-canvas')
  if (prCanvas) { prCanvas.width = W; prCanvas.height = H }
  if (wsCanvas) { wsCanvas.width = W; wsCanvas.height = H }

  // 2. Reset layer manager
  lm.layers    = []
  lm.activeIdx = 0
  lm._w        = W
  lm._h        = H

  // 3. Rebuild layers
  for (const L of data.layers) {
    const layer = lm._create()
    layer.name       = L.name       || layer.name
    layer.color      = L.color      || layer.color
    layer.instrument = L.instrument || 'piano'
    layer.volume     = (L.volume ?? 0.8)
    layer.strokes    = Array.isArray(L.strokes)
      ? L.strokes.map(s => s.map(p => ({ x: p.x, y: p.y })))
      : []
    layer.notes      = Array.isArray(L.notes)
      ? L.notes.map(n => ({ note: n.note, x: n.x, y: n.y }))
      : []

    if (L.image) {
      await new Promise(resolve => {
        const img = new Image()
        img.onload = () => {
          layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height)
          layer.ctx.drawImage(img, 0, 0, layer.canvas.width, layer.canvas.height)
          resolve()
        }
        img.onerror = resolve
        img.src = L.image
      })
    }

    // Reset history baseline to this snapshot so undo doesn't go past load
    layer.history = []
    layer.histIdx = -1
    lm._pushSnapshotTo(layer)
  }

  lm.activeIdx = Math.max(0, Math.min(data.activeIdx || 0, lm.layers.length - 1))

  // 4. Composite onto main canvas
  lm.composite(cm.ctx)

  // 5. Canvas-side state
  const c = data.canvas || {}
  if (c.mode)       cm.mode       = c.mode
  if (c.drawTool)   cm.drawTool   = c.drawTool
  if (c.brushSize)  cm.brushSize  = c.brushSize
  if (c.brushColor) cm.brushColor = c.brushColor

  // 6. Settings
  const s = data.settings || {}
  if (s.convertMode) {
    app.convertMode = s.convertMode
    document.querySelectorAll('#convert-mode-btns .mode-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.mode === s.convertMode))
    if (typeof app._togglePartialOverlay === 'function')
      app._togglePartialOverlay(s.convertMode === 'partial')
  }
  if (s.samplingInterval != null) {
    app.samplingInterval = s.samplingInterval
    const slider = document.getElementById('sampling-interval')
    const valEl  = document.getElementById('sampling-val')
    if (slider) slider.value = s.samplingInterval
    if (valEl)  valEl.textContent = s.samplingInterval
  }
  if (s.scale) {
    app.converter.setScale(s.scale)
    const sel = document.getElementById('scale-select')
    if (sel) sel.value = s.scale
  }
  if (s.bpm) {
    app.player.setBPM(Number(s.bpm))
    const b = document.getElementById('bpm')
    const v = document.getElementById('bpm-val')
    if (b) b.value = s.bpm
    if (v) v.textContent = s.bpm
  }
  if (s.theme && typeof applyTheme === 'function') {
    applyTheme(s.theme)
  }

  // 7. Refresh derived UI
  if (typeof app._renderLayerTabs === 'function') app._renderLayerTabs()
  if (typeof app._refreshUndoRedo === 'function') app._refreshUndoRedo()
  if (cm._refreshEmptyHint) cm._refreshEmptyHint()
  // Update brush/color/tool UI selection
  document.querySelectorAll('.color-swatch').forEach(sw =>
    sw.classList.toggle('active', sw.dataset.color === cm.brushColor))
  document.querySelectorAll('#tool-btns .tool-btn, #shape-btns .tool-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === cm.drawTool))
  document.querySelectorAll('#canvas-mode-btns .mode-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === cm.mode))

  // 8. If notes exist, enable play / export
  if (lm.allNotes().length > 0) {
    const play = document.getElementById('btn-play')
    const exp  = document.getElementById('btn-export')
    if (play) play.disabled = false
    if (exp)  exp.disabled  = false
  }

  return true
}

function loadAutosave() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (e) {
    console.warn('autosave parse failed', e)
    return null
  }
}

function writeAutosave(app) {
  try {
    const data = serializeProject(app)
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data))
    return true
  } catch (e) {
    console.warn('autosave write failed', e)
    // localStorage might be full — silently drop
    return false
  }
}

function clearAutosave() {
  try { localStorage.removeItem(AUTOSAVE_KEY) } catch (e) {}
}

function downloadProject(app, filename) {
  const data = serializeProject(app)
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  const name = (filename || 'shape-to-melody').replace(/\.s2m\.json$/i, '')
  a.href     = url
  a.download = name + '.s2m.json'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 0)
}

async function readProjectFile(file) {
  if (!file) throw new Error('no file')
  const text = await file.text()
  const data = JSON.parse(text)
  if (!data.version || !data.layers) throw new Error('not a Shape-to-Melody project file')
  return data
}

/* ───── Share via URL fragment ──────────────────────────────────
   We strip the per-layer PNG image (too heavy for a URL) and only
   ship vector data — strokes + notes + meta + settings.
   On hydrate we replay the strokes with each layer's color so the
   recipient sees a recognizable shape (not pixel-perfect brush
   texture but close enough to communicate the visual).            */

const SHARE_KEY      = 's' // hash prefix: #s/<base64url>
const SHARE_MAX_CHARS = 6500 // soft cap so common browsers + share apps accept it

/* Lean serializer for share URLs:
   - Skip per-layer `notes` — they're derivable; recipient will re-run
     convert() after hydrate so the music is identical.
   - Skip canvas draw-state (brush/tool/mode) — recipient picks their own.
   - Skip default-value settings to save more bytes. */
function serializeForShare(app) {
  const cm  = app.canvas
  const lm  = app.layerManager
  const bpm = Number((document.getElementById('bpm') || {}).value) || 120

  const layers = lm.layers
    .filter(L => L.strokes && L.strokes.length > 0)
    .map(L => {
      const obj = {
        n: L.name,
        c: L.color,
        s: L.strokes.map(s => s.map(p => [Math.round(p.x), Math.round(p.y)])),
      }
      if (L.instrument && L.instrument !== 'piano') obj.i = L.instrument
      if (L.volume != null && Math.abs(L.volume - 0.8) > 0.005) obj.v = L.volume
      return obj
    })

  const st = {}
  if (app.convertMode      && app.convertMode      !== 'full')       st.cm = app.convertMode
  if (app.samplingInterval && app.samplingInterval !== 60)           st.si = app.samplingInterval
  if (app.converter.scaleName && app.converter.scaleName !== 'pentatonic') st.sc = app.converter.scaleName
  if (bpm !== 120)                                                   st.bp = bpm
  const theme = localStorage.getItem('theme')
  if (theme && theme !== 'mint')                                     st.th = theme

  const payload = {
    v:  PROJECT_VERSION,
    cv: { w: cm.canvas.width, h: cm.canvas.height },
    ls: layers,
  }
  if (lm.activeIdx > 0)        payload.a  = lm.activeIdx
  if (Object.keys(st).length)  payload.st = st
  return payload
}

/* Expand the short-key share blob back to the long-key project shape
   that hydrateProject already knows how to consume.  We synthesize
   per-layer PNG by drawing the strokes onto an offscreen canvas. */
async function expandShareToProject(s) {
  if (!s || !s.ls) throw new Error('invalid share data')
  const W = s.cv?.w || 800
  const H = s.cv?.h || 450
  const layers = []
  for (const L of s.ls) {
    const strokes = (L.s || []).map(arr => arr.map(p => ({ x: p[0], y: p[1] })))
    // Paint strokes onto offscreen canvas so hydrateProject's image-path works.
    const off = document.createElement('canvas')
    off.width = W; off.height = H
    const ctx = off.getContext('2d')
    ctx.strokeStyle = L.c || '#7c6fe0'
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    ctx.lineWidth   = 4
    for (const stroke of strokes) {
      if (!stroke.length) continue
      ctx.beginPath()
      ctx.moveTo(stroke[0].x, stroke[0].y)
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y)
      ctx.stroke()
    }
    layers.push({
      name:       L.n        || 'L1',
      color:      L.c        || '#7c6fe0',
      instrument: L.i        || 'piano',
      volume:     L.v ?? 0.8,
      strokes,
      notes:      [],   // recipient re-runs convert() to repopulate
      image:      off.toDataURL('image/png'),
    })
  }
  return {
    version: s.v || PROJECT_VERSION,
    canvas:  { width: W, height: H },
    layers,
    activeIdx: s.a || 0,
    settings: {
      convertMode:      s.st?.cm || 'full',
      samplingInterval: s.st?.si || 60,
      scale:            s.st?.sc || 'pentatonic',
      bpm:              s.st?.bp || 120,
      theme:            s.st?.th || null,
    },
  }
}

/* ── Compression + base64url (no external deps) ─────────────── */

async function _gzipString(str) {
  const cs = new CompressionStream('gzip')
  const writer = cs.writable.getWriter()
  writer.write(new TextEncoder().encode(str))
  writer.close()
  const buf = await new Response(cs.readable).arrayBuffer()
  return new Uint8Array(buf)
}

async function _gunzipBytes(bytes) {
  const ds = new DecompressionStream('gzip')
  const writer = ds.writable.getWriter()
  writer.write(bytes)
  writer.close()
  return new Response(ds.readable).text()
}

function _bytesToB64Url(bytes) {
  let bin = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function _b64UrlToBytes(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/* Build a share URL (returns the full URL + char length).  Throws
   if compressed size would exceed SHARE_MAX_CHARS so callers can fall
   back to file download. */
async function buildShareURL(app) {
  const payload = serializeForShare(app)
  const json    = JSON.stringify(payload)
  const gz      = await _gzipString(json)
  const b64     = _bytesToB64Url(gz)
  if (b64.length > SHARE_MAX_CHARS) {
    const err = new Error('share-too-large')
    err.size  = b64.length
    err.max   = SHARE_MAX_CHARS
    throw err
  }
  const url = location.origin + location.pathname + '#' + SHARE_KEY + '/' + b64
  return { url, size: b64.length }
}

/* If the page was opened with a share fragment, decode and return the
   project (in the long-key format).  Returns null if no share fragment. */
async function tryReadShareFromURL() {
  const hash = location.hash || ''
  const prefix = '#' + SHARE_KEY + '/'
  if (!hash.startsWith(prefix)) return null
  try {
    const b64   = hash.slice(prefix.length)
    const bytes = _b64UrlToBytes(b64)
    const json  = await _gunzipBytes(bytes)
    const short = JSON.parse(json)
    return await expandShareToProject(short)
  } catch (e) {
    console.warn('share decode failed', e)
    return null
  }
}
