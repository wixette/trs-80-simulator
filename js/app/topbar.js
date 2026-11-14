// SPDX-License-Identifier: Apache-2.0
//
// The top bar (docs/ui-design.md, U8): what you do to the machine on the left (Tapes,
// Programs), what you do with the app on the right (Sound, About). Programs is the one
// catalogue of our samples: each opens a dialog that offers both ways in, typed on the keys
// or loaded from its tape; Tapes is for tapes themselves. Each is a menu or a dialog (P4,
// P10). Visitors bring their own tapes, read locally and never uploaded (D7); our samples are
// recorded at run time by a second Model I, so nothing but the ROM's own output is on them.

import { t } from "../l10n/l10n.js";
import { casFromTape, Tape, tapeFromCas } from "../sim/cassette.js";
import { recordSampleTape } from "../sim/sample-tapes.js";
import { typeKeys } from "../lessons/lessons.js";
import { SAMPLES } from "../sim/samples.js";
import { screenProgramCas } from "../sim/system-samples.js";
import { parseWav, pulsesFromSound, wavFromPulses } from "../sim/wav.js";
import { el, icon, setTip, showDialog, showMenu } from "../ui/components.js";

/** @typedef {import("../sim/system.js").System} System */

/** A file name made from a tape's name. @param {string} name @param {string} ext */
const fileName = (name, ext) => `${name.replace(/\.(cas|wav)$/i, "").replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "tape"}.${ext}`;

/** Hands the visitor a file. @param {Uint8Array} bytes @param {string} name @param {string} type */
function download(bytes, name, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([/** @type {BlobPart} */ (bytes)], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Where Sound on or off is remembered. */
const SOUND_STORE = "trs80.sound";

export class TopBar {
  /**
   * @param {System} system
   * @param {{ rom: () => Uint8Array | null, about: () => Node[], references: () => void, sound: { muted: boolean, setMuted: (m: boolean) => void } }} o
   */
  constructor(system, o) {
    this.system = system;
    this.o = o;
    const tapes = /** @type {HTMLButtonElement} */ (document.getElementById("tapes"));
    const programs = /** @type {HTMLButtonElement} */ (document.getElementById("programs"));
    const about = /** @type {HTMLButtonElement} */ (document.getElementById("about"));
    this.file = /** @type {HTMLInputElement} */ (el("input", { type: "file", accept: ".cas,.wav,audio/wav,audio/x-wav", hidden: true }));
    document.body.append(this.file);
    this.file.addEventListener("change", () => this.openFile());
    tapes.addEventListener("click", () => showMenu(tapes, this.tapeItems()));
    programs.addEventListener("click", () => showMenu(programs, this.programItems()));
    // About, as the Altair 8800 simulator's: References opens the tab, Close is the one action
    about.addEventListener("click", () =>
      showDialog(t("about.title"), this.o.about(), [
        { label: t("about.references"), run: () => this.o.references() },
        { label: t("about.close"), primary: true },
      ]),
    );
    setTip(tapes, t("bar.tapes.tip"));
    setTip(programs, t("bar.programs.tip"));
    setTip(about, t("bar.about"));
    // Sound, for the whole page (the tape's sound is all there is yet): on or off, remembered
    const sound = /** @type {HTMLButtonElement} */ (document.getElementById("sound"));
    const showSound = () => {
      const on = !this.o.sound.muted;
      sound.replaceChildren(icon(on ? "volume_up" : "volume_off"));
      sound.setAttribute("aria-pressed", String(on));
      setTip(sound, t(on ? "bar.sound.on" : "bar.sound.off"));
    };
    try {
      if (localStorage.getItem(SOUND_STORE) === "off") this.o.sound.setMuted(true);
    } catch {
      // private browsing: sound starts on
    }
    sound.addEventListener("click", () => {
      const on = this.o.sound.muted;
      this.o.sound.setMuted(!on);
      try {
        localStorage.setItem(SOUND_STORE, on ? "on" : "off");
      } catch {
        // not remembered
      }
      system.say({ key: on ? "sound.on" : "sound.off" });
      showSound();
    });
    showSound();
  }

  /** @private @returns {import("../ui/components.js").MenuItem[]} */
  tapeItems() {
    const s = this.system;
    const has = !!s.deck.tape;
    const recorded = has && /** @type {Tape} */ (s.deck.tape).pulses.length > 0;
    return [
      { label: t("bar.tape.blank"), icon: "voicemail", run: () => s.insertTape(new Tape(t("tape.blankName"))) },
      { label: t("bar.tape.open"), icon: "upload_file", run: () => this.file.click() },
      { label: t("bar.tape.saveCas"), icon: "download", divider: true, disabled: recorded ? undefined : t("bar.tape.nothing"), run: () => this.save("cas") },
      { label: t("bar.tape.saveWav"), icon: "download", disabled: recorded ? undefined : t("bar.tape.nothing"), run: () => this.save("wav") },
      { label: t("bar.tape.eject"), icon: "eject", disabled: has ? undefined : t("bar.tape.noTape"), run: () => s.deckKey("eject") },
      // the same switch as the Cassette tab's
      { label: t("tape.fast"), checked: s.fastTape, toggle: true, divider: true, run: () => s.setFastTape(!s.fastTape) },
    ];
  }

  /** @private @returns {import("../ui/components.js").MenuItem[]} */
  programItems() {
    return [
      ...SAMPLES.map((sm) => ({ label: t(`sample.${sm.id}.title`), run: () => this.program(sm) })),
      { label: t("sample.screen.menu"), run: () => this.program(null) },
    ];
  }

  /**
   * A program's dialog: what it does, its listing, and the two ways in, typed on the Model I's
   * keys or put in the recorder on its tape. Machine code has only the tape.
   * @private @param {import("../sim/samples.js").Sample | null} sm null: the machine-code sample
   */
  program(sm) {
    const s = this.system;
    const id = sm ? sm.id : "screen";
    const title = t(`sample.${id}.title`);
    const about = t(`sample.${id}.about`);
    const noRom = this.o.rom() ? undefined : t("bar.needsRom");
    const tape = { label: t("program.tape"), choice: true, icon: /** @type {const} */ ("voicemail"), disabled: sm ? noRom : undefined, run: () => (sm ? this.sampleTape(sm) : s.insertTape(tapeFromCas(t("tape.screenName"), screenProgramCas()))) };
    const body = [
      el("p", { class: "dialog-text", text: about.charAt(0).toUpperCase() + about.slice(1) }),
      ...(sm ? [el("pre", { class: "program-listing", text: sm.text.replace(/\nRUN\n$/, "\n").trimEnd() })] : []),
      el("ul", { class: "program-ways dim" }, [
        ...(sm ? [el("li", { text: t("program.how.type") })] : []),
        el("li", { text: sm ? t("program.how.tape", { letter: sm.letter }) : t("program.how.system") }),
      ]),
    ];
    if (!sm) return void showDialog(title, body, [tape]);
    const off = s.machine.powered ? undefined : t("bar.switchOnFirst");
    // two ways in, of equal weight, in the order the dialog lists them
    showDialog(title, body, [
      {
        label: t("program.type"),
        choice: true,
        icon: "keyboard",
        disabled: off,
        run: () => this.typeIn(sm, title),
      },
      tape,
    ]);
  }


  /**
   * Types a program in as an owner did, every key visible: ENTER first if the machine still
   * asks MEMORY SIZE? (it reads its line as a number, and anything else is thrown away as it
   * asks again), else BREAK to stop whatever runs; then NEW, so no old line is left in, the
   * listing, and RUN.
   * @private @param {import("../sim/samples.js").Sample} sm @param {string} title
   */
  typeIn(sm, title) {
    const s = this.system;
    if (!s.machine.powered) return void s.say({ key: "type.off" });
    const lines = s.machine.screenText().filter((l) => l.trim());
    const asking = /^MEMORY SIZE\?/.test(lines.at(-1) ?? "");
    typeKeys(s, `${asking ? "{ENTER}" : "{BREAK}"}NEW\n${sm.text}`);
    s.say({ key: asking ? "program.typingMemory" : "program.typing", params: { title } });
  }

  /** @private @param {import("../sim/samples.js").Sample} sm */
  sampleTape(sm) {
    const rom = this.o.rom();
    if (!rom) return void this.system.say({ key: "power.noRom" });
    this.system.say({ key: "tape.recording", params: { title: t(`sample.${sm.id}.title`), letter: sm.letter } });
    setTimeout(() => this.system.insertTape(recordSampleTape(rom, sm, t("tape.sampleName", { title: t(`sample.${sm.id}.title`), letter: sm.letter }))), 30);
  }

  /** @private A visitor's own .cas or .wav: read here, never uploaded (D7). */
  async openFile() {
    const f = this.file.files?.[0];
    if (!f) return;
    this.file.value = "";
    const bytes = new Uint8Array(await f.arrayBuffer());
    const s = this.system;
    if (String.fromCharCode(...bytes.slice(0, 4)) !== "RIFF") return void s.insertTape(tapeFromCas(f.name, bytes));
    try {
      const sound = parseWav(bytes);
      const pulses = pulsesFromSound(sound);
      if (pulses.length < 100) return void s.say({ key: "tape.noPulses", params: { name: f.name, seconds: (sound.samples.length / sound.rate).toFixed(1) } });
      s.insertTape(new Tape(f.name, pulses));
    } catch (err) {
      s.say({ key: "tape.badFile", params: { name: f.name, why: err instanceof Error ? err.message : String(err) } });
    }
  }

  /** @private @param {"cas" | "wav"} kind */
  save(kind) {
    const s = this.system;
    const tape = s.deck.tape;
    if (!tape || !tape.pulses.length) return void s.say({ key: "tape.nothingToSave" });
    if (kind === "cas") {
      const cas = casFromTape(tape);
      const name = fileName(tape.name, "cas");
      download(cas, name, "application/octet-stream");
      s.say({ key: "tape.savedCas", params: { name, bytes: cas.length } });
    } else {
      const wav = wavFromPulses(tape.pulses);
      const name = fileName(tape.name, "wav");
      download(wav, name, "audio/wav");
      s.say({ key: "tape.savedWav", params: { name, seconds: Math.round((wav.length - 44) / 22050) } });
    }
  }
}
