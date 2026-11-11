#!/usr/bin/env node
// Make the page readable without JavaScript, for search engines and AI crawlers that do not run it.
// Run in the Pages workflow on the assembled site, after tools/stats.mjs:
//
//   index.html   the cards rendered by assets/site.js's own renderMods() (one source for both paths) are
//                written between <!-- mods:start --> and <!-- mods:end -->; the header total is filled; a
//                JSON-LD block describes the site and each mod (SoftwareApplication with version, download
//                URL and download count). In the browser, site.js replaces the cards with a live render.
//   sitemap.xml  the one page, with the newest release date as lastmod.
//   llms.txt     a plain-text summary of the page for AI answer engines (llmstxt.org convention).
//
// Usage: node tools/prerender.mjs --site <dir>    (reads <dir>/data/mods.json and, if present, stats.json)

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const SITE_URL = "https://gfkm.github.io/deadlock-mods/";

// --- a DOM just large enough for site.js, serialised to HTML -----------------------------------------------

const VOID = new Set(["img", "br", "hr", "meta", "link", "input", "source"]);

function element(tag) {
    return {
        tag, attrs: {}, className: "", textContent: "", children: [],
        appendChild(c) { this.children.push(c); return c; },
        setAttribute(k, v) { this.attrs[k] = String(v); },
        getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    };
}

export const serverDoc = { createElement: element, createTextNode: t => ({ text: String(t) }) };

const escText = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = s => escText(s).replace(/"/g, "&quot;");

export function toHtml(node) {
    if (node.text !== undefined) return escText(node.text);
    const attrs = Object.assign(node.className ? { class: node.className } : {}, node.attrs);
    const open = "<" + node.tag + Object.entries(attrs).map(([k, v]) => v === "" ? " " + k : ` ${k}="${escAttr(v)}"`).join("") + ">";
    if (VOID.has(node.tag)) return open;
    return open + escText(node.textContent) + node.children.map(toHtml).join("") + "</" + node.tag + ">";
}

// --- structured data -------------------------------------------------------------------------------------

export function jsonLd(data, stats) {
    const author = { "@type": "Person", name: "gfkm" };
    const game = { "@type": "VideoGame", name: "Deadlock", publisher: { "@type": "Organization", name: "Valve" } };
    const apps = data.mods.map(mod => {
        const r = mod.releases && mod.releases[0];
        const s = stats && stats.mods && stats.mods[mod.id];
        const app = {
            "@type": "SoftwareApplication",
            name: mod.name,
            description: mod.summary,
            url: SITE_URL + "#" + mod.id,
            applicationCategory: "GameApplication",
            applicationSubCategory: "Game mod",
            operatingSystem: "Windows",
            isAccessibleForFree: true,
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            author,
            about: game,
        };
        if (mod.image) app.image = SITE_URL + mod.image;
        if (r) {
            app.softwareVersion = r.version;
            app.datePublished = r.date;
            app.downloadUrl = `https://github.com/${data.repo}/releases/download/${r.tag}/${r.assets[0].file}`;
        } else if (mod.links && mod.links.download) {
            app.downloadUrl = mod.links.download;
        }
        if (mod.links && mod.links.gamebanana) app.sameAs = [mod.links.gamebanana];
        if (s) {
            app.interactionStatistic = {
                "@type": "InteractionCounter",
                interactionType: "https://schema.org/DownloadAction",
                userInteractionCount: (s.github || 0) + (s.gamebanana ? s.gamebanana.count : 0),
            };
        }
        return app;
    });
    return {
        "@context": "https://schema.org",
        "@graph": [
            { "@type": "WebSite", name: "gfkm's Deadlock Mods", url: SITE_URL, inLanguage: "en", author },
            { "@type": "ItemList", name: "Deadlock mods by gfkm",
              itemListElement: apps.map((item, i) => ({ "@type": "ListItem", position: i + 1, item })) },
        ],
    };
}

export function sitemap(data) {
    const dates = data.mods.flatMap(m => (m.releases || []).map(r => r.date)).sort();
    const lastmod = dates.length ? `<lastmod>${dates[dates.length - 1]}</lastmod>` : "";
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
        + `  <url><loc>${SITE_URL}</loc>${lastmod}</url>\n</urlset>\n`;
}

export function llmsTxt(data, stats) {
    const lines = ["# gfkm's Deadlock Mods", "",
        "> Fan-made UI mods for Valve's game Deadlock that keep the game's own look and add what the HUD leaves out. "
        + "Free downloads as .zip archives holding one pakNN_dir.vpk each.", "",
        "Install: unzip into Deadlock/game/citadel/addons; if another mod already uses that pak number, rename the file "
        + "to a free one.", "", "## Mods", ""];
    for (const mod of data.mods) {
        const r = mod.releases && mod.releases[0];
        const s = stats && stats.mods && stats.mods[mod.id];
        const count = s ? (s.github || 0) + (s.gamebanana ? s.gamebanana.count : 0) : null;
        const facts = [r ? `version ${r.version} (${r.date})` : null, count !== null ? `${count} downloads` : null]
            .filter(Boolean).join(", ");
        lines.push(`- [${mod.name}](${SITE_URL}#${mod.id}): ${mod.summary}${facts ? " " + facts.charAt(0).toUpperCase() + facts.slice(1) + "." : ""}`);
    }
    lines.push("", "## Links", "", `- [All releases](https://github.com/${data.repo}/releases)`, "",
        "Not affiliated with or endorsed by Valve.", "");
    return lines.join("\n");
}

// --- the page --------------------------------------------------------------------------------------------

export function prerender(html, data, stats) {
    const site = require(path.join(ROOT, "assets", "site.js"));
    const cards = toHtml(site.renderMods(data, serverDoc, stats));
    const start = "<!-- mods:start -->", end = "<!-- mods:end -->";
    const a = html.indexOf(start), b = html.indexOf(end);
    if (a < 0 || b < a) throw new Error("index.html has no <!-- mods:start --> ... <!-- mods:end --> block");
    let out = html.slice(0, a + start.length) + cards + html.slice(b);

    const total = site.totalDownloads(data, stats);
    if (total) {
        out = out.replace('<p id="total-downloads" class="total" hidden></p>',
            `<p id="total-downloads" class="total"><span class="count">${escText(total)}</span><span class="unit"> downloads</span></p>`);
    }
    const ld = JSON.stringify(jsonLd(data, stats)).replace(/</g, "\\u003c");
    if (!out.includes("</head>")) throw new Error("index.html has no </head>");
    return out.replace("</head>", `<script type="application/ld+json">${ld}</script>\n</head>`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const i = process.argv.indexOf("--site");
    const dir = path.resolve(i > 0 ? process.argv[i + 1] : ROOT);
    try {
        const data = JSON.parse(fs.readFileSync(path.join(dir, "data", "mods.json"), "utf8"));
        const statsPath = path.join(dir, "data", "stats.json");
        const stats = fs.existsSync(statsPath) ? JSON.parse(fs.readFileSync(statsPath, "utf8")) : null;
        const page = path.join(dir, "index.html");
        fs.writeFileSync(page, prerender(fs.readFileSync(page, "utf8"), data, stats));
        fs.writeFileSync(path.join(dir, "sitemap.xml"), sitemap(data));
        fs.writeFileSync(path.join(dir, "llms.txt"), llmsTxt(data, stats));
        console.log(`prerendered ${data.mods.length} mods into ${page}; wrote sitemap.xml and llms.txt`);
    } catch (e) {
        console.error("error: " + e.message);
        process.exit(2);
    }
}
