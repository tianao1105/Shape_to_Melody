const THEMES = {
  mint: {
    label: '薄荷珊瑚', swatch: '#F08766',
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
    label: '荧光玫红', swatch: '#EE34D8',
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
    label: '森林橙绿', swatch: '#F49A2C',
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
    label: '桃色渐变', swatch: '#F58F7D',
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
    label: '鼠尾草脏粉', swatch: '#D49497',
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
    label: '大地咖啡', swatch: '#D89A5B',
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
    label: '棉花糖', swatch: '#F4B6D1',
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
    label: '玫红浪漫', swatch: '#E83D85',
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
  }
}

const _themeKeys = Object.keys(THEMES)

function applyTheme(name) {
  const theme = THEMES[name] || THEMES[_themeKeys[0]]
  const root  = document.documentElement
  for (const [k, v] of Object.entries(theme.vars)) root.style.setProperty(k, v)
  document.querySelectorAll('.theme-dot').forEach(d =>
    d.classList.toggle('active', d.dataset.theme === name)
  )
  localStorage.setItem('theme', name)
}

document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('theme') || _themeKeys[0]
  applyTheme(saved)
  document.querySelectorAll('.theme-dot').forEach(dot =>
    dot.addEventListener('click', () => applyTheme(dot.dataset.theme))
  )
})
