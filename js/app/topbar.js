// SPDX-License-Identifier: Apache-2.0
//
// The top bar (docs/ui-design.md, U8): what you do to the machine on the left (Tapes,
// Programs), what you do with the app on the right (Sound, About). Programs is the one
// catalogue of our programs, in sections (design/v0.0.3.md, S2): each opens a dialog that
// offers both ways in, typed on the keys or loaded from its tape; then where to find the
// era's own programs, and a listing of the visitor's to type in (S3). Tapes is for tapes
// themselves. Each is a menu or a dialog (P4, P10). Visitors bring their own tapes and
// listings, read locally and never uploaded (D7); our tapes were recorded by a Model I of
// our own (pnpm tapes), so nothing but the ROM's own output is on them.

import { locale, t } from "../l10n/l10n.js";
import { LOCALE_NAMES, LOCALE_SHORT, LOCALE_STORE, LOCALES } from "../l10n/locales.js";
import { casFromTape, Tape, tapeFromCas } from "../sim/cassette.js";
import { typeKeys } from "../lessons/lessons.js";
import { Typist } from "../sim/keys.js";
import { LONG, SAMPLES, SECTIONS, typeIn } from "../sim/samples.js";
import { parseWav, pulsesFromSound, wavFromPulses } from "../sim/wav.js";
import { el, icon, setTip, showDialog, showMenu, toggle } from "../ui/components.js";

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

/** The archives Find original programs names (S3), each with what it holds. @type {[string, string][]} */
const ORIGINALS = [
  ["https://www.trs-80.com/main-search-software.htm", "originals.trs80com"],
  ["https://www.classic-computers.org.nz/system-80/software_cassette_archive.htm", "originals.nz"],
  ["https://archive.org/details/80-microcomputing-magazine", "originals.80micro"],
];

/** Each section's icon in Programs. @type {Record<import("../sim/samples.js").Section, import("../ui/components.js").IconName>} */
const SECTION_ICONS = { learn: "school", games: "sports_esports", utilities: "construction", music: "music_note" };

/** Where Sound on or off is remembered. */
const SOUND_STORE = "trs80.sound";

/** Whether site data can be kept: if not, a language chosen goes in the address. */
const remembered = () => {
  try {
    localStorage.setItem("trs80.probe", "1");
    localStorage.removeItem("trs80.probe");
    return true;
  } catch {
    return false;
  }
};

export class TopBar {
  /**
   * @param {System} system
   * @param {{ rom: () => Uint8Array | null, tape: (id: string) => Promise<Uint8Array>, about: () => Node[], references: () => void, sound: { muted: boolean, setMuted: (m: boolean) => void } }} o
   */
  constructor(system, o) {
    this.system = system;
    this.o = o;
    const tapes = /** @type {HTMLButtonElement} */ (document.getElementById("tapes"));
    const programs = /** @type {HTMLButtonElement} */ (document.getElementById("programs"));
    const about = /** @type {HTMLButtonElement} */ (document.getElementById("about"));
    this.file = /** @type {HTMLInputElement} */ (el("input", { type: "file", accept: ".cas,.wav,audio/wav,audio/x-wav", hidden: true }));
    this.listing = /** @type {HTMLInputElement} */ (el("input", { type: "file", accept: ".bas,.txt,text/plain", hidden: true }));
    document.body.append(this.file, this.listing);
    this.listing.addEventListener("change", () => this.openListing());
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
    // the language (U11): each named as it names itself; a choice is remembered, and the page
    // opens again in it, as everything on it is written once, as it is built
    const lang = /** @type {HTMLButtonElement} */ (document.getElementById("lang"));
    /** @type {HTMLElement} */ (lang.querySelector(".lang-code")).textContent = LOCALE_SHORT[locale()];
    setTip(lang, t("bar.lang.tip"));
    lang.addEventListener("click", () =>
      showMenu(
        lang,
        LOCALES.map((l) => ({
          label: LOCALE_NAMES[l],
          checked: l === locale(),
          run: () => {
            if (l === locale()) return;
            try {
              localStorage.setItem(LOCALE_STORE, l);
            } catch {
              // not remembered: the address carries it instead
            }
            const u = new URL(location.href);
            u.searchParams.delete("lang");
            if (!remembered()) u.searchParams.set("lang", l);
            // the address may be this very one, #fragment and all (link.js keeps the view
            // there), and going to it only moves within the page: then load it again
            if (u.href === location.href) location.reload();
            else location.replace(u);
          },
        })),
      ),
    );
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
    /** @type {import("../ui/components.js").MenuItem[]} */
    const items = [];
    // a submenu for each section (Learn, Games, Utilities, Music), then the two that are not ours
    for (const sec of SECTIONS) {
      const list = SAMPLES.filter((sm) => sm.section === sec).map((sm) => ({ label: t(`sample.${sm.id}.title`), run: () => this.program(sm) }));
      if (list.length) items.push({ label: t(`programs.${sec}`), icon: SECTION_ICONS[sec], items: list });
    }
    items.push({ label: t("programs.find"), icon: "travel_explore", divider: true, run: () => this.findOriginals() });
    items.push({ label: t("programs.listing"), icon: "article", run: () => this.listing.click() });
    return items;
  }

  /** Opens one of our programs' dialogs, as Programs does (a lesson's step). @param {string} id */
  openProgram(id) {
    const sm = SAMPLES.find((x) => x.id === id);
    if (sm) this.program(sm);
  }

  /**
   * A program's dialog: what it does, its listing, and the two ways in, typed on the Model I's
   * keys or put in the recorder on its tape; a long one is typed in faster at first.
   * @private @param {import("../sim/samples.js").Sample} sm
   */
  program(sm) {
    const s = this.system;
    const title = t(`sample.${sm.id}.title`);
    const about = t(`sample.${sm.id}.about`);
    let faster = sm.text.length >= LONG;
    const fast = toggle(t("program.faster"), faster, (on) => (faster = on));
    fast.setAttribute("data-tip-describes", "");
    setTip(fast, t("program.faster.tip"));
    const body = [
      el("p", { class: "dialog-text", text: about.charAt(0).toUpperCase() + about.slice(1) }),
      el("pre", { class: "program-listing", text: sm.text.replace(/\nRUN\n$/, "\n").trimEnd() }),
      el("ul", { class: "program-ways dim" }, [el("li", { text: t("program.how.type") }), el("li", { text: t("program.how.tape", { letter: sm.letter }) })]),
      el("div", { class: "program-faster" }, [fast]),
    ];
    const off = s.machine.powered ? undefined : t("bar.switchOnFirst");
    // two ways in: the tape, and the one we recommend, Type it in, last (on the right, where a
    // dialog's confirming action goes), filled, and with the focus
    showDialog(title, body, [
      { label: t("program.tape"), choice: true, icon: "voicemail", run: () => this.sampleTape(sm) },
      { label: t("program.type"), primary: true, icon: "keyboard", disabled: off, run: () => this.typeProgram(sm.text, title, faster) },
    ]);
  }

  /**
   * Types a listing in as an owner did, every key visible: ENTER first if the machine still
   * asks MEMORY SIZE? (it reads its line as a number, and anything else is thrown away as it
   * asks again), else BREAK to stop whatever runs; then NEW, so no old line is left in, and
   * the listing (ours end with RUN).
   * @private @param {string} text @param {string} title @param {boolean} faster
   */
  typeProgram(text, title, faster) {
    const s = this.system;
    if (!s.machine.powered) return void s.say({ key: "type.off" });
    const { asking, keys } = typeIn(s.machine.screenText(), text);
    typeKeys(s, keys);
    s.typeFaster = faster;
    s.say({ key: asking ? "program.typingMemory" : "program.typing", params: { title } });
  }

  /** @private Our program's tape, recorded beforehand (pnpm tapes). @param {import("../sim/samples.js").Sample} sm */
  async sampleTape(sm) {
    const name = t("tape.sampleName", { title: t(`sample.${sm.id}.title`), letter: sm.letter });
    try {
      this.system.insertTape(tapeFromCas(name, await this.o.tape(sm.id)));
    } catch {
      this.system.say({ key: "tape.notLoaded", params: { name } });
    }
  }

  /** @private Where the era's own programs are, what of them runs here, and how (S3). */
  findOriginals() {
    const p = (/** @type {string} */ key) => el("p", { class: "dialog-text", text: t(key) });
    const h = (/** @type {string} */ key) => el("p", { class: "dialog-subhead", text: t(key) });
    const link = (/** @type {string} */ href, /** @type {string} */ key) => el("li", {}, [el("a", { href, target: "_blank", rel: "noopener", text: new URL(href).hostname.replace(/^www\./, "") }), el("span", { text: `: ${t(key)}` })]);
    showDialog(t("originals.title"), [
      p("originals.intro"),
      h("originals.runs.head"),
      p("originals.runs"),
      h("originals.not.head"),
      p("originals.not"),
      h("originals.load.head"),
      p("originals.load"),
      h("originals.where.head"),
      el("ul", { class: "originals-links" }, ORIGINALS.map(([href, key]) => link(href, key))),
      el("p", { class: "dialog-text dim", text: t("originals.rights") }),
    ]);
  }

  /** @private A visitor's own listing, plain text, typed in as Type it in types ours (S3). */
  async openListing() {
    const f = this.listing.files?.[0];
    if (!f) return;
    this.listing.value = "";
    const s = this.system;
    const bytes = new Uint8Array(await f.arrayBuffer());
    // a tokenised program (saved by BASIC itself) is not text: its keywords are single bytes
    if (bytes[0] === 0xff || bytes.some((b) => b >= 0x80 || (b < 0x20 && b !== 0x0a && b !== 0x0d && b !== 0x09))) return void s.say({ key: "listing.notText", params: { name: f.name } });
    const lines = new TextDecoder().decode(bytes).replace(/\t/g, " ").replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length || !lines.every((l) => /^\d+/.test(l))) return void s.say({ key: "listing.noNumbers", params: { name: f.name } });
    const text = lines.join("\n") + "\n";
    const bad = new Typist(/** @type {any} */ ({})).untypable(text);
    if (bad.length) return void s.say({ key: "listing.untypable", params: { name: f.name, chars: bad.join(" ") } });
    if (!s.machine.powered) return void s.say({ key: "type.off" });
    this.typeProgram(text, f.name, text.length >= LONG);
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
