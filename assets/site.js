"use strict";
// Renders one card per mod from data/mods.json, with download counts from data/stats.json when present
// (both same origin; the counts are collected by tools/stats.mjs in the Pages workflow, not here).
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

    // Counts: exact below 10,000, then whole thousands ("27K"); "+" when a part is a recorded figure, not live.
    function formatCount(n, approx) {
        var s = n >= 10000 ? Math.floor(n / 1000) + "K" : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return s + (approx ? "+" : "");
    }

    function downloads(stats, id) {
        var s = stats && stats.mods && stats.mods[id];
        if (!s) return null;
        var gb = s.gamebanana;
        return { github: s.github || 0, gamebanana: gb ? gb.count : 0, recorded: !!(gb && gb.source === "recorded"),
                 asOf: gb && gb.asOf, total: (s.github || 0) + (gb ? gb.count : 0), hasGamebanana: !!gb };
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

    // The hero-select PLAY button (#ConfirmButton): the green flame video behind, the box, and the label as one
    // element per letter (Valve's SplitLabel), each drawn from the oracle outline masks. The flame only plays
    // while the pointer or focus is on the button. A small caption carries the variant, type and size.
    var FLAME = "assets/game/play_btn_grn_flame.webm";

    function playButton(doc, parent, href, caption) {
        var btn = parent.appendChild(link(doc, href, "button download"));
        var box = btn.appendChild(make(doc, "span", "buttonContent"));
        var fx = box.appendChild(doc.createElement("video"));
        fx.className = "btn_fx";
        fx.setAttribute("src", FLAME);
        fx.setAttribute("muted", "");
        fx.setAttribute("loop", "");
        fx.setAttribute("playsinline", "");
        fx.setAttribute("preload", "none");
        fx.setAttribute("aria-hidden", "true");
        var label = box.appendChild(make(doc, "span", "SplitLabel"));
        var word = "Download";
        for (var i = 0; i < word.length; i++) {
            label.appendChild(make(doc, "span", "glyph g-" + word.charAt(i).toUpperCase(), word.charAt(i)));
        }
        btn.appendChild(make(doc, "span", "caption", caption));
        if (btn.addEventListener) {
            var start = function () { fx.muted = true; var p = fx.play(); if (p && p.catch) p.catch(function () {}); };
            var stop = function () { fx.pause(); };
            btn.addEventListener("mouseenter", start);
            btn.addEventListener("focus", start);
            btn.addEventListener("mouseleave", stop);
            btn.addEventListener("blur", stop);
        }
        return btn;
    }

    function card(doc, repo, mod, stats) {
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

        var d = downloads(stats, mod.id);
        if (d) {
            var line = body.appendChild(make(doc, "p", "downloads"));
            line.appendChild(make(doc, "span", "count", formatCount(d.total, d.recorded)));
            line.appendChild(make(doc, "span", "unit", d.total === 1 ? " download" : " downloads"));
            if (d.hasGamebanana) {
                body.appendChild(make(doc, "p", "sources", formatCount(d.gamebanana, d.recorded) + " on GameBanana"
                    + (d.recorded && d.asOf ? " (as of " + d.asOf + ")" : "") + " · " + formatCount(d.github) + " here"));
            }
        }
        body.appendChild(make(doc, "p", "summary", mod.summary));

        var actions = body.appendChild(make(doc, "div", "actions"));
        var dl = downloadUrl(repo, mod);
        if (r) {
            for (var k = 0; k < r.assets.length; k++) {
                var a = r.assets[k];
                var kind = /\.zip$/.test(a.file) ? ".zip" : ".vpk";
                var size = formatSize(a.size);
                var btn = playButton(doc, actions, assetUrl(repo, r, a), (a.label ? a.label + " · " : "") + kind + " · " + size);
                btn.setAttribute("aria-label", "Download " + (a.label ? a.label + " " : "") + kind + " (" + size + ")");
            }
        } else if (dl) {
            playButton(doc, actions, dl, "on GameBanana").setAttribute("aria-label", "Download on GameBanana");
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

    function renderMods(data, doc, stats) {
        var list = make(doc, "div", "cards");
        for (var i = 0; i < data.mods.length; i++) list.appendChild(card(doc, data.repo, data.mods[i], stats));
        return list;
    }

    // The header total: every mod's downloads, GitHub and GameBanana together.
    function totalDownloads(data, stats) {
        var sum = 0, approx = false, any = false;
        for (var i = 0; i < data.mods.length; i++) {
            var d = downloads(stats, data.mods[i].id);
            if (!d) continue;
            any = true;
            sum += d.total;
            approx = approx || d.recorded;
        }
        return any ? formatCount(sum, approx) : null;
    }

    if (typeof module !== "undefined" && module.exports) {
        module.exports = { renderMods: renderMods, downloadUrl: downloadUrl, changelogUrl: changelogUrl,
                           formatCount: formatCount, totalDownloads: totalDownloads };
        return;
    }

    // The section keeps its heading; only the loading line is replaced.
    function boot() {
        var host = document.getElementById("mods");
        var loading = host.querySelector(".loading");
        function clear() { if (loading && loading.parentNode) loading.parentNode.removeChild(loading); }
        function json(url) {
            return fetch(url, { cache: "no-cache" }).then(function (res) {
                if (!res.ok) throw new Error("HTTP " + res.status);
                return res.json();
            });
        }
        // The counts are optional: without them the cards render as before.
        var stats = json("data/stats.json").catch(function () { return null; });
        json("data/mods.json")
            .then(function (data) {
                return stats.then(function (s) { return [data, s]; });
            })
            .then(function (both) {
                clear();
                host.appendChild(renderMods(both[0], document, both[1]));
                var total = totalDownloads(both[0], both[1]);
                var slot = document.getElementById("total-downloads");
                if (total && slot) {
                    slot.textContent = "";
                    slot.appendChild(make(document, "span", "count", total));
                    slot.appendChild(make(document, "span", "unit", " downloads"));
                    slot.hidden = false;
                }
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
