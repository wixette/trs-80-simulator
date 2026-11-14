// SPDX-License-Identifier: Apache-2.0
//
// The ten languages (U11): ?lang= opens the page in a language, with no English of the page's
// own left on it, and it fits a phone's width; the language button's menu names each as it
// names itself, and a choice opens the page again in it, remembered.

const LOCALES = ["en", "es", "fr", "de", "it", "pt-BR", "zh", "zh-TW", "ja", "ko"];

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  for (const loc of LOCALES.slice(1)) {
    await h.viewport(1440, 900);
    await h.send("Page.navigate", { url: `${h.base}?debug&lang=${loc}` });
    await h.until(`document.documentElement.lang === "${loc}" && typeof trs80 === "object" && typeof app === "object"`, 20000);
    await h.sleep(600);
    h.verify(`${loc}: the page opens in it`, (await h.js("document.documentElement.lang")) === loc);
    // English left on the page: any of the page's own texts, as shown, that is English's
    // message where this language has another
    const left = await h.js(`(async () => {
      const en = (await import("./js/l10n/en.js")).default;
      const mine = (await import("./js/l10n/${loc}.js")).default;
      const english = new Set(Object.keys(en).filter((k) => mine[k] && mine[k] !== en[k] && !/[{\`]/.test(en[k]) && en[k].length > 3).map((k) => en[k]));
      const shown = [...document.querySelectorAll("#topbar, #band, #helper-strip, #dock-tabs, #pane-lessons, #status")].flatMap((r) =>
        [...r.querySelectorAll("*")].filter((e) => !e.children.length).map((e) => e.textContent.trim()).concat([...r.querySelectorAll("[aria-label],[aria-description]")].map((e) => e.getAttribute("aria-label") ?? e.getAttribute("aria-description"))));
      return [...new Set(shown.filter((x) => x && english.has(x)))];
    })()`);
    h.verify(`${loc}: no English of the page's own is left on it`, Array.isArray(left) && left.length === 0, left);
    await h.viewport(360, 740, true);
    await h.sleep(500);
    const fit = await h.js(`(() => { const w = innerWidth; return [...document.querySelectorAll('#topbar, #band, #helper-strip, #dock-tabs')].filter((e) => e.getBoundingClientRect().right > w + 1 || e.scrollWidth > e.clientWidth + 1).map((e) => e.id); })()`);
    h.verify(`${loc}: the top bar, the band, the strip and the tabs fit a 360 px phone`, Array.isArray(fit) && fit.length === 0, fit);
  }

  // the menu, and a choice remembered
  await h.viewport(1440, 900);
  await h.open();
  h.verify("a first visit in an English browser is in English", (await h.js("document.documentElement.lang")) === "en");
  await h.press("#lang");
  const names = await h.js("[...document.querySelectorAll('.menu [role^=menuitem]')].map((b) => b.textContent)");
  h.verify("the menu names each language as it names itself", JSON.stringify(names) === JSON.stringify(["English", "Español", "Français", "Deutsch", "Italiano", "Português (Brasil)", "简体中文", "繁體中文", "日本語", "한국어"]), names);
  await h.key("Escape");
  await h.choose("#lang", "Deutsch");
  await h.until("document.readyState === 'complete' && typeof app === 'object' && document.documentElement.lang === 'de'", 20000);
  h.verify("choosing one opens the page again in it", (await h.js("document.documentElement.lang")) === "de");
  h.verify("the button says which", (await h.js("document.querySelector('#lang .lang-code').textContent")) === "DE");
  await h.send("Page.navigate", { url: `${h.base}?debug` });
  await h.until("typeof app === 'object'", 20000);
  h.verify("and it is remembered", (await h.js("document.documentElement.lang")) === "de");
}
