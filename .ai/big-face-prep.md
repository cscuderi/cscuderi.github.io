# Prep Document (Ralph Wiggum Loop) - Steamboat Willie "Big Face" Site

- Goal
  - Redesign to an extremely simple, mobile-first, static GitHub Pages site dominated by a Mario 64-style interactive "bubbly" face hero, with the existing "CIAO!" animation and the existing blurb beneath it.

- Hard Requirements
  - Same aesthetic as current site: old-film / Steamboat Willie vibes (monochrome, paper/ink, vignette).
  - Static hosting on GitHub Pages: no framework, no build pipeline, no CSS framework; modern CSS + modern JS only.
  - Hero fills viewport on load (100vw x 100svh).
  - Remove projects/work section completely.
  - Face is primary; must feel fluid/responsive, 60fps minimum.
  - Desktop: eyes follow cursor; mouth opens/closes; eyes blink; head subtly follows cursor.
  - Blink: both eyes blink together; independent of other animations (can blink while tracking).
  - Mobile: idle is subtle "autopilot cursor follow" on load; tap triggers ~3s wake to look at tap point then returns to idle.
  - "CIAO!" animates in below chin; include existing blurb text under "CIAO!".
  - Keep Hotjar + Google Analytics.

---

## 1) Content + Layout Spec

- Hero stage (first viewport)
  - Centered face canvas (Three.js) that scales responsively.
  - "CIAO!" directly under chin (visually attached; not separated by large whitespace).
  - Blurb under "CIAO!" (reuse the existing intro copy).
  - No extra UI except optional tiny "tap to wake" hint on mobile (visually subtle and only shown until first interaction).

- Below the fold
  - Minimal footer/contact strip only (email + social icons or a single contact line).
  - No projects, no modal system.

---

## 2) Visual Direction (Preserve Current Language)

- Palette
  - Keep the current "paper" background + "ink" foreground concept.
  - Add only very subtle grayscale shading in the face (low contrast; should still read as monochrome).

- Atmosphere
  - Keep vignette effect (current site uses an inset shadow overlay).
  - Keep a light "film" feel: gentle easing, not "techy" UI motion.

- Typography
  - Keep the current font pairing (Montserrat + EB Garamond) unless you explicitly want a change.

- CIAO animation
  - Preserve the existing timing/energy: drop/bobble in + later bounce/float.
  - CIAO assets can remain the existing SVG letters in `assets/images/`.

---

## 3) Technical Architecture (Static, No Build)

- Output structure (proposed)
  - `index.html` (root, no Jekyll layout)
  - `.nojekyll` (root)
  - `assets/styles/site.css` (hand-authored modern CSS)
  - `assets/scripts/site.js` (site bootstrap + CIAO + interaction state machine)
  - `assets/scripts/face.js` (Three.js face renderer + rig + animation loop)
  - `assets/face.svg` (your exported rigged SVG)
  - `assets/vendor/three/...` (vendored Three.js + SVGLoader module files)

- Three.js vendoring
  - Use ESM modules with `<script type="module">` (modern browsers only; allowed by constraints).
  - Vendor only what's needed:
    - `assets/vendor/three/build/three.module.js`
    - `assets/vendor/three/examples/jsm/loaders/SVGLoader.js`

- Debugging (devtools)
  - Toggle runtime debug overlay + helpers with `window.face.debug = true` (set to `false` to hide).
  - Debug mode shows a small on-page overlay with WebGL/renderer stats and enables a subtle canvas outline + a tiny debug cube.

---

## 4) Face SVG Rig Spec (Illustrator Export Checklist)

You will export a rig-friendly SVG with stable IDs and grouped parts. Recommended minimum IDs:

- `head` (all face skin + outline as needed)
- `eyeL`, `eyeR` (white/eye sockets)
- `pupilL`, `pupilR`
- `lidL`, `lidR` (upper lids or a lid group we can scale/slide for blink)
- `mouth` (single group that can open/close)
- Optional:
  - `browL`, `browR` (micro expression)
  - `nose`, `earL`, `earR` (if you want subtle parallax)
  - `highlight` / `shadow` groups (VERY subtle grayscale layers)

Export rules:

- Keep shapes as filled paths (no strokes if avoidable; strokes can triangulate oddly).
- Avoid masks/filters if possible; prefer explicit shapes for highlights/shadows.
- Ensure each animated part is its own top-level `<g id="...">` with clean transforms.
- Keep the SVG coordinate system stable (avoid nested transforms; flatten where possible).

---

## 5) Interaction + Animation Design (State Machine)

### States

- `idle_desktop` (desktop, no pointer move recently): gentle return to neutral, blink continues.
- `active_pointer` (desktop): head/eyes follow pointer; blink continues; mouth idles.
- `idle_mobile_autopilot` (mobile on load): virtual cursor drifts subtly; blink continues; mouth idles.
- `wake_tap` (mobile for ~3s): face "looks at" tap point; then blends back to autopilot.
- `reduced_motion` (prefers-reduced-motion): no continuous animation; render a still pose; no autopilot; no blink; CIAO shows without motion.

### Behaviors (independent channels)

- Blink channel (independent)
  - Timer with randomized interval (e.g. 2.5-6s).
  - Both lids animate together (close/open) regardless of pointer state.
  - Brief ease-in/out (not too snappy; old-cartoon timing).

- Eye follow
  - Pupils track target with clamp radius.
  - Apply smoothing (spring/lerp) to avoid jitter.

- Head follow
  - Slight rotation and translation toward target.
  - Clamp to subtle range to keep it classy and performant.

- Mouth
  - Slow idle open/close loop (breathing-like).
  - Optional: slightly more open on wake tap.

- Mobile autopilot
  - A slow Lissajous/noise drift defines a virtual pointer target.
  - Very low amplitude (the face should not look "searchy" on load).

- Wake tap (3s)
  - On tap: set target to tapped position; increase responsiveness briefly.
  - After 3s: blend back to autopilot target and normal responsiveness.

---

## 6) Rendering Approach (Bubbly Without SVG Path Morphing)

- Load `assets/face.svg` via `SVGLoader`.
- Convert paths to shapes, triangulate, render as meshes.
- "Bubbly" feel via:
  - Subtle lighting (ambient + soft directional).
  - Subtle per-vertex displacement or shading tricks kept extremely low (so it stays VERY subtle).
- Keep most motion as transforms (group/object transforms) rather than rebuilding geometry.

---

## 7) Performance Plan (60fps)

- Single `requestAnimationFrame` loop when active; paused/slept when not needed:
  - Desktop: run while page visible; can downshift if no pointer activity.
  - Mobile: idle autopilot can run at full fps (cheap) or optionally at a lower tick; wake tap runs full.
- Clamp pixel ratio (<= 2).
- No DOM measurements in the animation loop; compute pointer in normalized device coords once per event.
- Respect `document.visibilityState` to pause rendering when hidden.

---

## 8) Accessibility + UX

- `prefers-reduced-motion: reduce`
  - No continuous face animation (static pose).
  - CIAO appears without bobble/bounce (or a single minimal fade).
- Ensure tap target works everywhere on mobile (entire hero stage can be tappable).
- Provide basic semantic structure (hero heading/labeling) without cluttering visuals.

---

## 9) Tracking (Keep Both)

- Preserve:
  - Hotjar snippet (head).
  - Google Analytics snippet (end-of-body).

---

## 10) Acceptance Checklist (What We'll Verify)

- Hero fills first viewport on iOS/Android (using 100svh behavior).
- Desktop:
  - Eyes track smoothly; head follows subtly; mouth idles; blink happens periodically and synchronized.
- Mobile:
  - Subtle autopilot movement on load.
  - Tap triggers ~3s "look at tap" then returns to idle.
- CIAO:
  - Animates in under chin; blurb appears under CIAO.
- 60fps feel on modern devices; no obvious stutters.
- Static deployment works on GitHub Pages with `.nojekyll`.

---

## One Remaining Input (to avoid rework)

What exact footer/contact content should remain below the fold (pick one):

1) Email + 2-3 social icons
2) Single line: "Email me at ..."
3) Same contact section as today (trimmed), minus projects

Selected for phase 1: (1) Email + 2-3 social icons (implemented in `index.html`).

<promise>COMPLETE</promise>
