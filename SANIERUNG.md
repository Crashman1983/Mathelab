# Mathelabor – Finaler Sanierungs-Bericht

Erstellt: 2026-03-16 | Scope: V2-Module, Klasse 3–4 Bayern

---

## PHASE 1 – Schonungslose Diagnose

### 1.1 Fachliche Qualität

| Modul | Problem | Schwere |
|---|---|---|
| **Zahlenlabor** (numbers) | `generatePlaceTask` geht bis `hundredThousands` (100.000er). Lehrplan Kl. 3-4 Bayern: bis 1.000.000, aber Lernprogression beginnt bei 1.000. Zu breiter Sprung ohne Bündelungsschritte. | ⚠️ mittel |
| **Einmaleins** (multiplication) | Division steckt als `mode: "divide"` im Multiplikationsmodul. Das verknüpft korrekt Multiplikation ↔ Division, aber fehlt eigenständige Darstellung der Division als Aufteilen UND Verteilen. | ⚠️ mittel |
| **Addition** | `initialState: () => ({ animProgress: 0 })` → alle Sprungbögen werden mit `segProgress = 0` gerendert = **unsichtbar**. Der Frosch sitzt bei `task.a` und die Bögen fehlen. Fachlich gesehen zeigt das Modul die Kernidee (Sprung) nicht. | 🔴 kritisch |
| **Algorithmen** | `onPointerDown` ruft `tapColumnCallback?.(ctx.state.focusCol)` → übergibt aktuelle Fokusspalte statt getippte Spalte. Spalten-Navigation ist komplett gebrochen. | 🔴 kritisch |
| **Geometrie** | Flächenberechnung (area mode) fordert Zählen, liefert aber keine interaktive Zähl-Hilfe. Kind muss im Kopf rechnen, nicht zählen. Kernhandlung fehlt. | 🔴 kritisch |
| **Alle Module** | Fehlende **Division als eigenes Konzept** (Aufteilen in gleiche Gruppen vs. Verteilen auf gleiche Gruppen). Division taucht nur als Multiplikations-Umkehrung auf. | 🔴 kritisch |

### 1.2 Didaktische Qualität

**Kernschwäche: Handlung vor Symbol fehlt**

Das Primat lautet: *Situation → Handlung → Veränderung → Erkenntnis → Symbol*. Die meisten Module zeigen sofort das Symbol.

| Modul | Diagnose |
|---|---|
| **Zahlenlabor** | Mode `place`: Kind tippt die *ganze Zahl* ein und sieht dann die Zerlegung. Das ist **Ergebnis vor Handlung**. Richtig wäre: Kind bündelt Einzel-Objekte zu Zehnern, Zehner zu Hundertern, erkennt dann die Stellen. |
| **Muster (Patterns)** | `machine` mode: rein abstrakte Tabelle `Eingang → Ausgang`. Kein konkreter Kontext. Was macht die Maschine? Bäckt Brötchen? Verdoppelt Früchte? |
| **Algorithmen** | Schriftliche Rechnung wird präsentiert als fertige Formel. Das `present`-Phase zeigt einfach das Layout. Richtig wäre: Lehrkraft baut die Stellenwerte Spalte für Spalte auf. |
| **Geometrie** | Area mode: `Fläche = ?` mit numerischer Eingabe. Fehlende Zwischenschritt: interaktive Kästchenzählung (Kind tippt Kästchen an um sie zu markieren). |
| **Zeit** | `timespan` mode: Nummernblock-Buttons rufen `onTap: () => {}` (leer!). Stunden/Minuten-Eingabe funktioniert strukturell nicht. |
| **Größen** | Money mode: gut. Units mode: Balkendiagramm zeigt `fillRatio = min(sourceValue / (factor * 5), 1)` – dieser Faktor 5 ist willkürlich, der Balken ist semantisch falsch. |

### 1.3 Visuelle Vermittlung

| Problem | Detail |
|---|---|
| **Kein Realwelt-Einbettung** bei Numbers | H/Z/E-Boxen sind abstrakt. Kein Bild von Nüssen, Beuteln, Kästen. |
| **Punktfeld** (Multiplication) | Richtige Idee, aber keine Kontextmarkierung (keine Zeilenfarben, kein Spaltencount-Overlay). |
| **Zahlenstrahlen** | Addition hat Frosch ✓, Subtraktion hat Taucher ✓, Multiplication `jumps` hat farbige Bögen aber **keine Figur** (kein Tier/Person als Ankerpunkt). |
| **Algorithmen** | Übertrag (Carry) wird angezeigt, aber kleiner Font und schwaches Highlighting. Übertrag ist der didaktische Kern – muss prominenter sein. |
| **Zeit Uhrzeiger** | `drawClock` zeigt beide Zeiger gleichwertig. Minutenzeiger sollte dicker/farbiger sein als Stundenzeiger für Erstlerner. |

### 1.4 Lernprogression

Die Registrierungs-Reihenfolge in `main.ts` wurde in Iteration 3 korrekt gesetzt. Innerhalb der Module fehlen jedoch interne Progressionsstufen:

- `difficulty` 1/2/3 ist vorhanden, aber die Differenzierung ist oft nur numerisch (größere Zahlen), nicht konzeptuell (neue Repräsentation, neues Modell)
- **Kein Übergang** von ikonisch (Bild) → ikonisch-symbolisch (Bild + Zahl) → symbolisch (Zahl allein) – das ist Bruner's EIS-Prinzip und fehlt komplett
- Addition `written` mode ist in den Types definiert aber hat keine Implementierung

### 1.5 Sprache

| Problem | Beispiel |
|---|---|
| Fachlich zu abstrakt | „Hundert-Tausender: 2" – sollte „2 Hunderttausender" heißen, aber nur bis `Tausender` für Kl. 3 |
| Instruktionen zu kurz | „Schau dir die Form genau an." – zu wenig Handlungsaufforderung |
| Fehlende Kontextgeschichten | Fast kein Modul hat eine Rahmengeschichte die mathematische Struktur trägt |
| Lob generisch | „Richtig!" / „Gut gezählt!" – fehlt Prozesslob (Strategie hervorheben) |

---

## PHASE 2 – Verbindliches Zielmodell

### Didaktische Leitlinien (bindend für alle Module)

1. **Situation → Handlung → Symbol** (kein Symbol vor Handlung)
2. **Konkret → Ikonisch → Symbolisch** (EIS-Prinzip nach Bruner)
3. **Realwelt-Metapher muss die Mathematik TRAGEN** (nicht nur dekorieren)
4. **Rechenweg vor Ergebnis**: Zwischenschritte immer sichtbar
5. **Mathematik als Veränderung**: Was verändert sich? Was bleibt gleich?

### Modul-Qualitätskriterien (alle müssen erfüllt sein)

- [ ] Mindestens 1 konkreter Sachkontext der die mathematische Struktur widerspiegelt
- [ ] `present`-Phase zeigt die mathematische Situation (nicht die Lösung)
- [ ] `interact`-Phase fordert aktive Handlung (Tippen, Malen, Ziehen – nicht nur Eintippen)
- [ ] Mind. 3 Hinweise: konzeptuell → strategisch → rechnerisch
- [ ] Fehler führt zu Visualisierung des korrekten Wegs (nicht nur „Falsch")
- [ ] Mindestens 2 `taskTypes` mit unterschiedlichen Repräsentationen

### Erlaubte Interaktionsmuster

| Muster | Wann | Beispiel |
|---|---|---|
| Tap-Auswahl | Mehrere Optionen, eindeutige Antwort | Winkeltyp bestimmen |
| Canvas-Malen | Räumliche Aufgaben | Symmetrie, Koordinaten |
| Numpad-Eingabe | Nummerische Antworten | Summe, Fläche |
| Drag | Zeiger, Objekte platzieren | Uhrzeiger, Zahlenstrahl |
| Segment-Tap | Objekte auswählen/markieren | Kästchen zählen, Münzen legen |

### Visualisierungsregeln

- Figuren (Frosch, Taucher) sind Anker für Bewegung/Veränderung
- Zahlenstrahl-Bögen zeigen Strategie (nicht nur Ergebnis)
- Bündelungs-Darstellungen: Objekte → Zehner-Stangen → Hunderter-Platten
- Farben immer aus `getPalette()` – Figuren dürfen eigene Farben haben

---

## PHASE 3 – Inhaltsarchitektur

### Modul-Gruppen und Vollständigkeit

| Gruppe | Ist-Zustand | Soll-Zustand | Gap |
|---|---|---|---|
| **Zahlverständnis** | Zahlenlabor (abstract), Muster | + Bündelungskontext, + Zahlenraum 1000 explizit | Sachkontext fehlt |
| **Addition** | ✅ Frosch, Zerlegung | + Schriftlich implementieren | Written mode leer |
| **Subtraktion** | ✅ Taucher, Zerlegung | + Schriftlich implementieren | Written mode leer |
| **Multiplikation** | ✅ Punktfeld, Sprünge, Division | + Kontext Eierkarton/Schokolade | Kontext schwach |
| **Division** | Als Umkehrung in Einmaleins | Eigenständige Aufteilen/Verteilen-Differenzierung | Konzept fehlt |
| **Brüche** | ✅ Pizza, Balken, Vergleich, Zahlenstrahl | Gut | – |
| **Größen** | ✅ Geld (gut), Einheiten (Balken falsch) | Einheiten-Balken fixen | Balken semantisch falsch |
| **Zeit** | ✅ Uhr, Zeitspanne, Kalender | Timespan numpad fix | Buttons ohne Handler |
| **Geometrie** | Formen, Winkel, Fläche | Fläche: interaktives Kästchen-Zählen | Kernhandlung fehlt |
| **Symmetrie** | ✅ Grid-Malen (exzellent) | – | – |
| **Netze** | ✅ 3D-Faltung | – | – |
| **Koordinaten** | ✅ | – | – |
| **Daten** | ✅ Rad + Würfel | + Balkendiagramm selbst zeichnen | Daten erheben fehlt |

---

## PHASE 4 – Szenenbibliothek (Auswahl, >40 Szenen)

### Zahlverständnis

1. **Nüsse bündeln (10er)** – Kontext: Eichhörnchen sammelt Nüsse. 10 Nüsse → 1 Beutel. Handlung: Kind tippt 10 Nüsse an, sie bündeln sich zu einem Beutel. Struktur: 1er → 10er-Bündelung.
2. **Beutel zu Kisten (100er)** – 10 Beutel → 1 Kiste. Handlung: Kiste füllt sich. Struktur: 10er → 100er.
3. **Kisten zu Lager (1000er)** – 10 Kisten → 1 Lager. Struktur: 100er → 1000er.
4. **Stellenwert ablesen** – Bild mit Kisten/Beuteln/Nüssen, Kind liest H/Z/E ab.
5. **Zahl zusammensetzen** – Vorgegebene H/Z/E, Kind baut Zahl aus Bausteinen.
6. **Zahlen vergleichen (Zahl ≤ 1000)** – Zwei Nuss-Vorräte, welcher ist größer?
7. **Zahlenstrahl: Wo ist diese Zahl?** – Frosch auf leerem Strahl, Kind platziert.
8. **Vorgänger/Nachfolger** – „Welche Zahl kommt vor/nach 347?"
9. **Runden (10er)** – Eichhörnchen rundet auf: 43 Nüsse → nächste 10er-Gruppe.
10. **Runden (100er)** – 347 → 300 oder 400?

### Addition

11. **Frosch-Sprung 1-stellig** – Frosch bei 5, springt 3 weiter. Kontext: Seerosenteich.
12. **Frosch-Sprung über 10er** – Frosch bei 8, springt 5 (erst +2 auf 10, dann +3). Zerlegung sichtbar.
13. **Frosch-Sprung 2-stellig** – Frosch bei 35, springt 27 (Zerlegung in Zehner+Einer).
14. **Frosch-Sprung 3-stellig** – Frosch bei 234, springt 156.
15. **Schriftliche Addition** – Spalten von rechts nach links aufbauen, Übertrag erscheint als kleiner Frosch.
16. **Tauschgesetz visuell** – 3+5 Punktfeld umdrehen → 5+3. Gleich viel!
17. **Rechenbaum Addition** – Baum mit zwei Blättern und einer Wurzel. Wert der Wurzel?

### Subtraktion

18. **Taucher rückwärts** – Taucher bei 18, schwimmt 6 zurück. Kontext: Aquarium.
19. **Taucher über 10er** – 23-8: erst auf 20 (−3), dann −5.
20. **Ergänzen** – Wie viele Schritte von 27 bis 40? Taucher läuft vorwärts (Ergänzungsmethode).
21. **Schriftliche Subtraktion mit Entbündelung** – Zehner auflösen, sichtbar animiert.

### Multiplikation

22. **Eierkarton** – 3 Reihen × 4 Eier. Kind tippt Reihe an, Eier werden gezählt.
23. **Schokolade brechen** – 4×6 Tafel. Kind bricht Stücke ab und zählt.
24. **Springer auf dem Zahlenstrahl** – Figur macht 6 Sprünge à 4.
25. **Malkreuz** – Visuelles Rechteck, Kind trägt fehlende Dimension ein.
26. **Tauschgesetz × visuell** – 3×4 Punktfeld drehen → 4×3.
27. **Punktfeld: Wie viele?** – Kind zählt Punkte einer Gruppe, multipliziert.

### Division

28. **Äpfel verteilen** – 12 Äpfel auf 4 Kinder. Kind zieht Äpfel in Gruppen.
29. **Aufteilen in gleiche Gruppen** – 15 Bonbons, Gruppen à 5. Wie viele Gruppen?
30. **Division als Umkehrung** – Eierkarton: 12 Eier, 3 Reihen → wie viele pro Reihe?
31. **Rest bei Division** – 14 ÷ 4 = 3 Rest 2. Visuell: 3 volle Gruppen + 2 übrig.
32. **Teilen im Zahlenraum 1000** – Schriftliche Division vorbereiten.

### Brüche

33. **Pizza teilen** – ✅ bereits implementiert. Verbessern: interaktives Anklicken der Stücke.
34. **Wassermelone in Streifen** – Balken-Darstellung mit Früchte-Kontext.
35. **Zwei Pizzen vergleichen** – ✅ bereits implementiert.
36. **Brüche am Zahlenstrahl** – ✅ bereits implementiert.
37. **Äquivalente Brüche** – ½ = 2/4 = 3/6. Pizza zeigt dasselbe.
38. **Brüche zu ganzen Zahlen** – 4/4 = 1. Volle Pizza.

### Größen

39. **Münzen legen** – ✅ bereits implementiert (gut).
40. **Länge mit Lineal** – Linie messen, Einheit ablesen.
41. **Gewicht: Waage** – Zwei Seiten einer Balkenwaage, Gleichgewicht herstellen.
42. **Einheiten: Liter/Milliliter** – Messglas animiert sich füllen.
43. **Einheiten: km/m/cm** – Bardarstellung mit korrekter Ratio.

### Zeit

44. **Uhr ablesen** – ✅ Zeiger-Drag implementiert.
45. **Uhr stellen** – ✅ implementiert.
46. **Zeitspanne** – ✅ aber numpad-Buttons broken (onTap leer).
47. **Kalender** – ✅ implementiert.
48. **Zeitstrahl: Jahreszeiten** – Wo im Jahr befinden wir uns?

### Geometrie

49. **Formen klassifizieren** – ✅ implementiert.
50. **Winkel messen** – ✅ implementiert.
51. **Fläche: Kästchen zählen (interaktiv)** – Kind tappt Kästchen zum Zählen.
52. **Umfang berechnen** – Seiten einer Form abgehen, Längen addieren.
53. **Spiegeln am Raster** – ✅ Symmetrie-Modul exzellent.
54. **Körper erkennen** – 3D-Körper benennen (Würfel, Quader, Kugel).
55. **Netz entfalten** – ✅ Netze-Modul exzellent.

### Daten & Zufall

56. **Würfelwurf** – ✅ implementiert.
57. **Glücksrad** – ✅ implementiert.
58. **Balkendiagramm zeichnen** – Kind malt Balken selbst ein.
59. **Häufigkeiten ablesen** – Tabelle → Frage beantworten.
60. **Wahrscheinlichkeit schätzen** – „Welches Ergebnis kommt häufiger?"

---

## PHASE 5 – Produkt-Sanierungsplan

### Sofort entfernen / deaktivieren

| Was | Warum |
|---|---|
| `addition/v2.ts` `initialState animProgress: 0` | Bögen unsichtbar – zeigt nichts |
| `algorithms/v2.ts` `onPointerDown: tapColumnCallback?.(ctx.state.focusCol)` | Nimmt aktuelle Spalte statt getippte → Navigation gebrochen |
| `measures/v2.ts` Units-Balken `fillRatio = min(source/(factor*5), 1)` | Faktor 5 willkürlich, visuell falsch |
| `time/v2.ts` timespan numpad `onTap: () => {}` | Buttons ohne Funktion |

### Überarbeiten

| Was | Maßnahme |
|---|---|
| `numbers/v2.ts` place mode | Nüsse/Beutel/Kiste Sachkontext hinzufügen |
| `multiplication/v2.ts` divide mode | Eierkarton-Kontext, interaktive Gruppen-Aufteilung |
| `patterns/v2.ts` machine mode | Backmaschine/Obstkorb Kontext |
| `geometry/v2.ts` area mode | Kästchen-Tap-Interaktion |
| `algorithms/v2.ts` | Spalten-Tap reparieren |
| `time/v2.ts` timespan | Numpad reparieren |

### Neu entwickeln

| Was | Warum |
|---|---|
| Division als Sachkontext (Szenen 28–31) | Konzept fehlt als eigenständige Darstellung |
| Addition/Subtraktion written mode | In types definiert, nicht implementiert |
| Daten: Balkendiagramm zeichnen | Aktive Datenerzeugung fehlt |

### Beibehalten (gut genug)

- `fractions/v2.ts` – Pizza, Balken, Vergleich, Zahlenstrahl ✓
- `symmetry/v2.ts` – Grid-Painting exzellent ✓
- `netze/v2.ts` – 3D-Faltung exzellent ✓
- `coordinates/v2.ts` – Koordinatensystem vollständig ✓
- `chance/v2.ts` – Würfel + Rad mit Statistik ✓
- `measures/v2.ts` money mode – Münzen legen interaktiv ✓
- `time/v2.ts` read + calendar modes ✓

---

## Implementierungs-Prioritäten (diese Session)

1. 🔴 `addition/v2.ts` – `animProgress: 0` → `1` (1-Zeilen-Fix, alle Bögen sofort sichtbar)
2. 🔴 `algorithms/v2.ts` – Spalten-Tap reparieren (geometry tracking)
3. 🟡 `numbers/v2.ts` – Nüsse-Bündelung Sachkontext (place mode)
4. 🟡 `multiplication/v2.ts` – Eierkarton-Label für divide mode
5. 🟡 `time/v2.ts` – timespan numpad onTap handlers reparieren
6. 🟡 `measures/v2.ts` – Units-Balken fillRatio korrigieren
