import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const canonical = "https://chortle.charlesblancas.com/";

test("search metadata describes the game and consolidates daily URLs", () => {
    const html = read("index.html");
    assert.match(html, /<title>Play Chortle — Daily Chess &amp; Word Puzzle Game<\/title>/);
    assert.match(html, /<meta name="description" content="Play Chortle,[^"]+four guesses\."/);
    assert.ok(html.includes(`<link rel="canonical" href="${canonical}"`));
    assert.ok(html.includes(`<meta property="og:url" content="${canonical}"`));
    assert.doesNotMatch(html, /noindex/);
});

test("crawler discovery files point to the production homepage", () => {
    assert.ok(read("public/robots.txt").includes(`Sitemap: ${canonical}sitemap.xml`));
    assert.ok(read("public/sitemap.xml").includes(`<loc>${canonical}</loc>`));
    assert.doesNotMatch(read("public/sitemap.xml"), /\?day=|fixture=/);
});
