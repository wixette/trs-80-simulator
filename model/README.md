# The 3D model

The whole system on a desk: the keyboard unit opened to board level, the Video Display, the Realistic CTR-80 cassette recorder, the power supply and the cables. It is **built by script from parameters** (design/decisions.md, D8), and the page loads the result, `trs80-model-i.glb`.

```
pnpm build:model     # Blender (4.2 or later), headless: params/ -> trs80-model-i.glb
pnpm params          # research/data/kicad_*_parts.json -> params/keyboard.json, params/board.json
```

Check renders: `Blender --background --factory-startup --python blender/scripts/render_previews.py -- [keyboard|display|recorder|desk] [all|<view>]` writes PNGs to `blender/out/previews/`, which git ignores.

## What is in it

| Folder | Holds |
|---|---|
| `params/machine.json` | Every dimension and angle: `{v, unit, conf, src}`, with its source and confidence (`doc`, `model`, `photo`, `est`, `design`) |
| `params/keyboard.json`, `params/board.json` | Generated: the 65 keys with their matrix rows and bits, and the main board's 230 parts, from RetroStack's KiCad boards (MIT) |
| `blender/scripts/` | `build_desk.py` (the whole desk, exported), `build_keyboard_unit.py`, `build_video_display.py`, `build_peripherals.py` (the recorder and the power supply), `render_previews.py`; `lib/` the shared helpers |
| `assets/logos/`, `assets/fonts/` | The name plates' logos (public domain) and their lettering font, Michroma (OFL 1.1): [assets/logos/ATTRIBUTION.md](assets/logos/ATTRIBUTION.md) |
| `trs80-model-i.glb` | The built model, about 2.8 MB and 73 k triangles, in plain git (D9) |

## The node contract

The page finds parts by name, `<unit>.<part>[.<index>]`. `tests/model.test.js` holds the model to the names the page uses, and to the machine's own key matrix and memory map.

| Nodes | What | Motion (glTF extras) |
|---|---|---|
| `unit.keyboard`, `unit.display`, `unit.recorder`, `unit.psu` | The four units on the desk | |
| `case.top`, `keyboard`, `board.main`, `cable.*` | What comes out when the machine is taken apart, in the order of `params/machine.json` `take_apart` | `path`: offsets in mm; the main board also `flip`s |
| `key.*`, `key.pad.*` | The 65 keycaps, each with its `matrix_row`, `matrix_bit` and `address` | `translate`, by `travel` mm |
| `part.<ref>` | Named parts on the main board: the Z80 (`z40`), ROM A and B (`z33`, `z34`), the video RAM (`z45`-`z48`, `z61`-`z63`), the user RAM (`z13`-`z20`), the character generator (`z29`), the crystal, the switches, the sockets | |
| `button.power`, `button.reset` | The computer's POWER switch and RESET button, on its rear | `translate` |
| `display.screen` | The tube's face, UV-mapped 0..1, with the picture's rectangle | `screen` |
| `display.power_button`, `display.control.*` | The Video Display's POWER button, C and B | `translate` |
| `recorder.key.*`, `recorder.door`, `recorder.cassette`, `recorder.reel.*` | The CTR-80's six keys, its door, a cassette and its reels | `translate`, `rotate` |
| `recorder.counter` | The tape counter's window; the page writes its three digits on it | |
| `recorder.lamp` | The RECORD/BATTERY lamp | `light` |

Each node also carries `label_en`, a short English description used while building. The page's labels are messages (`js/l10n/en.js`).

## Sources

The dimensions come from RetroStack's reconstructions of the Model I (the rev G main board and the ALPS keyboard in KiCad, and the case as STL; MIT), measured by the scripts in `research/tools/`; from museum records; and from photographs, scaled where no document gives a size. The photos used as references are listed in `research/data/photo_catalog.json` where they are public. Others were web images of unknown licence, used for measurement only; they are named in the params by their file names (`ctr80a_05`) and are not in the repository. Sources by key: [../research/bibliography.md](../research/bibliography.md).
