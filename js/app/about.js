// SPDX-License-Identifier: Apache-2.0
//
// About (docs/ui-design.md, U9): what the simulator is, its version (read from package.json,
// the one place it is kept), what it simplifies, its credits and licences, and its source.

import { t } from "../l10n/l10n.js";
import { el } from "../ui/components.js";

const REPO = "https://github.com/wixette/trs-80-simulator";

/** @param {string} key a message of items joined by " · " */
const list = (key) => el("ul", {}, t(key).split(" · ").map((s) => el("li", { text: s })));

/** @param {URL} pkg package.json @returns {Node[]} */
export function aboutBody(pkg) {
  const version = el("span", { class: "version" });
  fetch(pkg)
    .then((r) => r.json())
    .then((p) => (version.textContent = t("about.version", { version: p.version })))
    .catch(() => {});
  /** @param {string} what @param {string} licence */
  const row = (what, licence) => el("tr", {}, [el("td", { text: t(what) }), el("td", { text: licence })]);
  return [
    el("div", { class: "about-band" }, [el("img", { src: new URL("../../images/logo.svg", import.meta.url).href, alt: "" }), el("div", {}, [el("strong", { text: t("app.name") }), el("br"), version])]),
    el("p", { text: t("about.what") }),
    el("p", { class: "dim", text: t("about.prerelease") }),
    el("h3", { text: t("about.simplifies") }),
    list("about.simplifies.list"),
    el("h3", { text: t("about.credits") }),
    list("about.credits.list"),
    el("h3", { text: t("about.licences") }),
    el("table", { class: "licences" }, [
      row("about.lic.code", "Apache-2.0"),
      row("about.lic.content", "CC BY-SA 4.0"),
      row("about.lic.rom", "LicenseRef-HistoricalROM"),
      row("about.lic.z80", "MIT"),
      row("about.lic.chars", "xtrs (MIT-style)"),
      row("about.lic.three", "MIT"),
      row("about.lic.fonts", "OFL 1.1"),
      row("about.lic.icons", "Apache-2.0"),
      row("about.lic.photos", "CC BY-SA 4.0, CC0"),
    ]),
    el("p", {}, [el("a", { href: REPO, target: "_blank", rel: "noopener", text: t("about.source") })]),
    el("p", { class: "dim", text: t("about.trademark") }),
  ];
}
