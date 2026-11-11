#!/usr/bin/env node
// Collect download counts for the page and write data/stats.json. Runs in the Pages workflow before every
// deploy (and on a schedule), never in the visitor's browser: the page only reads its own JSON.
//
//   GitHub      the releases of data/mods.json's repo; each mod's count is the sum over its <id>-v* tags.
//   GameBanana  apiv11 Mod/<id>/ProfilePage, _nDownloadCount, for mods with stats.gamebanana. While a page is
//               withheld the API returns no count; the mod's stats.recordedGamebananaDownloads stands in and
//               is marked "recorded" so the page can say so.
//
// Any failed request fails the run: the deploy stops and the last published numbers stay up.
// Usage: node tools/stats.mjs [--out data/stats.json]     (GITHUB_TOKEN is used when set)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const AGENT = "deadlock-mods-stats";

async function getJson(fetch, url, headers) {
    const res = await fetch(url, { headers: Object.assign({ "User-Agent": AGENT, Accept: "application/json" }, headers) });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return res.json();
}

async function githubReleases(fetch, repo, token) {
    const headers = { Accept: "application/vnd.github+json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const all = [];
    for (let page = 1; page <= 10; page++) {
        const batch = await getJson(fetch, `https://api.github.com/repos/${repo}/releases?per_page=100&page=${page}`, headers);
        if (!Array.isArray(batch)) throw new Error("GitHub releases: not a list");
        all.push(...batch);
        if (batch.length < 100) break;
    }
    return all;
}

async function gamebanana(fetch, id, recorded) {
    const j = await getJson(fetch, `https://gamebanana.com/apiv11/Mod/${id}/ProfilePage`);
    if (!j._bIsWithheld && Number.isInteger(j._nDownloadCount)) return { count: j._nDownloadCount, source: "live" };
    if (j._bIsWithheld && recorded) return { count: recorded.count, source: "recorded", asOf: recorded.asOf };
    throw new Error(`GameBanana ${id}: no download count (withheld: ${!!j._bIsWithheld})`);
}

export async function collectStats(data, { fetch = globalThis.fetch, now = new Date(), token } = {}) {
    const releases = await githubReleases(fetch, data.repo, token);
    const mods = {};
    for (const mod of data.mods) {
        const tag = new RegExp(`^${mod.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-v\\d`);
        const github = releases.filter(r => tag.test(r.tag_name))
            .reduce((n, r) => n + (r.assets || []).reduce((m, a) => m + (a.download_count || 0), 0), 0);
        const gb = mod.stats && mod.stats.gamebanana;
        mods[mod.id] = { github, gamebanana: gb ? await gamebanana(fetch, gb, mod.stats.recordedGamebananaDownloads) : null };
    }
    return { updated: now.toISOString(), mods };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const i = process.argv.indexOf("--out");
    const out = path.resolve(i > 0 ? process.argv[i + 1] : path.join(ROOT, "data", "stats.json"));
    try {
        const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "mods.json"), "utf8"));
        const stats = await collectStats(data, { token: process.env.GITHUB_TOKEN });
        fs.writeFileSync(out, JSON.stringify(stats, null, 2) + "\n");
        for (const [id, s] of Object.entries(stats.mods)) {
            console.log(`${id}: GitHub ${s.github}` + (s.gamebanana ? `, GameBanana ${s.gamebanana.count} (${s.gamebanana.source})` : ""));
        }
    } catch (e) {
        console.error("error: " + e.message);
        process.exit(2);
    }
}
