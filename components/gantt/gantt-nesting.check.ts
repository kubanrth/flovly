import assert from "node:assert/strict";
import { flattenTree, nestTasks } from "./gantt-nesting";

const t = (id: string, parentId: string | null = null) => ({ id, parentId });
const tasks = [t("epik"), t("a", "epik"), t("b", "epik"), t("luzne"), t("wnuk", "a"), t("sierota", "nie-ma")];
const { roots, childrenOf } = nestTasks(tasks);

// Korzenie: bez rodzica + sierota (rodzic poza zbiorem) — nic nie znika.
assert.deepEqual(roots.map((x) => x.id), ["epik", "luzne", "sierota"]);
assert.deepEqual(childrenOf.get("epik")!.map((x) => x.id), ["a", "b"]);
assert.deepEqual(childrenOf.get("a")!.map((x) => x.id), ["wnuk"]);

// Zwiniete: same korzenie, z licznikiem dzieci.
assert.deepEqual(flattenTree(roots, childrenOf, new Set()).map((r) => [r.t.id, r.depth, r.childCount]), [["epik", 0, 2], ["luzne", 0, 0], ["sierota", 0, 0]]);
// Rozwiniety epik: dzieci pod nim z glebokoscia 1; wnuk dopiero po rozwinieciu „a".
assert.deepEqual(flattenTree(roots, childrenOf, new Set(["epik"])).map((r) => `${r.t.id}@${r.depth}`), ["epik@0", "a@1", "b@1", "luzne@0", "sierota@0"]);
assert.deepEqual(flattenTree(roots, childrenOf, new Set(["epik", "a"])).map((r) => `${r.t.id}@${r.depth}`), ["epik@0", "a@1", "wnuk@2", "b@1", "luzne@0", "sierota@0"]);

console.log("gantt-nesting: OK");
