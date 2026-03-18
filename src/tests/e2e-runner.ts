/**
 * E2E Test Runner — Anleitung für Claude zur Ausführung via Preview-Tools.
 *
 * Dieses Modul wird NICHT im Browser ausgeführt — es dient als strukturierte
 * Referenz für Claude, um die Tests über die preview_* MCP-Tools auszuführen.
 *
 * ## Ausführungs-Protokoll für Claude:
 *
 * Für jeden Test in ALL_SUITES:
 *
 * 1. Lies test.steps sequentiell
 * 2. Führe jeden Step mit dem passenden preview_*-Tool aus:
 *
 *    | Step.action       | Preview-Tool                                           |
 *    |-------------------|--------------------------------------------------------|
 *    | "navigate"        | preview_eval(`location.hash='${step.target}'`)         |
 *    | "click"           | preview_click(selector=step.target)                    |
 *    | "eval"            | preview_eval(expression=step.target)                   |
 *    | "snapshot"        | preview_snapshot()                                     |
 *    | "screenshot"      | preview_screenshot()                                   |
 *    | "inspect"         | preview_inspect(selector=step.target, styles=step.styles)|
 *    | "console"         | preview_console_logs(level="error")                    |
 *    | "resize"          | preview_resize(width, height)                          |
 *    | "wait"            | preview_eval(`new Promise(r=>setTimeout(r,${ms}))`)    |
 *    | "dismiss-tutorial"| preview_eval(`(() => {                                 |
 *    |                   |   const b=[...document.querySelectorAll('button')]      |
 *    |                   |     .find(b=>b.textContent.includes("Los geht"));       |
 *    |                   |   if(b) b.click();                                      |
 *    |                   | })()`)                                                  |
 *
 * 3. Wenn step.expect vorhanden:
 *    - "contains":     Prüfe ob Ergebnis den String enthält
 *    - "not-contains": Prüfe ob Ergebnis den String NICHT enthält
 *    - "exists":       Prüfe ob Element im DOM existiert
 *    - "not-exists":   Prüfe ob Element NICHT existiert
 *    - "gte":          Prüfe ob numerischer Wert >= erwarteten Wert
 *    - "equals":       Prüfe ob Ergebnis exakt gleich ist
 *    - "truthy":       Prüfe ob Ergebnis truthy ist (nicht false/null/undefined/"")
 *
 * 4. Protokolliere: PASS ✅ oder FAIL ❌ + Fehlerbeschreibung
 *
 * 5. Bei FAIL: Screenshot machen für Dokumentation
 *
 * ## Ausgabe-Format:
 *
 * ```
 * === E2E Test Suite: Mathelabor ===
 *
 * Suite: Navigation
 *   ✅ 1.1 App lädt ohne Console-Errors
 *   ✅ 1.2 Topbar zeigt Mathewerkstatt
 *   ❌ 1.3 Home-Button navigiert → Expected "Startseite" but got "..."
 *   ...
 *
 * Suite: Steuerleiste
 *   ✅ 2.1 Steuerleiste zeigt alle Buttons
 *   ...
 *
 * === Zusammenfassung ===
 * Gesamt: 83 Tests
 * Bestanden: 81 ✅
 * Fehlgeschlagen: 2 ❌
 * Erfolgsrate: 97.6%
 * ```
 *
 * ## Aufruf:
 *
 * Der User sagt: "Führe die E2E-Tests aus"
 * Claude importiert ALL_SUITES aus e2e-suite.ts und arbeitet sie ab.
 */

export { ALL_SUITES, SUITE_NAMES } from "./e2e-suite";
export type { E2ETest, E2EStep, E2EExpectation, E2EResult } from "./e2e-suite";
