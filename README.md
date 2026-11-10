# Portfolio

### ▶ [Live site: rohanjaswara88-art.github.io/portfolio](https://rohanjaswara88-art.github.io/portfolio/)

My personal portfolio: a single-page site with animated project cards for my AI voice assistant,
e-commerce website and Keyblaze typing test.

Plain HTML, CSS and JavaScript in one `index.html`, no build step. To run it locally:

```bash
python -m http.server 5174
```

Then open http://localhost:5174.

## AI Auto tour

Click **AI Auto** (top bar, or the button by the mascot on phones) and the mascot flies through every
section, points at each part, explains it in a speech bubble (and out loud with the browser's voice),
and drives the page's effects with her own cursor. Back / Pause / Next / Voice / Stop are in the bar at
the bottom (keys: arrows, Space, Esc). The words live in `STEPS` at the top of `tour.js`.

## Credits

The corner mascot uses "(Neverness to Everness) Daffodill Default"
(https://sketchfab.com/3d-models/neverness-to-everness-daffodill-default-f7d7956ae90a4db6b3d2ed5481844191)
by symbol aughhhh (https://sketchfab.com/yabadiba), licensed under CC-BY-4.0
(http://creativecommons.org/licenses/by/4.0/). Changes: compressed (Draco mesh, 512px WebP textures),
posed and animated in code (`nimbus3d.js`).
