# Shape to Melody
Draw something, hear melody. 

通过将用户画的形状转换为钢琴键来转换为旋律。
## A) Core Workflow (5/7 — 5/14)

- [x] Main pipeline working: Draw → Convert → Play (from drawing to sound)
- [ ] Drawing tools: brush / eraser / clear / undo (at least undo or clear)
- [x] Canvas modes: Normal / Horizontal Symmetry / Kaleidoscope (four-quadrant mirror) switching
- [x] Conversion: map lines/patterns into a readable piano key / note sequence (define minimum rules)
- [x] Conversion modes:
  - [x] Full conversion (with sampling interval parameter)
  - [ ] Partial conversion (range slider for area selection: vertically draggable)
  - [ ] Random conversion (optional: random seed or randomness intensity)
- [x] Playback controls: play / pause / stop; speed (BPM or speed)
- [x] Basic UI: clear mode entries (Draw / Convert / Play), status indicators, error messages

## B) Save / Share (5/14 — 5/28)

- [ ] Design save data structure (must include: canvas content / conversion parameters / note sequence)
- [ ] Save method (pick one):
  - [ ] Local storage (LocalStorage / IndexedDB)
  - [ ] File export (JSON)
- [ ] Load / restore: reopen saved works and play them back
- [ ] Share method (pick one):
  - [ ] Import / export JSON sharing
  - [ ] Generate copyable share string (compressed data)
- [ ] Save / share UI (buttons, success notifications, error notifications)

## C) Multiple Instrument Sounds (5/14 — 5/28)

- [ ] Choose audio approach: WebAudio synthesis / Tone.js / Sampler
- [ ] At least 3 instrument sounds (e.g., Piano / Synth / Bell)
- [ ] Stable playback and consistent volume across instruments (avoid clipping / overly quiet output)

## D) Visual Polish (5/28 — 6/8)

- [ ] Playback visualization (highlight current key / current segment, beat indicator)
- [ ] Conversion animations or transitions (make "shape → melody" more intuitive)
- [ ] Unified color scheme and typography; improve empty states / onboarding
- [ ] Performance optimization (no lag with long strokes or complex patterns)

## E) Deliverables (6/4 — 6/8)

- [ ] GitHub repo cleanup (README: project intro / usage / features / screenshots or GIFs)
- [ ] Deployment and accessibility (per course requirements: GitHub Pages or other online demo link)
- [ ] Submit to GitHub (deadline June 8): verify complete commit history, working code, accessible links

## 功能

- 绘画
- 将不规则图案或线条转换为可供读取的钢琴键
- 播放

## 绘画模式

- 正常画布
- 左右对称画布
- 万花筒（四象限镜像）

## 转化模式

- 全部转化（可选采样间隔）
- 部分转化（可上下拖动范围条选取区域）
- 随机转化

## 更新日志

### 2026-05-12
- 新增四种笔触：霓虹（发光叠层效果）、喷雾（随机散点）、书法（45°笔尖角度模拟宽细变化）、彩虹（色相自动旋转）
- 笔触与形状工具拆分为两个独立面板
- 颜色选择器扩展为标准 16 色（白/银/灰/黑/红/橙/黄/橄榄/亮绿/深绿/青/深青/蓝/品红/紫/暗红）
- 画布/琴谱视图切换改为画布右侧常驻书签式竖向标签，不再遮挡画布内容
- 默认语言改为英文，支持中英文切换
- 新增 8 套主题配色（薄荷珊瑚/荧光玫红/森林橙绿/桃色渐变/鼠尾草脏粉/大地咖啡/棉花糖/玫红浪漫）
