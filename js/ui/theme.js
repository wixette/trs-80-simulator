// SPDX-License-Identifier: Apache-2.0
//
// The theme's tokens (css/theme.css) for what is drawn by script: the canvases, the 2D
// drawings and the 3D scene (docs/ui-design.md, P11).

/** The tokens, by name in camel case: --case-silver is caseSilver. */
export function tokens() {
  const css = getComputedStyle(document.documentElement);
  /** @param {string} name @param {string} fallback */
  const get = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return {
    phosphor: get("--phosphor", "#e4ecff"),
    glassOff: get("--glass-off", "#4b5856"),
    glassOn: get("--glass-on", "#121716"),
    tubeBlack: get("--tube-black", "#0b0d0c"),
    caseSilver: get("--case-silver", "#959590"),
    caseSilverDark: get("--case-silver-dark", "#85857f"),
    monitorBrown: get("--monitor-brown", "#241f1b"),
    panelBrown: get("--panel-brown", "#2d2722"),
    inkSilver: get("--ink-silver", "#cfcfcb"),
    chrome: get("--chrome", "#c6c8cb"),
    bezelBlack: get("--bezel-black", "#0d0d0d"),
    recorderBlack: get("--recorder-black", "#1a1a1a"),
    ledOff: get("--led-off", "#3a0d0a"),
    ledOn: get("--led-on", "#ff3b24"),
    stage: get("--md-surface", "#1f1f1f"),
    surface: get("--md-surface-low", "#242424"),
    well: get("--md-well", "#171717"),
    onSurface: get("--md-on-surface", "#e6e6e6"),
    onSurfaceVariant: get("--md-on-surface-variant", "#a8a8a8"),
    outline: get("--md-outline", "#8c8c8c"),
    outlineVariant: get("--md-outline-variant", "#444444"),
    primary: get("--md-primary", "#ff9900"),
    on: get("--on", "#3ddc63"),
    story: get("--story", "#8db9f2"),
    error: get("--md-error", "#ff8a80"),
    glowCpu: get("--glow-cpu", "#ff8a3d"),
    glowRom: get("--glow-rom", "#55d18a"),
    glowRam: get("--glow-ram", "#d16cff"),
    glowVideo: get("--glow-video", "#4a7dff"),
  };
}

/** @typedef {ReturnType<typeof tokens>} Tokens */
