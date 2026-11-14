// SPDX-License-Identifier: Apache-2.0
//
// The link format (js/app/link.js; docs/ui-design.md, P8): acceptance area APP.

import assert from "node:assert/strict";
import { test } from "node:test";
import { linkHash, readLink } from "../js/app/link.js";

test("APP-30: #view=2d and #view=3d are read; anything else is not a view", () => {
  assert.deepEqual(readLink("#view=2d"), { view: "2d" });
  assert.deepEqual(readLink("#view=3d"), { view: "3d" });
  assert.deepEqual(readLink("#view=4d"), {});
  assert.deepEqual(readLink(""), {});
  assert.equal(linkHash({ view: "2d" }), "#view=2d");
  assert.equal(linkHash({}), "");
});
