// SPDX-License-Identifier: Apache-2.0
//
// Helpers run in the page for `pnpm shots` and `pnpm video` (the page opened with ?debug, so
// its handles `trs80` and `app` are within reach): the machine answered at MEMORY SIZE?, one
// of our programs typed in as Type it in types it (faster, if asked), text typed, a view, a
// tab, the dock's height or fold, the camera panned, and Programs opened on a section.
// Nothing here names a label in a language, so a setup works in each of the ten. After the
// Altair 8800 simulator's tools/page-helpers.mjs.

export const HELPERS = `
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (f, ms = 30000) => { const end = Date.now() + ms; while (!f() && Date.now() < end) await sleep(100); };
  const { typeKeys } = await import("./js/lessons/lessons.js");
  const samples = await import("./js/sim/samples.js");
  const { t } = await import("./js/l10n/l10n.js");
  const typed = async () => { await until(() => !trs80.typist.busy, 120000); await sleep(600); };
  const ready = async () => {
    await until(() => trs80.machine.screenText().some((l) => /^MEMORY SIZE\\?/.test(l)));
    typeKeys(trs80, "{ENTER}");
    await until(() => trs80.machine.screenText().includes("READY"));
  };
  const program = async (id, faster = false) => {
    const sm = samples.SAMPLES.find((x) => x.id === id);
    const { asking, keys } = samples.typeIn(trs80.machine.screenText(), sm.text);
    typeKeys(trs80, keys);
    trs80.typeFaster = faster;
    trs80.say({ key: asking ? "program.typingMemory" : "program.typing", params: { title: t("sample." + id + ".title") } });
    await typed();
  };
  const type = async (text) => { trs80.type(text); await typed(); };
  const view = async (v) => { app.stage.goTo(v); await sleep(200); await until(() => !app.viewer.isFlying(), 8000); await sleep(400); };
  const tab = (id) => app.dock.show(id);
  const dockHeight = (px) => { app.dock.folded = false; app.dock.choose(px); };
  const fold = () => { app.dock.folded = true; app.dock.apply(); };
  // slides the picture across the stage by so many pixels (+: right), as a camera's lens
  // shifts, so that the machine is seen just as before, only further across
  const pan = (px) => {
    const v = app.viewer, { width, height } = v.size();
    v.camera.setViewOffset(width, height, -px, 0, width, height);
    v.camera.updateProjectionMatrix();
  };
  // Programs, open on its n-th section (0 Learn, 1 Games, 2 Utilities, 3 Music)
  const programsMenu = async (section) => {
    document.getElementById("programs").click();
    await sleep(300);
    document.querySelectorAll(".menu [role=menuitem]")[section]?.click();
    await sleep(300);
  };
  await until(() => app.desk() !== null);
`;
