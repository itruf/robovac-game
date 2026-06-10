# 🤖 RoboVac: Home Sweet Home

**▶︎ Play it now: <https://itruf.github.io/robovac-game/>**

A 3D browser game where you play a robot vacuum on a mission to keep a busy
household clean — while navigating around its cats, dogs and humans.

Built with [Three.js](https://threejs.org/) (loaded from CDN). No build step,
no dependencies to install.

## Run it

### As a Mac app (recommended)

```sh
./build-mac-app.sh
open dist/RoboVac.app
```

Builds a self-contained, fully offline `RoboVac.app` (~1 MB) — a native
Swift/WKWebView wrapper with the game and Three.js bundled inside, its own
icon, and an ad-hoc code signature. Universal binary (Apple Silicon + Intel,
macOS 12+). Double-click to play; `Cmd+Q` quits. Requires Xcode command-line
tools to *build* (not to run).

### Sharing with friends

```sh
./package-for-sharing.sh   # -> dist/RoboVac.zip
```

Send `dist/RoboVac.zip`. Because the app is ad-hoc signed (not notarized by
Apple — that requires a paid Developer ID), macOS Gatekeeper blocks it on
first launch on other Macs with *"RoboVac can't be opened"*. The zip includes
a `READ ME FIRST.txt` walking your friend through the one-time fix: open
**System Settings → Privacy & Security → "Open Anyway"** after the first
blocked attempt (or `xattr -cr RoboVac.app` in Terminal). To eliminate that
step entirely you'd need the Apple Developer Program ($99/yr): sign with a
Developer ID Application certificate and notarize with `notarytool`.

### In the browser

```sh
cd claude-3d-game
python3 -m http.server 8741
```

Then open <http://localhost:8741> (any static file server works, e.g.
`npx serve`). Three.js is vendored in `vendor/`, so this also works offline.

## How to play

| Key | Action |
| --- | --- |
| `W / S` or `↑ / ↓` | Drive forward / reverse |
| `A / D` or `← / →` | Turn |
| `Shift` | Boost (drains battery faster) |
| `E` | Interact — pet the cat/dog, greet humans (+5 pts) |
| `Space` | Beep the horn (scares pets away, stops a dog chase) |
| `P` | Pause |
| `R` | Restart |

### The household

- **🐱 The cat** flees if you charge at it — but approach *slowly* and it may
  hop on for a ride (you'll drive slower with a passenger).
- **🐶 The dog** periodically gets the zoomies and chases you, shoving you
  around and tracking mud. Beep the horn to call it off.
- **🧑 Gary & Maya** wander the house dropping crumbs. Get out of their way or
  they'll complain. If your battery dies, Gary carries you back to the dock
  (−50 pts).

### Resources

- **🔋 Battery** drains while driving (faster with boost). Recharge on the
  dock in the hallway.
- **🗑️ Dust bag** holds 25 pieces of dirt; it empties automatically at the
  dock. Dust = 10 pts, crumbs = 15 pts, mud = 25 pts.

### The story 💍

Something is going on in this house. Gary has been acting nervous, and while
cleaning under the sofa you discover why: a hidden velvet ring box. Gary is
secretly planning to propose to Maya — and you, a humble vacuum, just became
his wingbot. Smuggle the ring past Maya's curious eyes, survive the dog
ruining everything at the worst moment, and get the living room spotless for
the big night.

### Missions

1. **First Spin** — vacuum 10 dust bunnies
2. **Grand Tour** — visit all 5 rooms
3. **Something Sparkly** — investigate the glint under the sofa
4. **Crumb Crisis** — clean up after Gary's nervous snacking
5. **Make a Friend** — give the cat an 8-second ride
6. **Keep It Secret** — deliver the ring to Gary without Maya seeing it
   (she gets curious and follows you if you drive too close!)
7. **Muddy Paws** — clean the dog's mud trail before the big night
8. **Full Cycle** — deep clean: fill your bag to 20, then dock
9. **Operation Proposal** — make the living room spotless, then watch
   the proposal unfold 💖

Finish the story to unlock free roam and chase a high score.

### Dev tip

Append `?mission=N` to the URL to start at mission N (e.g.
`http://localhost:8741/?mission=6` to jump straight to the ring delivery).

## Files

- `index.html` — page, HUD and start screen
- `main.js` — the whole game: house, robot physics, NPC AI, missions, audio
- `vendor/three.module.min.js` — vendored Three.js r170
- `mac-app/` — native Mac wrapper: `main.swift` (WKWebView shell with a
  custom `robovac://` scheme handler), `Info.plist`, `makeicon.swift`
- `build-mac-app.sh` — one-command build of `dist/RoboVac.app`
