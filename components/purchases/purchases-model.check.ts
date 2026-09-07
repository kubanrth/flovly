import assert from "node:assert/strict";
import { linkHost, normalizeLink } from "./purchases-model";

// Zwykly link zostaje, bez schematu dostaje https.
assert.equal(normalizeLink("https://allegro.pl/oferta/123"), "https://allegro.pl/oferta/123");
assert.equal(normalizeLink("  allegro.pl/oferta/123 "), "https://allegro.pl/oferta/123");
assert.equal(normalizeLink("http://x.pl"), "http://x.pl/");
// Puste = brak linku, nie blad.
assert.equal(normalizeLink(""), null);
assert.equal(normalizeLink("   "), null);
// Wszystko, co nie jest http(s), odpada — to laduje w href.
assert.equal(normalizeLink("javascript:alert(1)"), null);
assert.equal(normalizeLink("data:text/html,x"), null);
assert.equal(normalizeLink("ftp://x.pl/a"), null);
assert.equal(normalizeLink("nie url ani domena"), null);
// Host do pokazania.
assert.equal(linkHost("https://www.allegro.pl/oferta/123"), "allegro.pl");

console.log("purchases-model: OK");
