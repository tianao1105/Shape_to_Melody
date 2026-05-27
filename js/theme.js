const THEMES = {
  // ───────── Light mode ─────────
  mint: {
    mode: 'light', label: '薄荷珊瑚', swatch: '#F08766',
    vars: {
      '--bg':         '#FAF1DD',
      '--surface':    '#E8F7F6',
      '--surface2':   '#C8EDEA',
      '--border':     '#9FDDD7',
      '--accent':     '#F08766',
      '--accent-h':   '#D96A48',
      '--text':       '#2A3530',
      '--text-muted': '#46625E',
      '--danger':     '#D63C2A'
    }
  },
  pop: {
    mode: 'light', label: '荧光玫红', swatch: '#EE34D8',
    vars: {
      '--bg':         '#FCF1A3',
      '--surface':    '#FDEFC0',
      '--surface2':   '#FBEA95',
      '--border':     '#EDCC70',
      '--accent':     '#EE34D8',
      '--accent-h':   '#C820B5',
      '--text':       '#3D1840',
      '--text-muted': '#5A3060',
      '--danger':     '#D01040'
    }
  },
  forest: {
    mode: 'light', label: '森林橙绿', swatch: '#F49A2C',
    vars: {
      '--bg':         '#1A3310',
      '--surface':    '#2A4E1C',
      '--surface2':   '#3A6828',
      '--border':     '#4E8038',
      '--accent':     '#F49A2C',
      '--accent-h':   '#F7D960',
      '--text':       '#EEF8E0',
      '--text-muted': '#B8E090',
      '--danger':     '#F05030'
    }
  },
  peach: {
    mode: 'light', label: '桃色渐变', swatch: '#F58F7D',
    vars: {
      '--bg':         '#FEF0DC',
      '--surface':    '#FDDCC0',
      '--surface2':   '#FBB99F',
      '--border':     '#F5A48A',
      '--accent':     '#F58F7D',
      '--accent-h':   '#D86A55',
      '--text':       '#3C2018',
      '--text-muted': '#6A3828',
      '--danger':     '#D03020'
    }
  },
  sage: {
    mode: 'light', label: '鼠尾草脏粉', swatch: '#D49497',
    vars: {
      '--bg':         '#F5EFE5',
      '--surface':    '#E5EDE6',
      '--surface2':   '#D8E6D8',
      '--border':     '#CADDD0',
      '--accent':     '#D49497',
      '--accent-h':   '#B87A7D',
      '--text':       '#2A2E2C',
      '--text-muted': '#4A5858',
      '--danger':     '#B05050'
    }
  },
  earth: {
    mode: 'light', label: '大地咖啡', swatch: '#D89A5B',
    vars: {
      '--bg':         '#F5EDD5',
      '--surface':    '#E8D9AC',
      '--surface2':   '#D5C895',
      '--border':     '#C0A870',
      '--accent':     '#D89A5B',
      '--accent-h':   '#B87830',
      '--text':       '#2A1A08',
      '--text-muted': '#4F3818',
      '--danger':     '#C83020'
    }
  },
  candy: {
    mode: 'light', label: '棉花糖', swatch: '#F4B6D1',
    vars: {
      '--bg':         '#F7F6CC',
      '--surface':    '#EAF5EC',
      '--surface2':   '#DEF0E2',
      '--border':     '#C0DCC8',
      '--accent':     '#F4B6D1',
      '--accent-h':   '#E090B5',
      '--text':       '#2A2840',
      '--text-muted': '#4A4870',
      '--danger':     '#D04080'
    }
  },
  rose: {
    mode: 'light', label: '玫红浪漫', swatch: '#E83D85',
    vars: {
      '--bg':         '#FEF4F5',
      '--surface':    '#FBDDE4',
      '--surface2':   '#F8C8D2',
      '--border':     '#F4A0B5',
      '--accent':     '#E83D85',
      '--accent-h':   '#C8206A',
      '--text':       '#3A1025',
      '--text-muted': '#682050',
      '--danger':     '#C01840'
    }
  },

  // ───────── Dark mode ─────────
  noir: {
    mode: 'dark', label: '咖啡奶油', swatch: '#E5DCC7',
    vars: {
      '--bg':         '#08060A',
      '--surface':    '#1F1408',
      '--surface2':   '#3D2814',
      '--border':     '#5A4028',
      '--accent':     '#E5DCC7',
      '--accent-h':   '#C2B89E',
      '--text':       '#E5DCC7',
      '--text-muted': '#A89B82',
      '--danger':     '#E06040'
    }
  },
  ocean: {
    mode: 'dark', label: '海洋蓝绿', swatch: '#3FB0A1',
    vars: {
      '--bg':         '#0F1148',
      '--surface':    '#2D3786',
      '--surface2':   '#345D82',
      '--border':     '#4A7BA8',
      '--accent':     '#3FB0A1',
      '--accent-h':   '#2E8C7F',
      '--text':       '#DAEEEB',
      '--text-muted': '#8AB5B0',
      '--danger':     '#FF6060'
    }
  },
  mauve: {
    mode: 'dark', label: '雾灰玫瑰', swatch: '#D6AB9C',
    vars: {
      '--bg':         '#1E2533',
      '--surface':    '#3A2E26',
      '--surface2':   '#7A695E',
      '--border':     '#5E5048',
      '--accent':     '#D6AB9C',
      '--accent-h':   '#B98876',
      '--text':       '#EAD8CE',
      '--text-muted': '#B89A8E',
      '--danger':     '#E06080'
    }
  },
  electric: {
    mode: 'dark', label: '电光蓝', swatch: '#2A2BEC',
    vars: {
      '--bg':         '#08081C',
      '--surface':    '#0A1058',
      '--surface2':   '#1B25A8',
      '--border':     '#353EC0',
      '--accent':     '#2A2BEC',
      '--accent-h':   '#1819C0',
      '--text':       '#E5E5FF',
      '--text-muted': '#9090C8',
      '--danger':     '#FF4040'
    }
  },
  jade: {
    mode: 'dark', label: '森林薄荷', swatch: '#BFEAD8',
    vars: {
      '--bg':         '#0C1814',
      '--surface':    '#1F4438',
      '--surface2':   '#43887A',
      '--border':     '#5A9C8E',
      '--accent':     '#BFEAD8',
      '--accent-h':   '#95D8B8',
      '--text':       '#BFEAD8',
      '--text-muted': '#7AA89A',
      '--danger':     '#E05050'
    }
  },
  moss: {
    mode: 'dark', label: '苔绿米色', swatch: '#86AD61',
    vars: {
      '--bg':         '#1B211A',
      '--surface':    '#577939',
      '--surface2':   '#86AD61',
      '--border':     '#6B935A',
      '--accent':     '#E9D9A8',
      '--accent-h':   '#C9B988',
      '--text':       '#E9D9A8',
      '--text-muted': '#A5B895',
      '--danger':     '#D04540'
    }
  },
  harbor: {
    mode: 'dark', label: '钢蓝雾色', swatch: '#3D6580',
    vars: {
      '--bg':         '#1F3A4F',
      '--surface':    '#234A65',
      '--surface2':   '#3D6580',
      '--border':     '#4F7C95',
      '--accent':     '#C9BCAE',
      '--accent-h':   '#A89C8E',
      '--text':       '#DDE6EC',
      '--text-muted': '#95A8B5',
      '--danger':     '#D04540'
    }
  },
  crimson: {
    mode: 'dark', label: '深红海军', swatch: '#ED1F1F',
    vars: {
      '--bg':         '#241110',
      '--surface':    '#5C2025',
      '--surface2':   '#872E32',
      '--border':     '#4A1820',
      '--accent':     '#ED1F1F',
      '--accent-h':   '#C01818',
      '--text':       '#F0DCDC',
      '--text-muted': '#C08A8A',
      '--danger':     '#ED1F1F'
    }
  }
}

function _keysOfMode(mode) {
  return Object.keys(THEMES).filter(k => THEMES[k].mode === mode)
}

let _currentMode  = 'light'
let _currentTheme = 'mint'

function applyTheme(name) {
  const theme = THEMES[name]
  if (!theme) return
  const root = document.documentElement
  for (const [k, v] of Object.entries(theme.vars)) root.style.setProperty(k, v)
  _currentTheme = name
  _currentMode  = theme.mode
  localStorage.setItem('theme',              name)
  localStorage.setItem('theme-mode',         theme.mode)
  localStorage.setItem('theme-last-' + theme.mode, name)
  document.documentElement.dataset.themeMode = theme.mode
  document.querySelectorAll('.theme-dot').forEach(d =>
    d.classList.toggle('active', d.dataset.theme === name)
  )
  document.querySelectorAll('.mode-toggle-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === theme.mode)
  )
  // Notify canvas-rendered views (pianoroll / workspace) so they can
  // redraw with the new palette — CSS variables don't auto-update
  // pixels already painted to a <canvas>.
  window.dispatchEvent(new CustomEvent('themechange', {
    detail: { theme: name, mode: theme.mode }
  }))
}

function renderThemePicker() {
  const picker = document.getElementById('theme-picker')
  if (!picker) return
  // Remove any existing dots; keep non-dot children (e.g. inserted toggle buttons)
  picker.querySelectorAll('.theme-dot').forEach(n => n.remove())
  for (const name of _keysOfMode(_currentMode)) {
    const t = THEMES[name]
    const dot = document.createElement('button')
    dot.type             = 'button'
    dot.className        = 'theme-dot' + (name === _currentTheme ? ' active' : '')
    dot.dataset.theme    = name
    dot.style.background = t.swatch
    dot.title            = t.label
    dot.addEventListener('click', () => applyTheme(name))
    picker.appendChild(dot)
  }
}

function setThemeMode(mode) {
  if (mode !== 'light' && mode !== 'dark') return
  _currentMode = mode
  localStorage.setItem('theme-mode', mode)
  const keys = _keysOfMode(mode)
  // Prefer the user's last-used theme in this mode; otherwise a random one.
  let chosen = localStorage.getItem('theme-last-' + mode)
  if (!chosen || !THEMES[chosen] || THEMES[chosen].mode !== mode) {
    chosen = keys[Math.floor(Math.random() * keys.length)]
  }
  renderThemePicker()
  applyTheme(chosen)
}

function _initialMode() {
  const stored = localStorage.getItem('theme-mode')
  if (stored === 'light' || stored === 'dark') return stored
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  return 'light'
}

document.addEventListener('DOMContentLoaded', () => {
  _currentMode = _initialMode()
  // Pick a fresh random theme inside the current mode on every page load.
  const keys   = _keysOfMode(_currentMode)
  const random = keys[Math.floor(Math.random() * keys.length)]
  renderThemePicker()
  applyTheme(random)

  document.querySelectorAll('.mode-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => setThemeMode(btn.dataset.mode))
  })
})
