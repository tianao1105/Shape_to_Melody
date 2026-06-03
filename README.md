# Shape to Melody

A small web app that turns drawings into piano music.

You draw on a canvas. The app looks at where your lines go and plays notes for them. Higher on the page means higher pitch. A long curve plays many notes. A small dot plays one note.

That's basically the whole thing. I made it to find out if a drawing could "sound like" anything, and it kind of can.

Live demo: https://tianao1105.github.io/Shape_to_Melody/

> 中文版 README 见 [`README.zh.md`](README.zh.md).

## Drawing

Five brush types: pen, neon, spray, calligraphy, and rainbow. Five shape tools: line, rectangle, circle, heart, triangle, star. Sixteen colors in the color row. Brush size goes from 2 to 24.

Three canvas modes:
- Normal
- Left-right mirror
- Kaleidoscope (mirror both ways)

You can also drop in a PNG or JPG. The app finds the dark parts of the image and uses those as your lines. It does not look great with photos. It looks fine with simple line art.

## Making music from a drawing

Hit Convert on the right side. The app reads your strokes and gives you notes.

Three convert modes:
- Full: every stroke turns into notes
- Partial: drag a band on the canvas to pick a vertical area, only that area gets used
- Random: pick a fixed number of notes at random from your strokes

You can change the scale (pentatonic, major, minor, chromatic), the BPM (40 to 240), and the sample interval (how often along each stroke a note is taken).

Hit Play to hear it. Hit Stop to stop. The little circle in the right side of the screen lights up to show which key is playing.

## Editing notes by hand

Once you have notes, click Score on the right side of the canvas. The notes show up as colored blocks on a piano roll. Drag a block up or down to change its pitch. Drag it sideways to move it in time. Press Delete to remove one.

If you click Convert again after editing, the app pops up a warning first so you don't lose your edits by accident.

## Layers

Click the `+` above the canvas to add a layer. Each layer has its own drawing, color, instrument, and volume. Eight instruments to pick from: piano, electric piano, organ, strings, pluck, bell, marimba, xylophone.

You can have a bass line on one layer and a melody on another. Play mixes them together.

## Saving and sharing

- Save: gives you a `.s2m.json` file with the full project in it.
- Open: reads a `.s2m.json` file back in.
- Share: makes a link that has your whole drawing packed into the URL. Send the link to a friend and they will see what you made. No server is involved. Short drawings fit fine. If you draw too much the link gets too long and the app tells you to save a file instead.

The app also auto-saves to your browser. Next time you open the page a small bar at the top asks if you want to pick up where you left off.

## Themes

16 color themes. 8 are light. 8 are dark. Click the sun or moon icon in the header to switch between light and dark. Then click a colored dot to pick a theme. The piano keys, the note blocks, and the upload area all change with the theme.

## Languages

Chinese and English. The button in the top right (`EN` or `中文`) switches.

## Running it

It is just static files. Clone the repo and serve the folder.

```bash
git clone https://github.com/tianao1105/Shape_to_Melody.git
cd Shape_to_Melody
python3 -m http.server 8000
```

Then open `http://localhost:8000` in any modern browser.

You can also open `index.html` straight from the file system, but some browsers block audio for local files, so a tiny server is safer.

No npm install. No build step.

## What it is built with

- Vanilla JavaScript and the Canvas API for drawing
- [Tone.js](https://tonejs.github.io/) for sound
- [lamejs](https://github.com/zhuker/lamejs) for MP3 export
- The browser's built-in `CompressionStream` for the share-link gzip
- CSS container queries (`cqw`) so the layout shrinks with the canvas, not with the viewport

No framework. No bundler. No backend.

## Export formats

- MIDI for opening in a DAW
- WAV for lossless audio
- MP3 for sharing a small file

All three are rendered in the browser. Nothing leaves your machine.

## Tutorial

The first time you open the page, a short tutorial plays by itself. It draws a wave, converts it, and plays it back. If you want to see it again, click the `?` in the header.

## Keyboard

- `Ctrl/Cmd + Z`: undo
- `Ctrl/Cmd + Shift + Z` or `Ctrl + Y`: redo
- `Delete` or `Backspace`: in the Score view, removes the selected note

## File layout

- `index.html`
- `css/style.css`
- `js/` has the source files, one per concern:
  - `canvas.js` is the drawing engine
  - `converter.js` turns strokes into notes
  - `player.js` plays notes through Tone.js
  - `pianoroll.js` and `workspace.js` draw the Score view
  - `layers.js` is the layer manager
  - `imageImport.js` traces image lines
  - `save.js` handles save, load, autosave, and the share link
  - `theme.js` has the 16 themes
  - `i18n.js` has the Chinese and English strings
  - `tutorial.js` runs the first-time walkthrough
  - `intro.js` plays the opening animation
  - `app.js` ties everything together

## Development decisions

A few choices I had to pick early that shaped the whole thing.

**Vanilla JS, no framework.** I wanted to avoid the build step entirely. No `node_modules`, no webpack, no waiting. Just open the page. The trade-off is more boilerplate, but it is a small project and the boilerplate is fine.

**Map Y to pitch, X to time.** Higher on the page is a higher note. This felt the most natural. The other option was X for pitch and time per stroke, but that fell apart when people drew shapes that were not left-to-right.

**Sample by arc length.** A note every N pixels of line length, not every N raw points. This way a curve and a straight line of the same shape sound the same. Raw points would have meant fast scribbles play different from slow ones, which I did not want.

**Client-side everything.** No backend. Save is a file. Share is a URL. No accounts, no sign-up, no database. This made hosting trivial (GitHub Pages) and keeps user data on user machines.

**Per-stroke color stays out of the share link.** Including it would have nearly doubled the size for almost no gain. Recipients see strokes in the layer color instead. Good enough for "look what I drew".

**CSS container queries instead of viewport units.** Took me a while to find this one. Using `vw` for the layer tab sizes meant they only shrank when the whole window got smaller. But on a wide window with wide sidebars, the canvas could still be small and the tabs stayed huge. Container queries (`cqw`) read the canvas's actual width, which is what I wanted.

**Save the autosave as PNG plus strokes, but share as strokes only.** Autosave can be big because it goes to local storage and a few MB is fine. Share has to fit in a URL, so it can only carry vectors. The recipient runs Convert on their end to regenerate the notes from the strokes, which gives the same melody back.

## Dead ends

Things I tried that did not work out.

**Preview-modal before image convert.** When you upload an image, I first added a popup that showed the image and asked you to click "convert" before anything happened. The idea was to give the user control. In practice it added a confusing extra step. People wanted the image to just turn into lines so they could play with them. Removed it after the first round of feedback.

**Distance-chain note thinning.** First try at making the sample interval slider matter for image-traced strokes. The slider only affected per-stroke spacing, so a dense image (hundreds of tiny strokes) barely responded. I tried walking the notes in order and dropping any that were too close to the last kept note. It barely changed anything because image strokes are scattered all over the canvas. Switched to a grid-bucket approach (snap each note to a cell and keep one per cell), which actually worked.

**Vw-based responsive sizing.** First version of the layer tab `clamp()` used viewport width. Looked fine on phones, but on desktop browsers the tabs stayed full size even when the canvas was squeezed. The problem was that sidebar width ate into the viewport unevenly. Container queries fixed it.

**"Always-on" canvas hint.** Early on, the "draw something here" hint would flicker back when you cleared one of several layers, even when other layers still had art. The Clear button was removing the `has-drawn` class no matter what. Took me a while to realize this should look at all layers, not just the active one.

**Trying to commit code from inside the dev sandbox.** I ran `git status` inside a tool sandbox once. The sandbox could not delete its own lock file. After that, GitHub Desktop refused to commit because `.git/index.lock` was still sitting there. I had to delete it by hand.

**Storing the project in OneDrive's Documents folder.** Files kept getting cut off in the middle of writes. Took me several days to figure out it was OneDrive sync stepping on partial writes. Even moving the project from `OneDrive/文档/GitHub` to `Documents/GitHub` did not fix it, because Windows redirects Documents to OneDrive by default. The actual fix was turning off OneDrive's backup of the Documents folder.

## Breakthroughs

**The tutorial bug was not about Chinese.** I thought the first-step highlight only broke in Chinese mode. It turned out to break whenever the user was on the Score view when they clicked the help button to replay the tutorial. The main canvas was `display: none`, so its bounding box was zero, so the highlight pinned to the top-left corner. The fix was a one-liner: switch to drawing view at the start of the tutorial.

**Grid bucketing for image note thinning.** After the distance-chain method failed, I tried bucketing notes into a grid of cells the size of the sample interval, then keeping one note per cell. This finally made the sampling-interval slider feel responsive for images. From around 1100 notes down to 50 at the same interval setting.

**Container queries.** Once I knew the problem (viewport units do not track canvas size), the fix was direct. Add `container-type: inline-size` to the canvas column, change `vw` to `cqw`, done. The layer tabs now shrink with the actual canvas, not the window.

**Frosted-glass tint by theme.** The dropzone used a hard-coded white wash with a 2px blur. It looked broken on dark themes. Switching to `color-mix(in srgb, var(--surface) X%, transparent)` plus a stronger blur made it pick up each theme's surface color, so every theme looks intentional now.

**The `themechange` event.** Switching themes used to look right for new draws but the existing piano keys and notes stayed the old color, because they were drawn into canvas pixels and a CSS variable change cannot redraw pixels. Firing a custom `themechange` event from `applyTheme()` and letting the canvas views listen for it solved this cleanly.

## How I worked with AI (prompting)

I built this with Claude (Anthropic's chat agent) as a coding partner. Not a "ChatGPT wrote this for me" build, more like a back-and-forth where I drove and it typed.

The pattern I settled into:

1. Ask for one small thing at a time. "Add a delete button to each layer tab" not "build a layer system".
2. Run the change. Look at it. If it was wrong, say what was wrong in plain words ("the band is too small", "this still does not shrink on desktop") and let it try again.
3. When the model proposed something that sounded fancy, I asked for the simpler version. The simpler version was almost always correct.
4. I always read the diff before accepting it. Twice I caught the model adding logic that did not fit the rest of the file.
5. I kept a running task list outside the conversation so I could come back the next day.

Things the AI was good at:

- Boilerplate. Quickly writing new CSS rules, new HTML structure, new functions that look like their neighbors.
- Spotting bugs once I described the symptom. "Color changes do not redraw the canvas" got the right answer in one round.
- Refactoring (moving code around when the structure was wrong).

Things the AI was bad at:

- Knowing when to ask. It would often charge ahead with a plan instead of asking which of two reasonable options I wanted.
- File system surprises. The OneDrive truncation issue was beyond what the AI could see. It kept retrying writes that the disk silently corrupted.
- Visual judgement. "Does this look good?" needed me to actually look.

If I were starting over, I would use the AI for the same things and not ask it about UX taste.

Sample prompts that worked well:

- "The Convert button should ask first if I edited notes by hand. Add a small dialog. Cancel does nothing, Confirm runs Convert as before."
- "The book-mark tabs at the canvas edges look misaligned. They are centered to the whole canvas area, not to the canvas itself. Move them so they follow the canvas."
- "Sampling interval is not changing the note count for image-imported drawings. Figure out why and fix it."

Sample prompts that worked poorly (and why):

- "Make it pretty." Too vague. Better: "Reduce the bookmark tab shadow to barely visible."
- "Refactor the canvas code." No goal. Better: "Pull the brush style code out of `_strokeSegment` into its own helper so I can call it from the share-restore code."

## References

Things I looked at while building this.

- [Tone.js docs](https://tonejs.github.io/) for the audio engine. The Sampler and Transport classes do most of the heavy lifting.
- [lamejs](https://github.com/zhuker/lamejs) for in-browser MP3 export.
- [MDN: Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) for drawing primitives. The `getImageData` and `putImageData` calls are what make undo and redo possible.
- [MDN: CSS Container Queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_container_queries) the fix for the layout scaling problem.
- [MDN: CompressionStream](https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream) for the share-link gzip.
- [MDN: color-mix()](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix) for the theme-aware frosted glass.

The starting idea (drawing into music) is not new. There are a handful of similar apps from around 2015 onward. I wanted to see how far I could push the polish and the export pipeline on a single-page version.

## Reflection

A few things I learned that I did not expect.

The hardest part was not the audio or the canvas. It was making the small details feel right. Shadow size on the bookmark tabs. When the hint text disappears. Which color the note blocks should be. Each of these took a separate round of "this is not quite right". The total time spent on polish is probably 60% of the project.

Mobile testing should have happened earlier. I built the whole desktop layout first and then discovered that the header was about 500px wide and Android Chrome would not wrap it. iOS Safari handled it gracefully, which made me think it was fine. By the time I caught it, I had to retrofit `flex-wrap: wrap` into a layout that was not built for it. Next project, mobile from day one.

I wish I had picked a binary share format from the start. The JSON share link works for small drawings, but anything past a 50-stroke image hits the URL limit. Going binary would have given the share link more headroom. The trade-off was complexity, and I wanted to ship.

The sample-interval slider was a small UX trap. It works for hand-drawn shapes (interval equals arc length between notes), but image-imported strokes are short and dense, so the same slider does not behave the same way. I patched it with grid-bucket thinning. If I had thought about it earlier I might have made image-import generate fewer and longer strokes instead.

I would do save and restore much earlier next time. I added autosave around week 3. By then, dozens of test sessions had been lost. With autosave from day one I would have more data on which features people actually use, and how often.

Working with AI as a coding partner shifted how I think about scope. When boilerplate is cheap, it is tempting to keep adding features. I had to actively pull back a few times and ask "do I actually want this, or do I want it because it would be easy". Cheap labor is a double-edged sword.

What I am happy with: the themes work better than I expected. The piano keys actually adapting to the theme palette gives the app a consistent feel that a single color scheme would not have. The intro animation is silly but I have not gotten tired of it.

## License

MIT. Use it however you like.
