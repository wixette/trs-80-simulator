# Research

What the simulator is built on, with sources. Keys such as `[rs-info]` are in [bibliography.md](bibliography.md).

| File | What it holds |
|---|---|
| [how-it-worked.md](how-it-worked.md) | The units, the memory map, the screen (the 7-bit video RAM and block graphics), the keyboard matrix, the cassette, the CPU's timing |
| [history.md](history.md) | Timeline, people, launch prices, popular claims checked, software, where sources disagree |
| [education.md](education.md) | Its own idea, the real task, the zoom ladder, misconceptions |
| [bibliography.md](bibliography.md) | Every source, by key, with access, licence and state |
| `data/machine_facts.json` | Memory map, port FF, video, keyboard, cassette, dimensions, prices, each with its source |
| `data/photo_catalog.json` | Wikimedia Commons photos of the Model I: URL, author, licence (references; only those in `images/photos/` are in the repository) |
| `data/kicad_*_parts.json` | The footprints of RetroStack's rev G main board and ALPS keyboard, extracted by `tools/kicad_parts.py` (MIT, as their source) |
| `tools/` | The scripts that measured RetroStack's STL and KiCad files |

**No ROMs, models or code from other projects are kept here.** The STL and KiCad files measured were downloaded to a temporary folder and not committed; the figures are in `data/machine_facts.json` and `../model/params/machine.json`. To rebuild the part lists, download `KiCAD/TRS80_Model_I_G_E1.kicad_pcb` (RetroStack/TRS-80-Model-I-G-E1) and `KiCAD/TRS80_Model_I_Keyboard_ALPS_E1.kicad_pcb` (RetroStack/TRS-80-Model-I-Keyboard-ALPS), run `python3 -I tools/kicad_parts.py <board> > data/<name>.json`, then `pnpm params`.
