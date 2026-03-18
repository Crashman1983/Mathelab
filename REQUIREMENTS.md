# Mathewerkstatt Bayern 3/4 – Anforderungsdokumentation

**Version:** 1.1
**Datum:** 2026-03-14
**Zweck:** Externes Audit – vollständige Dokumentation aller funktionalen und nicht-funktionalen Anforderungen

---

## 1. Anwendungskontext

Mathewerkstatt Bayern 3/4 ist eine interaktive Lern-App für Grundschüler der 3. und 4. Klasse nach dem Lehrplan **LehrplanPLUS Bayern**. Die Anwendung wird primär auf **interaktiven Großbildschirmen** (75"–85", 4K) im Klassenraum eingesetzt sowie auf Tablets und Laptops.

---

## 2. Übergeordnete Systemanforderungen

### 2.1 Deployment und Portabilität

| ID | Anforderung |
|----|-------------|
| SYS-01 | Die Anwendung wird als **einzelne HTML-Datei** ausgeliefert (kein Server, keine externen Abhängigkeiten zur Laufzeit). |
| SYS-02 | Die Datei muss **offline** funktionieren – kein Internet, kein CDN, keine externen Schriften oder APIs. |
| SYS-03 | Die Zieldatei darf im Gzip-komprimierten Zustand **150 KB** nicht überschreiten. |
| SYS-04 | Die Anwendung läuft wahlweise lokal im Browser oder über einen Webserver. |
| SYS-05 | Technologie-Stack: **TypeScript**, **Vite** als Build-System, **vite-plugin-singlefile** für die HTML-Bündelung. |
| SYS-06 | Kein Frontend-Framework (kein React, Vue, Angular) – nur Web-Standards (DOM + Canvas 2D). |

### 2.2 Browser-Unterstützung

| ID | Anforderung |
|----|-------------|
| SYS-07 | Unterstützte Browser: **Chrome ≥ 105, Firefox ≥ 110, Safari ≥ 16.4, Edge ≥ 105**. Ältere Versionen sind End-of-Support und werden nicht unterstützt. |
| SYS-08 | Keine Polyfills; ES2022 und moderne Web-APIs (inkl. Container Queries) dürfen vorausgesetzt werden. |

### 2.3 Eingabe und Geräteklassen

| ID | Anforderung |
|----|-------------|
| SYS-09 | Alle Interaktionen (Klick, Drag, Zeigerbewegung) verwenden ausschließlich die **Pointer Events API** (`pointerdown`, `pointermove`, `pointerup`). Separate Mouse- und Touch-Handler sind verboten. |
| SYS-10 | Die Anwendung muss auf **interaktiven Whiteboards** mit Stift/Finger (Windows Ink, SMART Board) ebenso funktionieren wie mit Maus auf Desktop und Finger auf Tablet. |
| SYS-11 | Kein doppeltes Feuern von Events (z. B. Ghost-Clicks): Pointer Events verhindern dies ohne zusätzliche Logik. |
| SYS-12a | **Palm Rejection:** Wenn ein Stylus aktiv ist (`pointerType === 'pen'`), werden zeitgleiche Touch-Events ignoriert. `isPrimary`-Check filtert Multi-Touch-Geister. |

### 2.4 HiDPI-Rendering

| ID | Anforderung |
|----|-------------|
| SYS-12 | Jedes `<canvas>`-Element muss mit `syncCanvasSize()` initialisiert werden. Diese Funktion setzt die physische Canvas-Größe auf `CSS-Breite × devicePixelRatio` und skaliert den Kontext entsprechend. |
| SYS-13 | `syncCanvasSize()` muss sowohl in `onActivate()` als auch am Anfang von `render()` aufgerufen werden, damit Größenänderungen (Fenster-Resize, Orientierungswechsel) korrekt verarbeitet werden. |
| SYS-14 | Alle Canvas-Werte (Schriftgrößen, Abstände, Linienbreiten, Radien) basieren auf `canvasWidth` (physische Pixel) und nicht auf CSS-Pixeln, um auf HiDPI-Bildschirmen scharf zu bleiben. |

### 2.5 Barrierefreiheit (Accessibility)

| ID | Anforderung |
|----|-------------|
| SYS-15 | Alle Canvas-Elemente müssen `role="img"` und einen beschreibenden `aria-label` tragen. |
| SYS-16 | Canvas-Buttons (Hit Areas) sind per **Pfeiltasten** navigierbar (links/rechts/oben/unten zykliert durch aktive Hit Areas) und per **Enter/Space** aktivierbar. |
| SYS-17 | Modulwechsel: **Alt+1 bis Alt+9** (entspricht Nav-Reihenfolge der 12 Module); **Alt+0** führt immer zur Startseite. |
| SYS-18 | Der aktive Canvas erhält beim Fokus via Tastatur einen sichtbaren Fokus-Ring: **3px solid** `var(--accent)`, **3px offset**, ≥3:1 Kontrast. |
| SYS-19 | **Modul-Overlay** als modaler Dialog: `role="dialog"`, `aria-modal="true"`, Fokus-Trap, ESC zum Schließen. |
| SYS-20 | **`prefers-reduced-motion: reduce`:** Alle CSS-Animationen werden global gedrosselt (max 150ms Opacity-Fade). Canvas-Animationen werden über einen globalen Motion-Guard im Scene Graph gesteuert. |
| SYS-21 | **`safe-area-inset-bottom`:** iOS-Home-Bar-Bereich wird über `env(safe-area-inset-bottom)` freigehalten. `<meta viewport>` enthält `viewport-fit=cover`. |

### 2.6 Schrift-Einbettung

| ID | Anforderung |
|----|-------------|
| SYS-22 | **Atkinson Hyperlegible** (Regular 400, Bold 700) wird als **Base64-encoded WOFF2** inline in `tokens.css` eingebettet. Keine externen Font-Requests. |
| SYS-23 | Font-Subset: **Latin + Latin Extended** (U+0000–024F). Keine Italic-Varianten (Kursiv ist verboten nach UX-Richtlinien). |
| SYS-24 | Font-Stack: `'Atkinson Hyperlegible', system-ui, -apple-system, sans-serif`. Figtree entfällt als eigenständiger Font. |

---

## 3. Design-System-Anforderungen

### 3.1 Farben und Themes

| ID | Anforderung |
|----|-------------|
| DS-01 | Die Anwendung unterstützt **Dark Mode** und **Light Mode** mit je einer vollständigen Farbpalette. |
| DS-02 | Alle Farbwerte kommen ausschließlich aus dem zentralen Design-System (`src/core/design.ts`). Keine lokalen Magic-Color-Strings in Modulen. |
| DS-03 | Das Theme wird über einen **Toggle-Button** in der Navigationsleiste umgeschaltet und in `localStorage` persistiert. |
| DS-04 | Die Farbpalette definiert: Hintergründe, Panel, Text, Akzent, Status (ok/warn/bad) und Canvas-spezifische Rollen. |

### 3.2 Typografie

| ID | Anforderung |
|----|-------------|
| DS-05 | CSS-Schriftgrößen werden ausschließlich über `clamp(min, preferred, max)` mit `vw`-basierten Slopes definiert, um auf Bildschirmen von 10" bis 85" korrekt zu skalieren. |
| DS-06 | Canvas-Schriftgrößen werden **ausschließlich** über `resolveCanvasFonts(canvasWidth)` berechnet. Keine absoluten px-Werte für Canvas-Text. |
| DS-07 | **Mindestlesbarkeit auf 85"-4K-Tafeln:** Texte müssen aus **4 m Abstand** einem Sehwinkel von ≥ 0,5° entsprechen. Für einen 53-PPI-Bildschirm bedeutet dies: `xs ≥ 73 px` physische Canvas-Pixel (entspricht Ratio 0,023 × `canvasWidth`). |
| DS-08 | Canvas-Schriftgrößen-Verhältnisse (Anteil von `canvasWidth`): `xs 0,023` / `sm 0,028` / `md 0,036` / `lg 0,046` / `xl 0,064`. Nur nach unten durch Mindestpixel begrenzt (keine Obergrenzen). |

### 3.3 Abstände und Radien

| ID | Anforderung |
|----|-------------|
| DS-09 | Canvas-Abstände werden über `resolveCanvasSpacing(canvasWidth)` berechnet (proportional). |
| DS-10 | Canvas-Radien werden über `resolveCanvasRadius(canvasWidth)` berechnet (proportional, keine festen px). |
| DS-11 | CSS-Abstände kommen aus dem `SPACING`-Objekt in `design.ts`. |

### 3.4 Responsive Layout

| ID | Anforderung |
|----|-------------|
| DS-12 | Die App nutzt ein **einspaltiges Vollbreite-Layout** mit versteckter Overlay-Navigation (Lehrer-Smartboard-Modus). Der Canvas nutzt die volle Bildschirmbreite. |
| DS-13 | 6-Stufen-Breakpoints: **compact** < 768px, **tablet** 768–1099px, **desktop** 1100–1399px, **wide** 1400–2199px, **board** 2200–3399px, **massive** ≥ 3400px. |
| DS-14 | Ab **board** (≥ 2200px) oder im Fullscreen: Smartboard-Modus mit 64px Touch-Targets, 2px Borders, vergrößerter Schrift. |
| DS-15 | Canvas-Elemente skalieren mit dem verfügbaren Platz (`flex:1`, `min-height:0`, HiDPI-aware). |

---

## 4. Architektur-Anforderungen

### 4.1 Modul-System

| ID | Anforderung |
|----|-------------|
| ARCH-01 | Jedes Thema ist ein **autonomes Modul** (eigene Klasse, eigener State, eigene Rendering-Logik). |
| ARCH-02 | Module werden über die deklarative DSL `defineModule()` definiert. Pflicht-Methoden: `generate(difficulty, taskType)` und `check(input, task)`. Optionale Methoden: `getSolution(task)`, `explain(task, scene, path?)`. Legacy-Module können über `legacyAdapter()` koexistieren. |
| ARCH-03 | Jedes Modul deklariert `taskTypes[]`, `difficulties[]`, `flowType` ("task" oder "explore") und `input`-Methode. Das Framework leitet daraus automatisch die Steuerleisten-Variante ab. |
| ARCH-04 | Module teilen **keinen globalen State** miteinander. |
| ARCH-05 | Modulwechsel dürfen andere Module nicht beeinflussen (vollständige State-Isolation). |

### 4.2 Trennung von Concerns

| ID | Anforderung |
|----|-------------|
| ARCH-06 | **Logik** (`generate()`, `check()`) ist rein funktional und testbar — kein DOM/Canvas. Bei DSL-Modulen sind diese Funktionen direkt im `defineModule()`-Objekt. |
| ARCH-07 | **Canvas-Rendering** erfolgt über einen **Scene Graph** mit Measure→Layout→Draw-Zyklus. Kein manuelles `ctx.fillText()` in Modulen — nur deklarative Node-Bäume. |
| ARCH-08 | **State** wird über **Micro-Signals** verwaltet. `signal()` für lokalen State, `persisted()` für localStorage-backed Signals. |
| ARCH-09 | Canvas-Nodes (Text, Button, Shape, Container) kommen aus `@canvas/nodes/`. HitAreas werden automatisch aus ButtonNodes registriert. |
| ARCH-10 | Canvas-Layout verwendet 5 Container-Typen: **VStack, HStack, ZStack, Grid, Spacer**. Kein freies Positionieren — alle Koordinaten ergeben sich aus dem Constraint-basierten Layout-System. |

### 4.3 Interaktion

| ID | Anforderung |
|----|-------------|
| ARCH-11 | **Navigation:** Verstecktes Modul-Overlay (Modal), geöffnet über Topbar Modul-Label oder Alt+1–9. Kein permanentes Seitenpanel — Canvas nutzt volle Bildschirmbreite. |
| ARCH-12 | **Aufgabentyp-Chips:** DOM-Leiste oberhalb des Canvas. Horizontal scrollbar bei vielen Typen. Aktiver Typ visuell hervorgehoben. |
| ARCH-13 | **Lehrer-Steuerleiste:** DOM-Element unterhalb des Canvas, feste 56px Höhe. Enthält [💡 Hinweis] [📖 Lösung] [→ Nächste] bei `flowType: "task"` bzw. [🔄 Zurücksetzen] bei `flowType: "explore"`. Session-Counter rechts. |
| ARCH-13a | **Unified Click-Flow:** Kein Auto-Advance nach richtiger Antwort — Lehrer klickt [→ Nächste]. Steuerleiste ist immer am gleichen Ort mit gleichen Buttons. |
| ARCH-14 | Alle Canvas-Buttons werden automatisch aus dem Scene Graph als HitAreas registriert. Manuelle HitArea-Registrierung entfällt. |

### 4.4 Animation

| ID | Anforderung |
|----|-------------|
| ARCH-15 | Animationen laufen über den kontrollierten Loop `startAnimLoop()` / `stopAnimLoop()` aus `BaseModule`. Direktes `requestAnimationFrame()` außerhalb dieses Loops ist in Modulen verboten. |
| ARCH-16 | Der Loop stoppt automatisch, wenn `render()` am Ende keine weiteren Frames benötigt (`!stillAnimating`). |
| ARCH-17 | `renderCelebration(ctx)` muss der **letzte Aufruf** in jeder `render()`-Methode sein (zeichnet über alle anderen Inhalte). |
| ARCH-18 | Bei korrekter Antwort löst das Framework automatisch eine Celebration aus (500ms im Smartboard-Modus, kürzer als bisher). Kein Auto-Advance — [→ Nächste] wird enabled. |

### 4.4a Erklär-Animationen

| ID | Anforderung |
|----|-------------|
| ARCH-18a | Module mit `explain()`-Methode erhalten einen **[▶ Erklärung]**-Button in der Steuerleiste. Die Animation ist pausierbar, fortsetzbar und zurücksetzbar. |
| ARCH-18b | Module mit `solutionPaths[]` zeigen Rechenweg-Chips in der Steuerleiste. Der Lehrer wählt den Rechenweg vor Abspielen der Erklär-Animation. |
| ARCH-18c | Im `prefers-reduced-motion`-Modus werden Erklär-Animationen als schrittweise Enthüllung dargestellt (manueller [→ Nächster Schritt]-Button statt Auto-Play). |

### 4.5 Modul-Instantiierung

| ID | Anforderung |
|----|-------------|
| ARCH-19 | Module werden **lazy** erstellt: Die Factory-Funktion wird erst beim **ersten Aktivieren** des Moduls aufgerufen, nicht bei der Registrierung. |
| ARCH-20 | Einmal erstellte Modul-Instanzen bleiben für die gesamte Session im Speicher (kein Teardown zwischen Aktivierungen). `onDeactivate()` muss daher Animation-Loops und alle laufenden asynchronen Operationen selbst anhalten. |

### 4.6 Datenpersistenz

| ID | Anforderung |
|----|-------------|
| ARCH-21 | Die zuletzt aktive Session (aktives Modul, Theme-Präferenz) wird in `localStorage` gespeichert und beim Neustart wiederhergestellt. |
| ARCH-22 | Es werden keine personenbezogenen Daten gespeichert. |
| ARCH-23 | Kein Backend, keine Nutzerkonten, keine Netzwerkkommunikation. |
| ARCH-24 | **In-Memory-Transient:** Sitzungsstatistiken (Versuche, Treffer) und gespeicherte Experimentläufe (Chance-Modul) werden **nicht** in `localStorage` persistiert. Sie gehen beim Seitenladen verloren. Dies ist eine bewusste Designentscheidung, keine Lücke. |

### 4.7 Event-Bus

| ID | Anforderung |
|----|-------------|
| ARCH-25 | Der interne Event-Bus (`@core/events`) ist **ephemer**: Späte Subscriber empfangen keine vergangenen Events. |
| ARCH-26 | Fehler in Event-Listenern werden abgefangen und geloggt, unterbrechen aber nicht die Ausführung anderer Listener (Fehler-Isolation). |

---

## 5. Testanforderungen

| ID | Anforderung |
|----|-------------|
| TEST-01 | Alle funktionale Logik (`logic.ts`) ist durch **Unit-Tests** mit Vitest abgedeckt. |
| TEST-02 | Mindestabdeckung: Kernfunktionen (Spiegellogik, Netz-Analyse, Zeitberechnungen, Zahloperationen) haben jeweils eigene Testsuites. |
| TEST-03 | CI-Pflicht: `npm run validate` (typecheck + tests + build) muss vor jedem Release bestehen. |
| TEST-04 | Visuelle/Canvas-Inhalte und DOM-Events werden manuell per Smoke-Test-Checkliste geprüft (kein automatisiertes Browser-Testing). |

---

## 6. Funktionale Anforderungen nach Modul

### 6.1 Körper und Netze (`netze`)

**Ziel:** Dreidimensionale Körper verstehen, indem Netze gezeichnet und gefaltet werden.

| ID | Anforderung |
|----|-------------|
| NET-01 | Der Nutzer kann auf einem **11×11-Gitter** einzelne Felder anklicken oder durch Ziehen (Drag) markieren, um ein Netz aufzubauen. |
| NET-02 | Jede Fläche erhält eine der 6 auswählbaren Farben (Farbpicker im linken Panel). |
| NET-03 | Das System analysiert das Netz automatisch nach jedem Klick: Flächenzahl, Zusammenhang, Gültigkeit als Würfel- oder Quader-Netz. |
| NET-04 | **Prüfen:** Der Nutzer kann die Gültigkeit explizit prüfen; Feedback erscheint im Statusbereich. |
| NET-05 | **Falten:** Ein gültiges 6-Flächen-Netz wird durch eine animierte Falt-Sequenz zu einem 3D-Körper zusammengefaltet. |
| NET-06 | Das gefaltete Objekt lässt sich durch Ziehen (Pointer-Drag) in alle Richtungen drehen. |
| NET-07 | Nach vollständigem Falten dreht sich der Körper **automatisch** langsam (Auto-Spin). |
| NET-08 | **Quader-Morphing:** Ein gefalteter Würfel lässt sich per Button in einen Quader strecken und zurück. |
| NET-09 | **Gegenüber:** Die 3 geometrisch gegenüberliegenden Flächenpaare werden per BFS-Falt-Simulation berechnet und farblich hervorgehoben. |
| NET-10 | Mindestens **11 gültige Würfel-Vorlagen** und **3 Quader-Vorlagen** sind per Button abrufbar. |
| NET-11 | Ungültige Netze (nicht zusammenhängend, falsche Flächenzahl, Flächen-ID-Konflikte) werden als ungültig erkannt und gemeldet. |
| NET-12 | Die 3D-Ansicht und der 2D-Netz-Editor werden **nebeneinander** angezeigt (optimale Raumnutzung). |
| NET-13 | Die 3D-Projektion verwendet perspektivische Projektion mit Painter's Algorithm (Z-Sortierung) und einfachem diffusem Beleuchtungsmodell. |

### 6.2 Raster und Symmetrie (`symmetry`)

**Ziel:** Symmetrie entdecken, Spiegelungen ausführen, Vergrößerungen zeichnen.

| ID | Anforderung |
|----|-------------|
| SYM-01 | Das Arbeitsraster ist **15×15 Felder**, gleichmäßig aufgeteilt in Quell- und Antwortbereich. |
| SYM-02 | Die **Symmetrieachse** liegt exakt mittig zwischen Quell- und Antwortbereich (eine Spalte/Zeile als Puffer). |
| SYM-03 | Modi: **Senkrecht spiegeln**, **Waagerecht spiegeln**, **Vergrößern ×2**, **Vergrößern ×3**. |
| SYM-04 | **Beispielmodus:** Vorlage und korrekte Lösung sind beide sichtbar (zur Demonstration). |
| SYM-05 | **Übungsmodus:** Vorlage vorgegeben, Nutzer zeichnet Spiegelbild / Vergrößerung im Antwortbereich. |
| SYM-06 | **Freier Modus:** Kein Aufgabenvorgabe; Nutzer zeichnet frei und beobachtet Spiegelung in Echtzeit. |
| SYM-07 | Drag-Painting: Felder werden durch Ziehen (Pointer-Drag) ausgefüllt oder gelöscht. |
| SYM-08 | **Undo** (Ctrl+Z / Button) bis 50 Schritte. |
| SYM-09 | **Prüfen:** Antwort wird gegen die korrekte Lösung geprüft; richtige/falsche/fehlende Felder werden farbig markiert. |
| SYM-10 | Mindestens **9 vorbereitete Aufgaben** mit Abdeckung aller vier Modi (mirror-v, mirror-h, enlarge-2, enlarge-3); jeder Modus muss mindestens eine Aufgabe besitzen (durch Unit-Test abgesichert). |
| SYM-11 | Die Spiegelformel ist `mirrorX = 2 × half − x` (axis-zentriert; keine Off-by-One-Verschiebung). |

### 6.3 Daten und Zufall (`chance`)

**Ziel:** Experimentelle Wahrscheinlichkeit erleben und mit theoretischen Werten vergleichen.

| ID | Anforderung |
|----|-------------|
| CHC-01 | **Würfel:** Ein fairer 6-seitiger Würfel wird simuliert. |
| CHC-02 | **Drehrad A:** 4 gleich große Felder (fair). |
| CHC-03 | **Drehrad B:** Rotes Feld 4× größer als die anderen (unfair, zur Entdeckung). |
| CHC-04 | Würfelanzahl pro Klick: 1×, 10×, 50×, 100×. |
| CHC-05 | Ergebnisse werden in einem **Häufigkeitsbalkendiagramm** dargestellt. |
| CHC-06 | Eine **theoretische Marke** (gestrichelte Linie) zeigt die erwartete Häufigkeit bei Gleichverteilung. |
| CHC-07 | Einzelne Würfelläufe können gespeichert und innerhalb der Session verglichen werden. Gespeicherte Läufe sind **in-memory** und gehen beim Seitenladen verloren (by design, vgl. ARCH-24). |
| CHC-08 | Das Drehrad zeigt eine animierte Rotation beim Würfeln. |

### 6.4 Zeit und Kalender (`time`)

**Ziel:** Uhrzeiten ablesen, einstellen und Zeitspannen berechnen.

| ID | Anforderung |
|----|-------------|
| TIME-01 | **Uhr ablesen:** Eine analoge Uhr mit Stunden- und Minutenzeiger wird angezeigt; der Nutzer tippt die Zeit ein. |
| TIME-02 | **Uhr einstellen:** Zeiger werden per Drag auf eine Zielzeit eingestellt. |
| TIME-03 | **Kalender:** Monatskalender mit Navigierung; der Nutzer beantwortet Fragen zu Wochentagen und Zeitspannen. |
| TIME-04 | **Zeitspannen:** Berechnung der Differenz zwischen zwei Uhrzeiten (in Minuten). |
| TIME-05 | Aufgaben werden zufällig aus einem Aufgabenpool generiert. |
| TIME-06 | Feedback (korrekt/falsch) erscheint direkt nach Eingabe. |

### 6.5 Größen und Messen (`measures`)

**Ziel:** Geldbeträge zusammenstellen und Einheiten umrechnen.

| ID | Anforderung |
|----|-------------|
| MEA-01 | **Münzen:** Alle 8 deutschen Euromünzen (1 Ct bis 2 €) sind per Klick wählbar. |
| MEA-02 | Ausgewählte Münzen werden visuell angezeigt und summiert. |
| MEA-03 | Undo und Löschen-Funktionen. |
| MEA-04 | Ein Zielbetrag wird vorgegeben; der Nutzer stellt ihn durch Münzauswahl nach. |
| MEA-05 | **Einheiten umrechnen:** Mindestens 6 Maßeinheiten-Paare (z. B. km ↔ m, kg ↔ g, l ↔ ml). |
| MEA-06 | Der Nutzer tippt den Umrechnungswert ein; Feedback erscheint sofort. |

### 6.6 Zahlenlabor (`numbers`)

**Ziel:** Stellenwerte, Zahlenvergleich und Rechensprünge auf dem Zahlenstrahl.

| ID | Anforderung |
|----|-------------|
| NUM-01 | **Stellenwerte:** Zahlen bis 9 999 werden in Tausender, Hunderter, Zehner, Einer aufgeschlüsselt und als Dienes-Material visualisiert. |
| NUM-02 | **Zahlen vergleichen:** Zwei Zahlen werden angezeigt; der Nutzer wählt `<`, `=` oder `>`. |
| NUM-03 | **Rechensprünge:** Vorgegebene Sprünge (±1, ±10, ±100, ±1000) werden auf einem Zahlenstrahl als Bögen dargestellt. |
| NUM-04 | Pfeiltasten und Buttons ermöglichen die Eingabe von Sprüngen. |
| NUM-05 | Undo-Funktion für Sprünge (letzter Sprung rückgängig). |
| NUM-06 | Aufgaben werden aus einem vorbereiteten Pool zufällig ausgewählt. |

### 6.7 Geometrie (`geometry`)

**Ziel:** Ebene geometrische Figuren kennenlernen, Winkeltypen unterscheiden und Flächen berechnen.

| ID | Anforderung |
|----|-------------|
| GEO-01 | **Formen entdecken:** Mindestens 8 vorbereitete Formen (Quadrat, Rechteck, Dreieck, Kreis, Raute, Parallelogramm, Sechseck, Trapez) werden auf einem Gitter dargestellt. |
| GEO-02 | Der Nutzer tippt auf eine Form; ihre Eigenschaften werden angezeigt (Name, Beschreibung, rechte Winkel, Symmetrieachsen, Gleichseitigkeit, Gleichwinkligkeit). |
| GEO-03 | **Winkeltypen:** Verschiedene Winkel werden dargestellt; der Nutzer ordnet sie per Button-Auswahl als spitz, rechtwinklig oder stumpf ein. |
| GEO-04 | **Flächen berechnen:** Eine Form auf einem Quadratgitter wird angezeigt; der Nutzer gibt Fläche (in Kästcheneinheiten²) und Umfang (in Kästcheneinheiten) ein und prüft seine Lösung. |
| GEO-05 | Rechte Winkel in Formen werden durch ein quadratisches Markierungssymbol visualisiert. |
| GEO-06 | Alle Figuren, Winkelbögen und Gitterlinien skalieren proportional mit der Canvas-Größe (keine festen px-Caps). |

---

## 7. Nicht-funktionale Anforderungen

### 7.1 Performance

| ID | Anforderung |
|----|-------------|
| NFR-01 | Die Anwendung muss auf einem Chromebook der Mittelklasse (≥ 2 GHz, 4 GB RAM) flüssig laufen (≥ 30 fps in Animationen). |
| NFR-02 | Keine aufwändigen Bibliotheken im Runtime-Bundle; alle Abhängigkeiten sind DevDependencies. |
| NFR-03 | Canvas-Rendering nutzt `requestAnimationFrame`; der Loop pausiert bei Inaktivität. |

### 7.2 Robustheit

| ID | Anforderung |
|----|-------------|
| NFR-04 | Modulwechsel darf keine Seiteneffekte hinterlassen (kein Memory Leak durch Events oder AnimationLoops). |
| NFR-05 | Jeder Animations-Loop stoppt automatisch, wenn kein Renderbedarf mehr besteht. |
| NFR-06 | Fehlende DOM-Elemente erzeugen einen expliziten, verständlichen Fehler (über `requireElement()`). |

### 7.3 Wartbarkeit und Erweiterbarkeit

| ID | Anforderung |
|----|-------------|
| NFR-07 | Neue Module folgen der beschriebenen Modul-Vorlage und benötigen nur einen Eintrag in `main.ts` (keine globale Konfigurationsdatei). |
| NFR-08 | Alle Logik-Klassen sind frei von DOM- und Canvas-Abhängigkeiten → vollständig Unit-testbar. |
| NFR-09 | Design-Werte (Farben, Typografie, Abstände, Radien) sind ausnahmslos zentral definiert. Keine verteilten Magic Numbers. |

### 7.4 Sicherheit und Datenschutz

| ID | Anforderung |
|----|-------------|
| NFR-10 | Keine Netzwerkkommunikation; kein Tracking, kein Analytics, keine externe Ressource zur Laufzeit. |
| NFR-11 | Kein Nutzer-Login, keine Nutzerkonten, keine Speicherung personenbezogener Daten. |
| NFR-12 | `localStorage` wird ausschließlich für technische Sitzungsdaten genutzt (zuletzt aktives Modul, Theme-Präferenz). `localStorage`-Fehler (Quota, Private Mode) werden still ignoriert; die App bleibt voll funktionsfähig. |

---

## 8. Bekannte Einschränkungen und Risiken

Diese Einschränkungen sind dem Entwicklungsteam bekannt. Sie sind für ein externes Audit dokumentiert, stellen aber keine schwerwiegenden Defekte dar.

| ID | Einschränkung | Risiko | Empfehlung |
|----|---------------|--------|------------|
| LIM-01 | **ResizeObserver-Leak:** `setupCanvas()` registriert einen `ResizeObserver` je Canvas, der bei Modul-Deaktivierung nicht explizit getrennt wird. | Gering – Browser-GC räumt bei Modul-Teardown auf; Session ist langlebig, aber Modulanzahl fix. | `disconnect()` in `onDeactivate()` ergänzen, falls Memory-Profiling Auffälligkeiten zeigt. |
| LIM-02 | **Tap-Feedback-Timer nach Deaktivierung:** Wird ein Modul deaktiviert, während der 120-ms-Tap-Feedback-Timer läuft, führt der Timer noch einen `render()`-Aufruf auf dem inaktiven Modul aus. | Gering – `render()` zeichnet nur auf dem eigenen Canvas, keine Seiteneffekte. | Timer in `onDeactivate()` abbrechen. |
| LIM-03 | **Symmetrie-Vorschau-Animation außerhalb des Haupt-Loops:** Der „Vorschau einblenden"-Effekt nutzt eine eigene `requestAnimationFrame`-Kette parallel zum Hauptloop. Bei schnellem Modewechsel können beide Loops kurzzeitig laufen. | Gering – Loops schreiben beide nur in denselben Canvas, kein State-Konflikt. | Vorschau-Animation in `startAnimLoop` integrieren. |
| LIM-04 | **Hit-Area-Keyboard-Navigation bei leerem Array:** Wenn keine Hit Areas aktiv sind und Pfeiltasten gedrückt werden, wird intern ein ungültiger Index berechnet. Der Canvas bleibt funktionsfähig, aber kein Element wird fokussiert. | Gering – betrifft nur reine Zeige-Canvases ohne Buttons. | Guard `if (enabledAreas.length === 0) return` ergänzen. |
| LIM-05 | **`localStorage`-Fehler nicht surfaced:** Schreibfehler (z. B. Quota) werden silent ignoriert. Die Session-Wiederherstellung schlägt dann beim nächsten Start lautlos fehl. | Gering – betrifft nur die optionale Session-Wiederherstellung. | Log-Level-Warning im Fehlerfall; kein Nutzerfeedback nötig. |

---

## 9. Abnahmekriterien (Definition of Done)

Eine neue Funktion oder ein neues Modul gilt als fertig, wenn:

1. `npm run validate` (typecheck + tests + build) erfolgreich durchläuft.
2. Alle Unit-Tests für neue Logik-Funktionen vorhanden und bestanden.
3. Modul startet ohne Konsolen-Fehler in Chrome, Firefox und Safari.
4. Alle Canvas-Inhalte sind auf 85"-4K aus 4 m Abstand lesbar (Sehwinkel ≥ 0,5°).
5. Modulwechsel hin und zurück hinterlässt keinen sichtbaren Seiteneffekt.
6. Feiern-Animation erscheint bei korrekter Antwort.
7. Dark- und Light-Mode funktionieren ohne Darstellungsfehler.
8. Layout funktioniert bei 768 px Breite (Tablet) und bei 3840 px Breite (4K).

---

## 10. Glossar

| Begriff | Definition |
|---------|-----------|
| Canvas | HTML5-`<canvas>`-Element; rein pixelbasiertes Rendering. |
| `canvasWidth` | Physische Breite des Canvas in Geräte-Pixeln (CSS-Breite × devicePixelRatio). |
| HiDPI | High Dots Per Inch; Retina- und 4K-Bildschirme mit devicePixelRatio > 1. |
| Sehwinkel | Winkel, den ein Objekt auf der Netzhaut einnimmt; maßgeblich für Lesbarkeit aus Distanz. |
| LehrplanPLUS Bayern | Aktueller bayerischer Bildungsplan für Grundschulen; definiert Lernziele je Jahrgangsstufe. |
| `half` | `Math.floor(gridSize / 2)`; Trennindex zwischen Quell- und Antwortbereich in Symmetriemodulen. |
| BFS | Breadth-First Search; wird für Netz-Konnektivität und Falt-Simulation verwendet. |
| Painter's Algorithm | Z-Sortierung von Polygonen für 3D-Rendering ohne Tiefenpuffer. |
| Magic Number | Fest einprogrammierter numerischer Wert ohne Erklärung oder Herkunft aus dem Design-System. |
| Pointer Events API | W3C-Standard für einheitliche Eingabeverarbeitung (Maus, Touch, Stift) über `pointerdown`/`pointermove`/`pointerup`. |
| Hit Area | Rechteckiger Trefferbereich auf dem Canvas, der auf Pointer- und Tastatur-Events reagiert. Alle Hit Areas werden je Render-Frame neu berechnet und registriert. |
| `syncCanvasSize` | Utility-Funktion, die die physische Canvas-Größe an CSS-Größe × `devicePixelRatio` anpasst und den 2D-Kontext skaliert. Muss in `onActivate()` und `render()` aufgerufen werden. |
| Celebration | Partikel-Animation, die bei korrekter Antwort im oberen Canvas-Drittel abläuft. Ausgelöst via `triggerCelebration()`, gezeichnet via `renderCelebration()`. |
| Lazy Instantiation | Module werden erst beim ersten Aktivieren instanziiert (nicht bei der Registrierung). |
| ResizeObserver | Web-API, die Canvas-Größenänderungen überwacht und `syncCanvasSize` auslöst. |
