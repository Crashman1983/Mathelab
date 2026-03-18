# Redesign-Vision: Mathelab v2

## Kontext

Basierend auf einer tiefen Architekturanalyse (~23.000 Zeilen TS+CSS, 75 Dateien, 12 Module) des bestehenden Mathelab-Projekts.

**Primärer Use-Case:** Die App ist ein **Lehrer-Präsentationstool am Smartboard** — nicht eine Selbstlern-App für einzelne Kinder. Der Lehrer projiziert Aufgaben, steuert Schwierigkeit und Aufgabentyp gezielt, und blendet Lösungen per Knopfdruck ein.

**Rahmenbedingungen:** Vanilla TS + Vite, kein Framework, Single-File-Output (vite-plugin-singlefile).

**Geschätztes Ergebnis:**
- ~45% weniger Code (23.000 → ~12.500 Zeilen)
- Module: 80–250 statt 475–1.336 Zeilen
- Neues Modul hinzufügen: ~1h statt 4–6h
- Visuell: Modern, warm, klar lesbar am Smartboard

---

## Lehrer-Use-Case: Konsequenzen für die Architektur

### Navigation: Versteckt, bei Bedarf abrufbar

Die Navigation ist **nicht permanent sichtbar** — der Canvas/Aufgabenbereich nutzt die **volle Bildschirmbreite**. Pro Unterrichtseinheit wird typischerweise nur 1–2 Themen unterrichtet, häufiger Modulwechsel ist selten.

**Zugriff:** Topbar-Button (aktuelles Modul-Label ist klickbar) + Alt+1–9 Shortcuts öffnen ein **Modul-Overlay**:

```
┌─[🔢 Mathewerkstatt]─[✖️ Einmaleins ▾]───────────[🔔][☀️]─┐
│                         ↑                                    │
│                   Klick öffnet                               │
│                   Modul-Overlay                              │
│                                                              │
│              Canvas / Aufgabe                                │
│              (VOLLE BREITE — kein Platz für Sidebar verloren)│
│                                                              │
│   [Kernaufgaben] [Tauschaufg.] [Division]  ← Aufgabentyp-   │
│                                               Chips im Modul │
├──────────────────────────────────────────────────────────────┤
│ [💡 Hinweis]  [📖 Lösung]  [→ Nächste]                      │
└──────────────────────────────────────────────────────────────┘
```

**Modul-Overlay (bei Klick auf Modul-Label):**
```
┌──────────────────────────────────────────┐
│  🏠 Startseite                           │
│  ✖️ Einmaleins         📐 Geometrie      │
│  🍰 Bruchteile         📏 Größen & Maße  │
│  🕐 Uhrzeiten          🔢 Zahlenlabor    │
│  🎲 Zufall             📍 Koordinaten    │
│  🔁 Algorithmen        🧩 Muster         │
│  🪞 Symmetrie          🎁 Netze          │
│                                          │
│  Schwierigkeit: [1] [■2] [3]            │
└──────────────────────────────────────────┘
```
- Overlay schließt sich nach Modulwahl automatisch
- ESC oder Klick außerhalb schließt ebenfalls
- Alt+1–9: Direkter Modulwechsel ohne Overlay

**Aufgabentypen:** Nicht in der Navigation, sondern als **kompakte Chips/Tabs direkt im Modul-Bereich** (oberhalb oder neben dem Canvas). Spart einen Navigationsschritt — der Lehrer wechselt Aufgabentypen mit einem Klick, ohne die Navigation zu öffnen.

### Neues UI: Lehrer-Steuerleiste (unterhalb Canvas)

```
┌─[🔢 Mathewerkstatt]─[✖️ Einmaleins ▾]──────[Stats][🔔][☀️]─┐
│                                                               │
│  [Kernaufgaben] [Tauschaufg.] [Division]  ← Aufgabentyp-Chips│
│                                                               │
│                    3 × 7 = ?                                  │
│                                                               │
│              Canvas / Aufgabe (VOLLE BREITE)                  │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│ [💡 Hinweis]  [📖 Lösung]  [→ Nächste]   12 Aufg. · 9✅ [🔄]│
└───────────────────────────────────────────────────────────────┘
```

**Steuerleisten-Elemente:**
- **💡 Hinweis** — Zeigt nächsten Hint (manuell, nicht automatisch)
- **📖 Lösung zeigen** — Blendet korrekte Antwort sofort ein (prominent, eigene Farbe)
- **→ Nächste Aufgabe** — Generiert neue Aufgabe (gleicher Typ + Schwierigkeit)
- **Session-Counter** — "12 Aufgaben · 9 richtig" (Klassenebene, keine Einzelbewertung)
- **🔄 Session zurücksetzen** — Für neue Unterrichtsstunde

### Progressive Hints: Lehrer-gesteuert statt automatisch

Heute: Automatische Eskalation bei Fehlversuchen 1→5.
Neu: Lehrer entscheidet wann — Hint-Button zeigt die nächste Stufe, aber nur auf Knopfdruck.

```ts
// Modul-DSL: Hints sind deklarativ, aber Steuerung ist manuell
generate(difficulty, taskType): Task {
  return {
    question: "3 × 7 = ?",
    answer: 21,
    hints: [
      "Denk an die 3er-Reihe.",           // Hint 1
      "3 × 7 = 3 + 3 + 3 + 3 + 3 + 3 + 3", // Hint 2
      "3 × 7 = 21",                        // Lösung
    ],
  };
}
```

### Session-Tracking: Klassenebene

- Kein Per-Kind-Tracking, kein Login
- Session = eine Unterrichtsstunde
- Counter: "X Aufgaben bearbeitet, Y richtig"
- Reset-Button für neue Stunde
- Keine Badges, keine Sterne, kein Gamification — der Lehrer moderiert die Motivation

### Aufgabensteuerung: Gezielt wählbar

Jedes Modul deklariert seine verfügbaren Aufgabentypen + Schwierigkeitsgrade:

```ts
export default defineModule({
  id: "multiplication",
  title: "Einmaleins",
  icon: "✖️",

  taskTypes: [
    { id: "core",     label: "Kernaufgaben" },
    { id: "swap",     label: "Tauschaufgaben" },
    { id: "division", label: "Umkehraufgaben" },
  ],

  difficulties: [
    { id: 1, label: "Leicht",  description: "Kleine Zahlen" },
    { id: 2, label: "Mittel",  description: "Alle Reihen" },
    { id: 3, label: "Schwer",  description: "Große Zahlen, Umkehr" },
  ],

  generate(difficulty, taskType): Task { ... },
  check(input, task): CheckResult { ... },
});
```

Der Lehrer wählt im Modul-Overlay: Modul + Schwierigkeit. Aufgabentyp über Chips direkt im Modul-Bereich.

---

## Was bleibt vs. was sich ändert

| Behalten | Ersetzen |
|---|---|
| Design-Token-System (tokens.css + design.ts) | Imperative Canvas-Aufrufe → Scene Graph |
| BaseModule-Lifecycle-Konzept (mount/activate/deactivate) | Klassen-Vererbung → Modul-DSL |
| Sound-System (Web Audio, keine externen Assets) | innerHTML → h()-Templates |
| Single-File-Output (vite-plugin-singlefile) | Monolithisches CSS → 3-Schichten |
| Responsive Breakpoint-Tiers (7 Stufen) | Manuelle HitArea-Registrierung → automatisch |
| Debug-Overlay-Konzept (violations) | Copy-Paste Hint-Logik → deklarativ im Task |
| Modul-Wechsel muss schnell möglich sein | Permanent sichtbare Sidebar (verschwendet Platz) → verstecktes Modul-Overlay + Keyboard-Shortcuts |
| Progressive Hints (inhaltlich) | Automatische Eskalation → Lehrer-gesteuert |
| Canvas-Primitives (Zeichenfunktionen) | **Manuelle Pixel-Arithmetik → Constraint-basiertes Layout-System** |

---

## ⚠️ Baustein 0 — Robustes Canvas-Layout-System (FUNDAMENT)

**Dies ist der kritischste Baustein.** Ohne ihn bleiben alle anderen Verbesserungen auf Sand gebaut. Das Canvas-Layout war sowohl im MVP als auch in der aktuellen Version die größte Fehlerquelle: Überlappungen, falsche Abstände, Größenprobleme bei verschiedenen Viewports.

### Analyse: 10 Root Causes der aktuellen Fragilität

| # | Ursache | Schwere | Symptom |
|---|---|---|---|
| 1 | Font-Size-Shift nicht an nachfolgende Elemente propagiert | KRITISCH | Text überlappt Felder; reservierte Zonen schrumpfen |
| 2 | Manuelle Pixel-Arithmetik ohne Kollisions-API | KRITISCH | Überlappungen akkumulieren; keine Validierung vor Registrierung |
| 3 | Info/Hit-Areas werden post-render registriert, nicht als Constraints | HOCH | Zu spät für Layout-Anpassung; Debug erkennt nur, verhindert nicht |
| 4 | Responsive Font-Größen skalieren, aber Layout-Multiplikatoren nicht | HOCH | Funktioniert auf Laptops, bricht auf 4K / kleinen Screens |
| 5 | Primitives messen Text nicht vor dem Zeichnen | HOCH | Text läuft über oder wird abgeschnitten |
| 6 | Modul-spezifische Layout-Logik nicht generalisiert | MITTEL | Jedes Modul erfindet Layout neu; inkonsistente Abstände |
| 7 | Physische vs. CSS-Pixel-Verwechslung (DPI) | MITTEL | 4K-Monitore: Font 2× zu groß |
| 8 | Fließkomma-Rundungs-Akkumulation | MITTEL | Lücken und Überlappungen in Button-Reihen (±4–8px Drift) |
| 9 | Overlap-Detection nur post-hoc im Debug-Modus | NIEDRIG | Probleme bleiben unbemerkt ohne Dev-Tools |
| 10 | Magic-Number-Proliferation (0.60, 0.44, etc.) | NIEDRIG | Schwer global zu tunen; Änderungen brechen andere Module |

### Architektur-Lösung: Constraint-basiertes Layout mit Measure-Before-Draw

**Kernprinzip:** Kein Element wird gezeichnet, bevor sein Platzbedarf gemessen und seine Position in einem **Constraint-Solver** validiert wurde.

#### Phase 1: Messen (measure)
```ts
// Jedes Layout-Element hat eine measure()-Phase
interface CanvasNode {
  measure(ctx: CanvasRenderingContext2D, available: Size): MeasuredSize;
  layout(allocated: Rect): void;
  draw(ctx: CanvasRenderingContext2D): void;
}

interface MeasuredSize {
  minW: number;   // Mindestbreite (z.B. Text + Padding)
  minH: number;   // Mindesthöhe
  prefW: number;  // Bevorzugte Breite
  prefH: number;  // Bevorzugte Höhe
  maxW?: number;  // Maximalbreite (optional)
}
```

#### Phase 2: Layout (layout)
```ts
// Container-Nodes verteilen Platz an Kinder
class VStack implements CanvasNode {
  children: CanvasNode[];
  gap: number;

  measure(ctx, available) {
    // 1. Alle Kinder messen
    const measured = this.children.map(c => c.measure(ctx, available));
    // 2. Gesamthöhe = Summe aller minH + gaps
    const totalH = measured.reduce((s, m) => s + m.prefH, 0)
                   + this.gap * (this.children.length - 1);
    return { minW: Math.max(...measured.map(m => m.minW)),
             minH: totalH, prefW: available.w, prefH: totalH };
  }

  layout(allocated) {
    let y = allocated.y;
    for (const child of this.children) {
      const size = child.lastMeasured;
      child.layout({ x: allocated.x, y, w: allocated.w, h: size.prefH });
      y += size.prefH + this.gap;
    }
  }
}
```

#### Phase 3: Zeichnen (draw)
```ts
// Zeichnen passiert NACH Layout — Positionen sind garantiert korrekt
class TextNode implements CanvasNode {
  text: string;
  style: TextStyle;
  private rect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  measure(ctx, available) {
    ctx.font = this.resolveFont();
    const metrics = ctx.measureText(this.text);
    const textW = metrics.width;
    const textH = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    return {
      minW: Math.min(textW, available.w),
      minH: textH + this.style.padding * 2,
      prefW: textW + this.style.padding * 2,
      prefH: textH + this.style.padding * 2,
    };
  }

  layout(allocated) { this.rect = allocated; }

  draw(ctx) {
    // Position ist GARANTIERT korrekt — keine manuelle Berechnung
    ctx.fillText(this.text, this.rect.x + this.rect.w / 2,
                 this.rect.y + this.rect.h / 2, this.rect.w);
  }
}
```

### Die 5 Layout-Container (decken 95% der Modul-Layouts ab)

```ts
// 1. VStack — Vertikale Anordnung (Aufgabentext → Visualisierung → Buttons)
vstack({ gap: sp.md, children: [...] })

// 2. HStack — Horizontale Anordnung (Button-Reihen, Optionen nebeneinander)
hstack({ gap: sp.sm, children: [...] })

// 3. ZStack — Übereinander (Canvas-Zeichnung mit Overlay-Text)
zstack({ children: [background, foreground] })

// 4. Grid — Gleichmäßiges Raster (Punktfelder, Bruchteile-Kreise)
grid({ cols: 3, rows: 4, gap: sp.xs, children: [...] })

// 5. Spacer — Flexibler Freiraum (wie CSS flex: 1)
spacer({ flex: 1 })  // Nimmt verbleibenden Platz ein
```

### Wie Module das nutzen (vorher → nachher)

**VORHER (multiplication, ~60 Zeilen manuelle Berechnung):**
```ts
const contentZoneH = area.h * 0.60;           // Magic Number
const labelH = sp.sm + Math.ceil(fonts.sm * 1.4); // Schätzung
const fieldZoneH = contentZoneH - labelH;      // Abgeleitete Schätzung
const maxDotR = Math.min(area.w / (cols * 2.8), fieldZoneH / (rows * 2.8));
const dotR = Math.min(maxDotR, area.w * 0.028);
const cellW = dotR * 2.6;
// ... 40 weitere Zeilen Positionsberechnung
```

**NACHHER (~15 Zeilen deklarativ):**
```ts
return vstack({ gap: sp.md }, [
  // Aufgabentext — misst sich selbst
  text(`${a} × ${b} = ?`, { font: "title" }),

  // Punktfeld — berechnet Radius automatisch aus verfügbarem Platz
  dotGrid({ rows: a, cols: b, flex: 1 }),

  // Antwort-Buttons
  hstack({ gap: sp.sm }, [
    button("18", { onTap: () => check(18) }),
    button("21", { onTap: () => check(21) }),
    button("24", { onTap: () => check(24) }),
  ]),
]);
```

Das `dotGrid` berechnet seinen Dot-Radius automatisch:
```ts
class DotGrid implements CanvasNode {
  measure(ctx, available) {
    // Radius ergibt sich aus verfügbarem Platz
    const maxR = Math.min(
      available.w / (this.cols * 2.5),
      available.h / (this.rows * 2.5),
    );
    this.dotR = Math.max(maxR, 4); // Minimum 4px
    return {
      minW: this.cols * 4 * 2.5,
      minH: this.rows * 4 * 2.5,
      prefW: this.cols * this.dotR * 2.5,
      prefH: this.rows * this.dotR * 2.5,
    };
  }
}
```

### Garantien des neuen Systems

| Garantie | Wie |
|---|---|
| **Keine Überlappung** | Constraint-Solver verteilt Platz; Kinder bekommen nur ihren Anteil |
| **Keine Text-Überläufe** | `ctx.measureText()` vor jedem Zeichnen; `maxWidth` automatisch |
| **DPI-korrekt** | Layout rechnet in CSS-Pixeln; nur `draw()` skaliert mit `dpr` |
| **Responsive ohne Magic Numbers** | `flex: 1` und `measure()` statt `area.h * 0.60` |
| **Validierung VOR dem Zeichnen** | `layout()` kann warnen wenn `minH > allocated.h` |
| **HitAreas automatisch** | Jede Button-Node registriert sich nach `layout()` |
| **Ganzzahl-Positionen** | `Math.round()` einmal in `layout()`, nicht in jeder Berechnung |

### DPI-Problem gelöst

```ts
class CanvasScene {
  render(canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Canvas-Größe = physische Pixel
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    // LAYOUT rechnet in CSS-Pixeln (rect.width, nicht canvas.width)
    const root = this.rootNode;
    root.measure(ctx, { w: rect.width, h: rect.height });
    root.layout({ x: 0, y: 0, w: rect.width, h: rect.height });

    // DRAW nutzt CSS-Koordinaten — ctx.scale(dpr) erledigt die Skalierung
    root.draw(ctx);
  }
}
```

`resolveCanvasFonts()` bekommt jetzt **CSS-Pixel**, nicht physische Pixel. Fonts sind auf Laptop UND 4K identisch groß (in CSS-px).

### Rundungs-Problem gelöst

```ts
// In layout() — einmal runden, konsistente Ergebnisse
layout(allocated: Rect) {
  let y = Math.round(allocated.y);
  const gap = Math.round(this.gap);

  for (const child of this.children) {
    const h = Math.round(child.lastMeasured.prefH);
    child.layout({
      x: Math.round(allocated.x),
      y,
      w: Math.round(allocated.w),
      h,
    });
    y += h + gap;
  }
}
```

Rundung passiert **einmal pro Achse**, nicht in jeder verschachtelten Berechnung.

### Proaktive Validierung statt Post-hoc Debug

```ts
layout(allocated: Rect) {
  const totalNeeded = this.children.reduce((s, c) => s + c.lastMeasured.minH, 0)
                      + this.gap * (this.children.length - 1);

  if (totalNeeded > allocated.h) {
    console.warn(
      `[CanvasLayout] VStack overflow: need ${totalNeeded}px, have ${allocated.h}px. ` +
      `Children will be compressed.`
    );
    // Fallback: Proportional komprimieren statt überlappen
    const scale = allocated.h / totalNeeded;
    // ... komprimierte Verteilung
  }
}
```

---

## Baustein 1 — Deklarative Canvas-Szenen (baut auf Baustein 0 auf)

**Baustein 0 liefert das Layout-System. Baustein 1 liefert die Szenen-API die Module nutzen.**

```ts
const scene = canvas.scene([
  panel({ children: [
    text("3 × 7 = ?", { font: "title", color: "text" }),
    buttonRow([
      button("18", { onTap: () => check(18) }),
      button("21", { onTap: () => check(21), variant: "primary" }),
      button("24", { onTap: () => check(24) }),
    ]),
  ]}),
  statusBox({ text: feedbackMsg, variant: feedbackType }),
]);

scene.render(); // measure → layout → draw (automatisch)
```

**Vorteile:**
- HitAreas ergeben sich automatisch aus der Baumstruktur
- Animationen als Transitions auf Scene-Nodes (`node.animateTo({ opacity: 0 }, 300)`)
- ~40% weniger Code pro Modul
- Testbar: Scene-Tree ist ein Plain Object, unit-testbar ohne Canvas

---

## Baustein 2 — Modul-DSL statt BaseModule-Vererbung

**Problem heute:** 30–50% Boilerplate pro Modul: Canvas-Setup, DOM-Container, StatusBox + Controls, HitArea-Registrierung, newTask/check-Zyklus. 12× copy-pasted mit Variationen.

**Neu:** Deklarative Modul-Definition mit Aufgabentyp- und Schwierigkeitsdeklaration:

```ts
export default defineModule({
  id: "multiplication",
  title: "Einmaleins",
  icon: "✖️",

  taskTypes: [
    { id: "core",     label: "Kernaufgaben" },
    { id: "swap",     label: "Tauschaufgaben" },
    { id: "division", label: "Umkehraufgaben" },
  ],

  difficulties: [
    { id: 1, label: "Leicht" },
    { id: 2, label: "Mittel" },
    { id: 3, label: "Schwer" },
  ],

  generate(difficulty: number, taskType: string): Task {
    const a = randInt(2, 10), b = randInt(2, 10);
    return {
      question: `${a} × ${b}`,
      answer: a * b,
      hints: [
        `Denk an die ${a}er-Reihe.`,
        `${a} × ${b} = ${a} + ${a} + ... (${b} mal)`,
        `${a} × ${b} = ${a * b}`,
      ],
      canvasScene: (layout) => [
        dotGrid(a, b, { animate: true }),
        text(`${a} × ${b} = ?`, { pos: layout.title }),
      ],
    };
  },

  check(input: number, task: Task): CheckResult {
    return input === task.answer
      ? { correct: true }
      : { correct: false };
  },

  input: "numberPad",
});
```

**Das Framework übernimmt automatisch:**
- Canvas-Setup + DPI
- Lehrer-Steuerleiste (Hinweis / Lösung / Nächste)
- Sound-Feedback (correct, wrong, click, completion)
- Celebration-Animation
- Session-Tracking (Klassenebene)
- ARIA-Labels + Canvas-Label-Updates
- Keyboard-Navigation via HitAreas
- Reduced-Motion-Guards
- Debug-Overlay + Violation-Detection
- Aufgabentyp-Chips im Modul-Bereich (aus `taskTypes`)
- Schwierigkeitsregler im Modul-Overlay (aus `difficulties`)

### Kanonische DSL-Interfaces (verbindlich für alle Module)

Die folgenden Interfaces sind die **einzige Wahrheit** für die Modul-DSL. Spätere Abschnitte zeigen Anwendungsbeispiele — bei Widersprüchen gilt diese Definition.

```ts
// === Zentrale Typen ===

interface ModuleContext {
  theme?: string;        // Themenwelt-ID ("pizza", "squirrel", "abstract")
  locale?: string;       // Sprache (Zukunft)
}

interface Task {
  question: string;                                    // Fragestellung (Text)
  answer: number | string | { numerator: number; denominator: number }; // Erwartete Antwort
  hints: string[];                                     // Min. 2 Hints pro Task (Framework validiert)
  canvasScene?: (layout: LayoutInfo) => CanvasNode[];  // Deklarative Canvas-Szene
  sceneObjects?: CanvasNode[];                         // Kontextbezogene Objekte (Themenwelt)
}

interface CheckResult {
  correct: boolean;
  partialCredit?: number;     // 0–1 (z.B. 0.5 bei richtiger Strategie, falschem Ergebnis)
  feedbackMessage?: string;   // Modulspezifisches Feedback (optional, Framework hat Default)
}

interface SolutionDisplay {
  text: string;                                        // Lösungstext (z.B. "3/4" oder "28")
  overlay?: (ctx: CanvasRenderingContext2D, layout: LayoutInfo) => void;  // Canvas-Overlay
}

interface TaskType {
  id: string;
  label: string;
}

interface DifficultyLevel {
  id: number;
  label: string;
  description?: string;
}

interface SolutionPath {
  id: string;
  label: string;
  icon?: string;
}

interface ThemeDefinition {
  id: string;
  label: string;
  context: string;           // Kontextgeschichte in 1 Satz
  objects: string[];          // Verfügbare Canvas-Objekte
}

// === Modul-Definition ===

interface ModuleDefinition {
  id: string;
  title: string;
  icon: string;

  // Aufgabentypen → Chips im Modul-Bereich
  taskTypes: TaskType[];

  // Schwierigkeitsgrade → Regler im Modul-Overlay
  difficulties: DifficultyLevel[];

  // Flow-Typ bestimmt Steuerleisten-Variante:
  //   "task"    → [💡 Hinweis] [📖 Lösung] [→ Nächste]
  //   "explore" → [🔄 Zurücksetzen] + Lauf-Counter
  // Ob [▶ Erklärung] angezeigt wird, ergibt sich aus dem Vorhandensein von explain()
  flowType: "task" | "explore";

  // Eingabemethode
  input: "numberPad" | "buttons" | "drag" | "gridTap" | "pointer" | "mixed";

  // Optionale Themenwelten (nicht alle Module haben welche)
  themes?: ThemeDefinition[];

  // Optionale Rechenwege (z.B. Zerlegen / Zahlenstrahl / Schriftlich)
  solutionPaths?: SolutionPath[];

  // === Pflicht-Methoden ===

  // Aufgabe generieren (context ist optional — Module ohne Themes ignorieren es)
  generate(difficulty: number, taskType: string, context?: ModuleContext): Task;

  // Antwort prüfen
  check(input: unknown, task: Task): CheckResult;

  // === Optionale Methoden ===

  // Statische Lösung anzeigen (Text + optionales Canvas-Overlay)
  getSolution?(task: Task): SolutionDisplay;

  // Animierte Schritt-für-Schritt-Erklärung
  // Wenn vorhanden → [▶ Erklärung] Button erscheint in Steuerleiste
  // path: nur relevant bei Modulen mit solutionPaths[]
  explain?(task: Task, scene: CanvasScene, path?: string): SequenceAnimation;
}
```

**Steuerleisten-Varianten (abgeleitet aus DSL):**

```
flowType: "task", kein explain():
  [💡 Hinweis]  [📖 Lösung]  [→ Nächste]

flowType: "task", mit explain():
  [▶ Erklärung]  [💡 Hinweis]  [📖 Lösung]  [→ Nächste]

flowType: "task", mit solutionPaths[]:
  [✂️ Zerlegen] [📏 Zahlenstrahl] [✏️ Schriftlich]  ← Rechenweg-Chips
  [▶ Erklärung]  [💡 Hinweis]  [📖 Lösung]  [→ Nächste]

flowType: "explore":
  [🔄 Zurücksetzen]                        📝 X Läufe
```

---

## Baustein 3 — Typisierte Templates statt innerHTML

**Problem heute:** `container.innerHTML = '<div class="control-block">...'` — kein Type-Checking, unlesbar bei Verschachtelung.

**Neu:** Minimaler h()-Helper (hyperscript-artig, ~60 Zeilen):

```ts
const controls = h("div", { class: "control-block" }, [
  h("div", { class: "mode-switcher" },
    modes.map(m =>
      h("button", {
        class: `btn ${m.active ? "btn--primary" : "btn--ghost"}`,
        onClick: () => setMode(m.id),
      }, m.label)
    )
  ),
  h("div", { class: "status-box", id: "status" }),
]);
```

- Kein Virtual DOM, kein Diffing
- Typsicheres DOM-Building
- Event-Listener werden automatisch aufgeräumt bei `destroy()`

---

## Baustein 4 — State-Management: Micro-Signals

**Problem heute:** State verstreut — Klassen-Properties, localStorage, DOM-Attribute. Kein reaktives Update.

**Neu:** Micro-Signals (~40 Zeilen, keine Library):

```ts
const score = signal(0);
const difficulty = signal(1);
const muted = persisted("mathelabor_muted", false);

effect(() => {
  statusEl.textContent = `Punkte: ${score.value}`;
});

score.value++; // → UI updated automatisch
```

- Kein Overkill: keine globale Stores, kein Redux
- Jedes Modul hat eigene Signals
- Shell hat globale Signals (theme, muted, activeModule, difficulty)
- `persisted()` wraps Signal + localStorage automatisch

---

## Baustein 5 — CSS-Architektur: 3 Schichten + Container Queries

**Problem heute:** 2.878 Zeilen CSS in 3 Dateien, viele wiederholte Patterns.

**Neu:** 3-Schicht-Architektur:

```
tokens.css      → Design Tokens (behalten — ist bereits gut!)
base.css        → Reset + Grundtypen + Utility-Klassen
components.css  → Nur echte Komponenten (.btn, .panel, .status-box)
```

**Container Queries statt Media Queries für Komponenten:**

```css
.module-layout {
  container-type: inline-size;
}

@container (width < 600px) {
  .control-block { flex-direction: column; }
}
```

**Utility-Klassen** (kein Tailwind, nur die 20 häufigsten):
```css
.flex { display: flex; }
.flex-col { flex-direction: column; }
.gap-sm { gap: var(--space-sm); }
.gap-md { gap: var(--space-md); }
.items-center { align-items: center; }
.text-center { text-align: center; }
```

Geschätzter Effekt: ~40% weniger CSS.

---

## Baustein 6 — Visuelles Refresh

### 6.1 Smartboard-Optimierung
- **Hoher Kontrast:** Smartboards haben oft schwächere Displays als Monitore
- **Große Schrift:** Canvas-Inhalte müssen von der letzten Reihe lesbar sein
- **Reduzierter Glassmorphism:** `backdrop-filter: blur()` kann auf Smartboard-GPUs laggen

```css
.panel {
  background: var(--panel);
  border: 2px solid var(--line);     /* Stärker als 1px für Smartboard */
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}
```

### 6.2 Farbpalette auffrischen

| Token | Alt | Neu | Rationale |
|---|---|---|---|
| `--accent` | `#1982C4` | `#3B82F6` | Wärmer, höherer Kontrast |
| `--ok` | `#8AC926` | `#22C55E` | Satter, besser sichtbar am Board |
| `--panel` (light) | `#F8F9FC` | `#FAFBFE` | Minimal wärmer |

Plus: **Modul-Akzentfarben** — jedes Modul bekommt eine eigene Akzentfarbe (Overlay-Highlight, Topbar-Akzent, Aufgabentyp-Chips). Hilft dem Lehrer bei schneller visueller Orientierung.

### 6.3 Mikro-Animationen
- **Button-Press:** `scale(0.96)` + leichter Schatten-Rückzug (100ms)
- **Modulwechsel:** Crossfade (200ms) statt hartem Swap
- **Canvas-Aufgabe erscheint:** Soft slide-up + fade (250ms)
- **Richtige Antwort:** Konfetti-Partikel (verfeinert: mehr Physik, weniger starr)
- **Lösung einblenden:** Smooth reveal-Animation (scale 0→1 + fade)

### 6.4 Canvas-Rendering verfeinern
- Anti-aliased Linien: `ctx.lineWidth = dpr > 1 ? 1.5 : 2`
- Subtile Schatten unter Canvas-Panels
- Gradient-Fills statt Solid-Colors für interaktive Elemente
- Smooth Zahlenanimation bei Score-Änderungen (countUp/countDown)

---

## Baustein 7 — Modul-Overlay-Navigation + Lehrer-Steuerleiste

### Navigationskonzept: Overlay statt permanente Sidebar

Die Navigation ist **versteckt** und wird nur bei Bedarf aufgerufen. Der Canvas nutzt die volle Bildschirmbreite.

**Trigger:**
- Klick auf Modul-Label in der Topbar (z.B. "✖️ Einmaleins ▾")
- Alt+1–9 für Direktwechsel (kein Overlay nötig)
- Alt+0 für Startseite

**Modul-Overlay:**
```
┌──────────────────────────────────────────┐
│  🏠 Startseite                           │
│                                          │
│  ✖️ Einmaleins         📐 Geometrie      │
│  🍰 Bruchteile         📏 Größen & Maße  │
│  🕐 Uhrzeiten          🔢 Zahlenlabor    │
│  🎲 Zufall             📍 Koordinaten    │
│  🔁 Algorithmen        🧩 Muster         │
│  🪞 Symmetrie          🎁 Netze          │
│                                          │
│  Schwierigkeit: [1] [■2] [3]            │
└──────────────────────────────────────────┘
```

- Zentriertes Modal-Overlay mit Backdrop-Dimmer
- 2-Spalten-Grid für Module (große Touch-Targets, 64px Höhe)
- Schließt automatisch nach Modulwahl
- ESC oder Klick auf Backdrop schließt ohne Wechsel
- Schwierigkeitsregler im Overlay (globaler Signal)

### Aufgabentyp-Chips (im Modul-Bereich, NICHT in Navigation)

Aufgabentypen werden als kompakte Chip-Leiste direkt im Modul-Bereich angezeigt:

```
[Kernaufgaben] [Tauschaufg.] [Division] [Gemischt]
```

- Horizontal scrollbar bei vielen Typen
- Aktiver Typ visuell hervorgehoben (`--accent` Farbe)
- Klick wechselt Aufgabentyp ohne neues Overlay
- Position: zwischen Topbar und Canvas

### Lehrer-Steuerleiste (unterhalb Canvas, feste Position)

```
┌───────────────────────────────────────────────────┐
│ [💡 Hinweis]   [📖 Lösung]   [→ Nächste]         │
│                                                   │
│  ✅ 9 richtig · 📝 12 Aufgaben            [🔄]   │
└───────────────────────────────────────────────────┘
```

- **💡 Hinweis** — Manuell, zeigt nächsten Hint-Level
- **📖 Lösung zeigen** — Sofortige Lösungsanzeige (prominent, `--accent` Farbe)
- **→ Nächste Aufgabe** — Neue Aufgabe (gleicher Typ + Schwierigkeit)
- **🔄 Session zurücksetzen** — Für neue Unterrichtsstunde
- DOM-Element (kein Canvas) — feste 56px Höhe, immer sichtbar

### Implementierung

**`ModuleRegistration` erweitern:**
```ts
export interface TaskType {
  id: string;
  label: string;
}

export interface DifficultyLevel {
  id: number;
  label: string;
}

export interface ModuleRegistration {
  id: string;
  label: string;
  icon: string;
  description: string;
  taskTypes?: TaskType[];       // NEU
  difficulties?: DifficultyLevel[]; // NEU
  factory: () => LernModul;
}
```

**Shell: Overlay + Chips rendern**
- Topbar Modul-Label klickbar → öffnet Modul-Overlay
- Overlay: 2-Spalten-Grid mit allen Modulen + Schwierigkeitsregler
- Nach Modulwahl: Overlay schließt, Aufgabentyp-Chips rendern sich aus `taskTypes[]`
- Schwierigkeitsregler: Signal `difficulty`, alle Module lesen es

**Modul-Framework: Lösung + Hinweis (aus kanonischen Interfaces)**
```ts
// Framework ruft getSolution(task) aus der Modul-DSL auf:
showSolution(): void {
  const solution = this.activeModule.getSolution?.(this.currentTask);
  if (solution) {
    this.renderSolution(solution);  // Text + optionales Canvas-Overlay
  }
}

// Hint-Button ruft auf (manuell statt automatisch):
showNextHint(): void {
  this.currentHintLevel++;
  const hint = this.currentTask.hints[this.currentHintLevel - 1];
  this.setDomStatus(statusEl, hint, "warn");
}

// Erklär-Animation (nur wenn explain() definiert):
showExplanation(): void {
  const animation = this.activeModule.explain?.(this.currentTask, this.scene);
  if (animation) this.timeline.play(animation);
}
```

---

## Baustein 7b — Unified Click-Flow (Lehrer-Bedienlogik)

**Kernproblem:** Der aktuelle Flow ist aus 12 unabhängig gewachsenen Modulen entstanden. Jedes hat eigene Eingabemethoden, eigene "Nächste Aufgabe"-Trigger, eigene Mode-Switcher. Für den Lehrer am Smartboard bedeutet das: bei jedem Modulwechsel umlernen.

### IST-Zustand: Interaktionskarte aller 12 Module

| Modul | Eingabe | Nächste Aufgabe | Lösung zeigen | Mode-Switch |
|---|---|---|---|---|
| Einmaleins | Canvas-Buttons (Tauschen) | 🎲 Button | ✗ | Canvas-Tabs (3) |
| Geometrie | Canvas-Buttons + Numpad | 🎲 Button | ✗ | Canvas-Tabs (3) |
| Bruchteile | Canvas-Buttons + Line-Tap | Auto nach richtig | ✗ | Canvas-Tabs (4) |
| Zahlenlabor | Canvas-Numpad + DOM-Input | Manuell | ✗ | DOM-Buttons (3) |
| Größen | Canvas-Coins + DOM-Input | Manuell | ✗ | DOM-Radio (2) |
| Uhrzeiten | Numpad + Zeiger-Drag + Grid-Tap | Auto nach richtig | ✗ | DOM-Buttons (4) |
| Zufall | Roll-Buttons (explorativ) | 🎲 Reset | ✗ | Experiment-Buttons |
| Koordinaten | Grid-Tap + Numpad | 🎲 Button | ✗ | Canvas-Tabs (3) |
| Muster | Canvas-Numpad | ✔ Button | Regel-Button (nur Machine) | Canvas-Tabs (3) |
| Algorithmen | Canvas-Numpad (1 Ziffer/Spalte) | Auto nach letzter Spalte | ✗ | Canvas-Tabs (3) |
| Symmetrie | Pointer-Drag auf Grid | ✓ Prüfen | ✅ 💡 Lösung zeigen | DOM-Buttons (4) |
| Netze | Pointer-Tap/Drag auf Grid | ✓ Prüfen → Falten | ✗ | Farb-Picker + Templates |

### 4 Inkonsistenzen die den Lehrer ausbremsen

| # | Problem | Auswirkung |
|---|---|---|
| 1 | **"Nächste Aufgabe" ist überall anders** — mal 🎲-Button, mal Auto-Advance, mal ← →, mal Reset | Lehrer sucht nach dem Button |
| 2 | **Mode-Tabs mal im Canvas, mal als DOM-Buttons** — unterschiedliche Positionen, Styles, Verhalten | Kein konsistentes mentales Modell |
| 3 | **"Lösung zeigen" nur in Symmetrie** — alle anderen: 5× falsch antworten oder gar nicht | Lehrer kann Lösung nicht zeigen wenn er will |
| 4 | **Kein einheitliches Antwort-Feedback-Muster** — manche Module auto-advancen, manche nicht | Lehrer weiß nicht ob er klicken muss |

### SOLL-Zustand: Einheitlicher 4-Schritt-Flow

Jedes Modul (auch explorative) folgt demselben Ablauf:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  SCHRITT 1: Aufgabe anzeigen                        │
│  ─────────────────────────                          │
│  Canvas zeigt Visualisierung + Fragestellung        │
│  Lehrer kann besprechen, erklären, Kinder fragen    │
│                                                     │
│  SCHRITT 2: Antwort eingeben                        │
│  ─────────────────────────                          │
│  Kind kommt ans Board ODER Lehrer tippt             │
│  Eingabemethode ist modulspezifisch (ok!)           │
│  → Canvas-Numpad / Tap / Drag / Buttons             │
│                                                     │
│  SCHRITT 3: Feedback                                │
│  ─────────────────────────                          │
│  Richtig → Celebration + Sound + grüner Status      │
│  Falsch → Ermutigung + Sound + oranger Status       │
│  ⚡ KEIN Auto-Advance — Lehrer entscheidet wann     │
│                                                     │
│  SCHRITT 4: Lehrer-Aktion (Steuerleiste)            │
│  ─────────────────────────                          │
│  [→ Nächste]  oder  [💡 Hinweis]  oder  [📖 Lösung]│
│  Immer an derselben Stelle, immer gleiche Buttons   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Die 3 Regeln des Unified Flow

**Regel 1: Kein Auto-Advance — nie.**
```
// VORHER (fractions, time, algorithms):
if (correct) {
  this.triggerCelebration();
  setTimeout(() => this.newTask(), 1500); // ← Lehrer hat keine Kontrolle
}

// NACHHER:
if (correct) {
  this.triggerCelebration();
  this.enableNextButton();  // ← Lehrer entscheidet wann
}
```
Der Lehrer will nach einer richtigen Antwort vielleicht die Lösung besprechen, das Kind loben, oder die Klasse fragen "Warum ist das richtig?". Auto-Advance klaut diese Momente.

**Regel 2: Lehrer-Steuerleiste ist IMMER am gleichen Ort.**
```
┌─[Topbar: Modul-Label ▾]─────────────────────────────────┐
│  [Aufgabentyp-Chips]                                     │
│                                                          │
│              Canvas-Bereich (VOLLE BREITE)                │
│            (modulspezifische Visualisierung)              │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ [💡 Hinweis]   [📖 Lösung]   [→ Nächste]                 │ ← IMMER HIER
│  ✅ 9 richtig · 📝 12 Aufgaben               [🔄 Reset] │
└──────────────────────────────────────────────────────────┘
```
- Feste Position: unterhalb des Canvas, oberhalb der Unterkante
- Feste Höhe: 56px (primäre CTA-Größe nach CLAUDE.md)
- Feste Reihenfolge: Hinweis → Lösung → Nächste (links nach rechts)
- DOM-Element, kein Canvas — für zuverlässige Positionierung

**Regel 3: Mode-Tabs werden zu Aufgabentyp-Chips (DOM, über Canvas).**
```
// VORHER: Tabs IM Canvas (oben) — frisst Canvas-Platz, inkonsistentes Styling
┌─[Punkte][Sprünge][Division]─────────────────┐
│         Canvas-Bereich                       │

// NACHHER: Aufgabentyp-Chips als DOM-Leiste über dem Canvas
┌─[Kernaufgaben]─[Tauschaufg.]─[Division]─────┐  ← DOM, 36px
├──────────────────────────────────────────────┤
│         Canvas-Bereich (mehr Höhe!)          │
```
Canvas gewinnt Höhe: Tabs sind jetzt schlanke DOM-Chips (36px) statt Canvas-gezeichnete Tabs.

### Sonderfall: Explorative Module (Zufall, Netze)

Zufall und Netze haben keinen klassischen Aufgabe→Antwort-Flow. Hier gilt:

```
┌─[🔢 Mathewerkstatt]─[🎲 Zufall ▾]──────────[🔔][☀️]─┐
│  [Würfel] [Glücksrad A] [Glücksrad B]  ← Typ-Chips   │
│                                                        │
│  Canvas: Experiment-Visualisierung                     │
│  [1× Würfeln] [10×] [50×] [100×]                      │
│  Ergebnis-Tabelle + Diagramm                           │
│                                                        │
├────────────────────────────────────────────────────────┤
│ [🔄 Zurücksetzen]                       📝 3 Läufe    │
└────────────────────────────────────────────────────────┘
```

- Kein "Hinweis" / "Lösung" (sinnlos bei Exploration)
- Stattdessen: "🔄 Zurücksetzen" und Lauf-Counter
- Schwierigkeitsregler ausgegraut (nicht anwendbar)
- Steuerleiste ist trotzdem DA — gleicher Ort, nur andere Buttons

### Implementierung im Modul-DSL

```ts
export default defineModule({
  id: "fractions",
  title: "Bruchteile",
  icon: "🍰",

  // Aufgabentypen → werden Chips im Modul-Bereich
  taskTypes: [
    { id: "circle",   label: "Kreismodell" },
    { id: "bar",      label: "Balkenmodell" },
    { id: "compare",  label: "Vergleichen" },
    { id: "line",     label: "Zahlenstrahl" },
  ],

  // Flow-Typ bestimmt Steuerleisten-Variante (siehe kanonische Interfaces)
  flowType: "task",

  generate(difficulty: number, taskType: string, context?: ModuleContext): Task { ... },
  check(input: unknown, task: Task): CheckResult { ... },

  // Lösung als strukturierte Daten (siehe SolutionDisplay Interface)
  getSolution(task: Task): SolutionDisplay {
    return {
      text: `${task.numerator}/${task.denominator}`,
      overlay: (ctx, layout) => {
        highlightCorrectSlice(ctx, task.numerator, task.denominator);
      },
    };
  },
});
```

### Optimaler Click-Flow für typische Unterrichtssituation

```
LEHRER                              APP
──────                              ───
Klickt Modul-Label in Topbar     →  Modul-Overlay öffnet sich
Klickt "Einmaleins"              →  Overlay schließt, Modul aktiviert
Klickt "Punktfelder" (Chip)      →  Aufgabentyp gewechselt

"Wie viel ist 7 × 4?"              Visualisierung: 7×4 Punktfeld

Kind kommt ans Board             →  Kind tippt Antwort (Numpad)
                                  ←  Celebration! ✅ + Sound

"Warum ist das richtig?"            Lehrer bespricht mit Klasse
                                     (kein Auto-Advance — Zeit zum Reden)

Klickt [→ Nächste]               →  Neue Aufgabe erscheint

Kind antwortet falsch             ←  "Nicht ganz!" + oranger Status

Klickt [💡 Hinweis]              →  "Denk an die 7er-Reihe"

Kind antwortet nochmal falsch     ←  "Knapp daneben!"

Klickt [📖 Lösung]              →  "7 × 4 = 28" + Visualisierung

"Schaut euch das an..."            Lehrer erklärt am Board

Klickt [→ Nächste]               →  Neue Aufgabe

Klickt Modul-Label → "Geometrie" →  Modulwechsel (gleicher Flow!)
```

**Klicks pro Aufgabe (Normalfall):**
- Richtige Antwort: **2** (Antwort + Nächste)
- Mit Hinweis: **4** (Antwort + Hinweis + Antwort + Nächste)
- Mit Lösung: **3** (Antwort + Lösung + Nächste)

**Minimale kognitive Last für den Lehrer:** Die Steuerleiste ist IMMER gleich. Modulwechsel ändert nur den Canvas-Inhalt, nie die Bedienlogik.

---

## Baustein 8 — Testing-Infrastruktur

- **Vitest** für Unit-Tests (Modul-Generatoren, Check-Logik)
- **Playwright** für E2E (Canvas-Screenshots, Touch-Simulation)
- **Visual Regression** via eigene Baseline-Screenshots

Durch die Modul-DSL werden `generate()` und `check()` zu reinen Funktionen — trivial testbar.

---

## Baustein 9 — Build & DX

- **HMR für Canvas:** Vite-Plugin das bei Modul-Änderung nur das aktive Modul neu mounted
- **Dev-Overlay verbessern:** Violations + Performance-Metrics + Layout-Grid-Overlay
- **Modul-Preview via URL:** `?module=fractions&taskType=circle&difficulty=2` für schnelles Testen
- **Debug-Param:** `?debug=true` blendet Layout-Grid + Violation-Overlay ein

---

## Abhängigkeitsgraph der Bausteine (Kern, Bausteine 0–9)

> **Hinweis:** Dies ist der initiale Graph für die Kern-Bausteine. Der vollständige Graph mit allen 19 Bausteinen (0–18) steht im Abschnitt "Aktualisierter Abhängigkeitsgraph (Final)" weiter unten.

```
Baustein 0  (Canvas-Layout)  ════╗  FUNDAMENT — alles andere baut darauf auf
                                  ║
Baustein 1  (Scene Graph)     ──╬── braucht 0 als Layout-Engine
Baustein 2  (Modul-DSL)       ──╝── braucht 0 + 1

Baustein 3  (h()-Templates)    ──── unabhängig, parallel möglich
Baustein 4  (Micro-Signals)   ──── unabhängig, parallel möglich
Baustein 5  (CSS 3-Schichten) ──── unabhängig, parallel möglich
Baustein 6  (Visual Refresh)  ──── braucht 5 (CSS) als Basis
Baustein 7  (Overlay-Nav+Steuer.) ── braucht ModuleRegistration-Erweiterung aus 2
Baustein 7b (Unified Flow)    ──── braucht 2 (DSL) + 7 (Steuerleiste)
Baustein 8  (Testing)         ──── braucht 0 + 2 für vollen Nutzen
Baustein 9  (Build/DX)        ──── unabhängig, parallel möglich
```

**Warum Baustein 0 zuerst:**
Das Canvas-Layout war in JEDER bisherigen Iteration die größte Fehlerquelle. Ohne ein robustes Fundament werden alle anderen Verbesserungen (Scene Graph, DSL, Visual Refresh) die gleichen Positionierungsprobleme reproduzieren. Baustein 0 eliminiert die 10 Root Causes an der Wurzel.

**Warum Baustein 7b zwingend ist:**
Der Lehrer hat am Smartboard keine Zeit zum Umlernen bei jedem Modulwechsel. Ein einheitlicher Click-Flow (Aufgabe → Antwort → Feedback → Lehrer-Aktion) über ALLE Module reduziert die kognitive Last von "12 verschiedene Bedienkonzepte" auf "1 universelles Muster".

---

## Review-Ergebnisse: Identifizierte Lücken & Ergänzungen

Nach vollständiger Überprüfung des Plans gegen Codebase, CLAUDE.md-Richtlinien und Smartboard-Use-Case wurden folgende Ergänzungen identifiziert.

### Baustein 10 — Smartboard-Essentials (KRITISCH)

Diese Features sind für den Lehrer-Use-Case am Smartboard **unverzichtbar** und fehlen im aktuellen Plan:

**10.1 Fullscreen-Modus**
- F11 / Doppelklick auf Topbar → `document.documentElement.requestFullscreen()`
- Navigation ist bereits versteckt — Fullscreen nutzt volle Fläche optimal
- ESC zum Verlassen (native Browser-Verhalten)
- Smartboards haben oft keine sichtbare Browser-Adressleiste — Fullscreen ist der Normalzustand

**10.2 URL-Deep-Linking**
- `?module=fractions&taskType=circle&difficulty=2` → direkter Einstieg
- Lehrer kann Unterrichtsvorbereitung als Lesezeichen speichern
- Hash-basiertes Routing reicht (kein Server nötig bei Single-File-Output):
  ```
  #/multiplication/core?d=2  → Einmaleins, Kernaufgaben, Stufe 2
  #/fractions/circle?d=1     → Bruchteile, Kreismodell, Stufe 1
  ```
- `shell.activateModule()` liest URL-Hash beim Start
- Modulwechsel aktualisiert Hash (ohne Page-Reload)

**10.3 Browser-Zielkompatibilität**
- Build-Target: **ES2020** statt ES2022 (Schul-Chromebooks haben oft ältere Chrome-Versionen)
- `tsconfig.json`: `"target": "ES2020"`, `"lib": ["ES2020", "DOM"]`
- Vite: `build.target: "es2020"`
- Kein `Object.hasOwn()`, kein `Array.at()`, kein Top-Level-Await
- Optional: Browserslist `.browserslistrc`: `Chrome >= 88, Firefox >= 78, Safari >= 14`

**10.4 Keyboard-Shortcuts für Smartboard-Steuerung**

| Shortcut | Aktion | Kontext |
|---|---|---|
| **Leertaste** | Nächste Aufgabe | Nur wenn Aufgabe abgeschlossen (richtig/falsch beantwortet) |
| **Escape** | Overlay schließen / zur Startseite | Wenn Overlay offen → schließt es. Sonst → Startseite |
| **H** | Nächsten Hinweis zeigen | Nur im Modul (nicht auf Startseite) |
| **L** | Lösung zeigen | Nur im Modul |
| **E** | Erklär-Animation starten/pausieren | Nur bei Modulen mit `explain()` |
| **1–9** | Schnellantwort bei Multiple-Choice | Nur wenn Canvas-Buttons mit Ziffern sichtbar |
| **Alt+1–9** | Modulwechsel ohne Overlay | Global, immer aktiv |
| **Alt+0** | Startseite | Global, immer aktiv |
| **Alt+F / F11** | Fullscreen toggle | Global |

**Konfliktvermeidung:** `1–9` ohne Alt = Antwort-Input, `Alt+1–9` = Modulwechsel. Framework prüft ob Canvas-Buttons aktiv sind bevor `1–9` als Antwort interpretiert wird.

- Shortcuts als Tooltips auf Topbar-Buttons und im Modul-Overlay anzeigen

**10.5 Seitenverhältnis-Robustheit**
- Smartboards: 16:9 (modern), 16:10, 4:3 (ältere Modelle)
- Beamer: 4:3, 16:9, 16:10
- Canvas-Layout (Baustein 0) muss mit `aspectRatio < 1.2` (fast quadratisch) funktionieren
- Testen: `?viewport=4:3` Debug-Parameter

### Baustein 11 — Aufgaben-Engine, Curriculum & Didaktik

#### 11.1 Lehrplan-Verankerung: LehrplanPLUS Bayern Mathematik 3/4

Der LehrplanPLUS gliedert Mathematik in vier Lernbereiche:

| Lernbereich | Schwerpunkte Jgst. 3/4 | Abdeckung durch App |
|---|---|---|
| **Zahlen & Operationen** | Zahlenraum bis 1.000.000, Stellenwert, schriftliche Verfahren, Rechenstrategien, Zahlenfolgen | ✅ Zahlenlabor, Algorithmen, Einmaleins, Muster |
| **Raum & Form** | Orientierung im Raum, geometrische Figuren, Spiegelungen, Flächen/Volumen | ✅ Geometrie, Symmetrie, Netze, Koordinaten |
| **Größen & Messen** | Länge, Gewicht, Zeit, Geld, Flächen | ✅ Größen, Uhrzeiten |
| **Daten & Zufall** | Daten erfassen, Tabellen, Diagramme, Wahrscheinlichkeiten | ⚠️ Zufall (nur Wahrscheinlichkeit), **Diagramme fehlen** |

**Lehrplan-Forderung:** Schüler sollen Rechenwege *erklären, vergleichen und begründen*.
→ **Genau hier liegt der größte Mehrwert der App: Rechenwege animiert zeigen.**

#### 11.2 Didaktische Priorisierung: Strukturverständnis vor Drill

**Kernprinzip:** Die App konzentriert sich auf **Strukturverständnis und Rechenwege**, nicht auf Auswendiglernen. Software hat dort Mehrwert, wo sie Zusammenhänge **dynamisch sichtbar** machen kann.

| Didaktischer Mehrwert | Themen | App-Strategie |
|---|---|---|
| **Extrem hoch** | Stellenwertsystem, schriftliche Verfahren, Multiplikation als Flächenmodell | Animierte Herleitungen, Schritt-für-Schritt |
| **Hoch** | Division als Aufteilen, Zahlenstrahl, Brüche, Geometrische Transformationen | Interaktive Visualisierungen |
| **Mittel** | Diagramme, Einheiten-Umrechnung, Muster | Statische + leichte Animation |
| **Gering** | Reines Einmaleins-Drill, mechanisches Rechnen | Nur als Übungsmodus, nicht als Kernfeature |

**Top 6 Module nach didaktischem Wert:**
1. Stellenwertsystem (Zahlenlabor) — ⭐⭐⭐⭐⭐
2. Schriftliche Addition/Subtraktion (Algorithmen) — ⭐⭐⭐⭐⭐
3. Multiplikation als Flächenmodell (Einmaleins) — ⭐⭐⭐⭐⭐
4. Division als Aufteilen (Einmaleins) — ⭐⭐⭐⭐
5. Zahlenstrahl-Rechnen (Zahlenlabor) — ⭐⭐⭐⭐
6. Brüche visualisieren (Bruchteile) — ⭐⭐⭐⭐

→ Diese 6 Module decken **~70–80% der schwierigsten Lehrplaninhalte** ab.

#### 11.3 Neues Interaktionsmodell: Schrittbasierter Dialog

**Paradigmenwechsel:** Statt "Was ist 37 + 48?" → "**Wie willst du rechnen?**"

Der Schüler (oder Lehrer) wählt den Rechenweg:

```
37 + 48 = ?

Wie willst du rechnen?
  [Zerlegen]  [Zahlenstrahl]  [Schriftlich]
```

Je nach Wahl zeigt die App eine andere Erklär-Animation:

**Weg "Zerlegen":**
```
37 + 48
= (30 + 40) + (7 + 8)    ← Animation: Zahlen "spalten" sich
= 70 + 15                  ← Teilsummen verschmelzen
= 85                       ← Endsumme
```

**Weg "Zahlenstrahl":**
```
37 ──[+40]──→ 77 ──[+8]──→ 85    ← Animierte Bögen auf Zahlenstrahl
```

**Weg "Schriftlich":**
```
  37
+ 48     ← Spaltenweise, Übertrag als Blase
────
  85
```

**Integration in Modul-DSL:**
```ts
export default defineModule({
  id: "algorithms",
  // ...

  // NEU: Rechenwege als Varianten der Erklär-Animation
  solutionPaths: [
    { id: "decompose", label: "Zerlegen",       icon: "✂️" },
    { id: "numberline", label: "Zahlenstrahl",   icon: "📏" },
    { id: "written",    label: "Schriftlich",    icon: "✏️" },
  ],

  explain(task, path, scene): SequenceAnimation {
    switch (path) {
      case "decompose":  return this.explainDecompose(task, scene);
      case "numberline": return this.explainNumberLine(task, scene);
      case "written":    return this.explainWritten(task, scene);
    }
  },
});
```

**Lehrer-Steuerleiste mit Rechenweg-Auswahl:**
```
[✂️ Zerlegen] [📏 Zahlenstrahl] [✏️ Schriftlich]  ← Rechenweg wählen
[▶ Erklärung]  [💡 Hinweis]  [📖 Lösung]  [→ Nächste]
```

#### 11.4 Neue Visualisierungskonzepte aus Lehrplananalyse

**A. Multiplikation als Flächenmodell (mehrstufig)**

Über das einfache Punktfeld hinaus: **Zerlegung in Teilflächen** für mehrstellige Multiplikation:

```
23 × 14:

┌──────────────┬────┐
│              │    │
│  20 × 10     │20×4│   Animation:
│  = 200       │=80 │   1. Gesamtrechteck erscheint (300ms)
│              │    │   2. Vertikale Linie teilt 20|3 (drawLine 400ms)
├──────────────┼────┤   3. Horizontale Linie teilt 10|4 (drawLine 400ms)
│  3 × 10 = 30│3×4 │   4. Teilflächen füllen sich nacheinander (stagger 400ms)
│              │=12 │   5. Teilprodukte erscheinen: 200, 80, 30, 12
└──────────────┴────┘   6. Summe: 200+80+30+12 = 322 (morph 400ms)
```

→ Kind SIEHT, warum 23×14 = 200+80+30+12. Kein Hexenwerk, sondern Fläche.

**B. Division als Aufteilen (Verteilen)**

```
12 : 3 = ?

Animation:
  12 Kugeln in einer Reihe
  → 3 "Kinder" (Boxen) erscheinen
  → Kugeln werden nacheinander verteilt:
     1. Kugel → Kind 1
     2. Kugel → Kind 2
     3. Kugel → Kind 3
     4. Kugel → Kind 1
     ... (Karussell-Verteilung)
  → Jede Box hat 4 Kugeln
  → "12 : 3 = 4"

Division mit Rest (17 : 4):
  → 4 Boxen à 4 Kugeln
  → 1 Kugel übrig (hervorgehoben, andere Farbe)
  → "17 : 4 = 4 Rest 1"
```

**C. Zahlenstrahl-Zoom**

```
Übersicht:    0 ──────────────── 100
                         ↓ Zoom
Detail:       34 ── 35 ── 36 ── 37 ── 38 ── 39 ── 40

Animation:
  1. Zahlenstrahl 0–100 sichtbar
  2. Bereich um Zielzahl "zoomt" herein (scale + translate, 800ms)
  3. Feinere Markierungen erscheinen (stagger 100ms)
  4. Rechensprünge als Bögen auf gezoomtem Strahl
```

**D. Stellenwert-Interaktion (bündelbar + zerlegbar)**

```
Schüler-Interaktion:
  [347] eingeben oder mit Slider ändern

  ┌─────────────────────────────────────────┐
  │ ■■■         ||||||||||||    • • • • • • •│
  │ 3 Hunderter  4 Zehner      7 Einer      │
  │              Stäbe         Würfel        │
  └─────────────────────────────────────────┘

  Aktion "Bündeln":
    10 Einer-Würfel → wandern zusammen (arc, 600ms)
    → verschmelzen zu 1 Zehner-Stab (morph 400ms)

  Aktion "Zerlegen":
    1 Hunderter-Platte → spaltet sich (400ms)
    → wird zu 10 Zehner-Stäbe (split + stagger 200ms)
```

#### 11.5 Generative Aufgaben statt Hardcoded-Pools

Aktuell: Bruchteile-Modul hat nur **31 fest kodierte Aufgaben**. Bei täglichem Einsatz wiederholen sich Aufgaben.

Neu: Jedes Modul bekommt einen **parametrischen Generator**:

```ts
generate(difficulty, taskType) {
  const denominator = pick(difficulty === 1 ? [2,3,4] : [2,3,4,5,6,8,10,12]);
  const numerator = randInt(1, denominator - 1);
  return { numerator, denominator, ... };
}
```

#### 11.6 Schwierigkeits-Progression (3 Stufen)

| Stufe | Zahlenraum | Komplexität |
|---|---|---|
| 1 (Leicht) | Kleine Zahlen, einfache Fälle | Grundoperationen |
| 2 (Mittel) | Erweiterter Zahlenraum | Kombinierte Konzepte |
| 3 (Schwer) | Voller Lehrplan-Zahlenraum | Transfer, Umkehrungen |

#### 11.7 Fehlende Lehrplan-Themen (Phase 2)

| Thema | Lehrplan-Relevanz | Modul-Typ |
|---|---|---|
| **Daten & Diagramme** | Mittel | Neues Modul: Mini-Umfrage → Balken-/Kreisdiagramm |
| **Sachaufgaben** | Hoch | Neues Modul: Text→Rechnung→Lösung |
| **Schätzen & Überschlagen** | Mittel | Erweiterung Zahlenlabor: Zahlenstrahl-Schätzung |

#### 11.8 Animations-Primitive (Minimalset für Aufgaben-Engine)

Jede Aufgabe = Zustandsmaschine. Die Engine braucht nur **6 Grundoperationen**:

```ts
spawn(object, position, style)    // Objekt erscheint (fade/scale-in)
move(object, target, easing)      // Objekt bewegt sich
merge(objects, target)            // Mehrere Objekte verschmelzen zu einem
split(object, count, layout)      // Ein Objekt teilt sich in mehrere
highlight(object, style)          // Objekt hervorheben (glow/pulse/color)
count(objects, label, stagger)    // Objekte nacheinander zählen mit Label
```

Beispiel: `merge(10, ones) → tens` — 10 Einer verschmelzen zu 1 Zehner.

#### 11.9 Didaktische Design-Prinzipien

1. **Aktion und Ergebnis nahe beieinander** — kein Scrollen zwischen Input und Feedback
2. **Visuelle Bestätigung** — jede Aktion hat sofortige Rückmeldung
3. **Positive Rückmeldung** — Fehler als Lernmoment, nicht als Versagen
4. **Fehler ZEIGEN statt nur markieren** — Animation zeigt den korrekten Weg
5. **Rechenweg vor Ergebnis** — der Prozess ist wichtiger als die Antwort

### Baustein 12 — Resilienz & Fehlerbehandlung

**12.1 Crash Recovery**
- `window.onerror` + `window.onunhandledrejection` → Fehler-Overlay statt weißer Seite
- Fehlermeldung: "Ein Fehler ist aufgetreten. Bitte Seite neu laden."
- Automatischer Reload-Button im Overlay

**12.2 localStorage-Robustheit**
- `safeSetLocalStorage()` fängt bereits `QuotaExceededError` — gut
- Zusätzlich: Beim App-Start alte/korrupte Einträge bereinigen
- Fallback auf In-Memory-State wenn localStorage komplett blockiert (private Browsing)

**12.3 Offline-Hinweis für Google Fonts**
- Atkinson Hyperlegible wird von Google Fonts geladen — ohne Internet kein Font
- Fallback-Kette ist bereits definiert (`system-ui`), aber:
- Entweder Font inline einbetten (passt zum Single-File-Konzept) ODER
- Font als lokale Datei im Build mitliefern via `@font-face` + Vite Asset-Handling

### Baustein 13 — Classroom-gerechtes Feedback

**13.1 Celebration für Klassenraum anpassen**
- Konfetti-Animation: **kürzer** (500ms statt 1200ms), weniger Partikel
- Im Klassenkontext: Lehrer will schnell weiter, nicht 1.2s auf Animation warten
- Sound-Feedback: Beibehalten, aber `gain` noch leiser für Smartboard-Lautsprecher (oft schlecht)

**13.2 Sound-Design für Klassenzimmer**
- Aktuelle Gains (0.05–0.10) sind gut — beibehalten
- NEU: **Master-Volume-Regler** in der Topbar (nicht nur Mute-Toggle)
- Smartboard-Lautsprecher verzerren schnell → Low-Pass-Filter auf Sounds

**13.3 Hints: Konzeptuelle Tiefe**
- Aktuelle Hints sind oft nur "Probier nochmal!" → wenig hilfreich
- Im Modul-DSL: Hints müssen **aufgabenspezifisch** sein:
  ```ts
  hints: [
    `Denk an die ${a}er-Reihe.`,              // Strategie-Hinweis
    `${a} × ${b} = ${a} + ${a} + ... (${b}×)`, // Visualisierungshinweis
    `${a} × ${b} = ${a * b}`,                   // Lösung
  ]
  ```
- Framework validiert: `hints.length >= 2` pro Task (Lint-Regel)

### Baustein 14 — Accessibility-Härtung

**14.1 ARIA für Canvas**
- Canvas ist für Screenreader unsichtbar — `aria-label` auf `<canvas>` mit aktuellem Aufgabentext
- Bei Aufgabenwechsel: `aria-live="polite"` Region aktualisieren
- Bereits teilweise vorhanden (Topbar-Label), aber Canvas-Inhalt selbst nicht beschrieben

**14.2 Fokus-Management**
- Nach Modulwechsel: Fokus auf ersten interaktiven Canvas-Button setzen
- Nach Feedback: Fokus auf "Nächste Aufgabe"-Button (Lehrer-Steuerleiste)
- `tabindex` auf Canvas-Container für Keyboard-Navigation

**14.3 Pointer-Cancel (WCAG 2.5.2)**
- Touch-Events: `pointerup` statt `pointerdown` für finale Aktionen
- Ermöglicht "Finger wegziehen zum Abbrechen"
- Bereits in `base-module.ts` mit `pointerup` — prüfen ob konsistent in allen Modulen

### Baustein 15 — Animations-Engine: Mathematik in bewegten Bildern (SCHLÜSSEL-MEHRWERT)

**Kernthese:** Der entscheidende Vorteil der App gegenüber Arbeitsblättern, Schulbüchern und statischen Übungen ist die **dynamische, animierte Herleitung mathematischer Zusammenhänge**. Kein Lehrer kann am Whiteboard einen Übertrag als wandernde Blase zeigen, ein Netz sich in 3D falten lassen, oder Bruchteile fließend ineinander überführen. Die App MUSS diesen Mehrwert konsequent ausschöpfen.

#### IST-Zustand: Animationsfähigkeit pro Modul

| Modul | Animations-Status | Bewertung |
|---|---|---|
| **Netze** | 3D-Faltung, Morphing, Drag-Rotation, Auto-Spin | ⭐⭐⭐⭐⭐ Exzellent |
| **Einmaleins** | Punktfeld-Aufbau Reihe für Reihe, Tausch-Flip | ⭐⭐⭐ Gut |
| **Geometrie** | Flächenzählung Zelle für Zelle, Umfang-Nachzeichnung | ⭐⭐⭐ Gut |
| **Bruchteile** | Kreissektoren-Aufbau, (Äquivalenz-Bar unfertig) | ⭐⭐ Teilweise |
| **Muster** | Kugel durch Funktionsmaschine, Figurenaufbau | ⭐⭐ Teilweise |
| **Algorithmen** | Übertrag-Blase (State vorbereitet, Rendering unvollständig) | ⭐ Minimal |
| **Zahlenlabor** | Sprung auf Zahlenstrahl, Bündelung (State vorbereitet) | ⭐ Minimal |
| **Koordinaten** | Fadenkreuz-Bewegung (State vorbereitet, kein Easing) | ⭐ Minimal |
| **Symmetrie** | Achsen-Pulsieren (nur dekorativ, nicht erklärend) | ⚪ Dekorativ |
| **Zufall** | Rad-Drehen | ⚪ Dekorativ |
| **Uhrzeiten** | – | ⚪ Keine |
| **Größen** | – | ⚪ Keine |

**Fazit:** Nur 1 von 12 Modulen (Netze) nutzt Animation als echtes Erklärmittel. Die meisten haben bestenfalls dekorative Reveal-Animationen.

#### SOLL-Zustand: Jedes Modul erklärt durch Animation

##### Animations-Philosophie: "Zeig den Weg, nicht nur das Ziel"

Jede Animation muss eine **mathematische Einsicht** vermitteln. Keine Animation nur weil es hübsch aussieht.

| Prinzip | Beispiel |
|---|---|
| **Herleitung zeigen** | 3 × 4: Drei Reihen à 4 Punkte bauen sich nacheinander auf |
| **Zusammenhang visualisieren** | Bruch ½ = ²⁄₄: Kreis teilt sich animiert von 2 in 4 Teile |
| **Prozess offenlegen** | Schriftliche Addition: Übertrag wandert sichtbar als Blase |
| **Transformation zeigen** | Symmetrie: Spiegelachse klappt die Figur auf die andere Seite |
| **Abstraktion konkretisieren** | Zahlenstrahl: Sprünge als animierte Bögen |

##### 15.1 Animations-Infrastruktur (im Scene Graph, Baustein 1)

```ts
// Im Scene Graph: Jeder Node kann animiert werden
interface Animatable {
  animateTo(props: Partial<NodeProps>, duration: number, easing?: EasingFn): Animation;
  sequence(steps: AnimationStep[]): Animation;  // Sequentielle Schritte
  stagger(children: CanvasNode[], props: Partial<NodeProps>, opts: StaggerOpts): Animation;
}

// Easing-Bibliothek (kompakt, ~30 Zeilen)
const ease = {
  linear: (t: number) => t,
  easeOut: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t: number) => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2,
  spring: (t: number) => 1 - Math.cos(t * Math.PI * 0.5) * Math.exp(-6 * t),
  bounce: (t: number) => { /* Bouncing ball */ },
};

// Sequenz-Builder für mehrstufige Erkläranimationen
const explanation = sequence([
  { action: () => highlightRow(1), duration: 400 },      // "Erste Reihe"
  { action: () => highlightRow(2), duration: 400 },      // "Zweite Reihe"
  { action: () => highlightRow(3), duration: 400 },      // "Dritte Reihe"
  { action: () => showTotal(), duration: 600 },           // "Zusammen: 12"
]);

// Lehrer-gesteuert: Play/Pause über Steuerleiste
explanation.play();   // [▶ Abspielen]
explanation.pause();  // [⏸ Pause]
explanation.reset();  // [⏮ Zurück]
```

##### 15.2 Lehrer-Steuerleiste: Animations-Kontrolle

```
┌───────────────────────────────────────────────────────────┐
│ [▶ Erklärung]  [💡 Hinweis]  [📖 Lösung]  [→ Nächste]   │
└───────────────────────────────────────────────────────────┘
```

**Neuer Button: [▶ Erklärung abspielen]**
- Startet die Schritt-für-Schritt-Erklärungs-Animation
- Während Abspielen: Button wird zu [⏸ Pause]
- Lehrer kann jederzeit pausieren, erklären, fortsetzen
- Am Ende: Button wird zu [⏮ Nochmal]
- Nicht alle Module haben Erklär-Animationen → Button erscheint nur wenn `explain()` in der Modul-DSL definiert ist

##### 15.3 Animations-Konzept: Alle Module × Aufgabentypen

**Legende:**
- ✅ = Animation existiert bereits
- 🔧 = State-Machine vorbereitet, Rendering unvollständig
- 🆕 = Neu zu entwickeln
- ⭐ = Höchster pädagogischer Mehrwert (Schlüssel-Differenzierung)

---

**ALGORITHMEN (Schriftliches Rechnen)** — 3 Aufgabentypen

| Aufgabentyp | Erklär-Animation | Status | Pädagogischer Wert |
|---|---|---|---|
| **Addition** | ⭐ Übertrag wandert als Blase von Spalte zu Spalte (arc trajectory, 500ms). Ergebnis-Ziffer fällt ins Feld. Spalte leuchtet auf wenn aktiv. | 🔧 State existiert | ⭐⭐⭐⭐⭐ |
| **Subtraktion** | ⭐ Borgen-Animation: Zehner "gibt ab" an Einer-Spalte (Blase wandert rechts→links, spaltet sich in 10 Einheiten). | 🔧 State existiert | ⭐⭐⭐⭐⭐ |
| **Multiplikation** | Spaltenweise Berechnung: Zwischenergebnisse erscheinen, Überträge wandern wie bei Addition. | 🆕 | ⭐⭐⭐⭐ |

```
Choreographie "Addition 347 + 185":
  Spalte Einer:  7+5=12 → "2" fällt ↓ (arcMoveTo 400ms)
                            "1" wandert ← als Blase (500ms, bounce)
  Spalte Zehner: 4+8+1=13 → Blase "platzt" in Rechnung (pop 200ms)
                              "3" fällt ↓, "1" wandert ←
  Spalte Hunderter: 3+1+1=5 → "5" fällt ↓
  Ergebnis: 532 pulsiert grün (300ms)
  Dauer: ~4.5s, pausierbar
```

---

**EINMALEINS** — 3 Aufgabentypen

| Aufgabentyp | Erklär-Animation | Status | Pädagogischer Wert |
|---|---|---|---|
| **Punktfeld** | ⭐ Reihe-für-Reihe-Aufbau mit Zähl-Labels ("6... 12... 18... 24") + 90°-Rotation für Kommutativgesetz. | ✅ Teilweise | ⭐⭐⭐⭐⭐ |
| **Sprünge** | ⭐ Bögen zeichnen sich nacheinander auf Zahlenstrahl (quadratic curve, stagger 300ms). Jeder Bogen mit "+b" Label. | 🆕 | ⭐⭐⭐⭐ |
| **Division** | Punkte "gruppieren sich" in Boxen (Sammelbewegung, easeOutBounce). Zeigt: "24 ÷ 6 = 4 Gruppen". | 🆕 | ⭐⭐⭐⭐ |

```
Choreographie "4 × 6 = 24":
  Reihe 1: 6 Punkte poppen ein (stagger 80ms) → Label "6"
  Reihe 2: 6 Punkte → Label "6 + 6 = 12"
  Reihe 3: → "12 + 6 = 18"
  Reihe 4: → "18 + 6 = 24"
  Label morpht zu "4 × 6 = 24" (400ms)
  Rotation 90° → "6 × 4 = 24" (Kommutativgesetz, 800ms)
  Dauer: ~5.5s
```

---

**BRUCHTEILE** — 4 Aufgabentypen

| Aufgabentyp | Erklär-Animation | Status | Pädagogischer Wert |
|---|---|---|---|
| **Kreismodell** | ⭐ Schnittlinien ziehen sich durch Kreis (Mitte→Rand), Sektoren füllen sich nacheinander mit Counter. | ✅ Teilweise | ⭐⭐⭐⭐⭐ |
| **Balkenmodell** | ⭐ Äquivalenz-Animation: Balken "teilt sich" bei ×2/×3 (Schnittlinien + Sektor-Split, 400ms). Zeigt ½ = ²⁄₄. | 🔧 State existiert | ⭐⭐⭐⭐⭐ |
| **Vergleich** | Zwei Balken nebeneinander: Höherer "sinkt", niedrigerer "steigt" → gleiche Referenzlinie zeigt Größenverhältnis. | 🆕 | ⭐⭐⭐ |
| **Zahlenstrahl** | Marker gleitet zu getippter Position (easeOutCubic 300ms). Bei Fehler: Bogen zeigt Distanz zum richtigen Punkt. | 🆕 | ⭐⭐⭐ |

```
Choreographie "Äquivalenz ½ = ²⁄₄ = ⁴⁄₈":
  Kreis mit ½ → Neue Linie schneidet (400ms) → 4 Viertel
  Gefärbte zählen: "1/4... 2/4" (stagger 300ms)
  Label morpht: "½" → "²⁄₄" (Zähler+Nenner rollen, 400ms)
  Weitere Linien → 8 Achtel → "⁴⁄₈"
  Finale: "½ = ²⁄₄ = ⁴⁄₈" (extend 300ms)
  Dauer: ~5s
```

---

**GEOMETRIE** — 3 Aufgabentypen

| Aufgabentyp | Erklär-Animation | Status | Pädagogischer Wert |
|---|---|---|---|
| **Formgalerie** | Symmetrieachsen rotieren als animierte Linien, Winkel-Bögen zeichnen sich (arc sweep 400ms). | 🆕 | ⭐⭐⭐ |
| **Winkeltypen** | ⭐ Winkelbogen zeichnet sich von Strahl zu Strahl (easeInOutQuad 400ms). Farbe codiert Typ (spitz/recht/stumpf). | 🆕 | ⭐⭐⭐⭐ |
| **Fläche & Umfang** | ⭐ Flächenzählung: Zellen füllen sich reihenweise (stagger 60ms/Zelle + Counter). Umfang: Punkt fährt Kante entlang. | ✅ Teilweise | ⭐⭐⭐⭐ |

```
Choreographie "Umfang 3×4 Rechteck":
  Punkt startet oben-links
  Fährt Oberkante entlang → Counter: "1, 2, 3, 4"
  Rechte Kante → "+3" (7)
  Untere Kante → "+4" (11)
  Linke Kante → "+3" (14)
  Ring schließt sich → "= 14" (pulse, ok-Farbe)
  Dauer: ~3.5s
```

---

**SYMMETRIE** — 4 Aufgabentypen

| Aufgabentyp | Erklär-Animation | Status | Pädagogischer Wert |
|---|---|---|---|
| **Spiegel vertikal** | ⭐ Quell-Zellen "klappen" über Spiegelachse (pseudo-3D Y-Rotation, 800ms). Jede Zelle fliegt auf Bogen zu ihrer Spiegelposition. | 🆕 | ⭐⭐⭐⭐⭐ |
| **Spiegel horizontal** | Gleiche Klapp-Animation, aber über X-Achse. | 🆕 | ⭐⭐⭐⭐⭐ |
| **Vergrößerung ×2** | Jede Quell-Zelle "expandiert" zu 2×2 Block (scale 1→2, easeOutCubic 400ms). | 🆕 | ⭐⭐⭐⭐ |
| **Vergrößerung ×3** | Gleich, aber 1→3×3 Block. Dramatischere Expansion. | 🆕 | ⭐⭐⭐⭐ |

```
Choreographie "Spiegelung vertikal":
  Spiegelachse leuchtet auf (pulse 400ms)
  Figur-Kopie erscheint transparent auf Original
  Kopie "klappt" über Achse (3D-Rotation um Y, 800ms)
  Kopie landet gespiegelt → Beide pulsieren synchron
  Bei Fehler: Falsche Zellen fliegen auf Bogen zur richtigen Position (700ms)
  Dauer: ~3s
```

---

**ZAHLENLABOR** — 3 Aufgabentypen

| Aufgabentyp | Erklär-Animation | Status | Pädagogischer Wert |
|---|---|---|---|
| **Stellenwerte** | ⭐ Bündelungs-Animation: 10 Einer-Würfel wandern zusammen (arc trajectories 600ms), verschmelzen zu Zehner-Stab (morph 400ms). | 🔧 State existiert | ⭐⭐⭐⭐⭐ |
| **Vergleichen** | Balken wachsen proportional zur Zahl (easeOutCubic 300ms). Größerer Balken leuchtet. | 🆕 | ⭐⭐⭐ |
| **Rechensprünge** | ⭐ Marker springt auf Zahlenstrahl mit Parabel-Bogen (400ms). Sprungweite farbcodiert (±1 klein, ±100 groß). | ✅ Teilweise | ⭐⭐⭐⭐ |

```
Choreographie "Bündelung 13":
  13 einzelne Einer-Würfel verstreut
  10 Würfel wandern zusammen (arc trajectories, 600ms)
  Verschmelzen zu Zehner-Stab (morph 400ms, scale-down)
  Übrig: 1 Zehner + 3 Einer = "13"
  Stellenwert-Karten erscheinen: "10 + 3" (stagger 200ms)
  Dauer: ~2.5s
```

---

**UHRZEITEN** — 4 Aufgabentypen

| Aufgabentyp | Erklär-Animation | Status | Pädagogischer Wert |
|---|---|---|---|
| **Ablesen** | ⭐ Stundenzeiger dreht sich langsam, Stunden-Zahlen leuchten auf (1, 2, 3...). Minutenzeiger folgt, 5er-Markierungen leuchten. | 🆕 | ⭐⭐⭐⭐⭐ |
| **Zeiger setzen** | Zeiger "rasten" bei Drag an 5-min/1-h Grid ein (easeOutCubic 200ms, snap). | 🆕 | ⭐⭐⭐ |
| **Kalender** | Monats-Slide-Transition (easeInOutQuad 400ms). Ziel-Datum pulsiert. | 🆕 | ⭐⭐ |
| **Zeitspanne** | ⭐ Uhrzeiger malt Bogen von Start- zu End-Zeit (800ms). Bogen = Dauer. Label: "45 Minuten". | 🆕 | ⭐⭐⭐⭐⭐ |

```
Choreographie "Uhr ablesen 3:45":
  Uhr zeigt 12:00
  Stundenzeiger dreht auf 3 (1200ms) → Zahlen: 1, 2, 3
  Minutenzeiger dreht auf 45 (800ms) → 5er: 5, 10, 15... 45
  Label "3:45 Uhr" erscheint (300ms)
  Dauer: ~3s
```

---

**KOORDINATEN** — 3 Aufgabentypen

| Aufgabentyp | Erklär-Animation | Status | Pädagogischer Wert |
|---|---|---|---|
| **Punkt einzeichnen** | ⭐ X-Achse pulsiert → Marker fährt horizontal (500ms) → Y-Achse pulsiert → Marker fährt vertikal (400ms). Zeigt "erst x, dann y". | 🔧 State existiert | ⭐⭐⭐⭐⭐ |
| **Koordinaten ablesen** | Bei Fehler: Marker fährt von falschem zu richtigem Punkt (700ms). Zeigt Differenz. | 🆕 | ⭐⭐⭐ |
| **Figur zeichnen** | Linien zeichnen sich beim Verbinden der Punkte (drawLine 300ms pro Segment). Form "entsteht" schrittweise. | 🆕 | ⭐⭐⭐⭐ |

```
Choreographie "Punkt (3, 2) einzeichnen":
  X-Achse pulsiert → "Erst nach rechts"
  Marker fährt 3 Einheiten → Tick + "1... 2... 3" (500ms)
  Y-Achse pulsiert → "Dann nach oben"
  Marker fährt 2 Einheiten → "1... 2" (400ms)
  Punkt blinkt am Ziel auf (bounce 300ms)
  Label "(3, 2)" fade-in
  Dauer: ~2.5s
```

---

**MUSTER & STRUKTUREN** — 3 Aufgabentypen

| Aufgabentyp | Erklär-Animation | Status | Pädagogischer Wert |
|---|---|---|---|
| **Zahlenfolge** | Bekannte Elemente erscheinen nacheinander (stagger 200ms). Muster-Gruppen pulsieren farbcodiert. Fehlendes Element "füllt sich" bei Lösung. | 🆕 | ⭐⭐⭐ |
| **Funktionsmaschine** | ⭐ Kugel wandert durch Maschine (Input→Transformation→Output, easeInOutQuad 800ms). Input-Zahl geht rein, Output-Zahl kommt raus. | ✅ Teilweise | ⭐⭐⭐⭐ |
| **Figurenmuster** | Punkte erscheinen nacheinander und bauen Figur auf (stagger 50ms). Zeigt Wachstumsmuster: Dreieck, Quadrat, Plus, Treppe. | ✅ Teilweise | ⭐⭐⭐⭐ |

---

**GROSSEN & MESSEN** — 2 Aufgabentypen

| Aufgabentyp | Erklär-Animation | Status | Pädagogischer Wert |
|---|---|---|---|
| **Geld** | Münzen "fallen" in Spardose (arc, easeOutBounce 280ms). Gesamtbetrag zählt animiert hoch. | ✅ | ⭐⭐⭐ |
| **Einheiten** | ⭐ Quell-Block "teilt sich" in 10 kleinere Blöcke (Schnittlinien + bounce stagger 200ms). Zeigt WARUM 1m = 100cm. | ✅ Teilweise | ⭐⭐⭐⭐⭐ |

```
Choreographie "1m = 100cm":
  1-Meter-Balken erscheint
  Balken teilt sich in 10 (Schnittlinien, 400ms)
  Jeder Teil teilt sich in 10 (stagger 200ms)
  Counter: "10... 20... 30... 100 cm"
  Labels morphen: "1 m" ↔ "100 cm" (400ms)
  Dauer: ~3s
```

---

**ZUFALL** — 3 Aufgabentypen (explorativ)

| Aufgabentyp | Erklär-Animation | Status | Pädagogischer Wert |
|---|---|---|---|
| **Würfel** | Würfel-Rotation (pseudo-3D, easeOutBounce 500ms). Pip-Augen erscheinen nacheinander (stagger 30ms). | ✅ | ⭐⭐⭐ |
| **Glücksrad fair** | Rad dreht (easeOutExpo 2.5–3.5s). Zeiger vibriert bei Landung. Sektor leuchtet auf. | ✅ | ⭐⭐⭐ |
| **Glücksrad unfair** | Gleiche Animation. Pädagogischer Wert: bei 100× Drehen wachsen Balken im Diagramm animiert → zeigt unfaire Verteilung. | ✅ Teilweise | ⭐⭐⭐⭐ |

---

**NETZE** — 4 Aufgabentypen (bereits exzellent)

| Aufgabentyp | Erklär-Animation | Status | Pädagogischer Wert |
|---|---|---|---|
| **Freies Zeichnen** | Echtzeit-3D-Vorschau: Jede gezeichnete Fläche erscheint sofort im 3D-Modell. | ✅ | ⭐⭐⭐⭐ |
| **Falten** | ⭐ 2D-Netz faltet sich zum 3D-Körper (easeInOutQuad 800ms, Perspektivprojektion). Jede Fläche rotiert um Scharnierkante. | ✅ | ⭐⭐⭐⭐⭐ |
| **Quader-Morphing** | Proportionen ändern sich fließend (1:1:1 → 1.8:0.8:1.2, 800ms). | ✅ | ⭐⭐⭐⭐ |
| **Gegenüberliegende Flächen** | Farbcodierte Paare + Auto-Spin zur Visualisierung. | ✅ | ⭐⭐⭐ |

---

##### Zusammenfassung: Animations-Landkarte

| Modul | Aufgabentypen | ⭐⭐⭐⭐⭐ Animationen | Status | Priorität |
|---|---|---|---|---|
| **Algorithmen** | 3 | Übertrag-Wanderung, Borgen-Animation | 🔧 fast fertig | **P1** |
| **Bruchteile** | 4 | Schnittlinien + Äquivalenz-Morph | 🔧 teilweise | **P1** |
| **Einmaleins** | 3 | Reihenaufbau + Kommutativ-Rotation | ✅ erweitern | **P1** |
| **Symmetrie** | 4 | Klapp-Spiegelung (pseudo-3D) | 🆕 | **P2** |
| **Zahlenlabor** | 3 | Bündelungs-Wanderung | 🔧 State da | **P2** |
| **Uhrzeiten** | 4 | Zeiger-Drehung + Zeitspannenbogen | 🆕 | **P2** |
| **Koordinaten** | 3 | X-dann-Y Marker-Navigation | 🔧 State da | **P2** |
| **Geometrie** | 3 | Umfang-Nachzeichnung + Zellenzählung | ✅ erweitern | **P2** |
| **Größen** | 2 | Block-Teilung für Umrechnung | ✅ erweitern | **P3** |
| **Muster** | 3 | Funktionsmaschine-Kugel | ✅ erweitern | **P3** |
| **Zufall** | 3 | Balken-Wachstum bei Wiederholung | ✅ erweitern | **P3** |
| **Netze** | 4 | (bereits exzellent) | ✅ fertig | — |

**Gesamt: 39 Aufgabentypen × Erklär-Animationen** — davon:
- 8 bereits gut implementiert (Netze, Würfel, Rad, Münzen, Punktfeld, Maschine)
- 6 mit State-Machine vorbereitet (Algorithmen, Bruchteile-Bar, Koordinaten, Zahlenlabor)
- 25 neu zu entwickeln

##### 15.4 Animations-Primitives (in `src/canvas/animation.ts`)

```ts
// Stagger: Versetzte Animation vieler Kinder
function stagger(
  nodes: CanvasNode[],
  props: Partial<NodeProps>,
  opts: { delay: number; duration: number; easing?: EasingFn }
): Animation;

// Arc Trajectory: Parabelförmige Bewegung (für Überträge, Bündelung)
function arcMoveTo(
  node: CanvasNode,
  target: Point,
  opts: { height: number; duration: number; easing?: EasingFn }
): Animation;

// Morph: Zahlentransition (3 → 12, sanft)
function morphNumber(
  node: TextNode,
  from: number,
  to: number,
  opts: { duration: number; format?: (n: number) => string }
): Animation;

// Line Draw: Linie zeichnet sich von A nach B
function drawLine(
  from: Point,
  to: Point,
  opts: { duration: number; width: number; color: string }
): Animation;

// Sequence Builder: Mehrstufige Erklärungen
function sequence(steps: {
  action: () => Animation | void;
  duration: number;
  label?: string;  // Für Lehrer-Steuerleiste: "Schritt 2 von 5"
}[]): SequenceAnimation;
```

##### 15.5 Integration in Modul-DSL

```ts
export default defineModule({
  id: "multiplication",
  // ...

  // Erklär-Animation (optional — wenn vorhanden, erscheint [▶ Erklärung] in Steuerleiste)
  explain(task: Task, scene: CanvasScene): SequenceAnimation {
    const { a, b, answer } = task;
    return sequence([
      { label: "Reihen aufbauen",
        action: () => scene.stagger(dotRows, { opacity: 1 }, { delay: 80 }) },
      { label: "Zusammenzählen",
        action: () => scene.find("total-label").animateTo({ text: `${a} × ${b} = ${answer}` }) },
      { label: "Tauschaufgabe",
        action: () => scene.find("dot-grid").animateTo({ rotation: 90 }, 600) },
    ]);
  },
});
```

##### 15.6 Reduced-Motion-Compliance

```ts
// ALLE Erklär-Animationen respektieren prefers-reduced-motion
if (prefersReducedMotion()) {
  // Statt Animation: Schrittweise Anzeige per Klick
  // [→ Nächster Schritt] statt automatische Animation
  // Opacity-Fades (150ms) statt Bewegungsanimationen
}
```

##### 15.7 Prioritäten-Matrix: Was zuerst animieren?

| Priorität | Modul | Animation | Pädagogischer Wert | Aufwand |
|---|---|---|---|---|
| **P1** | Algorithmen | Übertrag-Wanderung | ⭐⭐⭐⭐⭐ | Mittel (State existiert) |
| **P1** | Bruchteile | Teilungs-Schnitte + Äquivalenz | ⭐⭐⭐⭐⭐ | Mittel |
| **P1** | Einmaleins | Reihen-Aufbau + Zähl-Labels | ⭐⭐⭐⭐ | Niedrig (teilweise vorhanden) |
| **P2** | Symmetrie | Klapp-Spiegelung | ⭐⭐⭐⭐ | Mittel (3D-artig) |
| **P2** | Zahlenlabor | Bündelungs-Wanderung | ⭐⭐⭐⭐ | Mittel |
| **P2** | Koordinaten | X-dann-Y Marker-Pfad | ⭐⭐⭐⭐ | Niedrig |
| **P2** | Geometrie | Umfang-Nachzeichnung + Counter | ⭐⭐⭐ | Niedrig (teilweise vorhanden) |
| **P3** | Uhrzeiten | Zeiger-Drehung + Stunden-Highlight | ⭐⭐⭐ | Niedrig |
| **P3** | Größen | Umrechnungs-Teilung | ⭐⭐⭐ | Mittel |
| **P3** | Muster | Gruppen-Highlight + Regel-Pfeil | ⭐⭐ | Niedrig |
| **P3** | Zufall | Würfel-Rotation + Balken-Wachstum | ⭐⭐ | Mittel |
| — | Netze | (bereits exzellent) | ⭐⭐⭐⭐⭐ | — |

##### 15.8 Animations-Technologie: Canvas 2D + 3D-Math

**Entscheidung: Canvas 2D bleibt, kein WebGL.**

Gründe:
- Single-File-Output: WebGL-Shaders müssten inline eingebettet werden (komplex)
- Smartboard-GPUs: Oft schwache integrierte GPUs, WebGL-Kompatibilität unsicher
- Performance reicht: Kein Modul braucht >20 simultane animierte Objekte
- Bestehende 3D-Math-Bibliothek (`math3d.ts`) liefert bereits Perspektivprojektion

**Performance-Budget pro Frame (16.6ms für 60fps):**

| Operation | Zeit | Budget |
|---|---|---|
| Canvas clear + Background | 0.05ms | ✓ |
| Scene Graph measure+layout | 0.2ms | ✓ |
| 3D-Transforms (6 Faces) | 0.2ms | ✓ |
| Text-Rendering (5 Labels) | 0.3ms | ✓ |
| 18 Partikel (Celebration) | 0.2ms | ✓ |
| Erklär-Animation (Schritte) | 0.3ms | ✓ |
| **Gesamt pro Frame** | **~1.3ms** | **8% von 16.6ms** |

**Harte Grenze:** ≤20 gleichzeitig animierte Objekte, ≤2 Partikelsysteme.

**3D-Math-Bibliothek erweitern für neue Module:**

```ts
// math3d.ts — bereits vorhanden, vollständig wiederverwendbar:
mMul(), mTranslate(), mRotX/Y/Z()     // 4×4 Matrix-Operationen
mTransformPoint()                       // Punkt-Transformation
project(v, camera, unit, cx, cy)       // Perspektivprojektion → 2D

// NEU hinzufügen:
mScale(sx, sy, sz)                     // Skalierungs-Matrix
mLookAt(eye, target, up)              // Kamera-Matrix (für freie Ansichten)
quaternionSlerp(q1, q2, t)            // Glatte Rotation ohne Gimbal Lock
```

**Module die 3D nutzen sollen:**

| Modul | 3D-Anwendung | Komplexität |
|---|---|---|
| Netze | Netz→Körper-Faltung (✓ existiert) | Vorhanden |
| Geometrie | 3D-Körper-Ansicht (Quader, Zylinder, Kegel) | Mittel |
| Symmetrie | Klapp-Animation über Spiegelachse (pseudo-3D) | Niedrig |
| Zufall | Würfel-Rotation beim Wurf | Niedrig |

##### 15.9 Mikro-Interaktionen: Canvas-Feedback-System

**Prinzip:** Jede Berührung/Aktion erhält sofortiges visuelles Feedback (100ms). Kinder brauchen die Bestätigung "mein Klick wurde erkannt".

**A. Button-Press (Canvas-Buttons)**
```
Normal:     [  21  ]     ← Ruhezustand, leichter Schatten
Hover:      [  21  ]     ← Hellerer Hintergrund, stärkerer Schatten (120ms ease)
Pressed:    [ 21 ]       ← Scale 0.95, Schatten reduziert (80ms spring)
Released:   [  21  ]     ← Zurück zu Normal (120ms easeOut)
```

```ts
// Im Scene Graph: ButtonNode hat eingebaute Mikro-Animationen
class ButtonNode implements CanvasNode {
  private pressAnim = 0;  // 0=normal, 1=voll gedrückt

  onPointerDown() {
    this.animateTo({ scale: 0.95, shadowBlur: 2 }, 80, ease.spring);
  }

  onPointerUp() {
    this.animateTo({ scale: 1.0, shadowBlur: 8 }, 120, ease.easeOut);
    this.onTap?.();
  }

  draw(ctx) {
    // Schatten-Intensität interpoliert
    ctx.shadowBlur = lerp(8, 2, this.pressAnim);
    // Scale-Transform
    const s = lerp(1.0, 0.95, this.pressAnim);
    ctx.scale(s, s);
    // ... Zeichnen
  }
}
```

**B. Antwort-Feedback**
```
Richtig:    Grüner Pulse (300ms) + Check-Icon morpht ein (200ms) + Sound
Falsch:     Oranges Shake (400ms, 3 Zyklen) + Ermutigung fade-in (300ms)
```

```ts
// Richtig-Animation
sequence([
  { action: () => answerField.animateTo({ bgColor: ok, scale: 1.05 }, 150) },
  { action: () => checkIcon.animateTo({ opacity: 1, scale: 1 }, 200, ease.spring) },
  { action: () => answerField.animateTo({ scale: 1.0 }, 150) },
]);

// Falsch-Animation
sequence([
  { action: () => answerField.animateTo({ x: -4 }, 50) },    // Shake links
  { action: () => answerField.animateTo({ x: 4 }, 100) },    // Shake rechts
  { action: () => answerField.animateTo({ x: -3 }, 80) },    // Schwächer
  { action: () => answerField.animateTo({ x: 0 }, 60) },     // Zurück
  { action: () => hintText.animateTo({ opacity: 1 }, 300) }, // Ermutigung
]);
```

**C. Aufgaben-Transition (Nächste Aufgabe)**
```
Alte Aufgabe:  Slide-out nach links + Fade (200ms)
Pause:         50ms (Auge braucht Separation)
Neue Aufgabe:  Slide-in von rechts + Fade (250ms)
```

**D. Modul-Wechsel**
```
Altes Modul:   Crossfade out (200ms)
Neues Modul:   Crossfade in (250ms) mit leichtem Scale 0.98→1.0
```

**E. Aufgabentyp-Chip-Wechsel**
```
Alter Chip:    Hintergrund faded zu neutral (150ms)
Neuer Chip:    Hintergrund faded zu accent (150ms) + leichter underline-slide
Canvas:        Crossfade wie Aufgaben-Transition
```

**F. Lösung einblenden**
```
[📖 Lösung] geklickt:
  1. Lösungstext erscheint im Canvas (scale 0→1, 300ms, ease.spring)
  2. Lösungstext hat accent-Farbe + leichter Glow-Effekt
  3. Canvas-Visualisierung hebt korrekte Teile hervor (pulse, 400ms)
```

##### 15.10 Erklär-Animationen: Detaillierte Choreographien

Hier die drei P1-Module als vollständige Choreographie-Skripte:

**ALGORITHMEN: Schriftliche Addition 347 + 185 = 532**

```
Szene-Setup:                              Timing:
─────────────────────────────────────────────────
  3 4 7                                   t=0ms
+ 1 8 5                                   Slide-in (300ms, easeOut)
─────────                                 Linie zieht sich (200ms)

Phase 1 — Einerspalte:                    t=500ms
  Spalte "7" und "5" leuchten auf         Glow-Animation (200ms)
  "7 + 5 = 12" erscheint als Tooltip      Fade-in (200ms)

  "2" fällt ins Ergebnis:                 t=900ms
  → Startet oben bei "12"
  → Parabel-Flugbahn nach unten           arcMoveTo (400ms, easeInOut)
  → Landet in Ergebnis-Zeile
  → Leichter Bounce bei Landung           easeOutBounce (150ms)

  "1" wird zum Übertrag:                  t=1400ms
  → Startet bei "12"
  → Wandert nach links-oben               arcMoveTo (500ms, easeOut)
  → Schrumpft leicht (scale 0.8)
  → Setzt sich über die Zehnerspalte
  → Farbe: accent (hervorgehoben)
  → Leichter Pulse bei Ankommen           pulse (200ms)

Phase 2 — Zehnerspalte:                   t=2000ms
  Spalte "4", "8" und Übertrag "1"
  leuchten auf                            Glow (200ms)
  Übertrag "platzt" in die Rechnung       pop-Animation (200ms, scale 1.2→1.0)
  "4 + 8 + 1 = 13" Tooltip               Fade-in (200ms)

  "3" fällt ins Ergebnis                  t=2500ms  arcMoveTo (400ms)
  "1" wandert als Übertrag                t=3000ms  arcMoveTo (500ms)

Phase 3 — Hundertespalte:                 t=3600ms
  "3", "1" und Übertrag "1"
  → "3 + 1 + 1 = 5"
  "5" fällt ins Ergebnis                  arcMoveTo (400ms)

Finale:                                   t=4200ms
  ═══
  5 3 2                                   Scale 1.0→1.05→1.0 (300ms)
                                          Farbe: ok-grün
                                          Sound: correct-Sound

Gesamt-Dauer: ~4.5 Sekunden
Lehrer kann jederzeit pausieren.
```

**BRUCHTEILE: Äquivalenz ½ = ²⁄₄ = ⁴⁄₈**

```
Phase 1 — Ausgangsbruch:                  t=0ms
  Voller Kreis erscheint                  Scale 0→1 (300ms, easeOut)
  Vertikale Schnittlinie zieht sich       drawLine von Mitte→Rand (400ms)
  Kreis hat jetzt 2 Hälften
  Linke Hälfte füllt sich mit Farbe       Fill-Animation (300ms)
  Label "½" erscheint daneben             Fade-in (200ms)

Phase 2 — Erweitern auf ²⁄₄:             t=1200ms
  Horizontale Schnittlinie zieht sich     drawLine (400ms)
  → Beide Hälften werden zu je 2 Vierteln
  → Animation: Linie "schneidet durch"

  Gefärbte Viertel zählen:                t=1800ms
  → Viertel 1 pulsiert                    Pulse + Counter "1/4" (300ms)
  → Viertel 2 pulsiert                    Pulse + Counter "2/4" (300ms)

  Label morpht:                           t=2400ms
  "½" → "²⁄₄"                            Number-Morph (400ms)
  → Nenner 2→4 (Zahl rollt)
  → Zähler 1→2 (Zahl rollt)

  Gleichheitszeichen erscheint:           t=2800ms
  "½ = ²⁄₄"                              Fade-in (200ms)

Phase 3 — Erweitern auf ⁴⁄₈:             t=3200ms
  Zwei neue Schnittlinien (diagonal)      drawLine ×2 (400ms)
  → 4 Viertel werden 8 Achtel

  Gefärbte Achtel zählen:                 t=3800ms
  Stagger: 1/8, 2/8, 3/8, 4/8            Pulse (200ms each)

  Label-Kette:                            t=4600ms
  "½ = ²⁄₄ = ⁴⁄₈"                       Extend animation (300ms)

Gesamt-Dauer: ~5 Sekunden
```

**EINMALEINS: 4 × 6 = 24 mit Kommutativgesetz**

```
Phase 1 — Reihenweiser Aufbau:            t=0ms
  Leeres 4×6 Raster (Platzhalter)        Fade-in (200ms)

  Reihe 1: 6 Punkte poppen ein           t=400ms
  → Stagger 80ms pro Punkt               Pop-in (scale 0→1.1→1.0)
  → Label rechts: "6"                     Fade-in (150ms)

  Reihe 2: 6 Punkte poppen ein           t=1000ms
  → Label: "6 + 6 = 12"                  Number-Morph

  Reihe 3: 6 Punkte                      t=1600ms
  → Label: "12 + 6 = 18"

  Reihe 4: 6 Punkte                      t=2200ms
  → Label: "18 + 6 = 24"

  Ergebnis:                               t=2800ms
  Label morpht: "18 + 6 = 24"
  → "4 × 6 = 24"                         Morph (400ms)
  → Grüner Pulse                          ok-Farbe (300ms)

Phase 2 — Kommutativgesetz:               t=3500ms
  "Jetzt drehen wir das Feld!"           Text fade-in (300ms)
  Punktfeld rotiert um 90°               Rotation (800ms, easeInOut)
  → Aus 4 Reihen à 6 werden 6 Reihen à 4

  Neues Label:                            t=4500ms
  "6 × 4 = 24"                           Fade-in (300ms)

  Gleichung:                              t=5000ms
  "4 × 6 = 6 × 4 = 24"                  Extend (400ms)

  Tausch-Pfeil animiert sich             Arc-Pfeil über den Gleichungen (500ms)

Gesamt-Dauer: ~5.5 Sekunden
```

##### 15.11 Timeline-System: Lehrer-kontrollierte Wiedergabe

```ts
interface ExplanationTimeline {
  // Zustand
  currentStep: number;
  totalSteps: number;
  isPlaying: boolean;
  isPaused: boolean;

  // Steuerung (Lehrer-Steuerleiste)
  play(): void;       // [▶ Erklärung]
  pause(): void;      // [⏸ Pause]
  resume(): void;     // [▶ Weiter]
  reset(): void;      // [⏮ Nochmal]
  skipToEnd(): void;  // [⏭ Überspringen]

  // Events
  onStepChange(cb: (step: number, label: string) => void): void;
  onComplete(cb: () => void): void;
}
```

**Steuerleisten-Integration:**

```
Vor Erklärung:     [▶ Erklärung]  [💡 Hinweis]  [📖 Lösung]  [→ Nächste]
Während Erklärung: [⏸ Pause]     Schritt 2/5: "Übertrag wandert"
Nach Erklärung:    [⏮ Nochmal]   [💡 Hinweis]  [📖 Lösung]  [→ Nächste]
```

**Fortschrittsanzeige:** Subtile Dots unterhalb der Steuerleiste:

```
  ● ● ○ ○ ○     ← 2 von 5 Schritten abgeschlossen
```

**Reduced-Motion-Modus:**
- Statt automatischer Animation: Schrittweise Enthüllung
- [→ Nächster Schritt] Button statt Auto-Play
- Opacity-Fades (150ms) statt Bewegung
- Kein Skip-Button nötig (ist schon schrittweise)

---

### Baustein 16 — Responsive Skalierung: Tablet bis 86" Smartboard

#### IST-Analyse: 7-stufiges Breakpoint-System

Das aktuelle System hat bereits 7 Breakpoints (1100, 1400, 1800, 2200, 2600, 3400px) — eine solide Basis. Aber es gibt Lücken:

| Lücke | Problem | Lösung |
|---|---|---|
| **Kein Aspect-Ratio-Guard** | 4:3-Beamer verzerrt Canvas-Inhalte | `max-aspect-ratio` Media Query + Canvas `contain: "height"` |
| **Canvas-Fonts unbegrenzt** | Auf 4K (3400px+) können Fonts unrealistisch groß werden | Obere Schranke: `xl: min(w × 0.064, 180px)` |
| **Status-Box Position** | `bottom: 28%` hardcoded — verrutscht auf 4K | Relative zu Canvas-Höhe, nicht prozentual |
| **Kein Fullscreen-Scaling** | Fullscreen nutzt Desktop-Breakpoints | Eigener Breakpoint-Layer für Fullscreen |
| **Topbar-Clipping auf 4K** | 33.6px Font in 64px min-height Topbar | `min-height: 72px` ab 3400px |

#### SOLL: Skalierungskurve Tablet → Smartboard

```
        Font-Größe (Canvas Title)
    70px ┤                                    ╱ 86" Board
    60px ┤                                 ╱
    50px ┤                              ╱
    40px ┤                           ╱
    30px ┤                     ╱──╱
    26px ┤               ╱──╱
    22px ┤          ╱──╱
    18px ┤    ╱──╱
         └──────────────────────────────────────
         768  1100  1440  1800  2200  2600  3400  px
         iPad  Lap.  HD   FHD    QHD   4K   5K
```

**Prinzip:** Fonts skalieren linear mit `clamp()`, aber mit harter Obergrenze. Canvas-Layout passt sich über `measure()` (Baustein 0) automatisch an.

#### 16.1 Container Queries statt nur Media Queries

```css
/* NEU: Modul-Bereich als Container */
.module-area {
  container-type: inline-size;
  container-name: module;
}

/* Aufgabentyp-Chips responsiv */
@container module (width < 500px) {
  .task-type-chips { flex-wrap: wrap; }
  .task-type-chip { font-size: 0.8rem; }
}

@container module (width > 1200px) {
  .task-type-chips { gap: var(--space-lg); }
  .task-type-chip { font-size: 1.1rem; min-height: 48px; }
}
```

#### 16.2 Smartboard-Modus (automatisch oder manuell)

```ts
// Automatische Erkennung: Viewport > 2200px ODER Fullscreen aktiv
const isSmartboard = window.innerWidth >= 2200 || document.fullscreenElement;

if (isSmartboard) {
  document.body.classList.add("smartboard-mode");
  // → Größere Touch-Targets (64px statt 48px)
  // → Stärkere Kontraste (border: 2px statt 1px)
  // → Celebration-Animation kürzer (500ms statt 1200ms)
}
```

#### 16.3 Viewport-Debug-Parameter

```
?viewport=tablet    → 768×1024 viewport emulation
?viewport=4k        → 3840×2160
?viewport=4:3       → Forces 4:3 aspect ratio container
?viewport=smartboard → 2600×1440 + smartboard-mode
```

Integriert in Baustein 9 (Build/DX).

---

### Baustein 17 — Technische Architektur: Redesign-Dateistruktur

#### IST-Zustand (75 Dateien, ~23.000 LOC)

```
src/
├── main.ts                    Entry point
├── app/   (2)                 shell.ts, base-module.ts
├── core/  (7)                 design, types, events, sounds, tts, utils
├── canvas/ (3)                primitives, numpad
├── layout/ (2)                layout helpers
├── styles/ (3)                tokens.css, base.css, components.css
├── modules/ (60)              12 Module × ~5 Dateien
├── data/  (leer)
└── ui/    (leer)
```

#### SOLL-Struktur (Redesign v2)

```
src/
├── main.ts                         Entry point (vereinfacht)
├── app/
│   ├── shell.ts                    App-Shell (Overlay-Nav, Steuerleiste)
│   ├── module-framework.ts         defineModule() DSL-Runtime (NEU, Baustein 2)
│   └── router.ts                   URL-Hash-Routing (NEU, Baustein 10)
├── core/
│   ├── types.ts                    Zentrale Typen
│   ├── design.ts                   Design-Tokens (behalten)
│   ├── events.ts                   Event-Bus (behalten)
│   ├── sounds.ts                   Sound-System (behalten)
│   ├── tts.ts                      TTS (behalten)
│   ├── utils.ts                    Utilities (behalten)
│   └── signals.ts                  Micro-Signals (NEU, Baustein 4)
├── canvas/
│   ├── scene.ts                    Scene Graph Runtime (NEU, Baustein 1)
│   ├── nodes/                      Canvas-Node-Typen (NEU, Baustein 0+1)
│   │   ├── container.ts            VStack, HStack, ZStack, Grid, Spacer
│   │   ├── text.ts                 TextNode (measure-before-draw)
│   │   ├── button.ts               ButtonNode (auto HitArea)
│   │   ├── shape.ts                ShapeNode (Kreis, Rechteck, Polygon)
│   │   └── custom.ts               CustomDrawNode (freies Zeichnen)
│   ├── animation.ts                Animation Engine (NEU, Baustein 15)
│   │   // stagger(), arcMoveTo(), morphNumber(), sequence()
│   ├── primitives.ts               Low-Level-Zeichenfunktionen (behalten)
│   └── hit-areas.ts                HitArea-Management (refactored aus BaseModule)
├── layout/
│   └── layout.ts                   Constraint-Solver (NEU, Baustein 0)
│   // buildStandardLayout etc. → ENTFÄLLT (durch Scene Graph ersetzt)
├── ui/
│   ├── h.ts                        Hyperscript h()-Helper (NEU, Baustein 3)
│   ├── overlay.ts                  Modul-Overlay-Navigation (NEU)
│   ├── control-bar.ts              Lehrer-Steuerleiste (NEU, Baustein 7)
│   └── task-chips.ts               Aufgabentyp-Chips (NEU)
├── styles/
│   ├── tokens.css                  Design-Tokens (behalten, erweitert)
│   ├── base.css                    Reset + Grundtypen (vereinfacht)
│   └── components.css              Komponenten (vereinfacht)
├── modules/                        12+ Module (drastisch vereinfacht)
│   ├── multiplication/
│   │   ├── index.ts                defineModule({ ... }) — 80–150 Zeilen statt 475+
│   │   └── index.test.ts           Tests für generate() + check()
│   ├── fractions/
│   │   ├── index.ts
│   │   └── index.test.ts
│   ├── ... (jedes Modul: 1–2 Dateien statt 4–8)
│   └── netze/
│       ├── index.ts
│       ├── math3d.ts               3D-Math behalten (eigenständig)
│       └── index.test.ts
└── test/
    ├── helpers.ts
    └── setup-canvas-mock.ts
```

#### Zentrale Änderungen

| Aspekt | IST | SOLL |
|---|---|---|
| **Module** | Klasse extends BaseModule (475+ LOC) | `defineModule({...})` (80–150 LOC) |
| **Modul-Dateien** | 4–8 pro Modul | 1–2 pro Modul |
| **Canvas-Layout** | Manuelle Pixel-Arithmetik | Scene Graph mit measure→layout→draw |
| **DOM-Building** | innerHTML Strings | h()-Helper (typsicher) |
| **State** | Klassen-Properties + localStorage | Micro-Signals + `persisted()` |
| **Navigation** | Permanente Sidebar (shell.ts) | Overlay-Modal (ui/overlay.ts) |
| **Steuerleiste** | Nicht vorhanden | ui/control-bar.ts |
| **Animation** | Ad-hoc pro Modul | Zentrale Engine (canvas/animation.ts) |
| **Build Target** | ES2022 | ES2020 (Schul-Browser) |
| **Tests** | Getrennt logic.test + ui.test | Vereint index.test (generate/check sind reine Fn) |

#### Build-Pipeline (unveränderte Stärken)

- **Vite** + `vite-plugin-singlefile` → Single HTML output (behalten)
- **Zero Dependencies** → Kein npm-Paket im Bundle (behalten)
- **Vitest** → Unit-Tests (behalten, Coverage-Thresholds anheben)
- **TypeScript Strict** → Behalten

#### Neue Build-Ergänzungen

```json
// package.json scripts (NEU)
{
  "dev": "vite",
  "build": "vite build",
  "test": "vitest run",
  "typecheck": "tsc --noEmit",
  "validate": "npm run typecheck && npm run test && npm run build",
  "lint": "eslint src/",          // NEU
  "format": "prettier --write src/"  // NEU
}
```

- **ESLint** → Import-Ordnung, Naming-Konventionen
- **Prettier** → Konsistente Formatierung
- **.browserslistrc** → `Chrome >= 88, Firefox >= 78, Safari >= 14`

#### Geschätzte LOC-Reduktion

| Bereich | IST | SOLL | Reduktion |
|---|---|---|---|
| Module (12×) | ~14.000 | ~3.000 | -79% |
| Core/App | ~3.000 | ~2.200 | -27% |
| Canvas/Layout | ~2.500 | ~3.000 | +20% (Scene Graph) |
| UI (NEU) | 0 | ~800 | — |
| Animation (NEU) | 0 | ~600 | — |
| CSS | ~3.500 | ~1.900 | -46% |
| **Gesamt** | **~23.000** | **~11.500** | **-50%** |

#### Migrationsstrategie

**Prinzip: Modul-für-Modul, kein Big Bang.**

Die alte BaseModule-Architektur und die neue DSL-Architektur müssen **temporär koexistieren**. Ein Adapter-Layer ermöglicht schrittweise Migration:

```ts
// Adapter: Wraps alte BaseModule-Klasse als defineModule()-kompatibles Objekt
function legacyAdapter(ModuleClass: typeof BaseModule): ModuleDefinition {
  return {
    id: ModuleClass.id,
    title: ModuleClass.label,
    // ... Mapping der alten Methoden auf neue Interfaces
    generate: (d, t) => ModuleClass.prototype.generateTask(d, t),
    check: (i, task) => ModuleClass.prototype.checkAnswer(i, task),
  };
}
```

**Migrationsreihenfolge (innerhalb Phase 3):**
1. Einmaleins (einfachstes Modul, 3 Aufgabentypen, guter Testfall)
2. Bruchteile (4 Aufgabentypen, Themenwelt-Test)
3. Algorithmen (Erklär-Animation-Test)
4. Restliche Module in beliebiger Reihenfolge
5. Adapter-Layer entfernen wenn alle 12 Module migriert

**Testabsicherung:** Vor Migration jedes Moduls:
- `generate()` + `check()` als reine Funktionen extrahieren
- Unit-Tests für die reinen Funktionen schreiben
- Erst dann Modul auf DSL umstellen
- Regressions-Screenshots vor/nach vergleichen

---

### Baustein 18 — Didaktisches Framework: Mathematik als Handlung

Dieses Framework definiert die pädagogischen und visuellen Grundregeln, nach denen ALLE Module aufgebaut sein müssen. Es ist das didaktische Fundament der App und stellt sicher, dass die Erkläranimationen nicht nur technisch funktionieren, sondern mathematische Einsicht erzeugen.

#### 18.1 Vier pädagogische Grundprinzipien

**Prinzip 1: Mathematik ist Handlung**

Kinder verstehen Mathematik besser, wenn sie eine Handlung *beobachten oder selbst ausführen*.

```
NICHT:  "Berechne ¾"
STATT:  "Vier Kinder teilen eine Pizza."
         → Animation zeigt den mathematischen Prozess
```

Jede Aufgabe beginnt mit einer *Situation*, nicht mit einer abstrakten Gleichung.

**Prinzip 2: Veränderung sichtbar machen**

Mathematik IST Veränderung. Animationen müssen immer eine *Transformation* zeigen:

| Transformation | Animation |
|---|---|
| Bündeln | 10 Einer → verschmelzen → 1 Zehner |
| Teilen | Pizza → Schnittlinien → Stücke |
| Verteilen | 12 Muffins → wandern auf → 3 Teller |
| Zerlegen | 347 → spaltet sich → 300 + 40 + 7 |
| Wachsen | Punktfeld baut sich Reihe für Reihe auf |

**Prinzip 3: Rechenweg vor Ergebnis**

Die App erklärt den *Prozess*, nicht nur das Ergebnis. Jede Aufgabe durchläuft 4 Schritte:

```
1. Situation darstellen    → "12 Muffins, 3 Kinder"
2. Handlung zeigen         → Muffins wandern auf Teller
3. Mathematische Struktur  → "12 : 3 = ?"
4. Ergebnis ableiten       → "= 4 pro Teller"
```

**Prinzip 4: Realwelt-Metaphern**

Abstrakte Konzepte werden durch bekannte Objekte dargestellt. Das Objekt dient als *Modell*, nicht als Dekoration:

| Konzept | Metapher | Warum diese Metapher? |
|---|---|---|
| Brüche | Pizza, Kuchen | Kinder kennen "Stücke" aus dem Alltag |
| Multiplikation | Reihen von Objekten, Spielfeld | Gruppierung ist sichtbar |
| Division | Verteilen auf Teller | Fairness-Konzept ist intuitiv |
| Stellenwert | Bündeln in Beutel/Kisten | Physisches Zusammenfassen |
| Zahlenstrahl | Schwimmendes Tier im Aquarium | Bewegung = Zahlenoperation |

#### 18.2 Visuelle Designregeln für Canvas-Objekte

**Stil: Vereinfacht, warm, klar**
- Runde Formen (keine scharfen Ecken bei Objekten)
- Dicke Linien (≥2px bei Canvas-Zoom, ≥3px auf Smartboard)
- Maximal 5–6 Farben pro Szene
- Keine fotorealistischen Texturen
- Keine dekorativen Partikel (Confetti nur bei Celebration, max 500ms)

**Farbkodierung mit mathematischer Bedeutung:**

| Bedeutung | Farbe | Token | Konsistent in ALLEN Modulen |
|---|---|---|---|
| Einer | Gelb | `--place-ones` | ✓ |
| Zehner | Orange | `--place-tens` | ✓ |
| Hunderter | Rot | `--place-hundreds` | ✓ |
| Tausender | Violett | `--place-thousands` | ✓ |
| Aktive Operation | `--accent` | Blau | ✓ |
| Ergebnis / Richtig | `--ok` | Grün | ✓ |
| Hinweis / Achtung | `--warn` | Orange | ✓ |

→ Ein Kind das Gelb sieht, weiß sofort: "Das sind Einer". Modulübergreifend.

**Animations-Regeln:**
- Erlaubt: bewegen, bündeln, zerlegen, verteilen, wachsen, teilen
- Verboten: dekorative Effekte ohne mathematischen Bezug, Partikel als Schmuck, Animationen >400ms für Einzelschritte
- Humor-Animationen (Figur jubelt) ≤ 1 Sekunde, nie den Lernfluss blockieren

#### 18.3 Wiederkehrende Themenwelten

Die App verwendet 5 Themenwelten als wiederkehrende Kontexte. Diese erhöhen Wiedererkennung und reduzieren kognitive Last ("Ah, die Pizzeria kenne ich schon!").

| Themenwelt | Einsatz | Visuell |
|---|---|---|
| 🍕 **Pizza Restaurant** | Brüche, Division | Pizza, Schneidebrett, Teller, Kinder |
| 🧁 **Bäckerei** | Division, Aufteilen, Mengen | Muffins, Bleche, Tüten |
| 🐿️ **Eichhörnchen sammelt Nüsse** | Stellenwertsystem, Bündeln | Nüsse, Beutel, Kiste, Baum |
| ⚽ **Fußballtraining** | Multiplikation als Fläche | Kinder, Spielfeld, Reihen |
| 🐠 **Aquarium** | Zahlenstrahl, Sprünge | Fisch, Zahlenstrahl als Schwimmbahn |

**Integration in Modul-DSL:**

```ts
export default defineModule({
  id: "fractions",
  title: "Bruchteile",
  icon: "🍰",

  // NEU: Themenwelt definiert visuelle Objekte + Kontextgeschichte
  themes: [
    {
      id: "pizza",
      label: "🍕 Pizzeria",
      context: "Kinder teilen Pizza im Restaurant",
      objects: ["pizza", "plate", "child"],
      // Erzeugt: "4 Kinder teilen eine Pizza. Wie viel bekommt jeder?"
    },
    {
      id: "cake",
      label: "🎂 Geburtstag",
      context: "Kuchen wird auf dem Geburtstag verteilt",
      objects: ["cake", "plate", "child"],
    },
  ],

  generate(difficulty: number, taskType: string, context?: ModuleContext): Task {
    const { numerator, denominator } = generateFraction(difficulty);
    const theme = context?.theme ?? "abstract";
    return {
      question: theme === "pizza"
        ? `${denominator} Kinder teilen eine Pizza. Wie viel bekommt jeder?`
        : theme === "cake"
        ? `Der Kuchen wird in ${denominator} Stücke geteilt.`
        : `Wie viel ist ${numerator}/${denominator}?`,
      answer: { numerator, denominator },
      // Kontextbezogene Objekte für die Szene
      sceneObjects: theme === "pizza"
        ? [pizza(), plates(denominator), children(denominator)]
        : theme === "cake"
        ? [cake(), plates(denominator)]
        : undefined,  // abstract = klassische Canvas-Darstellung
    };
  },
});
```

**Lehrer wählt Themenwelt:**
- **Im Modul-Overlay** als Dropdown unterhalb der Schwierigkeitsstufe (nicht in den Aufgabentyp-Chips — die sind für Aufgabentypen reserviert)
- `Themenwelt: [🍕 Pizzeria ▾]` → Dropdown mit: Pizzeria, Geburtstag, Abstrakt
- "Abstrakt" = klassische Canvas-Darstellung ohne Realwelt-Kontext (für Lehrer die das bevorzugen)
- Module ohne Themenwelten zeigen keinen Dropdown (z.B. Symmetrie, Netze)
- Gewählte Themenwelt wird als `context.theme` an `generate()` übergeben

#### 18.4 Modul-Struktur-Template

Jedes neue Modul muss diese 7 Elemente definieren. Das Template dient als **Spezifikation** die direkt in `defineModule()` übersetzt werden kann:

```
THEMA:                  [Mathematisches Thema]
LERNZIEL:               [Was das Kind verstehen soll]
KONTEXTGESCHICHTE:      [Realwelt-Situation in 1 Satz]
VISUELLE OBJEKTE:       [Liste der Canvas-Objekte]
ANIMATION:              [Schritt-für-Schritt-Choreographie]
INTERAKTION:            [Was der Schüler/Lehrer tut]
MATHEMATISCHE STRUKTUR: [Formale Gleichung die sichtbar wird]
TECHNISCHE EVENTS:      [State-Machine-Übergänge]
```

#### 18.5 Beispiel-Module nach Template (für alle Themenwelten)

**Modul: Brüche — Pizzeria**
```
THEMA:              Brüche (Teil eines Ganzen)
LERNZIEL:           Verstehen dass ¾ = 3 von 4 gleichen Teilen
KONTEXTGESCHICHTE:  "4 Kinder im Restaurant bestellen eine Pizza."
VISUELLE OBJEKTE:   Pizza (Kreis), 4 Teller, 4 Kind-Icons
ANIMATION:
  1. Pizza erscheint ganz (300ms fade-in)
  2. Schnittlinien ziehen sich durch (drawLine 400ms, Kreuz)
  3. 4 gleiche Stücke entstehen (split 300ms)
  4. 3 Stücke gleiten auf Teller (move 400ms each, stagger)
  5. 1 Stück bleibt übrig → hervorgehoben
INTERAKTION:        Kind zieht Pizzastücke zu Tellern (drag)
MATH. STRUKTUR:     "3 von 4 Stücken = ¾"
TECHNISCHE EVENTS:  pizza_whole → slice → pieces_ready → distribute → result
```

**Modul: Stellenwert — Eichhörnchen**
```
THEMA:              Stellenwertsystem (Zehnerbündel)
LERNZIEL:           Verstehen dass 10 Einer = 1 Zehner
KONTEXTGESCHICHTE:  "Eichhörnchen sammelt Nüsse für den Winter."
VISUELLE OBJEKTE:   Nüsse (gelb, Einer), Beutel (orange, Zehner), Kiste (rot, Hunderter)
ANIMATION:
  1. Nüsse liegen verstreut (spawn stagger 50ms)
  2. Eichhörnchen sammelt 10 Nüsse zusammen (arc trajectories 600ms)
  3. 10 Nüsse verschmelzen zu 1 Beutel (merge 400ms)
  4. Beutel wird orange (Stellenwert-Farbkodierung)
  5. Bei 10 Beuteln → verschmelzen zu 1 Kiste (rot)
INTERAKTION:        Schüler zieht Nüsse in Beutel (drag, min 10)
MATH. STRUKTUR:     "10 Nüsse = 1 Beutel", "10 Beutel = 1 Kiste"
TECHNISCHE EVENTS:  nuts_scattered → collect(10) → bundle → bag_created
```

**Modul: Multiplikation — Fußball**
```
THEMA:              Multiplikation als Flächenmodell
LERNZIEL:           Verstehen dass 4 × 5 = "4 Reihen à 5"
KONTEXTGESCHICHTE:  "Fußballtraining: Kinder stellen sich in Reihen auf."
VISUELLE OBJEKTE:   Kind-Icons, Spielfeld-Raster, Reihen-Markierungen
ANIMATION:
  1. Leeres Spielfeld erscheint (300ms)
  2. Reihe 1: 5 Kinder laufen nacheinander aufs Feld (stagger 80ms)
     → Label "5" erscheint rechts
  3. Reihe 2–4: je 5 Kinder (stagger pro Reihe)
     → Labels: "10", "15", "20"
  4. Gesamtlabel: "4 × 5 = 20 Kinder" (morph 400ms)
INTERAKTION:        Schüler kann Reihen hinzufügen/entfernen (+/- Buttons)
MATH. STRUKTUR:     "4 Reihen × 5 Kinder = 20"
TECHNISCHE EVENTS:  field_empty → add_row → count_update → result
```

**Modul: Division — Bäckerei**
```
THEMA:              Division als Aufteilen
LERNZIEL:           Verstehen dass 12 : 3 = "fair verteilen"
KONTEXTGESCHICHTE:  "12 Muffins werden auf 3 Kinder verteilt."
VISUELLE OBJEKTE:   Muffins (rund, braun), 3 Teller, 3 Kind-Icons
ANIMATION:
  1. 12 Muffins in Reihe (spawn stagger 50ms)
  2. 3 Teller erscheinen darunter (fade-in 300ms)
  3. Muffins wandern im Karussell auf Teller:
     Muffin 1 → Teller 1 (arc 300ms)
     Muffin 2 → Teller 2
     Muffin 3 → Teller 3
     Muffin 4 → Teller 1
     ... (stagger 200ms)
  4. Jeder Teller hat 4 Muffins → Count erscheint
INTERAKTION:        Schüler verteilt Muffins per Drag auf Teller
MATH. STRUKTUR:     "12 : 3 = 4"
TECHNISCHE EVENTS:  muffins_ready → distribute → plate_count_update → result

Division mit Rest (13 : 4):
  → 4 Teller à 3 Muffins
  → 1 Muffin übrig → hervorgehoben, pulsiert
  → "13 : 4 = 3 Rest 1"
```

**Modul: Zahlenstrahl — Aquarium**
```
THEMA:              Zahlenstrahl (Sprünge, Navigation)
LERNZIEL:           Zahlenstrahl als Modell für Addition/Subtraktion
KONTEXTGESCHICHTE:  "Ein Fisch schwimmt im Aquarium."
VISUELLE OBJEKTE:   Fisch-Icon, Zahlenstrahl als Schwimmbahn, Markierungen
ANIMATION:
  1. Aquarium mit Zahlenstrahl (0–100) erscheint (300ms)
  2. Fisch steht bei Startzahl (z.B. 34)
  3. Rechenaufgabe: "+23"
  4. Fisch springt in Bögen:
     +10 → großer Bogen (parabolic arc, 400ms) → bei 44
     +10 → großer Bogen → bei 54
     +3  → kleiner Bogen (300ms) → bei 57
  5. Sprünge werden als Bögen über dem Strahl sichtbar
INTERAKTION:        Schüler klickt Sprungweite (+1, +10, +100)
MATH. STRUKTUR:     "34 + 23 = 34 + 10 + 10 + 3 = 57"
TECHNISCHE EVENTS:  fish_at(34) → jump(+10) → jump(+10) → jump(+3) → result
```

#### 18.6 Technische State-Machine pro Aufgabe

Jede Aufgabe wird als Zustandsmaschine modelliert. Dies ermöglicht:
- Lehrer-gesteuerte Pause/Weiter an jedem Zustand
- Rücksprung auf vorherigen Zustand
- Erklär-Animation als automatischer Durchlauf aller Zustände

```ts
interface TaskStateMachine {
  states: {
    [id: string]: {
      render: (scene: CanvasScene) => void;    // Was in diesem Zustand sichtbar ist
      animation?: () => Animation;              // Übergangs-Animation ZUM nächsten Zustand
      onEnter?: () => void;                     // Sound, TTS etc.
      interactable?: boolean;                   // Kann der Schüler interagieren?
    };
  };
  transitions: Array<[from: string, to: string, trigger: string]>;
  initialState: string;
}

// Beispiel: Pizza-Brüche
const pizzaStates: TaskStateMachine = {
  initialState: "pizza_whole",
  states: {
    pizza_whole:    { render: drawWholePizza, animation: sliceAnimation },
    slicing:        { render: drawSlicingPizza },
    pieces_ready:   { render: drawPieces, interactable: true },  // Drag & Drop
    distributed:    { render: drawDistributed },
    result:         { render: drawResult },  // "¾" Label
  },
  transitions: [
    ["pizza_whole",  "slicing",       "explain_start"],
    ["slicing",      "pieces_ready",  "slice_complete"],
    ["pieces_ready", "distributed",   "all_distributed"],
    ["distributed",  "result",        "show_result"],
  ],
};
```

#### 18.7 Humor-Integration (charmant, nie ablenkend)

| Moment | Humor-Element | Dauer | Regel |
|---|---|---|---|
| Richtige Antwort | Figur (Eichhörnchen/Fisch) macht kurze Freude-Geste | ≤500ms | Nie den Nächste-Button blockieren |
| Falsche Antwort | Figur kratzt sich am Kopf, ermutigendes Lächeln | ≤500ms | Nie negativ oder frustrierend |
| Bündelung geschafft | Beutel "hüpft" kurz (bounce, 200ms) | 200ms | Subtil, nicht laut |
| Leerer Zustand | Figur schaut fragend ("Na, was machen wir?") | Statisch | Nur als Idle-State |

**Regeln:**
- Humor erzeugt Motivation, nie kognitive Ablenkung
- Keine Sound-Effekte bei Humor (nur bei mathematischem Feedback)
- Figuren sind Teil der Themenwelt, nicht aufgesetzt
- Humor-Animationen laufen parallel, blockieren nie die Interaktion

#### 18.8 Ausgabeformat für neue Module

Wenn neue Module spezifiziert werden (durch Lehrer, Didaktiker oder KI), nutzen sie dieses standardisierte Format:

```yaml
module:
  thema: "..."
  lernziel: "..."
  kontextgeschichte: "..."
  themenwelt: pizza | bakery | squirrel | football | aquarium | abstract
  visuelle_objekte:
    - name: "pizza"
      typ: "circle"
      farbe: "--accent"
  interaktion:
    - typ: "drag"
      von: "pizza_piece"
      zu: "plate"
  animation:
    - schritt: 1
      aktion: "spawn"
      objekt: "pizza"
      dauer: 300
    - schritt: 2
      aktion: "split"
      objekt: "pizza"
      anzahl: 4
      dauer: 400
  mathematische_struktur: "1/4"
  events:
    - "pizza_whole → slice → pieces_ready → distribute → result"
```

Dieses Format kann:
- Direkt in `defineModule()` übersetzt werden
- Von einem LLM generiert werden
- Als Spezifikation für neue Module dienen
- Vom Lehrer als Unterrichtsvorbereitung gelesen werden

---

## Aktualisierter Abhängigkeitsgraph (Final)

```
Baustein 0  (Canvas-Layout)  ════╗  FUNDAMENT
                                  ║
Baustein 1  (Scene Graph)     ──╬── braucht 0
Baustein 2  (Modul-DSL)       ──╝── braucht 0 + 1

Baustein 3  (h()-Templates)    ──── unabhängig
Baustein 4  (Micro-Signals)   ──── unabhängig
Baustein 5  (CSS 3-Schichten) ──── unabhängig

Baustein 6  (Visual Refresh)  ──── braucht 5
Baustein 7  (Overlay-Nav+Steuer.) ── braucht 2
Baustein 7b (Unified Flow)    ──── braucht 2 + 7

Baustein 8  (Testing)         ──── braucht 0 + 2
Baustein 9  (Build/DX)        ──── unabhängig

Baustein 10 (Smartboard)      ──── braucht 7 (Overlay-Nav) + 9 (URL-Params)
Baustein 11 (Aufgaben-Engine) ──── braucht 2 (DSL)
Baustein 12 (Resilienz)       ──── unabhängig, früh machbar
Baustein 13 (Classroom-FB)    ──── braucht 2 (DSL) + 6 (Visual)
Baustein 14 (A11y-Härtung)    ──── braucht 0 (Canvas) + 7 (Steuerleiste)
Baustein 15 (Animations-Engine) ── braucht 0 + 1 (Scene Graph) + 2 (DSL) ⭐
Baustein 16 (Responsive)       ──── braucht 0 (Canvas-Layout) + 5 (CSS)
Baustein 17 (Architektur)      ──── Meta-Baustein, definiert Dateistruktur
Baustein 18 (Didaktik-Framework) ── braucht 2 (DSL) + 15 (Animation) + 11 (Engine)
```

## Aktualisierte Implementierungsreihenfolge

| Phase | Bausteine | Fokus |
|---|---|---|
| **Phase 1** | 0, 12, 17 | **Fundament:** Canvas-Layout-System, Crash Recovery, Dateistruktur anlegen |
| **Phase 2** | 1, 15 (Infra), 3, 4, 5 | **Infrastruktur:** Scene Graph + Animations-Engine (6 Primitive), h()-Templates, Signals, CSS |
| **Phase 3** | 2, 11, **18** | **Modul-System:** DSL `defineModule()` + Aufgaben-Engine + **Didaktik-Framework (Themenwelten, State-Machines, Humor)** |
| **Phase 4** | 7, 7b, 10 | **Bedienung:** Overlay-Nav, Steuerleiste, Unified Flow, Fullscreen, URL-Routing |
| **Phase 5** | **15 (P1)**, 16, 6 | **⭐ Erklär-Animationen** (Algorithmen, Bruchteile, Einmaleins) + Responsive + Visual Refresh |
| **Phase 6** | **15 (P2+P3)**, 13, 14 | Weitere Erklär-Animationen + Classroom-Feedback + Accessibility |
| **Phase 7** | 8, 9 | Qualität: Testing, Build/DX, ESLint, Prettier |

---

## Beschlüsse & Ergänzungen (Final-Review)

Die folgenden Abschnitte schließen alle offenen Punkte die im Final-Review identifiziert wurden. Jede Ergänzung referenziert den betroffenen Baustein und enthält eine verbindliche Entscheidung.

---

### E1 — BESCHLUSS: Font-Strategie (betrifft Baustein 12.3)

**Problem:** Atkinson Hyperlegible wird per Google Fonts CDN geladen. Das verletzt SYS-01 (einzelne HTML-Datei) und SYS-02 (offline-fähig). Ohne Internet = kein Font, Fallback auf system-ui.

**IST-Analyse:**
- Aktueller Bundle: **74,5 KB gzip** (Budget: 150 KB → Headroom: ~75 KB)
- Geladene Fonts: Atkinson Hyperlegible (Regular 400, Bold 700, Italic 400, Bold Italic 700) + Figtree (400, 500, 600, 700)
- CLAUDE.md verbietet Kursivschrift für Fließtext → Italic-Varianten unnötig

**ENTSCHEIDUNG:**

1. **Atkinson Hyperlegible einbetten** als Base64-encoded WOFF2 im CSS (`@font-face` inline in `tokens.css`)
2. **Nur 2 Varianten:** Regular (400) und Bold (700) — keine Italics (CLAUDE.md verbietet Kursiv)
3. **Latin-Subset:** Nur Latin + Latin Extended (Deutsch braucht ÄÖÜäöüß) — spart ~40% vs. Full
4. **Figtree entfernen:** Nicht mehr als eigenständiger Font, nur noch in der Fallback-Kette: `'Atkinson Hyperlegible', system-ui, -apple-system, sans-serif`
5. **Google Fonts CDN-Links entfernen** aus `index.html`

**Geschätztes Budget nach Font-Einbettung:**

| Komponente | Gzip-Größe |
|---|---|
| Aktueller Bundle (JS+CSS+HTML) | 74,5 KB |
| + Atkinson Regular 400 (Latin subset, WOFF2) | ~18 KB |
| + Atkinson Bold 700 (Latin subset, WOFF2) | ~19 KB |
| − Einsparung durch Redesign (~50% weniger Code) | −35 KB |
| **Geschätztes Gesamt** | **~77 KB** |

Weit unter der 150-KB-Grenze. Selbst konservativ (nur 30% Einsparung) wäre es ~96 KB.

**Font-Subsetting in der Build-Pipeline:**
```bash
# Im Build-Schritt (einmalig, Ergebnis wird committed):
pyftsubset AtkinsonHyperlegible-Regular.ttf \
  --output-file=AtkinsonHyperlegible-Regular-Latin.woff2 \
  --flavor=woff2 \
  --layout-features='kern,liga' \
  --unicodes='U+0000-00FF,U+0100-024F,U+2000-206F,U+20AC,U+2122'
```

**@font-face in tokens.css:**
```css
@font-face {
  font-family: 'Atkinson Hyperlegible';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(data:font/woff2;base64,...) format('woff2');
}
@font-face {
  font-family: 'Atkinson Hyperlegible';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(data:font/woff2;base64,...) format('woff2');
}
```

**Aktualisierter Font-Stack:**
```css
--font-family: 'Atkinson Hyperlegible', system-ui, -apple-system, sans-serif;
```

---

### E2 — BESCHLUSS: ES-Target & Browser-Kompatibilität (betrifft Baustein 10.3)

**Problem:** REQUIREMENTS.md SYS-08 sagt ES2022. Baustein 10.3 empfiehlt Downgrade auf ES2020 für Schul-Chromebooks.

**IST-Analyse:**
- Alle 12 Module sind auf ES2022
- Chrome 92 (Jul 2021) unterstützt alle ES2022-Features die wir nutzen (`Array.at()`, class fields)
- Chrome 105 (Sep 2022) unterstützt Container Queries
- Chromebooks erhalten automatische Updates — Chrome < 100 ist seit 2022 End-of-Life
- Es gibt keine Schul-Chromebook-Modelle in aktivem Support mit Chrome < 92

**ENTSCHEIDUNG:**

1. **ES2022 bleibt** als Build-Target (kein Downgrade)
2. **Minimum Browser-Version:** Chrome ≥ 105, Firefox ≥ 110, Safari ≥ 16.4
3. **Begründung:** Alle Geräte mit niedrigerer Version sind seit 2+ Jahren End-of-Support. Schulträger müssen aktuelle Software einsetzen (IT-Sicherheitsvorgaben).
4. **REQUIREMENTS.md aktualisieren:** SYS-08 ergänzen um explizite Mindest-Versionen
5. **Kein `.browserslistrc` nötig:** Vite + ES2022-Target reicht

**REQUIREMENTS.md-Änderung:**
```
| SYS-08 | ES2022 und moderne Web-APIs dürfen vorausgesetzt werden.
|        | Mindest-Versionen: Chrome ≥ 105, Firefox ≥ 110, Safari ≥ 16.4, Edge ≥ 105. |
```

---

### E3 — BESCHLUSS: Container Queries Strategie (betrifft Baustein 5, 16)

**Problem:** Container Queries ab Chrome 105. Mit E2 (Chrome ≥ 105 als Floor) ist das abgedeckt.

**ENTSCHEIDUNG:**

1. **Container Queries dürfen uneingeschränkt genutzt werden** — Chrome ≥ 105 ist gesichert (E2)
2. **Kein Fallback auf Media Queries nötig**
3. **Einsatzorte (3 Stück):**
   - `.module-area` für responsive Aufgabentyp-Chips
   - `.control-bar` für responsive Steuerleisten-Layout
   - Canvas-Container für responsive DOM-Elemente neben dem Canvas
4. **Media Queries bleiben** für globale Breakpoints (Topbar, Overlay, Body-Level)

---

### E4 — BESCHLUSS: prefers-reduced-motion im Scene Graph (betrifft Baustein 0, 1)

**Problem:** CLAUDE.md verlangt `prefers-reduced-motion: reduce` als MUST. Die Vision behandelt es nur für die Erklärungs-Timeline (Baustein 15.11), aber nicht systemisch für alle Canvas-Animationen.

**ENTSCHEIDUNG:**

Das Scene Graph System (Baustein 1) erhält einen **globalen Motion-Guard** der ALLE `animateTo()`-Aufrufe automatisch beeinflusst:

```ts
// In scene.ts — globaler State
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = prefersReducedMotion.matches;
prefersReducedMotion.addEventListener('change', (e) => { reducedMotion = e.matches; });

// In jedem CanvasNode.animateTo():
animateTo(props: Partial<NodeProps>, duration: number, easing?: EasingFn): Animation {
  if (reducedMotion) {
    // Sofort zum Zielzustand, nur Opacity-Fade (150ms max)
    const reducedDuration = props.opacity !== undefined ? Math.min(duration, 150) : 0;
    return this._instantTransition(props, reducedDuration);
  }
  return this._animate(props, duration, easing);
}
```

**Konsequenzen für alle Bausteine:**

| Baustein | Normaler Modus | Reduced-Motion-Modus |
|---|---|---|
| **15 (Mikro-Interaktionen)** | Scale 0.95 + Bounce (80ms) | Opacity-Change (100ms) |
| **15 (Feedback-Shake)** | X-Offset ±4px (400ms) | Opacity-Blink (200ms) |
| **15 (Aufgaben-Transition)** | Slide + Fade (250ms) | Crossfade (150ms) |
| **15 (Erklär-Animationen)** | Vollständige Choreographie | Schrittweise Enthüllung per Button |
| **6 (Modulwechsel)** | Crossfade + Scale (250ms) | Sofortiger Swap |
| **Celebration** | Konfetti-Partikel (500ms) | Grüner Pulse (200ms) |

**CSS-Seite (bestehende Pflicht aus CLAUDE.md):**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 150ms !important;
    transition-property: opacity !important;
  }
}
```

---

### E5 — BESCHLUSS: TTS-Integration in Modul-DSL (betrifft Baustein 2)

**Problem:** CLAUDE.md: "Text-to-Speech für alle Textinhalte integrieren" (MUST). Das bestehende `tts.ts` wird behalten, aber die DSL hat keinen expliziten TTS-Hook.

**ENTSCHEIDUNG:**

1. **Automatischer TTS-Aufruf** im Modul-Framework bei Aufgabenwechsel:

```ts
// In module-framework.ts
function showTask(task: Task): void {
  // Aufgabe rendern
  this.scene.update(task.canvasScene);

  // TTS automatisch (sofern aktiviert)
  if (ttsEnabled.value) {
    const text = task.ttsText ?? task.question;
    tts.speak(text);
  }
}
```

2. **Optionales `ttsText`-Feld** im Task-Interface für abweichende Aussprache:

```ts
interface Task {
  question: string;
  answer: number | string | { numerator: number; denominator: number };
  hints: [string, string, ...string[]];  // Min. 2 (siehe E6)
  ttsText?: string;                       // NEU: Für Aussprache-Abweichungen
  canvasScene?: (layout: LayoutInfo) => CanvasNode[];
  sceneObjects?: CanvasNode[];
}
```

**Beispiele für `ttsText`:**
```ts
// Brüche: "¾" wird als "drei Viertel" gesprochen
{ question: "¾", ttsText: "Wie viel ist drei Viertel?" }

// Multiplikation: "×" wird als "mal" gesprochen
{ question: "7 × 4 = ?", ttsText: "Wie viel ist sieben mal vier?" }

// Geometrie: Formelnamen
{ question: "Wie heißt diese Form?", ttsText: "Wie heißt diese Form?" }  // identisch → ttsText weglassen
```

3. **TTS für Hints:** Framework spricht Hints automatisch beim Anzeigen
4. **TTS für Lösung:** Framework spricht `getSolution().text` automatisch
5. **TTS-Toggle** in der Topbar (bestehendes Feature, bleibt erhalten)

---

### E6 — BESCHLUSS: Hints als TypeScript Tuple-Typ (betrifft Baustein 2)

**Problem:** Die Vision sagt "Framework validiert `hints.length >= 2`" als Runtime-Check. Besser: Compile-Time-Sicherheit.

**ENTSCHEIDUNG:**

Kanonisches `Task`-Interface wird aktualisiert:

```ts
interface Task {
  question: string;
  answer: number | string | { numerator: number; denominator: number };

  // GEÄNDERT: Tuple-Typ erzwingt mindestens 2 Hints zur Compile-Time
  hints: [string, string, ...string[]];

  ttsText?: string;
  canvasScene?: (layout: LayoutInfo) => CanvasNode[];
  sceneObjects?: CanvasNode[];
}
```

**Vorher:** `hints: string[]` + Runtime-Validation
**Nachher:** `hints: [string, string, ...string[]]` — TypeScript-Fehler wenn < 2 Hints

Die Runtime-Validation in `defineModule()` bleibt als zusätzlicher Guard (für dynamische Daten), aber der Hauptschutz ist statisch.

---

### E7 — BESCHLUSS: ARIA-Spezifikation für Modul-Overlay (betrifft Baustein 7)

**Problem:** Das Modul-Overlay ist ein Modal, aber die Vision spezifiziert keine ARIA-Attribute und kein Fokus-Management.

**ENTSCHEIDUNG:**

```html
<!-- Overlay-Markup -->
<div class="module-overlay"
     role="dialog"
     aria-modal="true"
     aria-labelledby="overlay-title"
     hidden>

  <h2 id="overlay-title" class="sr-only">Modul auswählen</h2>

  <!-- Modul-Grid -->
  <div class="module-grid" role="radiogroup" aria-label="Module">
    <button role="radio" aria-checked="true"  class="module-card active">✖️ Einmaleins</button>
    <button role="radio" aria-checked="false" class="module-card">📐 Geometrie</button>
    <!-- ... -->
  </div>

  <!-- Schwierigkeitsregler -->
  <fieldset>
    <legend>Schwierigkeit</legend>
    <input type="range" min="1" max="3" aria-valuetext="Stufe 2: Mittel">
  </fieldset>
</div>

<!-- Backdrop -->
<div class="overlay-backdrop" aria-hidden="true" hidden></div>
```

**Fokus-Management:**

```ts
// Overlay öffnen
function openOverlay(): void {
  overlay.hidden = false;
  backdrop.hidden = false;

  // Fokus auf aktuell aktives Modul setzen
  const activeCard = overlay.querySelector('.module-card.active');
  activeCard?.focus();

  // Fokus-Trap aktivieren
  trapFocus(overlay);
}

// Overlay schließen
function closeOverlay(): void {
  overlay.hidden = true;
  backdrop.hidden = true;

  // Fokus zurück auf Trigger-Element
  moduleLabel.focus();
}
```

**Fokus-Trap (minimal, ~20 Zeilen):**
```ts
function trapFocus(container: HTMLElement): void {
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { closeOverlay(); return; }
    if (e.key !== 'Tab') return;

    const focusable = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  };
  container.addEventListener('keydown', handler);
  container._cleanupTrap = () => container.removeEventListener('keydown', handler);
}
```

**Zusätzlich:**
- Backdrop-Klick schließt Overlay (bereits in Vision)
- `aria-live="polite"` Region für Statusmeldungen (Aufgabe geladen, Feedback) — bereits teilweise vorhanden
- Lehrer-Steuerleiste: Buttons bekommen `aria-label` (z.B. "Nächster Hinweis, Stufe 2 von 3")

---

### E8 — BESCHLUSS: Migrationsstrategie im Repository (betrifft Baustein 17)

**Problem:** Die Vision beschreibt einen `legacyAdapter()` für schrittweise Migration, aber nicht die Git-Strategie.

**ENTSCHEIDUNG:**

**Prinzip: Trunk-Based Development mit Feature-Flags, kein langer Feature-Branch.**

```
main (immer deploybar)
  │
  ├── Commit: "feat: add canvas layout system (Baustein 0)"
  │   └── Neue Dateien: src/canvas/nodes/, src/layout/layout.ts
  │   └── Alte Dateien: UNVERÄNDERT
  │
  ├── Commit: "feat: add scene graph (Baustein 1)"
  │   └── Neue Dateien: src/canvas/scene.ts
  │   └── Alte Dateien: UNVERÄNDERT
  │
  ├── Commit: "feat: add module DSL framework (Baustein 2)"
  │   └── Neue Dateien: src/app/module-framework.ts
  │   └── Alte Dateien: UNVERÄNDERT — legacyAdapter wraps BaseModule
  │
  ├── Commit: "refactor: migrate multiplication to DSL"
  │   └── src/modules/multiplication/index.ts → defineModule({...})
  │   └── src/modules/multiplication/logic.ts → inline in index.ts
  │   └── Alte Dateien: GELÖSCHT (logic.ts, state.ts, render.ts, interactions.ts, types.ts)
  │
  ├── ... (Modul für Modul)
  │
  └── Commit: "refactor: remove legacyAdapter (alle Module migriert)"
      └── src/app/base-module.ts → GELÖSCHT
      └── src/app/module-framework.ts → legacyAdapter entfernt
```

**Regeln:**

1. **`npm run validate` muss nach JEDEM Commit grün sein** — keine roten Phasen
2. **Alte und neue Architektur koexistieren** über den `legacyAdapter()`
3. **Kein langer Feature-Branch** — jeder Baustein wird in main gemerged sobald er funktioniert
4. **Module werden einzeln migriert** — nie alle auf einmal
5. **Reihenfolge der Modul-Migration:**
   - Phase A: `multiplication` (einfachstes Modul, 778 LOC, guter Testfall für DSL)
   - Phase B: `fractions` (4 Aufgabentypen, Themenwelt-Test, 1.035 LOC)
   - Phase C: `algorithms` (Erklär-Animation-Test, 861 LOC)
   - Phase D: `patterns`, `coordinates` (mittlere Komplexität)
   - Phase E: `numbers`, `measures`, `time` (größere Module)
   - Phase F: `geometry`, `chance`, `symmetry`, `netze` (komplex, Canvas-intensive)

**Sicherheitsnetz pro Modul-Migration:**
```
1. Unit-Tests für generate() + check() schreiben (VOR Migration)
2. Screenshot-Baselines anlegen (VOR Migration)
3. Modul auf DSL umstellen
4. npm run validate
5. Screenshot-Vergleich (NACH Migration)
6. Manueller Smoke-Test
```

---

### E9 — BESCHLUSS: Palm Rejection (betrifft Baustein 14)

**Problem:** CLAUDE.md: "Palm Rejection auf Tablet implementieren" (MUST). Die Vision erwähnt es nicht.

**ENTSCHEIDUNG:**

Palm Rejection wird im Pointer-Event-Handler des Scene Graph implementiert:

```ts
// In hit-areas.ts / scene.ts
function handlePointerDown(e: PointerEvent): void {
  // Palm Rejection: Nur primären Pointer akzeptieren
  if (!e.isPrimary) return;

  // Stylus hat höhere Priorität als Touch
  if (e.pointerType === 'touch' && this.activeStylusId !== null) {
    // Ein Stylus ist aktiv → Touch ignorieren (Hand auf dem Screen)
    return;
  }

  if (e.pointerType === 'pen') {
    this.activeStylusId = e.pointerId;
  }

  // ... normale HitArea-Verarbeitung
}

function handlePointerUp(e: PointerEvent): void {
  if (e.pointerType === 'pen' && e.pointerId === this.activeStylusId) {
    this.activeStylusId = null;
  }
  // ...
}
```

**Regeln:**
- Wenn ein Stylus aktiv ist (pointerdown ohne pointerup), werden alle Touch-Events ignoriert
- `isPrimary` filtert Multi-Touch-Geister (Palm)
- `pointerType === 'pen'` hat Vorrang vor `pointerType === 'touch'`
- Smartboards mit Windows Ink senden `pen`-Events — diese werden bevorzugt behandelt

---

### E10 — BESCHLUSS: Breakpoint-System vereinheitlichen (betrifft CLAUDE.md, REQUIREMENTS.md, Baustein 16)

**Problem:** CLAUDE.md und REQUIREMENTS.md definieren unterschiedliche Breakpoints:
- CLAUDE.md: `<1100px` Mobile, `≥1100px` Desktop, `≥1400px/1800px/2200px/2600px/3400px`
- REQUIREMENTS.md DS-13: `mobile < 960, tablet < 1200, desktop < 1400, wide ≥ 2000`

**ENTSCHEIDUNG: Ein einheitliches 6-Stufen-System:**

| Stufe | Breakpoint | Geräte | Layout |
|---|---|---|---|
| **compact** | `< 768px` | Phone (unwahrscheinlich, aber möglich) | Einspaltiges Minimal-Layout |
| **tablet** | `768–1099px` | iPad, kleine Laptops | Einspaltiges Layout, volle Breite Canvas |
| **desktop** | `1100–1399px` | Laptop, Chromebook | Volle Breite Canvas, Overlay-Nav |
| **wide** | `1400–2199px` | FHD-Monitor, großer Laptop | Größere Touch-Targets, mehr Whitespace |
| **board** | `2200–3399px` | 4K-Monitor, Smartboard | Smartboard-Modus: 64px Targets, 2px Borders |
| **massive** | `≥ 3400px` | 5K, 86"-Board | Maximale Skalierung, Font-Caps aktiv |

**CSS-Tokens (in tokens.css):**
```css
:root {
  --bp-tablet:  768px;
  --bp-desktop: 1100px;
  --bp-wide:    1400px;
  --bp-board:   2200px;
  --bp-massive: 3400px;
}
```

**Smartboard-Auto-Detection (Baustein 10):**
```ts
// Viewport ≥ 2200px ODER Fullscreen → Smartboard-Modus
const isSmartboard = window.innerWidth >= 2200 || !!document.fullscreenElement;
document.body.classList.toggle('smartboard-mode', isSmartboard);
```

**CLAUDE.md und REQUIREMENTS.md werden auf dieses System aktualisiert.**

---

### E11 — BESCHLUSS: Undo-Strategie (betrifft Baustein 7b, 18)

**Problem:** CLAUDE.md: "Bei destruktiven Aktionen: Undo-Toast statt Bestätigungsdialog" (MUST). Die Vision erwähnt Undo nur für Symmetrie und Zahlenlabor.

**ENTSCHEIDUNG:**

**Undo-Toast als Framework-Feature** (im Modul-Framework, nicht pro Modul):

```ts
// In module-framework.ts
function onNextTask(): void {
  const previousTask = this.currentTask;
  const previousState = this.captureModuleState();

  this.loadNewTask();

  // Undo-Toast: 5 Sekunden
  showToast({
    message: "Neue Aufgabe geladen",
    action: {
      label: "↩ Zurück",
      onTap: () => {
        this.restoreModuleState(previousState);
        this.currentTask = previousTask;
        this.render();
      },
    },
    duration: 5000,
  });
}
```

**Undo-fähige Aktionen:**

| Aktion | Undo-Verhalten |
|---|---|
| **→ Nächste Aufgabe** | Toast "↩ Zurück zur vorigen Aufgabe" (5s) |
| **🔄 Session zurücksetzen** | Toast "↩ Session wiederherstellen" (5s) |
| **Aufgabentyp wechseln** | Kein Undo nötig (Aufgabe wird neu generiert) |
| **Modulwechsel** | Kein Undo nötig (altes Modul bleibt im Speicher) |

**Toast-Design:**
```
┌──────────────────────────────────────┐
│  Neue Aufgabe geladen    [↩ Zurück] │
│  ━━━━━━━━━━━░░░░░░░░░░░░           │  ← Fortschrittsbalken (5s countdown)
└──────────────────────────────────────┘
```
- Position: unten mittig, 16px vom unteren Rand
- z-index: 1000 (modal-Schicht)
- Verschwindet nach 5s oder bei Klick auf "↩ Zurück"
- Reduced-Motion: Keine Slide-Animation, nur Fade (150ms)

---

### E12 — KLARSTELLUNG: Modul-Inventar (betrifft Baustein 17)

**Zur Vermeidung von Missverständnissen: Alle 12 Module existieren bereits.**

| # | Vision-Name | Codename | LOC (IST) | Migrationskomplexität |
|---|---|---|---|---|
| 1 | Einmaleins | `multiplication` | 778 | ⬜ Niedrig |
| 2 | Algorithmen | `algorithms` | 861 | ⬜ Niedrig |
| 3 | Bruchteile | `fractions` | 1.035 | ⬛ Mittel |
| 4 | Koordinaten | `coordinates` | 1.107 | ⬛ Mittel |
| 5 | Muster | `patterns` | 1.161 | ⬛ Mittel |
| 6 | Symmetrie | `symmetry` | 1.417 | ⬛⬛ Hoch |
| 7 | Größen | `measures` | 1.479 | ⬛ Mittel |
| 8 | Zufall | `chance` | 1.538 | ⬛⬛ Hoch (Explore-Flow) |
| 9 | Zahlenlabor | `numbers` | 1.711 | ⬛⬛ Hoch |
| 10 | Geometrie | `geometry` | 1.814 | ⬛⬛ Hoch |
| 11 | Netze | `netze` | 1.971 | ⬛⬛⬛ Sehr hoch (3D) |
| 12 | Uhrzeiten | `time` | 1.986 | ⬛⬛ Hoch |
| | **Gesamt** | | **16.858** | |

Die Redesign-Vision beschreibt die **Migration** aller 12 bestehenden Module auf die neue DSL-Architektur. Es müssen keine neuen Module entwickelt werden für v2. Neue Module (z.B. "Daten & Diagramme", "Sachaufgaben") sind explizit als Phase-2-Erweiterungen markiert (Baustein 11.7).

---

### E13 — BESCHLUSS: CSS prefers-reduced-motion global (betrifft Baustein 5)

**Problem:** CLAUDE.md verlangt reduced-motion als MUST für alle CSS-Animationen. Die Vision zeigt das Pattern pro Komponente, aber nicht global.

**ENTSCHEIDUNG:**

In `base.css` wird ein **globaler reduced-motion Guard** als letzter Block eingefügt:

```css
/* === Reduced Motion: Globaler Guard === */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 150ms !important;
  }

  /* Erlaubt: Opacity-Transitions (als Fallback für alle Animationen) */
  .btn,
  .module-card,
  .task-type-chip,
  .overlay-backdrop {
    transition-property: opacity !important;
  }

  /* Celebration-Partikel komplett deaktivieren */
  .celebration-canvas {
    display: none !important;
  }
}
```

**Kombination mit E4 (Canvas-Guard):**
- CSS-Guard deckt alle DOM-Elemente ab
- Canvas-Guard (E4) deckt alle Scene-Graph-Animationen ab
- Zusammen: **100% der Animationen respektieren `prefers-reduced-motion`**

---

### E14 — BESCHLUSS: safe-area-inset-bottom (betrifft Baustein 5, 16)

**Problem:** CLAUDE.md: "`safe-area-inset-bottom` für iOS beachten" (MUST). Die Vision erwähnt es nicht.

**ENTSCHEIDUNG:**

```css
/* In base.css */
:root {
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}

/* Lehrer-Steuerleiste: Bottom-Padding berücksichtigt iOS Safe Area */
.control-bar {
  padding-bottom: calc(var(--space-sm) + var(--safe-bottom));
}

/* Body: Kein Inhalt hinter der Home-Bar */
body {
  padding-bottom: var(--safe-bottom);
}
```

**Viewport-Meta (in index.html):**
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

Das `viewport-fit=cover` ist nötig damit `env(safe-area-inset-bottom)` funktioniert.

---

### E15 — BESCHLUSS: Focus-Indikatoren einheitlich (betrifft Baustein 14)

**Problem:** CLAUDE.md spezifiziert "3px solid Outline, 3px Offset, ≥3:1 Kontrast" als MUST. Die Vision erwähnt Fokus-Ring für Canvas, aber nicht die genaue Spezifikation.

**ENTSCHEIDUNG:**

```css
/* In base.css — globaler Focus-Stil */
:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 3px;
}

/* Canvas-Fokus */
canvas:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 3px;
  border-radius: var(--radius-sm);
}

/* Buttons: Konsistenter Focus-Ring */
.btn:focus-visible,
.module-card:focus-visible,
.task-type-chip:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 3px;
}

/* Kontrastprüfung: --accent (#3B82F6) auf --bg (#0F1729 dark / #FAFBFE light) */
/* Dark:  #3B82F6 auf #0F1729 → Kontrast 5.2:1 ✓ */
/* Light: #3B82F6 auf #FAFBFE → Kontrast 4.1:1 ✓ (≥3:1) */
```

**Canvas-interne Focus-Indikatoren (für HitAreas):**
```ts
// In button.ts (Scene Graph)
drawFocusRing(ctx: CanvasRenderingContext2D, rect: Rect): void {
  ctx.save();
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 3;
  ctx.setLineDash([]);  // Solid, kein Dash

  const offset = 3;
  roundRect(ctx,
    rect.x - offset, rect.y - offset,
    rect.w + offset * 2, rect.h + offset * 2,
    radius + offset
  );
  ctx.stroke();
  ctx.restore();
}
```

---

---

### E16 — BESCHLUSS: Navigationsparadigma-Wechsel (betrifft CLAUDE.md §Navigation)

**Konflikt mit CLAUDE.md:**
- CLAUDE.md §48: "Kein Hamburger-Menü — persistente, sichtbare Navigation"
- CLAUDE.md §49: "Bottom Tab Bar auf Tablet/Mobile: 3–5 Items, immer Icon + Text-Label"
- CLAUDE.md §50: "Großer, persistenter Zurück-Button: oben links, min 48×48px"

**Vision-Entscheidung:** Overlay-Navigation statt permanenter Sidebar/Tabbar. Begründung: Lehrer-Smartboard-Tool braucht maximale Canvas-Fläche.

**BESCHLUSS: CLAUDE.md wird wie folgt angepasst:**

CLAUDE.md §Navigation wird für das Redesign aktualisiert:

| Alt (CLAUDE.md) | Neu (Redesign) | Begründung |
|---|---|---|
| Persistente, sichtbare Navigation | **Topbar mit klickbarem Modul-Label** + Overlay-Grid | Modul-Label IST persistent sichtbar — Navigation öffnet sich bei Bedarf. Kein Hamburger-Icon, sondern das aktuelle Modul-Label + ▾ Chevron |
| Bottom Tab Bar, 3–5 Items | **Lehrer-Steuerleiste** (unterhalb Canvas, 56px) | Steuerleiste ist persistent sichtbar und enthält die häufigsten Aktionen (Hinweis, Lösung, Nächste) — wichtiger als Modulwechsel-Tabs |
| Zurück-Button oben links | **Logo/Titel "Mathewerkstatt"** oben links = Home-Button | Klick auf App-Titel navigiert immer zur Startseite. Min 48×48px Touch-Target. |

**Warum das die UX-Prinzipien trotzdem erfüllt:**
- "Persistente, sichtbare Navigation" → Die Topbar mit Modul-Label + Steuerleiste ist IMMER sichtbar. Navigation ist 1 Klick entfernt — nicht hinter einem abstrakten Icon versteckt.
- "Kein Hamburger-Menü" → Das klickbare Modul-Label (z.B. "✖️ Einmaleins ▾") ist KEIN Hamburger-Icon. Es zeigt den aktuellen Kontext und ist selbstbeschreibend.
- "3–5 Items mit Icon + Text-Label" → Das Modul-Overlay zeigt ALLE Module mit Icon + Text-Label. Die Steuerleiste hat 3–4 Items mit Icon + Label.

---

### E17 — BESCHLUSS: Progressive Hints (automatisch vs. Lehrer-gesteuert)

**Konflikt mit CLAUDE.md:**
- CLAUDE.md §84: "Progressives Hinweissystem (4 Stufen)" mit automatischer Eskalation bei Fehlversuchen 1→5
- Vision: "Lehrer entscheidet wann — Hint-Button zeigt die nächste Stufe, aber nur auf Knopfdruck"

**BESCHLUSS: Hybrid-Lösung**

Das Hint-System wird **primär Lehrer-gesteuert**, aber mit **optionalem Auto-Modus** für Einzelarbeit:

```ts
// Signal für Hint-Modus
const hintMode = persisted<'manual' | 'auto'>('mathelabor_hint_mode', 'manual');

// Manueller Modus (Default, Smartboard):
// - Lehrer klickt [💡 Hinweis] → nächste Stufe
// - Kein automatischer Hint bei Fehlversuchen
// - Lehrer hat volle Kontrolle

// Auto-Modus (Einzelarbeit auf Tablet):
// - Versuch 1–2: Ermutigendes Feedback
// - Versuch 3: Automatisch Hint Stufe 1
// - Versuch 4: Automatisch Hint Stufe 2
// - Versuch 5+: Lösung Schritt für Schritt

// Toggle in Modul-Overlay oder Topbar-Einstellungen:
// [🤖 Automatische Hilfe: An/Aus]
```

**CLAUDE.md-Anpassung:**
```
Progressives Hinweissystem:
  - Manueller Modus (Default): Lehrer steuert Hints über Steuerleisten-Button
  - Automatischer Modus (optional): Eskalation bei Fehlversuchen 1→5
  - Modus-Toggle in den Einstellungen
```

---

### E18 — BESCHLUSS: Legasthenie-Einstellungen im neuen UI (betrifft CLAUDE.md §Legasthenie)

**Problem:** CLAUDE.md verlangt optionale Einstellungen für Schriftgröße, Zeilenabstand, Wortabstand und Hintergrundfarbe. Im alten Design waren diese vermutlich in der Sidebar. Im neuen Design (keine Sidebar) — wo?

**BESCHLUSS:**

**Einstellungen-Panel im Modul-Overlay** (unterer Bereich):

```
┌──────────────────────────────────────────┐
│  🏠 Startseite                           │
│                                          │
│  ✖️ Einmaleins         📐 Geometrie      │
│  🍰 Bruchteile         📏 Größen & Maße  │
│  ... (Module)                            │
│                                          │
│  Schwierigkeit: [1] [■2] [3]            │
│  Themenwelt:    [🍕 Pizzeria ▾]          │
│                                          │
│  ─── Einstellungen ───                   │
│  Schriftgröße:  [A] [A] [A]  ← S/M/L    │
│  Hintergrund:   [◻️] [🟡] [🟤]  ← Weiß/Creme/Warm │
│  Hilfe-Modus:   [✋ Manuell] [🤖 Auto]  │
│  Lautstärke:    ━━━━━━━○━━━             │
└──────────────────────────────────────────┘
```

**Implementierung:**

```ts
// Persisted Signals für Barrierefreiheits-Einstellungen
const fontSize = persisted<'sm' | 'md' | 'lg'>('mathelabor_fontsize', 'md');
const bgColor = persisted<'default' | 'cream' | 'warm'>('mathelabor_bgcolor', 'default');
const hintMode = persisted<'manual' | 'auto'>('mathelabor_hint_mode', 'manual');
const volume = persisted<number>('mathelabor_volume', 0.5);

// Font-Size wirkt sich auf CSS Custom Properties aus:
effect(() => {
  const scale = { sm: 1, md: 1.15, lg: 1.3 }[fontSize.value];
  document.documentElement.style.setProperty('--font-scale', String(scale));
});

// Hintergrundfarbe wirkt auf Body-Background:
effect(() => {
  const colors = {
    default: '',          // Standard aus Theme
    cream: '#FFF8F0',     // Warmes Creme
    warm: '#F5F0E8',      // Wärmerer Ton
  };
  document.body.style.setProperty('--bg-override', colors[bgColor.value]);
});
```

**CSS-Integration (in tokens.css):**
```css
:root {
  --font-scale: 1;
}

body {
  font-size: calc(var(--font-body) * var(--font-scale));
  background-color: var(--bg-override, var(--bg));
}
```

**Hinweis:** Zeilenabstand und Wortabstand skalieren automatisch mit `--font-scale` (relativ definiert). Kein separater Regler nötig — größere Schrift = mehr Platz.

---

### E19 — BESCHLUSS: On-Screen-Keyboard Handling (betrifft Baustein 16)

**Problem:** CLAUDE.md: "On-Screen-Keyboard nimmt ~50% Bildschirm → Layouts müssen sich anpassen" (MUST).

**BESCHLUSS:**

1. **Canvas-basierte Eingabe bevorzugen:** Wo möglich, nutzen Module Canvas-Numpads statt DOM-Inputs. Das vermeidet das OS-Keyboard komplett. Die DSL-Property `input: "numberPad"` aktiviert den Canvas-Numpad.

2. **Für DOM-Inputs (z.B. Einheiten-Umrechnung):**

```ts
// Keyboard-Detection über Visual Viewport API
const viewport = window.visualViewport;
if (viewport) {
  viewport.addEventListener('resize', () => {
    const keyboardOpen = viewport.height < window.innerHeight * 0.75;
    document.body.classList.toggle('keyboard-open', keyboardOpen);
  });
}
```

```css
/* Wenn Keyboard offen: Steuerleiste ausblenden, Canvas komprimieren */
body.keyboard-open .control-bar {
  display: none;  /* Platz freimachen */
}
body.keyboard-open .task-type-chips {
  display: none;  /* Platz freimachen */
}
body.keyboard-open .module-area {
  /* Nur Canvas + aktives Input sichtbar */
  max-height: calc(var(--visual-vh, 50vh));
}
```

3. **Scroll-to-Input:** Bei Fokus auf DOM-Input scrollt das Layout so, dass das Eingabefeld über dem Keyboard sichtbar bleibt:
```ts
inputEl.addEventListener('focus', () => {
  setTimeout(() => inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
});
```

---

### E20 — BESCHLUSS: Topbar-Home-Button Spezifikation (betrifft Baustein 7)

**Problem:** CLAUDE.md: "Großer, persistenter Zurück-Button oben links" (MUST). Die Vision zeigt den App-Titel links, aber spezifiziert nicht explizit den Home-Navigationslink.

**BESCHLUSS:**

```
┌─[🔢 Mathewerkstatt]─[✖️ Einmaleins ▾]───────────[🔔][☀️]─┐
  ↑                      ↑
  Home-Button            Modul-Overlay-Trigger
  (immer zur Startseite) (öffnet Modul-Auswahl)
```

- **"🔢 Mathewerkstatt"** ist ein Button (nicht nur Text)
- Touch-Target: min 48×48px (Höhe der Topbar)
- Klick → navigiert immer zur Startseite
- Auf der Startseite selbst: deaktiviert (visuell gedimmt)
- Keyboard: **Alt+0** als Shortcut (bereits in Vision)

**Markup:**
```html
<header class="topbar">
  <button class="topbar-home" aria-label="Zurück zur Startseite">
    🔢 Mathewerkstatt
  </button>
  <button class="topbar-module" aria-label="Modul wechseln" aria-haspopup="dialog">
    ✖️ Einmaleins ▾
  </button>
  <!-- ... -->
</header>
```

---

### Finale Status-Tabelle: Alle offenen Punkte

| # | Thema | Status |
|---|---|---|
| E1 | Font-Strategie | ✅ Entschieden: Inline-Einbettung, 2 Varianten |
| E2 | ES-Target | ✅ Entschieden: ES2022 bleibt, Chrome ≥ 105 |
| E3 | Container Queries | ✅ Entschieden: Uneingeschränkt nutzbar |
| E4 | prefers-reduced-motion Canvas | ✅ Spezifiziert: Globaler Motion-Guard |
| E5 | TTS in DSL | ✅ Spezifiziert: Auto-TTS + ttsText-Feld |
| E6 | Hints Typing | ✅ Spezifiziert: Tuple-Typ |
| E7 | ARIA Overlay | ✅ Spezifiziert: role=dialog + Focus-Trap |
| E8 | Migrationsstrategie | ✅ Spezifiziert: Trunk-Based, Modul für Modul |
| E9 | Palm Rejection | ✅ Spezifiziert: isPrimary + Stylus-Priorität |
| E10 | Breakpoints | ✅ Vereinheitlicht: 6-Stufen-System |
| E11 | Undo-Toast | ✅ Spezifiziert: Framework-Feature |
| E12 | Modul-Inventar | ✅ Klargestellt: 12 Module existieren |
| E13 | CSS reduced-motion | ✅ Spezifiziert: Globaler Guard |
| E14 | safe-area-inset-bottom | ✅ Spezifiziert: CSS + viewport-fit |
| E15 | Focus-Indikatoren | ✅ Spezifiziert: 3px solid, 3px offset |
| E16 | Navigationsparadigma | ✅ Begründeter Wechsel, CLAUDE.md-Anpassung definiert |
| E17 | Progressive Hints | ✅ Hybrid: Manual (default) + Auto (optional) |
| E18 | Legasthenie-Einstellungen | ✅ Im Modul-Overlay, 3 Regler |
| E19 | On-Screen-Keyboard | ✅ Visual Viewport API + CSS Toggle |
| E20 | Home-Button | ✅ App-Titel als Home-Link spezifiziert |

### CLAUDE.md-Änderungen (bei Implementierungsbeginn durchzuführen)

Die folgenden CLAUDE.md-Abschnitte müssen vor oder bei Phase 1 des Redesigns aktualisiert werden:

| § | Aktuell | Neu |
|---|---|---|
| **Layout-Regeln** | `.module-layout { grid-template-columns: 300px 1fr }` | Einspaltiges Vollbreite-Layout, kein linkes Panel |
| **Breakpoints** | `<1100px` Mobile, `≥1100px` Desktop | 6-Stufen-System (E10) |
| **Canvas-Architektur** | `buildStandardLayout()` / `buildButtonRow()` | Scene Graph: `vstack()`, `hstack()`, `grid()` |
| **Canvas-Primitives** | `drawLabel`, `drawPanel`, `drawCanvasButton` | Scene Graph Nodes: `TextNode`, `PanelNode`, `ButtonNode` |
| **HitArea-Registrierung** | `this.hitAreas.push({...})` manuell | Automatisch aus Scene Graph |
| **Navigation** | "Persistente, sichtbare Navigation" | "Topbar + Overlay-Navigation" (E16) |
| **Bottom Tab Bar** | "3–5 Items, Icon + Text-Label" | "Lehrer-Steuerleiste" (E16) |
| **Zurück-Button** | "Großer, persistenter Zurück-Button" | "App-Titel als Home-Button" (E20) |
| **Progressive Hints** | 4-Stufen automatische Eskalation | Hybrid: Manual (default) + Auto (optional) (E17) |
| **Z-Index-System** | 5 Schichten (8–1000) | Um Steuerleiste + Toast erweitern |
