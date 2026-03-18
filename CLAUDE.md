# Mathelab – CLAUDE.md

## Projekt
Vanilla TypeScript + Vite, kein Framework, kein Tailwind. Canvas-intensive Lern-App.
**Primärer Einsatz:** Lehrer-Präsentationstool auf Smartboards (kein Selbstlern-Tool).
**Architektur V2:** Constraint-basiertes Canvas-Layout-System (measure→layout→draw), Scene Graph, `defineModule()` DSL, Overlay-Navigation, Lehrer-Steuerleiste.

---

## Prävention: Design-Token-Layer (keine Magic Numbers)

**Pflicht:** Alle Werte aus den zentralen Quellen – nie erfinden.

| Was | CSS | TypeScript |
|---|---|---|
| Farben | `var(--accent)`, `var(--ok)`, `var(--ok-hover)`, `var(--warn)`, `var(--warn-hover)`, `var(--bad)`, `var(--bad-hover)`, `var(--text)`, `var(--panel)`, … | `getPalette().*` aus `src/core/design.ts` |
| Abstände | `var(--space-xs/sm/md/lg/xl/xxl)` | `SPACING.*` |
| Typografie | `var(--font-body/small/micro/lead/panel-title)` | `TYPOGRAPHY.*` |
| Radius | `var(--radius-sm/md/lg/pill)` | `RADIUS.*` |
| Animation | `var(--duration-fast/medium/slow)`, `var(--ease-default)` | `ANIMATION.*` |

Token-Dateien: `src/styles/tokens.css` und `src/core/design.ts`

---

## Prävention: Layout-Regeln

- **V2 Layout:** Einspaltiges Vollbreite-Layout — **kein linkes Sidebar-Panel**. Canvas nimmt volle Breite ein.
- **Topbar:** Logo/Titel "🔢 Mathewerkstatt" (Home-Button) + klickbares Modul-Label mit Chevron → Overlay-Navigation
- **Lehrer-Steuerleiste:** Feste 56px Höhe unterhalb Canvas, immer sichtbar (💡 Hinweis, 📖 Lösung, → Nächste, 🔄 Reset)
- **Flex für 1D (innerhalb Komponenten):** Buttons, Action-Bars, Nav-Items — immer `min-width: 0` auf Flex-Items
- **Container Queries** für `.module-area`, `.control-bar`, Canvas-Container. Media Queries nur für globale Breakpoints.
- Neue Module: `defineModule()` DSL verwenden — **keine direkten Canvas-Primitives**

### 6-Stufen Breakpoint-System (E10)
| Breakpoint | Stufe | Geräte |
|---|---|---|
| `< 768px` | **compact** | iPhone Portrait (375×812), Android Phone |
| `768–1099px` | **tablet** | iPad, kleine Laptops |
| `1100–1399px` | **desktop** | Laptop, Chromebook |
| `1400–2199px` | **wide** | FHD-Monitor |
| `2200–3399px` | **board** | Smartboard (4K) |
| `≥ 3400px` | **massive** | Große Smartboards |

**iPhone Portrait (375×812 CSS-px) ist offizielle Zielplattform.**
- Numpad als kompakter 2-Zeilen-Streifen (6 Spalten: `grid-template-columns: repeat(6, 1fr)`) zwischen Canvas und Control-Bar
- `v2-middle` wechselt auf `flex-direction: column` bei `< 768px`
- Schriftgrößen durch volle Canvas-Breite automatisch korrekt skaliert (`resolveCanvasFonts(canvasWidth)`)
- Viewport-Test in `src/tests/e2e-suite.ts` Suite 5 enthalten (375×812)

### Z-Index-System
| Schicht | Wert | Verwendung |
|---|---|---|
| canvas-overlay | 8 | Status/Session-Overlays über Canvas |
| control-bar | 56 | Lehrer-Steuerleiste |
| nav-backdrop | 40 | Dimmer hinter Overlay |
| nav | 50 | Overlay-Navigation |
| topbar | 100 | App-Topbar |
| toast | 120 | Undo-/Feedback-Toasts |
| modal | 1000 | Modal-Overlays |

Neuer z-index? → Tabelle erweitern + Kommentar im CSS.

---

## Prävention: Canvas-Regeln (Pflicht-Boilerplate)

```ts
// DPI-Handling (immer!)
const dpr = window.devicePixelRatio || 1;
canvas.width  = Math.round(rect.width  * dpr);
canvas.height = Math.round(rect.height * dpr);
ctx.scale(dpr, dpr);

// State-Isolation
ctx.save();
/* ...transform/clip-Operationen... */
ctx.restore();

// Animation Loop
requestAnimationFrame(loop);           // NIE setInterval
ctx.clearRect(0, 0, w, h);            // am Frame-Anfang
```

- Canvas-Schriftgrößen → `resolveCanvasFonts(canvas.width / dpr)` aus `design.ts`
- Canvas-Farben → `getPalette().*` aus `design.ts`
- Canvas-Abstände → `resolveCanvasSpacing(canvas.width / dpr)` aus `design.ts`

---

## Prävention: Canvas-Architektur-Regeln (V2)

- **Scene Graph:** Kein freies `ctx.fillText` / `ctx.fillRect` in Modulen — immer Node-Typen aus `src/canvas/nodes/` (`TextNode`, `ButtonNode`, `PanelNode`, `ShapeNode`, `CustomDrawNode`)
- **Layout-System:** Koordinaten nie frei berechnen — immer Container-Nodes: `vstack()`, `hstack()`, `zstack()`, `grid()`, `spacer()` aus `src/canvas/nodes/container.ts`
- **HitArea-Registrierung:** Automatisch via Scene Graph aus `ButtonNode.toHitArea()` — **kein manuelles `this.hitAreas.push()`**
- **Mindest-Touch-Target:** 44×44 CSS-Pixel (erzwungen von `ButtonNode`, geprüft von Debug-System)
- **DPI-Handling:** `CanvasScene` (`src/canvas/scene.ts`) übernimmt Layout in CSS-px, zeichnet mit `ctx.scale(dpr, dpr)`
- **Reduced Motion:** `prefersReducedMotion()` aus `scene.ts` — alle Animationen müssen diesen Guard verwenden
- **V1 entfernt:** `BaseModule`, `primitives.ts`, `layout.ts`, `numpad.ts` und alle V1-`index.ts`-Module wurden entfernt. Alle Module nutzen `defineModule()` + Scene Graph.

---

## Prävention: Verbotene Patterns

- Hardcodierte Hex-Farben oder px-Werte außerhalb von `tokens.css` / `design.ts`
- `position: absolute` als Layout-Werkzeug (nur für echte Overlays über `position: relative`-Container)
- `z-index` ohne Kommentar und ohne Eintrag in der Z-Index-Tabelle
- `setInterval` für Animationen (→ `requestAnimationFrame`)
- Neue CSS-Klassen, die vorhandene Komponenten-Klassen duplizieren
- Neue CSS-Farbregeln ohne `body.light-mode`-Override (jede Farbe die nicht `var(--token)` nutzt, muss überschrieben werden)
- Animationen ohne `@media (prefers-reduced-motion: reduce)` Guard

---

## Detektion: Verifikations-Protokoll

Nach jeder UI-Änderung:
1. `preview_screenshot` bei 1024px und 1440px
2. Canvas-Module: `window.__mathelaborDebug?.violations` via `preview_eval` prüfen
3. Light Mode: `preview_eval('document.body.classList.toggle("light-mode")')` + Screenshot
4. Fehler debuggen mit Chain-of-Thought: ① Beteiligte Elemente identifizieren → ② Aktuelles Layout-Modell bestimmen → ③ Konflikt-Properties prüfen → ④ Fehlerursache isolieren → ⑤ Minimale Änderung → ⑥ Warum sie nichts anderes bricht
5. Fehler als strukturiertes Feedback formulieren:

```xml
<ui_error>
  <component>Komponentenname</component>
  <viewport>1024px</viewport>
  <expected>Erwartetes Verhalten</expected>
  <actual>Tatsächliches Verhalten</actual>
  <suggested_fix>Minimale Änderung (1 Property bevorzugt)</suggested_fix>
</ui_error>
```

---

## Korrektur: Iterative Fixes

- Max. **5 Runden**, Abbruch bei 0 Findings
- **Minimale Änderung** bevorzugen — 1 Property statt Refactor
- Nach jedem Fix: Screenshot + `window.__mathelaborDebug` prüfen
- Gefundene Bugs als Regressions-Kommentar im Code dokumentieren

---

## UX: Zielgruppe & Grundprinzipien

Zielgruppe: Kinder Klasse 3–4 (8–10 Jahre), Piaget konkret-operational.
Plattformen: Desktop/Browser **und** Tablet (Touch) — Tablet-First.

- Arbeitsgedächtnis ≤5 Items → max 4–5 sichtbare Auswahloptionen gleichzeitig
- Aufmerksamkeitsspanne 10–15 min pro Aufgabe
- Kein reines Schwarz (`#000000`) → `#1E293B` / `var(--text)` verwenden
- Sofortiges visuelles **und** akustisches Feedback nach jeder bedeutsamen Aktion
- Skeuomorphe, konkrete Icons statt abstrakter Metaphern (Hamburger-Menü verboten)
- Fehler = Lernmoment — kein rotes X, kein Buzzer, kein „Falsch!"

---

## UX: Typografie (MUST)

- Schriftfamilie: `'Atkinson Hyperlegible', system-ui, -apple-system, sans-serif`
- **Font-Embedding (E1):** Atkinson Hyperlegible (400+700, Latin+Extended) ist als Base64 WOFF2 in `src/styles/fonts.css` eingebettet — kein CDN nötig
- Mindest-Schriftgröße Fließtext: **18px** (empfohlen: 20px) → `var(--font-body)`
- Zeilenabstand Fließtext: **1.5–1.7** (mindestens 1.5)
- Zeilenabstand Überschriften: 1.2–1.3
- Textausrichtung: **Linksbündig** — KEIN Blocksatz
- Maximale Zeilenlänge: 50–65 Zeichen
- Schriftgewicht Fließtext: 400–500 | Überschriften: 600–700
- **Kein Versaltext** (All-Caps) für lesbare Inhalte
- **Keine Kursivschrift** für Fließtext (stark negativer Effekt bei Legasthenie)
- Leicht erhöhter Buchstabenabstand: 0.01–0.02em (SHOULD)
- H1: 32–36px | H2: 26–28px | H3: 22–24px (SHOULD)

### Legasthenie-Unterstützung (MUST, E18)
- Text-to-Speech für alle Textinhalte integrieren
- Einstellungen im **Modul-Overlay** (unterer Bereich): Schriftgröße, Zeilenabstand, Hintergrundfarbe
- Wortabstand skaliert automatisch mit Schriftgröße (kein separater Regler)
- Optionale Hintergrundfarbe (Creme/Pastell statt reinem Weiß)

---

## UX: Touch-Targets & Interaktion (MUST)

- Minimum für **alle** interaktiven Elemente: **48×48 CSS-px**
- Primäre Aktionen: **56–64 CSS-px** empfohlen
- Mindestabstand zwischen interaktiven Elementen: **12px** (empfohlen: 16–24px)
- Mindestabstand zwischen **gegensätzlichen** Aktionen: **≥64px**
- Primäre CTA-Buttons: `min-height: 56px`, `min-width: 160px`, mobile full-width
- Hit-Areas über sichtbare Widget-Grenzen hinaus erweitern
- Nur zuverlässige Gesten als primäre Interaktion: Tap, Swipe, kurzes Drag
- **Keine** kritischen Funktionen hinter Long-Press, Pinch oder Rotation
- Palm Rejection auf Tablet implementieren
- Auto-Save alle 30 Sekunden oder nach jeder bedeutsamen Aktion
- Bei destruktiven Aktionen: Undo-Toast statt Bestätigungsdialog

---

## UX: Navigation & Informationsarchitektur (MUST, E16, E20)

- Maximale Navigationstiefe: **2 Ebenen** (Startseite → Modul)
- **Kein Hamburger-Menü** — Navigation über Overlay-Modal (`role="dialog"`, `aria-modal="true"`, ESC schließt)
- **Topbar:** "🔢 Mathewerkstatt" (Home-Button, min 48×48px, Alt+0) + "✖️ Einmaleins ▾" (Modul-Label, öffnet Overlay)
- **Lehrer-Steuerleiste** (E16): Feste 56px unter Canvas, Buttons: 💡 Hinweis, 📖 Lösung, → Nächste, 🔄 Reset
- **Aufgabentyp-Chips:** DOM-Bar 36px über Canvas, horizontal scrollbar, aktiver Typ mit `--accent`
- **Kein Auto-Advance** — Lehrkraft steuert immer manuell (Unified Click-Flow)
- **Keyboard-Shortcuts:** Space=Nächste, H=Hinweis, L=Lösung, E=Erklärung, 1-9=Antwort, Alt+1-9=Modul
- **URL-Hash-Routing:** `#/multiplication/core?d=2` → Direkteinstieg
- Paginierte Navigation bevorzugen statt langes vertikales Scrollen (SHOULD)

---

## UX: Farben & Kontrast (MUST)

- Kontrastverhältnis Text auf Hintergrund: **≥4.5:1** (Ziel: ≥5:1)
- Kontrastverhältnis große Schrift (≥18px bold / ≥24px): ≥3:1
- **Niemals Farbe als einziges Informationsmittel** — immer + Icon/Text/Muster
- Kein Rot+Grün als alleiniges Unterscheidungsmerkmal

Empfohlene semantische Farb-Tokens (SHOULD):

| Rolle | Hex | Token |
|---|---|---|
| Primär-Blau | `#1982C4` | `var(--accent)` |
| Erfolgs-Grün | `#8AC926` | `var(--ok)` |
| Warn-Orange | `#FF9F1C` | `var(--warn)` |
| Fehler-Koralle | `#FF595E` | `var(--bad)` |
| Hintergrund | `#F8F9FC` | `var(--panel)` |
| Text-Primär | `#1E293B` | `var(--text)` |

- Erfolgs-UI: Grün + Häkchen-Icon + fröhlicher Sound
- Fehler-UI: Orange/Koralle + Fragezeichen-Icon + sanfter Sound

---

## UX: Spacing & Layout (MUST)

- 8px-Grundraster (4px Halbschritte für Feinanpassungen) → `var(--space-*)`
- Button-Innenabstand: ≥12px vertikal, ≥24px horizontal
- Karten-Innenabstand: ≥16px (empfohlen: 20–24px)
- Seitenrand Mobile: ≥16px | Tablet: 24–32px
- Mindestabstand zwischen Hauptsektionen: 32px
- Bottom-Padding: ≥48px (Inhalte nicht hinter Bottom-Nav verstecken)
- `safe-area-inset-bottom` für iOS beachten
- Content-zu-Whitespace: ~60:40 — mehr Whitespace als Erwachsenen-UI (SHOULD)

---

## UX: Border-Radius & Schatten (MUST)

- **Mindest-Radius für jedes sichtbare Element: 8px** → `var(--radius-sm)`
- Scharfe Ecken (0px) sind **verboten** für Kinder-UI
- Verschachtelungsregel: `inner_radius = outer_radius - padding`
- Karten: 16px | Buttons: 12–16px | Eingabefelder: 12px | Modals: 20–24px (SHOULD)
- Weiche Schatten: `0 2px 8px rgba(0,0,0,0.08)` | Hover: `0 8px 24px rgba(0,0,0,0.12)` (SHOULD)

---

## UX: Animationen (MUST)

- Micro-Interactions (Button-Press, Toggle): 100–200ms → `var(--duration-fast)`
- State-Transitions (Card-Flip, Panel-Expand): 200–400ms → `var(--duration-medium)`
- Seiten-/View-Transitions: 300–500ms → `var(--duration-slow)`
- NUR `transform` und `opacity` animieren (composite-only)
- Animationen müssen unterbrechbar sein — nie UI blockieren
- Kein Blinken >3× pro Sekunde (WCAG 2.3.1)
- **`prefers-reduced-motion: reduce` MUSS unterstützt werden** → Opacity-Fade (150ms ease)
- Scale-Feedback: 0.95 on `:active`, 1.05 on `:hover` (80ms) (SHOULD)
- Belohnungs-Animationen: 500–1200ms, dürfen Interaktion NICHT blockieren (SHOULD)

```css
/* Pflicht-Pattern für jede Animation */
.element {
  transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
}
@media (prefers-reduced-motion: reduce) {
  .element {
    transition: opacity 150ms ease;
    transform: none !important;
  }
}
```

---

## UX: Responsive Design (MUST)

- Primärer Breakpoint: **Tablet-Portrait 768px** (iPad)
- 6-Stufen-System: compact / tablet / desktop / wide / board / massive (siehe Layout-Regeln)
- Smartboard-Erkennung: `≥2200px` oder Fullscreen → board-Modus
- Testen auf: **iPhone Portrait (375×812)**, iPad (810×1080 CSS), Chromebook (1366×768)
- On-Screen-Keyboard (E19): Visual Viewport API nutzen, `body.keyboard-open .control-bar { display: none }`
- Canvas-basierte Eingabe bevorzugen (`input: "numberPad"` in DSL)
- Touch-Targets auf Tablet **größer** als auf Desktop
- Hover-States **niemals** als einziger Interaktionspfad (Touch-Fallback nötig)
- Schriftgrößen-Skalierung: +2px pro Major-Breakpoint (SHOULD)

### Querformat-Optimierung (Tablet Landscape) (MUST)
- **Tablet-Landscape** (1024×768 CSS) ist ein Hauptanwendungsfall — Layout muss hier optimal funktionieren
- `orientation: landscape` Media Query nutzen, um Canvas-Höhe und Steuerleisten-Anordnung anzupassen
- **Canvas im Landscape:** Maximale Höhe ausnutzen — `height: calc(100dvh - topbar - chips - controlbar)` statt fester Werte
- **Steuerleiste im Landscape:** Darf bei wenig vertikalem Platz kompakter werden (44px statt 56px)
- **Tutorial-Overlay im Landscape:** Card horizontal layouten — Canvas links, Text rechts (`flex-direction: row` ab Landscape)
- **Numpad im Landscape:** Kompaktere Anordnung, damit Canvas-Bereich nicht zu stark schrumpft
- **Kein vertikales Scrollen** im Landscape erzwingen — alle Inhalte müssen im Viewport sichtbar sein
- `dvh`/`svh` statt `vh` verwenden (iOS Safari Adressleiste)
- Testen auf: iPad Landscape (1080×810 CSS), Chromebook (1366×768)

---

## UX: Motivation & Fehler-Feedback (MUST)

- Feedback nach **jeder** bedeutsamen Aktion (visuell + akustisch)
- Fehler sanft darstellen — kein rotes X, kein Buzzer, kein „Falsch!"
- Ermutigendes Fehler-Feedback: „Fast!", „Probier nochmal!", „Du lernst!"
- **Progressives Hinweissystem (E17 — Hybrid):**
  - **Manual-Modus (Default):** Lehrkraft steuert Hinweise über Steuerleiste (💡-Button)
  - **Auto-Modus (optional, für Tablet-Einzelarbeit):** Toggle in Einstellungen `[🤖 Automatische Hilfe: An/Aus]`
    1. Versuch 1–2: Selbstständig, ermutigendes Feedback bei Fehlern
    2. Versuch 3: Hint 1 automatisch
    3. Versuch 4: Hint 2 automatisch
    4. Versuch 5+: Lösung Schritt für Schritt demonstrieren
  - Jede Aufgabe MUSS min. 2 Hints definieren (`hints: string[]`, Framework validiert)
- Kein Speed-Lob („Toll, wie schnell du warst!")
- Keine öffentlichen Leaderboards mit individuellen Rankings
- Prozess-Lob: Strategie und Anstrengung hervorheben (SHOULD)
- Temporaler Vergleich: „Du hast dich seit letzter Woche verbessert!" (SHOULD)
- Kurzfristige Ziele (Wochenziele) statt endlose Streaks (SHOULD)

---

## UX: Barrierefreiheit & Inklusion (MUST)

- Text-to-Speech für alle Textinhalte
- Sichtbare Fokus-Indikatoren: 3px solid Outline, 3px Offset, ≥3:1 Kontrast
- Screen Reader + Voice Input unterstützen
- `prefers-reduced-motion: reduce` unterstützen
- Nie Bedeutung nur durch Farbe vermitteln
- Flexible Geschwindigkeit: nie langsamere Antworten bestrafen
- Focus Mode Toggle: reduzierte Farben, weniger Animationen, größere Targets (SHOULD)

---

## UX: Datenschutz & Compliance (MUST)

- Höchste Privatsphäre-Einstellungen als Default
- Datenschutzhinweise in altersgerechter Sprache
- Kein Tracking ohne verifizierte elterliche Einwilligung
- Kein Profiling von Kindern
- Keine Nudging-Techniken zur Datenfreigabe
- Parental Gate vor externen Links und Käufen
- Geolocation standardmäßig deaktiviert
- Minimale Datenerhebung (nur für Kernfunktionalität nötige Daten)
