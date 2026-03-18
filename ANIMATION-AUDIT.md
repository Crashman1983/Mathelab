# Tiefenanalyse: Animation und Visualisierung — Mathelabor

**Analyse-Datum:** 2026-03-16
**Expertenteam:** Mathematikdidaktik (GS), Cognitive Science, Visual Learning, Motion Design, Scientific Visualization, Educational Software Design
**Zielgruppe:** Klasse 3–4 (8–10 Jahre), Piaget konkret-operational

---

## 1. Gesamtbewertung der Animationen

### Befund: Die App ist überwiegend statisch

Von 14 V2-Modulen besitzen nur **3 Module** echte, lernrelevante Animationen:

| Modul | Animation vorhanden | Didaktisch wirksam |
|---|---|---|
| **Addition** | Sprungbogen-Sequenz | ⚠️ Infrastruktur da, aber `animProgress=1` → sofort fertig |
| **Subtraktion** | Sprungbogen-Sequenz | ⚠️ Gleich wie Addition — Animation existiert, wird übersprungen |
| **Einmaleins** | Keine | ❌ Statisches Punktfeld |
| **Zahlenlabor** | Keine | ❌ Rein statisch |
| **Bruchlabor** | Keine | ❌ Pizza/Balken sofort sichtbar |
| **Geometrie** | Keine | ❌ Formen statisch |
| **Zeit** | Zeiger-Dragging | ✅ Direkte Manipulation (aber ohne Smooth-Transition) |
| **Koordinaten** | Keine | ❌ Punkte erscheinen instant |
| **Symmetrie** | Keine | ❌ Kein Spiegel-Effekt sichtbar |
| **Daten & Zufall** | Würfel-Bounce, Rad-Spin | ⚠️ Dekorativ, nicht didaktisch |
| **Muster** | Keine | ❌ Statische Boxen |
| **Algorithmen** | Keine | ❌ Statisches Spalten-Layout |
| **Körper & Netze** | 3D-Faltung | ✅ Geometrisch korrekt, didaktisch wertvoll |
| **Größen & Messen** | Keine | ❌ Statischer Umrechnungsbalken |

**Gesamturteil:** Die App nutzt Animationen primär als **dekoratives Element** (Würfel-Bounce, Rad-Spin) oder als **übersprungene Infrastruktur** (Sprungbögen mit Progress=1). Nur das Netze-Modul setzt Animation als echtes **Denk-Werkzeug** ein. Das Potenzial der Canvas-basierten Architektur wird zu weniger als 20% ausgeschöpft.

---

## 2. Analyse der Bewegungslogik

### 2.1 Mathematisch korrekte Bewegungen

**Netze-Modul (✅ korrekt):**
- Faltung um korrekte Kanten mittels `buildFaceTransforms()` mit Matrix-Multiplikation
- Perspektivprojektion mit Tiefensortierung (Painter's Algorithm)
- Rückseiten-Erkennung via Bildschirm-Kreuzprodukt
- Falt-Interpolation `fold: 0→1` mit `easeInOutCubic` (2400ms) — geometrisch exakt

**Addition/Subtraktion (✅ korrekt, aber unsichtbar):**
- Quadratische Bézier-Kurven für Sprungbögen: `(1-t)²P₀ + 2t(1-t)Pₘ + t²P₁`
- Segmentierung korrekt: Stagger-Sequenz `segStart = i/segCount`
- **Problem:** `animProgress` startet bei 1 → alle Bögen sofort vollständig gezeichnet. Die Animation existiert im Code, wird aber nie sichtbar.

**Einmaleins-Sprünge (✅ korrekt):**
- Quadratische Kurven mit `arcHeight = (x1-x0) * 0.55`
- **Problem:** Keine Animation — sofort alle Bögen sichtbar

### 2.2 Fehlende oder fehlerhafte Bewegungen

**Brüche:** Pizza-Sektoren werden statisch gezeichnet. Es gibt keine Animation des "Schneidens" oder "Füllens". Ein Kind sieht das Ergebnis, aber nicht den Prozess.

**Symmetrie:** Das gespiegelte Muster erscheint als fertige Farbfüllung. Es gibt keine Animation, die den Spiegelvorgang selbst zeigt — das Kind malt die Antwort, sieht aber nie, wie die Spiegelung tatsächlich funktioniert.

**Geometrie (Flächen):** Die Form erscheint instant auf dem Raster. Keine Animation des "Zusammensetzens" aus Einheitsquadraten.

### 2.3 Physikalische Plausibilität

**Chance-Würfel (⚠️):** `easeOutBounce` simuliert Aufprall — visuell ansprechend, aber der Würfel "bounced" nur vertikal (Y-Offset), ohne Rotation oder Kippen. Kinder erwarten, dass ein Würfel sich dreht. Die fehlende Rotation ist eine verpasste Gelegenheit, räumliches Denken zu stärken.

**Chance-Rad (✅):** `easeOutExpo` über 2500-3500ms simuliert plausibles Auslaufen. Korrekte Drehbewegung.

---

## 3. Analyse der kognitiven Lernwirkung

### 3.1 Dual Coding Theory (Paivio)

Die App bietet grundsätzlich **visuelle + verbale** Kanäle:
- Zahlenstrahl + Gleichungstext (Addition/Subtraktion)
- Punktfeld + Aufgabentext (Einmaleins)
- Pizza-Diagramm + Bruchzahl (Brüche)

**Kritik:** Der visuelle Kanal ist **unterausgelastet**. Statische Bilder erzeugen schwächere Gedächtnisspuren als dynamische Visualisierungen. Paivios Theorie sagt: Wenn beide Kanäle gleichzeitig aktiviert werden und die Information kongruent ist, verdoppelt sich die Gedächtnisleistung. Aktuell nutzt die App den visuellen Kanal als bloße Illustration, nicht als eigenständigen Erkenntnispfad.

**Fehlend:** Animierte Übergänge zwischen konkreter und abstrakter Darstellung. Beispiel: Ein Punktfeld (konkret) sollte sich animiert in eine Multiplikationsgleichung (abstrakt) transformieren.

### 3.2 Cognitive Load Theory (Sweller)

**Positiv:**
- Extraneous Load ist gering: Klare Layouts, wenig visuelles Rauschen
- Jedes Modul zeigt nur eine Aufgabe zur Zeit

**Negativ:**
- **Intrinsic Load wird nicht scaffolded.** Ohne Animation muss das Kind den gesamten Verarbeitungsprozess mental durchführen. Beispiel: Bei 47+28 muss das Kind den Zahlenstrahl-Sprung mental animieren. Die App könnte diese kognitive Last reduzieren, indem sie den Sprung Schritt für Schritt zeigt.
- **Germane Load wird nicht gefördert.** Animationen, die Zwischenzustände zeigen, fördern Schema-Bildung. Ohne sie bleibt das Lernen an der Oberfläche.

### 3.3 Embodied Cognition

**Module mit motorischer Beteiligung:**
- **Zeit:** Uhr-Zeiger drehen (✅ starke Embodiment-Verbindung)
- **Symmetrie:** Zellen malen (✅ Hand-Auge-Koordination)
- **Koordinaten:** Punkt platzieren (✅ Raum-Handlung-Verbindung)
- **Netze:** 3D-Rotation per Drag (✅ räumliche Exploration)

**Module ohne motorische Beteiligung (11 von 14):**
- Addition, Subtraktion, Einmaleins, Zahlenlabor, Brüche, Geometrie, Muster, Algorithmen, Größen: Alle rein passiv (Numpad-Eingabe ≠ Embodiment).

**Bewertung:** Die App verschenkt das größte Potenzial von Touch-Geräten. Kinder im konkret-operationalen Stadium lernen durch Handlung. "Ziehe den Frosch zum richtigen Platz" wäre didaktisch 10× wirksamer als "Tippe die Zahl ein."

### 3.4 Spatial Reasoning

Nur das **Netze-Modul** fordert echtes räumliches Denken. Alle anderen Module sind 2D-flach und erfordern keine mentale Rotation oder Perspektivwechsel.

**Verpasste Gelegenheiten:**
- Geometrie: Keine Rotation von Formen, kein Drehen um Achsen
- Symmetrie: Kein animiertes Klappen um die Spiegelachse
- Brüche: Kein räumliches Aufteilen (z.B. Pizza-Schnitt-Animation)

### 3.5 Conceptual Change Theory

**Kernfrage:** Können Kinder durch die App von naiven zu wissenschaftlichen Konzepten wechseln?

**Befund: Nein.** Die Visualisierungen zeigen das **Was**, aber nicht das **Warum**.

Beispiele:
- **Addition:** Zeigt, dass 15+1=16. Zeigt nicht, warum der Frosch genau einen Schritt macht (keine Verknüpfung von Zählen und Addition).
- **Brüche:** Zeigt ⅔ als zwei von drei Sektoren. Zeigt nicht den Übergang von "2 Stücke von 3" zu "der Bruch ⅔" (konkret → formal).
- **Einmaleins:** Zeigt ein 3×4 Punktfeld. Zeigt nicht, wie 3×4 = 4+4+4 (keine animierte Gruppierung).

---

## 4. Analyse der visuellen Klarheit

### 4.1 Fokusführung

**Gut:**
- Farbliche Hervorhebung des fokussierten Elements (Algorithmen: Spalte mit Akzentfarbe)
- Deaktivierte Bereiche sind abgeblendet (z.B. Symmetrie: Antwort-Region α=0.35)

**Schlecht:**
- Kein visueller Eintritts-Fokus bei Aufgabenwechsel. Wenn eine neue Aufgabe generiert wird, erscheint alles gleichzeitig — kein Element zieht den Blick an.
- Keine Aufmerksamkeits-Animation ("Schau hierher"): Kein Pulsieren, kein Highlight, kein sanfter Zoom auf das neue Element.

### 4.2 Kontrast und Hierarchie

**Positiv:**
- Konsistente Farbsemantik: Grün = richtig, Akzent = aktiv, Panelsoft = inaktiv
- Design-Token-System verhindert Wildwuchs

**Negativ:**
- Viele Module haben **zu homogene visuelle Dichte**. Alle Elemente haben gleiche Opazität und gleiche Strichstärke. Es fehlt eine klare visuelle Hierarchie: Primär (Aufgabe) > Sekundär (Kontext) > Tertiär (Dekoration).

### 4.3 Farbcodierung (mathematische Semantik)

| Modul | Farbnutzung | Bewertung |
|---|---|---|
| Addition/Subtraktion | Grün für Frosch/Bögen, aber beide Teilsprünge gleiche Farbe | ⚠️ Schritte nicht differenzierbar |
| Einmaleins-Sprünge | `palette.faceColors` — jeder Sprung andere Farbe | ✅ Gut: Gruppierung sichtbar |
| Brüche (Pizza) | Rot für gefüllte Sektoren, Grau für leere | ✅ Klar |
| Netze | Gegenüberliegende Flächen gleiche Farbe | ✅ Didaktisch korrekt |
| Zahlenlabor (Stellen) | Kisten/Beutel/Stangen/Nüsse — brauntönig | ⚠️ Zu ähnliche Farbtöne |

---

## 5. Analyse der Interaktion

### 5.1 Direkte Manipulation

| Modul | Interaktionstyp | Didaktische Qualität |
|---|---|---|
| Zeit (Uhr) | Zeiger drehen | ✅ **Stark:** Geste = mathematische Operation |
| Koordinaten | Punkt platzieren | ✅ **Stark:** Tippen = Positionieren |
| Symmetrie | Zellen malen | ✅ **Mittel:** Malen ≠ Spiegeln |
| Netze | 3D drehen | ✅ **Stark:** Rotation = räumliches Erkunden |
| Addition | Numpad → Zahl | ❌ **Schwach:** Tippen ≠ Springen |
| Einmaleins | Numpad → Zahl | ❌ **Schwach:** Tippen ≠ Gruppieren |
| Brüche | Numpad → Zähler | ❌ **Schwach:** Tippen ≠ Aufteilen |

**Kernproblem:** 10 von 14 Modulen verwenden Numpad-Eingabe als primäre Interaktion. Das ist **Abfrage**, nicht **Lernen**. Direkte Manipulation (Drag, Paint, Place) erzeugt tieferes Verständnis.

### 5.2 Vorhersage-Möglichkeiten

**Aktuell:** Keine. Kein Modul fragt das Kind: "Was glaubst du, was passiert?" bevor die Animation/Lösung gezeigt wird.

**Ideal:** Das Netze-Modul sollte fragen: "Welche Fläche wird oben sein?" → Kind tippt → Faltung zeigt Ergebnis → Vergleich. Dies aktiviert **Predict–Observe–Explain** (POE), eine der wirksamsten naturwissenschaftsdidaktischen Methoden.

---

## 6. Identifizierte Probleme

### Kritische Probleme (verhindern Lernen)

| # | Problem | Betroffene Module | Begründung |
|---|---|---|---|
| K1 | **Animationen existieren im Code, werden aber übersprungen** (`animProgress=1`) | Addition, Subtraktion | Sprungbögen sind die zentrale Visualisierung der Operation. Ohne Animation ist der Zahlenstrahl ein statisches Bild — didaktisch kaum wirksamer als gedrucktes Papier. |
| K2 | **Kein animierter Übergang bei Aufgabenwechsel** | Alle 14 Module | Instant-Swap zerstört Orientierung. Kinder verlieren den Bezug zum vorherigen Problem. Kein Scaffolding möglich. |
| K3 | **Einmaleins-Punktfeld ist statisch** | Einmaleins | Das Punktfeld ist die wichtigste Visualisierung für Multiplikationsverständnis. Ohne Animation der Gruppierung (3 Reihen zu je 4) bleibt es ein abstraktes Bild. |
| K4 | **Bruch-Füllung ohne Prozess** | Brüche | Sektoren sind sofort gefüllt oder leer. Kein "Schneiden" der Pizza, kein "Gießen" in den Balken. Der Teilungsprozess — das Kernkonzept — ist unsichtbar. |
| K5 | **Symmetrie zeigt keinen Spiegelvorgang** | Symmetrie | Das Kind malt Zellen, aber sieht nie, wie die Spiegelung als Transformation funktioniert. Die Spiegelachse ist eine Linie, kein aktives Werkzeug. |

### Mittlere Probleme (reduzieren Lernwirkung)

| # | Problem | Betroffene Module | Begründung |
|---|---|---|---|
| M1 | **Erfolgsanimation hat keinen mathematischen Bezug** | Alle (via Celebration) | Das neue ✓+Konfetti zeigt "richtig!", aber nicht "warum richtig." Besser: Die Lösung visuell hervorheben (z.B. Frosch springt zum Ziel, Bruch-Sektor leuchtet). |
| M2 | **Würfel dreht sich nicht beim Rollen** | Chance | Kinder erwarten physikalische Plausibilität. Ein Würfel, der nur vertikal bounced, untergräbt die Glaubwürdigkeit der Simulation. |
| M3 | **Uhr-Zeiger snappen ohne Transition** | Zeit | `setHour/setMinute` ändern sofort die Anzeige. Kein sanftes Gleiten. Kinder verlieren das Gefühl für "wie weit" sich der Zeiger bewegt hat. |
| M4 | **Algorithmen zeigen Übertrag nicht animiert** | Algorithmen | Überträge erscheinen sofort. Eine Animation "Einer voll → Zehner rüber" würde das Stellenwertsystem erfahrbar machen. |
| M5 | **Koordinaten-Punkt erscheint instant** | Koordinaten | Ein animiertes "Gleiten" zur Position würde X- und Y-Komponente einzeln erfahrbar machen. |
| M6 | **Muster-Sequenz zeigt alle Schritte gleichzeitig** | Muster | Stufenweises Einblenden (Schritt 1 → 2 → 3 → ?) würde das Erkennen des Musters unterstützen. |

### Geringfügige Probleme

| # | Problem | Betroffene Module |
|---|---|---|
| G1 | Frosch hat keine Sprung-Animation (keine Bein-Bewegung) | Addition |
| G2 | Taucher hat keine Schwimm-Animation | Subtraktion |
| G3 | Kein visueller Unterschied zwischen "noch nicht beantwortet" und "falsch beantwortet" in erster Sekunde | Mehrere |
| G4 | Netze: Falt-Animation pausiert nicht bei Zwischenzuständen | Netze |

---

## 7. Konkrete Verbesserungsvorschläge

### 7.1 Sofort umsetzbar (bestehende Infrastruktur)

#### V1: Addition/Subtraktion — Sprunganimation aktivieren
```
Problem: animProgress=1 überspringt Animation
Lösung: animProgress=0 als Default, onActivate startet RAF-Loop 0→1 über 800ms
Aufwand: ~20 Zeilen (RAF-Loop existiert bereits im Code)
Lerneffekt: Kind sieht jeden Sprung einzeln entstehen → Zählen wird sichtbar
```

#### V2: Aufgabenwechsel-Transition (alle Module)
```
Problem: Instant-Swap bei neuer Aufgabe
Lösung: In module-framework.ts: Canvas kurz (200ms) auf α=0 faden, neue Aufgabe laden, 200ms einfaden
Aufwand: ~15 Zeilen in module-framework.ts
Lerneffekt: Orientierung bleibt erhalten, Kind erkennt "neue Aufgabe beginnt"
```

#### V3: Netze — Zwischenzustände bei Faltung
```
Problem: Faltung läuft durch ohne Pause
Lösung: Faltung bei fold=0.5 pausieren (1s), Kontaktkanten hervorheben, dann weiterfalten
Aufwand: ~30 Zeilen (Pause-State + Kanten-Highlight)
Lerneffekt: Kind kann Zwischenzustand betrachten, mentale Rotation wird unterstützt
```

#### V4: Uhr-Zeiger — Smooth-Transition
```
Problem: Zeiger snappen instant
Lösung: animateTo(currentAngle, targetAngle, {duration: 200, ease: easeOut}) bei jedem Drag-Schritt
Aufwand: ~20 Zeilen
Lerneffekt: Kontinuität der Zeigerbewegung → Zeitgefühl wird gestärkt
```

### 7.2 Mittelfristig umsetzbar (neue Animations-Szenen)

#### V5: Einmaleins — Gruppierungs-Animation
```
Konzept: Bei Aufgabe 3×4:
1. Einzelne Punkte erscheinen nacheinander (Stagger, 50ms)
2. Punkte gruppieren sich zu 3 Reihen (horizontale Slide-Animation, 300ms)
3. Reihen-Label "4" erscheint je Reihe
4. Gesamtergebnis "12" faded ein
Lerneffekt: Kind sieht wie Multiplikation = wiederholte Addition
```

#### V6: Brüche — Schnitt-Animation
```
Konzept: Pizza-Modus:
1. Ganze Pizza sichtbar (1s)
2. Schnittlinien erscheinen nacheinander (Stagger, 200ms pro Schnitt)
3. Leere Sektoren gleiten leicht auseinander (Translation 3px, 200ms)
4. Gefüllte Sektoren leuchten auf (α-Pulse)
Lerneffekt: "Teilen" wird als Prozess sichtbar, nicht als Zustand
```

#### V7: Symmetrie — Spiegel-Animation
```
Konzept: Nach "Prüfen":
1. Korrekte Lösung erscheint gespiegelt — aber erst als Reflexion
2. Die gemalten Zellen "klappen" um die Spiegelachse (Transformation-Animation, 400ms)
3. Übereinstimmende Zellen leuchten grün, falsche orange
Lerneffekt: Spiegelung wird als geometrische Transformation erfahrbar
```

#### V8: Koordinaten — Achsen-Gleiten
```
Konzept: Beim Platzieren eines Punktes:
1. Kind tippt auf Grid
2. Vertikale Hilfslinie gleitet von Links zur X-Koordinate (200ms)
3. Horizontale Hilfslinie gleitet von Unten zur Y-Koordinate (200ms)
4. Schnittpunkt blinkt, Punkt erscheint
Lerneffekt: X und Y werden als unabhängige Komponenten erfahrbar
```

#### V9: Algorithmen — Übertrag-Animation
```
Konzept: Wenn eine Spalte überfließt:
1. Summe >9 wird kurz angezeigt (z.B. "13")
2. Einer-Ziffer (3) gleitet in die Ergebnis-Zeile (Slide-Down, 200ms)
3. Zehner-Ziffer (1) gleitet nach links in die nächste Spalte (Slide-Left, 300ms)
4. Übertrag-Label erscheint mit Scale-Ease
Lerneffekt: Stellenwertsystem wird als Umlagerungsprozess sichtbar
```

#### V10: Muster — Sequenz-Aufbau
```
Konzept: Figuren-Modus:
1. Schritt 1 erscheint (Scale-In, 200ms)
2. Pause 500ms
3. Schritt 2 erscheint, Unterschied zum vorherigen wird farblich markiert
4. Pause 500ms
5. Schritt 3 erscheint, Muster wird sichtbar
6. "?" pulsiert sanft
Lerneffekt: Kind erkennt Wachstumsregel durch sequenzielle Offenbarung
```

### 7.3 Langfristig (Interaktionsmodell-Änderungen)

#### V11: Addition — Frosch-Drag statt Numpad
```
Konzept: Kind zieht den Frosch auf dem Zahlenstrahl zum vermuteten Ergebnis.
Sprungbögen entstehen während des Ziehens.
Feedback: Frosch landet → Richtig/Falsch.
Lerneffekt: Motorische Kopplung von Handlung und Rechenoperation (Embodied Cognition)
```

#### V12: Brüche — Pizza-Sektoren antippen
```
Konzept: Kind tippt Sektoren an, um sie zu "füllen" (statt Zähler einzutippen).
Jeder Tipp füllt einen Sektor mit Animation.
Feedback: Richtige Anzahl → Grün.
Lerneffekt: "Zählen der Teile" wird zur Handlung
```

#### V13: Einmaleins — Punkte gruppieren per Drag
```
Konzept: Lose Punkte auf Canvas. Kind zieht Lasso um Gruppen.
Jede Gruppe = ein Multiplikand. Anzahl Gruppen = anderer Faktor.
Lerneffekt: Multiplikation als Strukturierung einer Menge
```

---

## 8. Ideales Animationsdesign

### Modell: Perfekte Zahlenstrahl-Sprung-Animation (Addition)

**Phase 1 — Orientierung (500ms):**
1. Zahlenstrahl baut sich von links nach rechts auf (Linie wächst, Ticks erscheinen gestaffelt)
2. Startzahl `a` wird hervorgehoben (Puls-Animation, Scale 1.0→1.15→1.0)
3. Frosch "landet" auf der Startzahl (Drop-In von oben, easeOutBounce)

**Phase 2 — Aktion (800ms pro Sprung):**
1. Frosch duckt sich (scaleY 1.0→0.85, 100ms)
2. Frosch springt entlang Bézier-Bogen (400ms, easeOut)
   - Bogen zeichnet sich synchron mit Frosch-Position
   - Sprung-Label "+step" faded ein am Scheitelpunkt (200ms Verzögerung)
3. Frosch landet (scaleY 0.85→1.1→1.0, easeOutBounce, 200ms)
4. Landezahl wird hervorgehoben (Puls)

**Phase 3 — Wenn mehrstufig:**
- Pause 400ms zwischen Sprüngen
- Zweiter Bogen in anderer Farbe (visuell trennbar)
- Gesamtpfeil erscheint nach letztem Sprung

**Phase 4 — Ergebnis (300ms):**
1. Gleichung "a + b = ?" morpht zu "a + b = c" (Zahl-Morph-Animation)
2. Ergebnis-Zahl pulsiert kurz grün

**Phase 5 — Lehrersteuerung:**
- Lehrkraft kann jeden Schritt einzeln auslösen (Klick auf "Nächster Sprung")
- Alternative: Automatischer Ablauf mit Pause-Möglichkeit
- Zeitlupe-Button: Alles 2× langsamer

### Zwischenzustände (entscheidend):
- Nach Phase 1: Kind sieht nur Zahlenstrahl + Frosch auf Startposition
- Nach Phase 2 (Sprung 1): Bogen + Zwischenposition sichtbar
- Nach Phase 2 (Sprung 2): Beide Bögen sichtbar, Frosch auf Endposition
- Jeder Zwischenzustand bleibt stehen, bis Lehrkraft weiterklickt

### Farbsemantik:
- Frosch: Grün (Natur-Metapher, Sicherheit)
- Erster Sprung: Blau (palette.accent) — "der Anfang"
- Zweiter Sprung: Orange (palette.warn) — "der Übertrag"
- Ergebnis: Grün (palette.ok) — "geschafft!"

### Reduced Motion:
- Alle Phasen überspringen, Endzustand sofort zeigen
- Statt Bounce: Opacity-Fade (150ms)
- Zwischenzustände bleiben navigierbar (Lehrersteuerung)

---

## Modell: Perfekte Würfelnetz-Faltung (Netze)

**Phase 0 — Netz-Präsentation (800ms):**
1. Netz erscheint flach, Flächen faden nacheinander ein (Stagger 100ms)
2. Jede Fläche hat ihre Farbe + Nummer
3. Kanten, um die gefaltet wird, leuchten kurz auf (Puls, Akzentfarbe)

**Phase 1 — Gelenk-Hervorhebung (400ms):**
1. Faltkante wird markiert (3px Linie, Akzentfarbe)
2. Pfeil zeigt Faltrichtung (90° Bogen-Pfeil)
3. Pause — Kind kann vorhersagen: "Welche Fläche kommt wohin?"

**Phase 2 — Langsame Faltung (3000ms statt 2400ms):**
1. Faltung beginnt: `fold 0→0.5` über 1200ms (easeInOut)
2. **PAUSE bei fold=0.5** (1000ms):
   - Halb-gefalteter Zustand ist sichtbar
   - Kontaktkanten blinken
   - Labels "diese Kante trifft auf diese Kante" erscheinen
3. Faltung weiter: `fold 0.5→1.0` über 1200ms
4. Fertiger Würfel dreht sich langsam

**Phase 3 — Erkundung:**
1. Kind kann Würfel frei drehen (Touch-Drag)
2. "Auffalten"-Button: Rückwärts-Animation zum Netz
3. Toggle "Nummern zeigen/verstecken"

**Zwischenzustände:**
- fold=0.25: Zwei Flächen aufgerichtet, Rest flach → "Sieht aus wie ein offener Karton"
- fold=0.50: Vier Flächen aufgerichtet → "Jetzt fehlen nur noch Deckel und Boden"
- fold=0.75: Fast zu → "Gleich ist der Würfel fertig"

**Kontaktkanten:**
- Kanten, die sich bei der Faltung berühren, haben gleiche Farbe
- Beim Berühren: kurzer Licht-Blitz (Flash-Animation 150ms)

**Drehachsen:**
- Gestrichelte Linie zeigt die aktuelle Drehachse
- Farbe der Achse = Farbe der zugehörigen Fläche

---

## Anhang: Bewertungsmatrix

| Modul | Math. Korrektheit | Visuelle Klarheit | Lernwirksamkeit | Räumliche Verständlichkeit | Interaktivität | **Gesamt** |
|---|---|---|---|---|---|---|
| Addition | 5/5 | 4/5 | 2/5 | 3/5 | 1/5 | **3.0** |
| Subtraktion | 5/5 | 4/5 | 2/5 | 3/5 | 1/5 | **3.0** |
| Einmaleins | 4/5 | 3/5 | 2/5 | 2/5 | 2/5 | **2.6** |
| Zahlenlabor | 4/5 | 4/5 | 3/5 | 2/5 | 2/5 | **3.0** |
| Brüche | 4/5 | 4/5 | 2/5 | 2/5 | 2/5 | **2.8** |
| Geometrie | 5/5 | 3/5 | 2/5 | 2/5 | 2/5 | **2.8** |
| Zeit | 5/5 | 4/5 | 4/5 | 3/5 | 4/5 | **4.0** |
| Koordinaten | 5/5 | 4/5 | 3/5 | 3/5 | 3/5 | **3.6** |
| Symmetrie | 5/5 | 3/5 | 3/5 | 3/5 | 3/5 | **3.4** |
| Daten & Zufall | 4/5 | 4/5 | 3/5 | 2/5 | 3/5 | **3.2** |
| Muster | 3/5 | 3/5 | 2/5 | 1/5 | 1/5 | **2.0** |
| Algorithmen | 5/5 | 3/5 | 2/5 | 2/5 | 2/5 | **2.8** |
| Körper & Netze | 5/5 | 4/5 | 4/5 | 4/5 | 4/5 | **4.2** |
| Größen & Messen | 4/5 | 3/5 | 2/5 | 1/5 | 2/5 | **2.4** |
| **Durchschnitt** | **4.5** | **3.6** | **2.6** | **2.4** | **2.3** | **3.1** |

**Fazit:** Mathematische Korrektheit ist hoch (4.5), aber Lernwirksamkeit (2.6) und Interaktivität (2.3) sind die kritischen Schwächen. Die App ist korrekt, aber nicht wirksam genug.

---

## Priorisierung der Verbesserungen

| Priorität | Maßnahme | Aufwand | Lerneffekt |
|---|---|---|---|
| 🔴 P1 | V1: Sprunganimation aktivieren (Addition/Subtraktion) | Klein | Sehr hoch |
| 🔴 P1 | V5: Gruppierungs-Animation (Einmaleins) | Mittel | Sehr hoch |
| 🔴 P1 | V6: Schnitt-Animation (Brüche) | Mittel | Sehr hoch |
| 🟡 P2 | V2: Aufgabenwechsel-Transition (alle Module) | Klein | Hoch |
| 🟡 P2 | V9: Übertrag-Animation (Algorithmen) | Mittel | Hoch |
| 🟡 P2 | V7: Spiegel-Animation (Symmetrie) | Mittel | Hoch |
| 🟡 P2 | V3: Faltungs-Zwischenzustände (Netze) | Klein | Mittel |
| 🟢 P3 | V4: Smooth-Zeiger (Zeit) | Klein | Mittel |
| 🟢 P3 | V8: Achsen-Gleiten (Koordinaten) | Klein | Mittel |
| 🟢 P3 | V10: Sequenz-Aufbau (Muster) | Mittel | Mittel |
| 🔵 P4 | V11: Frosch-Drag (Addition) | Groß | Sehr hoch |
| 🔵 P4 | V12: Sektoren-Tap (Brüche) | Groß | Sehr hoch |
| 🔵 P4 | V13: Lasso-Gruppierung (Einmaleins) | Groß | Sehr hoch |
