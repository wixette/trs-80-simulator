# Licensing and attribution

## Our own work

| What | Licence |
|---|---|
| Code: JavaScript, the Blender scripts, configuration, our programs and their tapes (`tapes/`) | **Apache-2.0** |
| Content: docs, design and research notes, lessons and teacher notes, `model/params/`, `research/data/`, the 3D model, the README's pictures | **CC BY-SA 4.0** |

The repository follows the [REUSE](https://reuse.software) specification. `REUSE.toml` sets these defaults and lists every third-party exception, and the licence texts are in `LICENSES/`. CI runs `reuse lint`.

## Third-party material

- **Vendored libraries** in `vendor/`, each with its own licence file:
  - three.js (MIT), copied unchanged from npm;
  - the Roboto Flex font (SIL Open Font License 1.1), copied unchanged from npm;
  - the Material Symbols icons (Apache-2.0), gathered into one module as they are;
  - the Z80 core, Molly Howell's `Z80.js` (MIT), unchanged but for one appended `export` line (design/decisions.md, D3);
  - xtrs's Model I character set (a Clarendon Hill Software notice and Tim Mann's MIT-style terms, `LicenseRef-xtrs`), from which `js/sim/charset-data.js` is generated with the licence at its head (D4).
- **Level II BASIC** in `roms/` is not under any licence of ours: its copyright is Microsoft's and Tandy's (`LicenseRef-HistoricalROM`). `roms/NOTICE` says where it came from and offers to remove it on request (D2).
- **RetroStack's reconstructions** of the Model I (KiCad boards and the case, MIT) were measured. The part lists extracted from the boards (`research/data/kicad_*_parts.json`) and the params generated from them (`model/params/board.json`, `keyboard.json`) keep RetroStack's copyright and MIT licence. No RetroStack file itself is in the repository (D8).
- **The logos** on the name plates (`model/assets/logos/`) are public domain text logos from Wikimedia Commons. Trademarks may still apply. They are used only to show the machine as it was sold.
- **Michroma** (`model/assets/fonts/`), the plates' lettering font, is under the SIL Open Font License 1.1.
- **Photographs** in `images/photos/` are from Wikimedia Commons, each under its own licence, credited in [../images/photos/CREDITS.md](../images/photos/CREDITS.md) and in About. Other photographs were used as references for sizes and colours only, and are not in the repository. Each is listed with its source in `research/data/photo_catalog.json` where it is public.
- **ZEXDOC**, Frank Cringle's Z80 exerciser (GPL-2.0), is not in the repository. The opt-in test fetches it at a pinned commit and checks its hash (D3).

Each third-party path gets its own annotation in `REUSE.toml`, and its licence text goes in `LICENSES/`.

"TRS-80" names the machine simulated. This project is not affiliated with Tandy Corporation or RadioShack.
