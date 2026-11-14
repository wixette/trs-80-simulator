// SPDX-License-Identifier: Apache-2.0
//
// The References tab (docs/ui-design.md, U6), as the Altair 8800 simulator's: what the
// simulator simplifies, what it is built on, and further reading, in one column down the middle
// of the dock, looked up rather than read in order. About's References button opens it.

import { t } from "../l10n/l10n.js";
import { el } from "../ui/components.js";
import { REPO } from "./about.js";

/** @param {string} href @param {string} text */
const link = (href, text) => el("a", { href, target: "_blank", rel: "noopener", text });

/** What it is built on: each a message, and where it is. */
const CREDITS = /** @type {[string, string][]} */ ([
  ["refs.credit.retrostack", "https://github.com/RetroStack/TRS-80-Model-I-Info"],
  ["refs.credit.kesteloot", "https://github.com/lkesteloot/trs80"],
  ["refs.credit.reed", "https://www.trs-80.org/"],
  ["refs.credit.z80", "https://github.com/DrGoldfire/Z80.js"],
  ["refs.credit.xtrs", "https://github.com/TimothyPMann/xtrs"],
  ["refs.credit.three", "https://threejs.org/"],
]);

/** Further reading: each a message, and where it is (research/bibliography.md has the rest). */
const READING = /** @type {[string, string][]} */ ([
  ["refs.read.reed", "https://www.trs-80.org/model-1.html"],
  ["refs.read.intro", "https://www.trs-80.org/trs80-introduction-part1.html"],
  ["refs.read.l2", "https://archive.org/details/Level_II_BASIC_Reference_Manual_1st_Ed._1978_Radio_Shack"],
  ["refs.read.tm", "https://archive.org/download/TRS-80_Technical_Manual_1978_Radio_Shack/TRS-80_Technical_Manual_1978_Radio_Shack_text.pdf"],
  ["refs.read.chm", "https://www.computerhistory.org/revolution/artifact/298/1161"],
  ["refs.read.wp", "https://en.wikipedia.org/wiki/TRS-80"],
  ["refs.read.rs", "https://github.com/RetroStack/TRS-80-Model-I-Info"],
]);

export class ReferencesTool {
  /** @param {HTMLElement} host */
  constructor(host) {
    const list = (/** @type {[string, string][]} */ items) => el("ul", { class: "link-list" }, items.map(([key, href]) => el("li", {}, [link(href, t(key))])));
    host.append(
      el("article", { class: "references" }, [
        el("h3", { text: t("refs.simplifies") }),
        el("ul", { class: "plain-list" }, t("refs.simplifies.list").split(" · ").map((s) => el("li", { text: s }))),
        el("h3", { text: t("refs.credits") }),
        list(CREDITS),
        el("h3", { text: t("refs.reading") }),
        list(READING),
        el("h3", { text: t("refs.source") }),
        el("ul", { class: "link-list" }, [el("li", {}, [link(REPO, t("about.source"))]), el("li", {}, [link(`${REPO}/tree/main/research`, t("refs.research"))])]),
      ]),
    );
  }
}
