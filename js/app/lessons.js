// SPDX-License-Identifier: Apache-2.0
//
// The Lessons tool (docs/ui-design.md, U7): a bar of numbered lessons, one shown at a time;
// "Lesson 3 of 6", its title and lead; then its steps, each with its text, the program it
// types as the machine's own text, its chips (Type it, one of our programs to open, Show me), a tick when the machine
// shows it done, and a "Going further" aside, folded. Show me points at what a step is about
// and never works the machine; a tool it opens goes beside the lesson, so that the lesson
// stays in view (U7). The lesson open and each step's tick are remembered.

import { t } from "../l10n/l10n.js";
import { LESSONS, typeKeys } from "../lessons/lessons.js";
import { el, icon, setTip, tabs } from "../ui/components.js";

/** @typedef {import("../sim/system.js").System} System */
/** @typedef {import("../lessons/lessons.js").Show} Show */

const STORE = "trs80.lessons";
/** How often the steps are checked, ms. */
const CHECK_MS = 250;

/**
 * A message's text as HTML: escaped, then `code` and **bold**.
 * @param {string} s
 */
export function markup(s) {
  const esc = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

/** @returns {{ lesson?: string, done?: Record<string, string[]> }} */
function load() {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "{}");
  } catch {
    return {};
  }
}

export class LessonsTool {
  /**
   * @param {HTMLElement} host
   * @param {System} system
   * @param {(show: Show) => void} show what Show me does: the page points at it
   * @param {(id: string) => void} program opens one of our programs' dialogs (Programs)
   */
  constructor(host, system, show, program) {
    this.system = system;
    this.showMe = show;
    this.openProgram = program;
    const saved = load();
    /** The steps done, by lesson. @type {Record<string, Set<string>>} */
    this.done = Object.fromEntries(LESSONS.map((l) => [l.id, new Set(saved.done?.[l.id] ?? [])]));
    this.lessonId = saved.lesson && LESSONS.some((l) => l.id === saved.lesson) ? saved.lesson : LESSONS[0].id;
    this.bar = el("div", { class: "lesson-bar", role: "tablist", "aria-label": t("lessons.bar") });
    for (const [i, l] of LESSONS.entries()) {
      const b = el("button", { class: "lesson-tab", role: "tab", id: `lesson-tab-${l.id}`, type: "button" }, [el("b", { text: String(i + 1) }), el("span", { text: t(`lesson.${l.id}.title`) })]);
      b.setAttribute("data-tip-describes", "");
      setTip(b, t(`lesson.${l.id}.title`));
      this.bar.append(b);
    }
    this.page = el("article", { class: "lesson" });
    /** Where Show me puts a tool beside the lesson. */
    this.companion = el("aside", { class: "lesson-companion", hidden: true });
    host.append(el("div", { class: "lessons" }, [this.bar, el("div", { class: "lesson-body" }, [this.page, this.companion])]));
    this.select = tabs(this.bar, (id) => this.open(id.replace(/^lesson-tab-/, "")));
    this.select(`lesson-tab-${this.lessonId}`);
    /** @private */
    this.last = 0;
  }

  /** @private Opens a lesson. @param {string} id */
  open(id) {
    this.lessonId = id;
    const i = LESSONS.findIndex((l) => l.id === id);
    const lesson = LESSONS[i];
    /** @type {HTMLElement[]} */
    const steps = lesson.steps.map((st, n) => {
      const key = `lesson.${id}.${st.id}`;
      const chips = el("div", { class: "chips" });
      if (st.type) {
        const b = el("button", { class: "chip type-it", type: "button" }, [icon("keyboard"), el("span", { text: t("lessons.typeIt") })]);
        b.setAttribute("data-tip-describes", "");
        setTip(b, t("lessons.typeIt.tip"));
        b.addEventListener("click", () => {
          if (!this.system.machine.powered) return void this.system.say({ key: "type.off" });
          typeKeys(this.system, /** @type {string} */ (st.type));
          this.system.say({ key: "lessons.typing" });
        });
        chips.append(b);
      }
      if (st.program) {
        const id = st.program;
        const b = el("button", { class: "chip open-program", type: "button" }, [icon("play_arrow"), el("span", { text: t("lessons.openProgram", { title: t(`sample.${id}.title`) }) })]);
        b.setAttribute("data-tip-describes", "");
        setTip(b, t("lessons.openProgram.tip"));
        b.addEventListener("click", () => this.openProgram(id));
        chips.append(b);
      }
      if (st.show) {
        const b = el("button", { class: "chip show-me", type: "button" }, [icon("visibility"), el("span", { text: t("lessons.showMe") })]);
        b.setAttribute("data-tip-describes", "");
        setTip(b, t("lessons.showMe.tip"));
        b.addEventListener("click", () => this.showMe(/** @type {Show} */ (st.show)));
        chips.append(b);
      }
      const text = el("div", { class: "step-text" });
      text.innerHTML = markup(t(`${key}.text`));
      const body = el("div", { class: "step-body" }, [el("h4", { text: t(`${key}.title`) }), text]);
      if (st.photo) {
        const img = el("img", { src: new URL(`../../${st.photo.src}`, import.meta.url).href, alt: t(`${key}.title`), loading: "lazy" });
        body.append(el("figure", { class: "photo" }, [img, el("figcaption", {}, [el("a", { href: st.photo.href, target: "_blank", rel: "noopener", text: t(st.photo.credit) })])]));
      }
      if (st.listing) body.append(el("pre", { class: "listing", text: st.listing }));
      if (chips.childElementCount) body.append(chips);
      if (st.more) {
        const more = el("details", { class: "more" }, [el("summary", { text: t("lessons.more") })]);
        const p = el("div");
        p.innerHTML = markup(t(`${key}.more`));
        more.append(p);
        body.append(more);
      }
      const tick = el("span", { class: "tick", "aria-hidden": "true" }, [icon("check_circle")]);
      return el("li", { class: `step${st.done ? "" : " no-check"}`, "data-step": st.id }, [el("span", { class: "step-n", text: String(n + 1) }), body, st.done ? tick : null]);
    });
    const next = LESSONS[i + 1];
    const foot = next
      ? el("button", { class: "btn tonal has-icon next-lesson", type: "button" }, [el("span", { text: t("lessons.next", { title: t(`lesson.${next.id}.title`) }) }), icon("chevron_right")])
      : el("p", { class: "dim", text: t("lessons.end") });
    if (next) foot.addEventListener("click", () => this.select(`lesson-tab-${next.id}`));
    this.page.replaceChildren(
      el("p", { class: "lesson-of", text: t("lessons.of", { n: i + 1, of: LESSONS.length }) }),
      el("h3", { text: t(`lesson.${id}.title`) }),
      el("p", { class: "lead", text: t(`lesson.${id}.lead`) }),
      el("ol", { class: "steps" }, steps),
      foot,
    );
    this.page.parentElement?.scrollTo?.({ top: 0 });
    this.save();
    this.paintTicks();
  }

  /** Shows a tool beside the lesson (Show me), or closes it. @param {HTMLElement | null} tool */
  setCompanion(tool) {
    this.companion.hidden = !tool;
    if (!tool) {
      this.companion.replaceChildren();
      return;
    }
    const close = el("button", { class: "btn icon-only companion-close", type: "button" }, [icon("close")]);
    setTip(close, t("lessons.closeTool"));
    close.addEventListener("click", () => this.setCompanion(null));
    this.companion.replaceChildren(close, tool);
  }

  /** @private */
  save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({ lesson: this.lessonId, done: Object.fromEntries(Object.entries(this.done).map(([k, v]) => [k, [...v]])) }));
    } catch {
      // private browsing: nothing is remembered
    }
  }

  /** @private */
  paintTicks() {
    const done = this.done[this.lessonId];
    for (const li of this.page.querySelectorAll(".step")) li.classList.toggle("done", done.has(/** @type {HTMLElement} */ (li).dataset.step ?? ""));
    for (const l of LESSONS) {
      const tab = document.getElementById(`lesson-tab-${l.id}`);
      const all = l.steps.filter((s) => s.done).every((s) => this.done[l.id].has(s.id));
      tab?.classList.toggle("complete", all);
    }
  }

  /** Checks the open lesson's steps against the machine; called each frame. */
  tick() {
    const now = performance.now();
    if (now - this.last < CHECK_MS) return;
    this.last = now;
    const lesson = LESSONS.find((l) => l.id === this.lessonId);
    if (!lesson || !this.system.machine.powered) return;
    const done = this.done[lesson.id];
    let changed = false;
    for (const st of lesson.steps) {
      if (!st.done || done.has(st.id)) continue;
      if (st.done(this.system)) {
        done.add(st.id);
        changed = true;
      }
    }
    if (changed) {
      this.save();
      this.paintTicks();
    }
  }
}
