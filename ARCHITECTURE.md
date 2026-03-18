# Mathewerkstatt Bayern 3/4 – Architektur-Dokumentation

## Übersicht

Single-Page-App für interaktives Mathe-Lernen in Klasse 3/4 (LehrplanPLUS Bayern).
- **Entwicklung:** TypeScript, modulare Struktur, Vite Build-System
- **Auslieferung:** Eine einzelne portable HTML-Datei (127 KB gzip: 33 KB)
- **Offline-fähig:** Läuft lokal ohne Server, ebenso auf Webservern

## Build-System

```bash
npm install        # Abhängigkeiten installieren
npm run dev        # Entwicklungsserver (http://localhost:5173)
npm run build      # Produkt-Build → dist/index.html (single file)
npm run test       # Alle Unit-Tests
npm run typecheck  # TypeScript-Prüfung
npm run validate   # typecheck + tests + build (vollständige Validierung)
```

## Projektstruktur

```
Mathelabor/
├── index.html              # Haupt-HTML-Template (für Vite-Dev-Server)
├── dist/index.html         # Einzel-HTML-Build (Auslieferung)
├── src/
│   ├── main.ts             # App-Einstieg, Modul-Registrierung
│   ├── app/
│   │   ├── shell.ts        # App-Shell: Navigation, Theme, Lifecycle
│   │   └── base-module.ts  # Abstrakte Basisklasse für alle Module
│   ├── core/
│   │   ├── design.ts       # Design-System: Farben, Typo, Abstände, Radien
│   │   ├── types.ts        # Zentrale Typdefinitionen + Modul-Interface
│   │   ├── events.ts       # App-Event-Bus
│   │   └── utils.ts        # Gemeinsame Utilities (Math, DOM, Storage)
│   ├── canvas/
│   │   └── primitives.ts   # Canvas-Primitives: Panel, Button, Label, etc.
│   ├── layout/
│   │   └── layout.ts       # Canvas-Layout-System: Slots, Grids, Buttons
│   ├── styles/
│   │   ├── tokens.css      # CSS Custom Properties (Design-Tokens)
│   │   ├── base.css        # Reset + Body-Styles
│   │   └── components.css  # UI-Komponenten-Styles
│   ├── modules/
│   │   ├── netze/          # Körper und Netze (3D Geometrie)
│   │   ├── symmetry/       # Raster und Symmetrie
│   │   ├── chance/         # Daten und Zufall
│   │   ├── time/           # Zeit und Kalender
│   │   ├── measures/       # Größen und Messen
│   │   └── numbers/        # Zahlenlabor
│   └── data/               # Statische Lerndaten (zukünftig)
```

## Modul-Struktur

Jedes Modul enthält:
```
src/modules/<name>/
├── index.ts          # Hauptklasse (extends BaseModule) + Registration export
├── logic.ts          # Rein funktionale Logik (testbar, kein DOM/Canvas)
├── logic.test.ts     # Unit-Tests für logic.ts
├── types.ts          # Modul-spezifische Typen
├── state.ts          # State-Factory und State-Mutations (optional)
├── render.ts         # Rendering-Logik (optional, für komplexe Module)
└── interactions.ts   # Interaktions-Handler (optional)
```

## Neues Modul hinzufügen

1. **Verzeichnis anlegen:** `src/modules/<mein-modul>/`

2. **Interface implementieren** in `index.ts`:
```typescript
import { BaseModule } from "@app/base-module";
import type { ModuleRegistration } from "@core/types";

class MeinModul extends BaseModule {
  readonly id = "mein-modul";
  readonly label = "Mein Modul";
  readonly icon = "🎯";
  readonly description = "Kurzbeschreibung für die Startseite.";

  protected setup(container: HTMLElement): void {
    container.innerHTML = `<div class="module-layout">...</div>`;
    this.canvas = requireElement("#mein-canvas", container);
    this.ctx = this.setupCanvas(this.canvas, () => this.render());
    // Event-Binding
  }

  protected onActivate(): void {
    syncCanvasSize(this.canvas);
    this.render();
  }

  protected onDeactivate(): void {
    this.stopAnimLoop();
  }

  render(): void {
    syncCanvasSize(this.canvas);
    this.clearHitAreas();
    // ... Canvas zeichnen ...
    this.renderCelebration(this.ctx);
  }
}

export const meinModulRegistration: ModuleRegistration = {
  id: "mein-modul",
  label: "Mein Modul",
  icon: "🎯",
  description: "...",
  factory: () => new MeinModul(),
};
```

3. **Registrierung** in `src/main.ts`:
```typescript
import { meinModulRegistration } from "@modules/mein-modul/index";

const moduleRegistrations = [
  // ... bestehende ...
  meinModulRegistration,
];
```

4. **Tests** in `logic.test.ts` – rein funktionale Logik ist vollständig testbar.

5. **Validierung:**
```bash
npm run validate
```

## Architektur-Prinzipien

### Design-System
- **Alle** Farben, Typografie, Abstände kommen aus `src/core/design.ts` und `src/styles/tokens.css`
- Keine Magic Numbers oder freien Styles in Modulen
- Canvas-Schriftgrößen immer über `resolveCanvasFonts(canvasWidth)` berechnen
- Canvas-Abstände über `resolveCanvasSpacing(canvasWidth)` berechnen

### Canvas-Layout-Slots
- Jede Canvas-Szene MUSS die Layout-Funktionen aus `@layout/layout` verwenden
- Text und Grafik teilen sich NICHT denselben Raum
- Reservierte Slots: `taskArea` (Aufgabe), `mainArea` (Interaktion), `actionBar` (Buttons)

### Canvas-Primitives
- Alle Canvas-Zeichenoperationen über `@canvas/primitives` (Panel, Button, Label, etc.)
- Kein direktes `ctx.fillText()` für UI-Elemente außerhalb reservierter Slots
- Canvas-Buttons MÜSSEN in `hitAreas` registriert werden

### Interaktions-Trennung
- **Links (linkes Panel):** Moduswahl, Erklärung, Hilfen, Rückmeldung
- **Rechts (rechtes Panel):** Aufgabe, Hauptinteraktion, Canvas, häufige Aktionen
- Keine Dopplung von Links/Rechts-Interaktionen

### Lifecycle
- `mount()` → einmalig: DOM, Events, Canvas-Setup
- `activate()` → bei jedem Wechsel ZU diesem Modul
- `deactivate()` → bei jedem Wechsel WEG
- `resize()` → bei Viewport-Änderung
- `destroy()` → Cleanup (für zukünftige dynamische Module)

### State-Isolation
- Jedes Modul hat seinen eigenen lokalen State
- Kein globaler State zwischen Modulen
- Modulwechsel darf andere Module nicht beschädigen

## Teststrategie

### Was getestet wird
- **Aufgabenlogik** (Unit-Tests): `computeExpected()`, `checkAnswer()`, `getPlaceValues()`, usw.
- **Zustandsübergänge** (Unit-Tests): `applyJump()`, `recordJump()`, `undoLastCell()`
- **Layout-Helfer** (Unit-Tests): `buildStandardLayout()`, `buildButtonRow()`
- **Typografie-Helfer** (Unit-Tests): `resolveCanvasFonts()`
- **Core-Utilities** (Unit-Tests): 40 Tests für `utils.ts`

### Was explizit NICHT getestet wird
- DOM-Rendering (wird manuell im Browser geprüft)
- Canvas-Rendering (visuell)
- Event-Handler (Smoke-Tests im Browser)

### Smoke-Test-Checkliste (manuell, nach jedem Build)
```
□ Alle 6 Module lassen sich aktivieren
□ Kein Modul wirft Fehler in der Konsole
□ Jeder Modulwechsel hinterlässt andere Module stabil
□ Rechte Canvas-Flächen sind in allen Modulen sichtbar
□ Aufgaben-Buttons sind klickbar
□ Status-Rückmeldungen erscheinen
□ Feiern-Animation erscheint bei korrekter Antwort
□ Theme-Toggle wechselt Dark/Light
□ Alt+1 bis Alt+6 wechseln Module
```

## Bekannte Altprobleme – so gelöst

| Altproblem | Lösung |
|---|---|
| Leere rechte Interaktionsflächen | Canvas-Container mit `flex:1`, `min-height:0` |
| Fragile Modulinitialisierung | Lazy-Init in AppShell, Lifecycle-Guards |
| Layout-Sprünge | CSS Grid statt manueller Positionierung |
| Freie Text/Grafik-Überlagerung | Mandatory Layout-Slots via `buildStandardLayout()` |
| Doppelte Bedienlogik | Links = Status/Modus, Rechts = Interaktion (erzwungen) |
| Modulübergreifende Seiteneffekte | Kein globaler State, Event-Bus mit klaren Typen |
| Nicht testbare Vermischung | State/Logic/Render/Interaction vollständig getrennt |
| Nicht zentralisierte Typografie | `resolveCanvasFonts()` + CSS Custom Properties |

## Technologie-Entscheidungen

| Entscheidung | Begründung |
|---|---|
| TypeScript | Typsicherheit, Refactoring-Support, Dokumentation durch Typen |
| Vite | Schneller Dev-Server, einfaches Single-File-Build via vite-plugin-singlefile |
| Kein Framework (React/Vue) | Kein Runtime-Overhead, kleinere Bundle-Größe, direkte Canvas-Kontrolle |
| Vitest | Vite-natives Test-Framework, schnell, gleiche TS-Config |
| Canvas 2D | Volle Kontrolle über Rendering, kinderfreundliche Layouts möglich |
| CSS Custom Properties | Theme-System ohne JS, Live-Override möglich |

## Parititäts-Checkliste

### Körper und Netze
- ✅ 2D-Netz-Editor (11×11 Grid)
- ✅ 3D-Ansicht mit Rotation
- ✅ Faltanimation
- ✅ Würfel-Netzvorlagen (11 gültige)
- ✅ **Quader** mit eigener Geometrie (nicht gestreckter Würfel)
- ✅ Gegenüberliegende Flächen automatisch einfärben

### Raster und Symmetrie
- ✅ Spiegeln senkrecht
- ✅ Spiegeln waagerecht
- ✅ Vergrößern ×2
- ✅ Vergrößern ×3
- ✅ Beispiel/Üben/Frei-Modi
- ✅ Undo (Ctrl+Z)
- ✅ Drag-Malen

### Daten und Zufall
- ✅ Fairer Würfel (1–6)
- ✅ Fairies Rad A (4 gleiche Felder)
- ✅ Unfaires Rad B (Rot 4× größer)
- ✅ 1×/10×/50×/100× Würfe
- ✅ Häufigkeitsdiagramm mit Theorie-Markierung
- ✅ Läufe speichern und vergleichen
- ✅ Rad-Animation

### Zeit und Kalender
- ✅ Uhrzeit ablesen
- ✅ Uhrzeit einstellen (Zeiger-Drag)
- ✅ Kalenderansicht
- ✅ Zeitspannen berechnen

### Größen und Messen
- ✅ Münzen zusammenstellen (8 Nominale)
- ✅ Einheiten umrechnen (6 Paare)
- ✅ Undo/Löschen
- ✅ Ziel-Betrag validieren

### Zahlenlabor
- ✅ Stellenwerte (Dienes-Material visuell)
- ✅ Zahlen vergleichen (<, =, >)
- ✅ Rechensprünge (±1, ±10, ±100, ±1000)
- ✅ Zahlenstrahl mit Sprung-Bögen
- ✅ Pfeiltasten für Sprünge
