// SPDX-License-Identifier: Apache-2.0
//
// The page's link format (docs/ui-design.md, P8, U1): `#view=3d` or `#view=2d`. It may still
// change before 1.0.0; from then on a field is never renamed, dropped or read differently.
// Nothing of the page is in here, so tests/link.test.js can pin it down.

/** @typedef {{ view?: "2d" | "3d" }} Link */

/** Reads a link's fields from a location's hash. @param {string} hash @returns {Link} */
export function readLink(hash) {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const view = p.get("view");
  return view === "2d" || view === "3d" ? { view } : {};
}

/** The hash for a link's fields. @param {Link} link */
export function linkHash(link) {
  const p = new URLSearchParams();
  if (link.view) p.set("view", link.view);
  const s = p.toString();
  return s ? `#${s}` : "";
}

/** Puts a link's fields in the address bar, without a new history entry. @param {Link} link */
export function writeLink(link) {
  const h = linkHash(link);
  if (h !== location.hash) history.replaceState(null, "", h || location.pathname + location.search);
}
