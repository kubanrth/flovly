// Self-check: `npx tsx components/ui/status-hue.check.ts`
import assert from "node:assert/strict";
import { hueForColor } from "./status-hue";
assert.equal(hueForColor("#F59E0B"), "yellow");
assert.equal(hueForColor("#3B82F6"), "blue");
assert.equal(hueForColor("#10B981"), "green");
assert.equal(hueForColor("#64748B"), "gray");
assert.equal(hueForColor("#FF3B30"), "red");
assert.equal(hueForColor("#FF9500"), "orange");
assert.equal(hueForColor("#7B68EE"), "indigo");
assert.equal(hueForColor("#FF2D9C"), "pink");
assert.equal(hueForColor("#00CDD8"), "teal");
assert.equal(hueForColor("#1C1A17"), "black");
assert.equal(hueForColor("nope"), "gray");
console.log("status-hue ok");
