"use strict";
// Renders one card per mod from data/mods.json (same origin; no GitHub API calls).
// Text from the data is always set with textContent, never parsed as HTML.
// Also loaded by node for the tests (module.exports at the bottom).

(function () {
    var GITHUB = "https://github.com/";

    function latest(mod) {
        return mod.releases && mod.releases.length ? mod.releases[0] : null;
    }

    function assetUrl(repo, release, asset) {
        return GITHUB + repo + "/releases/download/" + release.tag + "/" + asset.file;
    }

    // The first file of the newest release, else the mod's external download page, else none.
    function downloadUrl(repo, mod) {
        var r = latest(mod);
        if (r) return assetUrl(repo, r, r.assets[0]);
        return (mod.links && mod.links.download) || null;
    }

    function changelogUrl(repo, mod) {
        var r = latest(mod);
        return r ? GITHUB + repo + "/releases/tag/" + r.tag : null;
    }

    function formatSize(bytes) {
        if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + " MB";
        return Math.max(1, Math.round(bytes / 1024)) + " KB";
    }

    function make(doc, tag, cls, txt) {
        var e = doc.createElement(tag);
        if (cls) e.className = cls;
        if (txt !== undefined) e.textContent = txt;
        return e;
    }

    function link(doc, href, cls, txt) {
        var a = make(doc, "a", cls, txt);
        a.setAttribute("href", href);
        if (/^https:/.test(href)) a.setAttribute("rel", "noopener");
        return a;
    }

    function card(doc, repo, mod) {
        var art = make(doc, "article", "card");
        art.setAttribute("id", mod.id);

        var shot = art.appendChild(make(doc, "div", "shot"));
        if (mod.image) {
            var img = shot.appendChild(doc.createElement("img"));
            img.setAttribute("src", mod.image);
            img.setAttribute("alt", mod.imageAlt || mod.name);
            img.setAttribute("loading", "lazy");
            img.setAttribute("width", "960");
            img.setAttribute("height", "540");
        } else {
            shot.className = "shot shot-empty";
            shot.appendChild(make(doc, "span", "shot-title", mod.name));
            shot.appendChild(make(doc, "span", "shot-note", "Screenshot coming"));
        }

        var body = art.appendChild(make(doc, "div", "body"));
        body.appendChild(make(doc, "h3", "name speckle", mod.name));

        var r = latest(mod);
        var meta = r ? "v" + r.version + " · " + r.date
            : mod.hosted ? mod.hosted.label + " · " + mod.hosted.date : null;
        if (meta) body.appendChild(make(doc, "p", "meta", meta));
        body.appendChild(make(doc, "p", "summary", mod.summary));

        var actions = body.appendChild(make(doc, "div", "actions"));
        var dl = downloadUrl(repo, mod);
        if (r) {
            // Laid out like the main menu's PLAY entry: the big label, and under it a small line where the
            // menu shows the queue count (here the variant, file type and size).
            for (var k = 0; k < r.assets.length; k++) {
                var a = r.assets[k];
                var kind = /\.zip$/.test(a.file) ? ".zip" : ".vpk";
                var size = formatSize(a.size);
                var btn = actions.appendChild(link(doc, assetUrl(repo, r, a), "button download"));
                btn.setAttribute("aria-label", "Download " + (a.label ? a.label + " " : "") + kind + " (" + size + ")");
                btn.appendChild(make(doc, "span", "menuButtonLabel", "Download"));
                btn.appendChild(make(doc, "span", "queueNumber", (a.label ? a.label + " · " : "") + kind + " · " + size));
            }
        } else if (dl) {
            var gb = actions.appendChild(link(doc, dl, "button download"));
            gb.appendChild(make(doc, "span", "menuButtonLabel", "Download"));
            gb.appendChild(make(doc, "span", "queueNumber", "on GameBanana"));
        } else {
            actions.appendChild(make(doc, "span", "pending", "Not released yet"));
        }
        var log = changelogUrl(repo, mod);
        if (log) actions.appendChild(link(doc, log, "textlink", "Changelog"));
        var links = mod.links || {};
        if (links.gamebanana && links.gamebanana !== dl) {
            actions.appendChild(link(doc, links.gamebanana, "textlink", "GameBanana"));
        }
        if (links.source) actions.appendChild(link(doc, links.source, "textlink", "Source"));
        if (links.discord) actions.appendChild(link(doc, links.discord, "textlink", "Discord"));

        // Each archive holds one pakNN_dir.vpk; files that share a name share one line.
        if (r) {
            var paks = [];
            for (var p = 0; p < r.assets.length; p++) {
                if (r.assets[p].pak && paks.indexOf(r.assets[p].pak) < 0) paks.push(r.assets[p].pak);
            }
            if (paks.length) {
                var pak = body.appendChild(make(doc, "p", "pak", "Unzip into Deadlock/game/citadel/addons: "));
                pak.appendChild(make(doc, "code", "", paks.join(", ")));
                pak.appendChild(make(doc, "span", "", ". If another mod already uses that number, rename it to a free one."));
            }
        }

        if (mod.knownIssues && mod.knownIssues.length) {
            var issues = body.appendChild(make(doc, "div", "issues"));
            issues.appendChild(make(doc, "h4", "", "Known issues"));
            var ul = issues.appendChild(make(doc, "ul"));
            for (var i = 0; i < mod.knownIssues.length; i++) ul.appendChild(make(doc, "li", "", mod.knownIssues[i]));
        }

        // The per-mod AI text stays in the data and the release notes; the page carries one line in the
        // footer (docs/specs/2026-11-11-showcase-design.md §8). Checksums fold away under one summary.
        if (r) {
            var sums = body.appendChild(make(doc, "details", "hashes"));
            sums.appendChild(make(doc, "summary", "", "SHA-256"));
            for (var h = 0; h < r.assets.length; h++) {
                var f = r.assets[h];
                sums.appendChild(make(doc, "p", "hash", (f.label ? f.label + " " : "") + f.sha256));
            }
        }
        return art;
    }

    function renderMods(data, doc) {
        var list = make(doc, "div", "cards");
        for (var i = 0; i < data.mods.length; i++) list.appendChild(card(doc, data.repo, data.mods[i]));
        return list;
    }

    if (typeof module !== "undefined" && module.exports) {
        module.exports = { renderMods: renderMods, downloadUrl: downloadUrl, changelogUrl: changelogUrl };
        return;
    }

    // The section keeps its heading; only the loading line is replaced.
    function boot() {
        var host = document.getElementById("mods");
        var loading = host.querySelector(".loading");
        function clear() { if (loading && loading.parentNode) loading.parentNode.removeChild(loading); }
        fetch("data/mods.json", { cache: "no-cache" })
            .then(function (res) {
                if (!res.ok) throw new Error("HTTP " + res.status);
                return res.json();
            })
            .then(function (data) {
                clear();
                host.appendChild(renderMods(data, document));
            })
            .catch(function () {
                clear();
                var p = host.appendChild(make(document, "p", "error", "The mod list did not load. Every release is on "));
                p.appendChild(link(document, GITHUB + "gfkm/deadlock-mods/releases", "textlink", "the Releases page"));
                p.appendChild(document.createTextNode("."));
            });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
})();
