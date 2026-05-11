const TRANSLATIONS = {
  zh: {
    subtitle:           '画出形状，听见旋律',
    'brush-tools':      '笔触',
    'shape-tools':      '形状',
    'tool-freehand':    '画笔',
    'tool-line':        '直线',
    'tool-rect':        '矩形',
    'tool-circle':      '圆形',
    'tool-heart':       '心形',
    'tool-triangle':    '三角',
    'tool-star':        '星形',
    'tool-neon':        '霓虹',
    'tool-spray':       '喷雾',
    'tool-calligraphy': '书法',
    'tool-rainbow':     '彩虹',
    'canvas-mode':      '画布模式',
    'mode-normal':      '普通',
    'mode-symmetric':   '左右对称',
    'mode-kaleidoscope':'万花筒',
    'brush-size':       '笔刷大小',
    color:              '颜色',
    'btn-clear':        '清除画布',
    'view-drawing':     '🎨 原画',
    'view-pianoroll':   '🎹 钢琴卷帘',
    'tab-drawing':      '画布',
    'tab-pianoroll':    '琴谱',
    'band-label':       '↕ 拖动调整范围',
    'convert-mode':     '转换方式',
    'mode-full':        '全部转换',
    'mode-partial':     '部分转换',
    'mode-random':      '随机转换',
    'sampling-interval':'采样间隔',
    instrument:         '乐器',
    'inst-piano':       '钢琴',
    'inst-epiano':      '电钢琴',
    'inst-organ':       '风琴',
    'inst-strings':     '弦乐',
    'inst-pluck':       '拨弦',
    'inst-bell':        '钟声',
    'inst-marimba':     '马林巴',
    'inst-xylophone':   '木琴',
    scale:              '音阶',
    'scale-pentatonic': '五声音阶',
    'scale-major':      '大调',
    'scale-minor':      '小调',
    'scale-chromatic':  '半音阶',
    tempo:              '速度',
    'btn-convert':      '⟳ 转换',
    'btn-play':         '▶ 播放',
    'btn-stop':         '■ 停止',
    'status-empty':     '画布是空的，请先绘画',
    'status-converted': '已转换 {n} 个音符，点击播放',
    'status-playing':   '播放中… {n} 个音符',
  },
  en: {
    subtitle:           'Draw shapes, hear melodies',
    'brush-tools':      'Brushes',
    'shape-tools':      'Shapes',
    'tool-freehand':    'Pen',
    'tool-line':        'Line',
    'tool-rect':        'Rect',
    'tool-circle':      'Circle',
    'tool-heart':       'Heart',
    'tool-triangle':    'Triangle',
    'tool-star':        'Star',
    'tool-neon':        'Neon',
    'tool-spray':       'Spray',
    'tool-calligraphy': 'Calligraphy',
    'tool-rainbow':     'Rainbow',
    'canvas-mode':      'Canvas Mode',
    'mode-normal':      'Normal',
    'mode-symmetric':   'Symmetric',
    'mode-kaleidoscope':'Kaleidoscope',
    'brush-size':       'Brush Size',
    color:              'Color',
    'btn-clear':        'Clear',
    'view-drawing':     '🎨 Drawing',
    'view-pianoroll':   '🎹 Piano Roll',
    'tab-drawing':      'Draw',
    'tab-pianoroll':    'Score',
    'band-label':       '↕ Drag to adjust',
    'convert-mode':     'Convert Mode',
    'mode-full':        'Full',
    'mode-partial':     'Partial',
    'mode-random':      'Random',
    'sampling-interval':'Sample Interval',
    instrument:         'Instrument',
    'inst-piano':       'Piano',
    'inst-epiano':      'E. Piano',
    'inst-organ':       'Organ',
    'inst-strings':     'Strings',
    'inst-pluck':       'Pluck',
    'inst-bell':        'Bell',
    'inst-marimba':     'Marimba',
    'inst-xylophone':   'Xylophone',
    scale:              'Scale',
    'scale-pentatonic': 'Pentatonic',
    'scale-major':      'Major',
    'scale-minor':      'Minor',
    'scale-chromatic':  'Chromatic',
    tempo:              'Tempo',
    'btn-convert':      '⟳ Convert',
    'btn-play':         '▶ Play',
    'btn-stop':         '■ Stop',
    'status-empty':     'Canvas is empty, draw something first',
    'status-converted': 'Converted {n} notes, click play',
    'status-playing':   'Playing… {n} notes',
  }
}

let _lang = 'en'

function t(key, vars = {}) {
  let str = (TRANSLATIONS[_lang] || TRANSLATIONS.zh)[key] || key
  for (const [k, v] of Object.entries(vars)) str = str.replace(`{${k}}`, v)
  return str
}

function setLang(lang) {
  _lang = lang
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n)
  })
  const btn = document.getElementById('lang-toggle')
  if (btn) btn.textContent = lang === 'zh' ? 'EN' : '中文'
}

function toggleLang() {
  setLang(_lang === 'zh' ? 'en' : 'zh')
}
