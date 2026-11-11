# Deadlock mods by gfkm

The showcase page and release channel for gfkm's Deadlock mods: **https://gfkm.github.io/deadlock-mods/**

Every download is a `.vpk` attached to a [release](https://github.com/gfkm/deadlock-mods/releases) tagged
`<mod>-v<version>`, with its release text, an AI disclosure and the file's SHA-256.

| Mod | What |
|---|---|
| BetterTopBar | the top bar in the game's own style, with the timers the game does not show |
| BetterMap | a points-of-interest overlay and customization layer for the minimap |
| BetterMap Camp Icons | new creep camp and Sinner's Sacrifice icons for the minimap (on GameBanana) |

**Install:** put the `.vpk` in `Deadlock/game/citadel/addons` as its own pak, with a `pakXX_dir.vpk` number no other
mod uses. A mod manager does this for you.

**AI:** these mods are built with AI tools; each card and release says how.

## This repository

| Path | What |
|---|---|
| `index.html`, `assets/` | the page (plain HTML/CSS/JS, no build step, no CDN) |
| `data/mods.json` | the single source of the page: mods, versions, links, disclosures |
| `images/`, `notes/` | screenshots; the release texts |
| `tools/stage_build.py` | stages a mod's code without comments for compiling a release |
| `tools/release.mjs` | checks a compiled `.vpk`, records it, prints the `gh release create` command |
| `docs/` | the brief and the design |

Tests: `node --test "tests/*.test.js"` and `python -m unittest discover -s tests`.

Fan-made mods, not affiliated with or endorsed by Valve.
