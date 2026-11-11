"use strict";
// Renders one card per mod from data/mods.json (same origin; no GitHub API calls).
// Text from the data is always set with textContent, never parsed as HTML.
// Also loaded by node for the tests (module.exports at the bottom).

(function () {
    var GITHUB = "https://github.com/";

    function latest(mod) {
        return mod.releases && mod.releases.length ? mod.releases[0] : null;
    }

    function downloadUrl(repo, mod) {
        var r = latest(mod);
        if (r) return GITHUB + repo + "/releases/download/" + r.tag + "/" + r.asset;
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
            shot.appendChild(make(doc, "span", "", "Screenshot coming"));
        }

        var body = art.appendChild(make(doc, "div", "body"));
        body.appendChild(make(doc, "h2", "name", mod.name));

        var r = latest(mod);
        var meta = r ? "v" + r.version + " · " + r.date
            : mod.hosted ? mod.hosted.label + " · " + mod.hosted.date : null;
        if (meta) body.appendChild(make(doc, "p", "meta", meta));
        body.appendChild(make(doc, "p", "summary", mod.summary));

        var actions = body.appendChild(make(doc, "div", "actions"));
        var dl = downloadUrl(repo, mod);
        if (dl) {
            var label = r ? "Download .vpk (" + formatSize(r.size) + ")" : "Download on GameBanana";
            actions.appendChild(link(doc, dl, "button download", label));
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

        if (mod.knownIssues && mod.knownIssues.length) {
            var issues = body.appendChild(make(doc, "div", "issues"));
            issues.appendChild(make(doc, "h3", "", "Known issues"));
            var ul = issues.appendChild(make(doc, "ul"));
            for (var i = 0; i < mod.knownIssues.length; i++) ul.appendChild(make(doc, "li", "", mod.knownIssues[i]));
        }

        var ai = body.appendChild(make(doc, "p", "disclosure"));
        ai.appendChild(make(doc, "strong", "", "AI disclosure. "));
        ai.appendChild(make(doc, "span", "", mod.disclosure));

        if (r) body.appendChild(make(doc, "p", "hash", "SHA-256 " + r.sha256));
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

    function boot() {
        var host = document.getElementById("mods");
        fetch("data/mods.json", { cache: "no-cache" })
            .then(function (res) {
                if (!res.ok) throw new Error("HTTP " + res.status);
                return res.json();
            })
            .then(function (data) {
                host.textContent = "";
                host.appendChild(renderMods(data, document));
            })
            .catch(function () {
                host.textContent = "";
                var p = host.appendChild(make(document, "p", "error", "The mod list did not load. Every release is on "));
                p.appendChild(link(document, GITHUB + "gfkm/deadlock-mods/releases", "textlink", "the Releases page"));
                p.appendChild(document.createTextNode("."));
            });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
})();
