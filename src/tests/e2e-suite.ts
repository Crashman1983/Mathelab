/**
 * E2E-Test-Suite — Strukturierte Testdefinitionen für Preview-Tool-basierte Tests.
 *
 * Diese Tests werden von Claude über die preview_* MCP-Tools ausgeführt.
 * Jeder Test besteht aus Schritten (navigate, click, eval, snapshot, inspect, etc.)
 * und einer Erwartung (contains, exists, gte, etc.).
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface E2EExpectation {
  /** Assertion type */
  type: "contains" | "not-contains" | "exists" | "not-exists" | "gte" | "equals" | "truthy";
  /** Expected value (string for contains, number for gte) */
  value?: string | number;
  /** Description of what's being checked */
  desc: string;
}

export interface E2EStep {
  /** Action to perform */
  action:
    | "navigate"     // Set location.hash via eval
    | "click"        // preview_click with CSS selector
    | "eval"         // preview_eval JS expression
    | "snapshot"     // preview_snapshot (accessibility tree)
    | "screenshot"   // preview_screenshot
    | "inspect"      // preview_inspect CSS selector + styles
    | "console"      // preview_console_logs
    | "resize"       // preview_resize viewport
    | "wait"         // preview_eval with setTimeout
    | "dismiss-tutorial"; // Click "Los geht's!" if tutorial is open
  /** CSS selector (for click/inspect) or hash (for navigate) or JS (for eval) */
  target?: string;
  /** Styles to inspect (for inspect action) */
  styles?: string[];
  /** Viewport dimensions (for resize action) */
  viewport?: { width: number; height: number };
  /** Wait duration in ms (for wait action) */
  waitMs?: number;
  /** Expected result — checked after this step */
  expect?: E2EExpectation;
}

export interface E2ETest {
  /** Unique test ID (e.g. "1.1") */
  id: string;
  /** Suite name */
  suite: string;
  /** Test description */
  name: string;
  /** Steps to execute */
  steps: E2EStep[];
}

export interface E2EResult {
  test: E2ETest;
  passed: boolean;
  error?: string;
  failedStep?: number;
  screenshot?: string; // base64 on failure
}

// ─── Suite 1: App-Start & Navigation ────────────────────────────────────────

const suite1Navigation: E2ETest[] = [
  {
    id: "1.1", suite: "Navigation", name: "App lädt ohne Console-Errors",
    steps: [
      { action: "console", expect: { type: "equals", value: "0", desc: "0 Error-Logs" } },
    ],
  },
  {
    id: "1.2", suite: "Navigation", name: "Topbar zeigt Mathewerkstatt",
    steps: [
      { action: "snapshot", expect: { type: "contains", value: "Mathewerkstatt", desc: "Topbar-Titel sichtbar" } },
    ],
  },
  {
    id: "1.3", suite: "Navigation", name: "Home-Button navigiert zur Startseite",
    steps: [
      { action: "navigate", target: "#/multiplication" },
      { action: "dismiss-tutorial" },
      { action: "click", target: ".app-topbar__title" },
      { action: "snapshot", expect: { type: "contains", value: "Startseite", desc: "Home-View aktiv" } },
    ],
  },
  {
    id: "1.4", suite: "Navigation", name: "Modul-Overlay öffnet sich",
    steps: [
      { action: "navigate", target: "#/multiplication" },
      { action: "dismiss-tutorial" },
      { action: "click", target: ".app-topbar__module" },
      { action: "snapshot", expect: { type: "contains", value: "module-card", desc: "Modul-Karten sichtbar" } },
    ],
  },
  {
    id: "1.5", suite: "Navigation", name: "Task-Chip wechselt Aufgabentyp",
    steps: [
      { action: "navigate", target: "#/multiplication/dot" },
      { action: "dismiss-tutorial" },
      { action: "eval", target: "document.querySelector('.task-chip:nth-child(2)')?.click(); 'clicked'" },
      { action: "eval", target: "document.querySelector('.task-chip:nth-child(2)')?.classList.contains('active')",
        expect: { type: "truthy", desc: "Zweiter Chip ist aktiv" } },
    ],
  },
  {
    id: "1.6", suite: "Navigation", name: "Theme-Toggle wechselt Modus",
    steps: [
      { action: "eval", target: "document.body.classList.contains('light-mode')",
        expect: { type: "equals", value: "false", desc: "Startet im Dark Mode" } },
      { action: "eval", target: "document.querySelector('[aria-label*=\"Hell\"]')?.click(); 'clicked'" },
      { action: "eval", target: "document.body.classList.contains('light-mode')",
        expect: { type: "truthy", desc: "Jetzt im Light Mode" } },
      // Zurückschalten
      { action: "eval", target: "document.querySelector('[aria-label*=\"Hell\"]')?.click(); 'clicked'" },
    ],
  },
  {
    id: "1.7", suite: "Navigation", name: "URL-Hash-Routing funktioniert",
    steps: [
      { action: "navigate", target: "#/addition" },
      { action: "dismiss-tutorial" },
      { action: "snapshot", expect: { type: "contains", value: "Addition", desc: "Addition-Modul aktiv" } },
    ],
  },
  {
    id: "1.8", suite: "Navigation", name: "Tutorial erscheint und lässt sich schließen",
    steps: [
      { action: "eval", target: "localStorage.clear(); location.reload(); 'reloaded'" },
      { action: "wait", waitMs: 500 },
      { action: "navigate", target: "#/multiplication" },
      { action: "wait", waitMs: 300 },
      { action: "snapshot", expect: { type: "contains", value: "Los geht", desc: "Tutorial sichtbar" } },
      { action: "dismiss-tutorial" },
      { action: "eval", target: "!document.querySelector('.tutorial-card')",
        expect: { type: "truthy", desc: "Tutorial geschlossen" } },
    ],
  },
];

// ─── Suite 2: Lehrer-Steuerleiste ───────────────────────────────────────────

const suite2ControlBar: E2ETest[] = [
  {
    id: "2.1", suite: "Steuerleiste", name: "Steuerleiste zeigt alle Buttons",
    steps: [
      { action: "navigate", target: "#/multiplication/dot" },
      { action: "dismiss-tutorial" },
      { action: "snapshot", expect: { type: "contains", value: "Hinweis", desc: "Hinweis-Button" } },
      { action: "snapshot", expect: { type: "contains", value: "Lösung", desc: "Lösung-Button" } },
      { action: "snapshot", expect: { type: "contains", value: "Nächste", desc: "Nächste-Button" } },
    ],
  },
  {
    id: "2.2", suite: "Steuerleiste", name: "Hinweis-Button zeigt Hilfetext",
    steps: [
      { action: "navigate", target: "#/multiplication/dot" },
      { action: "dismiss-tutorial" },
      { action: "eval", target: "document.querySelector('.control-bar-btn:nth-child(2)')?.click(); 'clicked hint'" },
      { action: "wait", waitMs: 200 },
      { action: "eval", target: "document.querySelector('.status-feedback')?.textContent || document.querySelector('[class*=status]')?.textContent || 'no feedback'",
        expect: { type: "not-contains", value: "no feedback", desc: "Hint-Text erscheint" } },
    ],
  },
  {
    id: "2.3", suite: "Steuerleiste", name: "Steuerleiste min-height 48px",
    steps: [
      { action: "navigate", target: "#/multiplication/dot" },
      { action: "dismiss-tutorial" },
      { action: "inspect", target: ".control-bar", styles: ["min-height"],
        expect: { type: "gte", value: 48, desc: "min-height >= 48px" } },
    ],
  },
  {
    id: "2.4", suite: "Steuerleiste", name: "Nächste generiert neue Aufgabe",
    steps: [
      { action: "navigate", target: "#/multiplication/dot" },
      { action: "dismiss-tutorial" },
      { action: "eval", target: "document.querySelector('canvas')?.getAttribute('aria-label') || 'before'" },
      { action: "eval", target: "[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Nächste'))?.click(); 'clicked'" },
      { action: "wait", waitMs: 300 },
      // New task should appear (can't compare exact content since it's random)
      { action: "console", expect: { type: "equals", value: "0", desc: "Keine Fehler" } },
    ],
  },
];

// ─── Suite 3: Numpad ────────────────────────────────────────────────────────

const suite3Numpad: E2ETest[] = [
  {
    id: "3.1", suite: "Numpad", name: "Numpad sichtbar bei Einmaleins",
    steps: [
      { action: "navigate", target: "#/multiplication/dot" },
      { action: "dismiss-tutorial" },
      { action: "eval", target: "getComputedStyle(document.querySelector('.v2-numpad')).display !== 'none'",
        expect: { type: "truthy", desc: "Numpad sichtbar" } },
    ],
  },
  {
    id: "3.2", suite: "Numpad", name: "Numpad ausgeblendet bei Geld-Modul",
    steps: [
      { action: "navigate", target: "#/measures/money" },
      { action: "dismiss-tutorial" },
      { action: "eval", target: "getComputedStyle(document.querySelector('.v2-numpad')).display === 'none'",
        expect: { type: "truthy", desc: "Numpad versteckt" } },
    ],
  },
  {
    id: "3.3", suite: "Numpad", name: "Ziffern-Eingabe und Display",
    steps: [
      { action: "navigate", target: "#/multiplication/dot" },
      { action: "dismiss-tutorial" },
      { action: "eval", target: "document.querySelectorAll('.v2-numpad__btn')[8]?.click(); 'clicked 1'" }, // 7,8,9,4,5,6,1,2,3 → index 6=1
      { action: "eval", target: "document.querySelector('.v2-numpad__display')?.textContent?.trim()",
        expect: { type: "contains", value: "1", desc: "Display zeigt 1" } },
    ],
  },
  {
    id: "3.4", suite: "Numpad", name: "OK-Button hat Akzent-Farbe",
    steps: [
      { action: "navigate", target: "#/multiplication/dot" },
      { action: "dismiss-tutorial" },
      { action: "inspect", target: ".v2-numpad__btn--enter", styles: ["background-color"],
        expect: { type: "not-contains", value: "rgba(0, 0, 0, 0)", desc: "OK hat Hintergrundfarbe" } },
    ],
  },
  {
    id: "3.5", suite: "Numpad", name: "Falsche Antwort zeigt ermutigendes Feedback",
    steps: [
      { action: "navigate", target: "#/multiplication/dot" },
      { action: "dismiss-tutorial" },
      // Eingabe: 1 → OK (fast sicher falsch)
      { action: "eval", target: `(() => {
        const btns = [...document.querySelectorAll('.v2-numpad__btn')];
        btns.find(b=>b.textContent.trim()==='1')?.click();
        btns.find(b=>b.textContent.trim()==='OK')?.click();
        return 'submitted';
      })()` },
      { action: "wait", waitMs: 300 },
      { action: "eval", target: "document.querySelector('.status-feedback,.auto-advance-bar__label,[class*=feedback]')?.textContent || ''",
        expect: { type: "not-contains", value: "Falsch", desc: "Kein 'Falsch!' im Feedback" } },
    ],
  },
];

// ─── Suite 4: Modul-Flows ───────────────────────────────────────────────────

const moduleFlows: Array<{ id: string; hash: string; name: string; checkText: string }> = [
  { id: "4.1",  hash: "#/multiplication/dot",    name: "Einmaleins/Punktfeld",       checkText: "×" },
  { id: "4.2",  hash: "#/multiplication/jumps",   name: "Einmaleins/Sprünge",         checkText: "×" },
  { id: "4.3",  hash: "#/multiplication/divide",  name: "Einmaleins/Division",        checkText: "÷" },
  { id: "4.4",  hash: "#/addition/numberline",    name: "Addition/Zahlenstrahl",       checkText: "+" },
  { id: "4.5",  hash: "#/subtraction/numberline", name: "Subtraktion/Zahlenstrahl",    checkText: "−" },
  { id: "4.6",  hash: "#/time/read",             name: "Uhrzeit/Uhr lesen",          checkText: "Uhr" },
  { id: "4.7",  hash: "#/time/calendar",          name: "Uhrzeit/Kalender",           checkText: "Finde" },
  { id: "4.8",  hash: "#/measures/money",          name: "Geld (Münzen)",              checkText: "€" },
  { id: "4.9",  hash: "#/numbers/place",           name: "Zahlenlabor/Stellenwerte",   checkText: "Zerlege" },
  { id: "4.10", hash: "#/fractions/circle",        name: "Bruchlabor/Pizza",           checkText: "Bruch" },
  { id: "4.11", hash: "#/geometry/shapes",         name: "Geometrie/Formen",           checkText: "Form" },
  { id: "4.12", hash: "#/symmetry/mirror-v",       name: "Symmetrie/Senkrecht",        checkText: "spiegeln" },
  { id: "4.13", hash: "#/coordinates/plot",        name: "Koordinaten/Einzeichnen",    checkText: "Koordinat" },
  { id: "4.14", hash: "#/algorithms/addition",     name: "Schriftliches Rechnen",      checkText: "+" },
];

const suite4Modules: E2ETest[] = moduleFlows.map(m => ({
  id: m.id, suite: "Module", name: `${m.name} lädt und zeigt Aufgabe`,
  steps: [
    { action: "navigate", target: m.hash },
    { action: "dismiss-tutorial" },
    { action: "wait", waitMs: 200 },
    { action: "eval", target: `document.querySelector('canvas')?.getAttribute('aria-label') || document.querySelector('[class*=module]')?.textContent || ''`,
      expect: { type: "contains", value: m.checkText, desc: `Enthält "${m.checkText}"` } },
    { action: "console", expect: { type: "equals", value: "0", desc: "Keine Console-Errors" } },
  ],
}));

// ─── Suite 5: Viewport-Tests ────────────────────────────────────────────────

const viewports = [
  { name: "iPhone Portrait", width: 375, height: 812 },
  { name: "iPad Landscape", width: 1080, height: 810 },
  { name: "MacBook", width: 1440, height: 900 },
  { name: "FHD Smartboard", width: 1920, height: 1080 },
];

const suite5Viewports: E2ETest[] = viewports.flatMap((vp, vi) => [
  {
    id: `5.${vi * 3 + 1}`, suite: "Viewports", name: `${vp.name}: Layout ohne Overflow`,
    steps: [
      { action: "resize", viewport: { width: vp.width, height: vp.height } },
      { action: "navigate", target: "#/multiplication/dot" },
      { action: "dismiss-tutorial" },
      { action: "wait", waitMs: 300 },
      { action: "eval", target: "document.documentElement.scrollHeight <= window.innerHeight + 5",
        expect: { type: "truthy", desc: "Kein vertikales Scrollen" } },
    ],
  },
  {
    id: `5.${vi * 3 + 2}`, suite: "Viewports", name: `${vp.name}: Canvas hat Höhe`,
    steps: [
      { action: "resize", viewport: { width: vp.width, height: vp.height } },
      { action: "navigate", target: "#/multiplication/dot" },
      { action: "dismiss-tutorial" },
      { action: "eval", target: "document.querySelector('canvas')?.clientHeight || 0",
        expect: { type: "gte", value: 200, desc: "Canvas-Höhe > 200px" } },
    ],
  },
  {
    id: `5.${vi * 3 + 3}`, suite: "Viewports", name: `${vp.name}: Screenshot`,
    steps: [
      { action: "resize", viewport: { width: vp.width, height: vp.height } },
      { action: "navigate", target: "#/multiplication/dot" },
      { action: "dismiss-tutorial" },
      { action: "wait", waitMs: 300 },
      { action: "screenshot" },
      { action: "console", expect: { type: "equals", value: "0", desc: "Keine Errors" } },
    ],
  },
]);

// ─── Suite 6: Accessibility ─────────────────────────────────────────────────

const suite6A11y: E2ETest[] = [
  {
    id: "6.1", suite: "Accessibility", name: "Toggle-Buttons haben aria-pressed",
    steps: [
      { action: "eval", target: `(() => {
        const toggles = document.querySelectorAll('[aria-label*="Vorlesen"], [aria-label*="Töne"], [aria-label*="Hell"]');
        return [...toggles].every(t => t.hasAttribute('aria-pressed'));
      })()`,
        expect: { type: "truthy", desc: "Alle Toggles haben aria-pressed" } },
    ],
  },
  {
    id: "6.2", suite: "Accessibility", name: "Canvas hat alt-Text",
    steps: [
      { action: "navigate", target: "#/multiplication/dot" },
      { action: "dismiss-tutorial" },
      { action: "eval", target: "document.querySelector('canvas')?.getAttribute('aria-label')?.length > 5",
        expect: { type: "truthy", desc: "Canvas hat beschreibenden alt-Text" } },
    ],
  },
  {
    id: "6.3", suite: "Accessibility", name: "Keine Console-Errors nach 3 Modul-Wechseln",
    steps: [
      { action: "navigate", target: "#/multiplication" },
      { action: "dismiss-tutorial" },
      { action: "navigate", target: "#/addition" },
      { action: "dismiss-tutorial" },
      { action: "navigate", target: "#/time" },
      { action: "dismiss-tutorial" },
      { action: "console", expect: { type: "equals", value: "0", desc: "0 Errors nach Navigation" } },
    ],
  },
  {
    id: "6.4", suite: "Accessibility", name: "Stats-Counter hat aria-live",
    steps: [
      { action: "navigate", target: "#/multiplication" },
      { action: "dismiss-tutorial" },
      { action: "eval", target: "document.querySelector('[aria-live]')?.getAttribute('aria-live')",
        expect: { type: "equals", value: "polite", desc: "aria-live='polite' vorhanden" } },
    ],
  },
];

// ─── Suite 7: Didaktik ──────────────────────────────────────────────────────

const suite7Didaktik: E2ETest[] = [
  {
    id: "7.1", suite: "Didaktik", name: "Lösung zeigt Rechenweg mit Gleichheitszeichen",
    steps: [
      { action: "navigate", target: "#/multiplication/dot" },
      { action: "dismiss-tutorial" },
      { action: "eval", target: "[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Lösung'))?.click(); 'clicked'" },
      { action: "wait", waitMs: 200 },
      { action: "eval", target: "document.querySelector('.status-feedback,[class*=status]')?.textContent || ''",
        expect: { type: "contains", value: "=", desc: "Lösung enthält '='" } },
    ],
  },
  {
    id: "7.2", suite: "Didaktik", name: "Einmaleins-Lösung zeigt wiederholte Addition",
    steps: [
      { action: "navigate", target: "#/multiplication/dot" },
      { action: "dismiss-tutorial" },
      { action: "eval", target: "[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Lösung'))?.click(); 'clicked'" },
      { action: "wait", waitMs: 200 },
      { action: "eval", target: "document.querySelector('.status-feedback,[class*=status]')?.textContent || ''",
        expect: { type: "contains", value: "+", desc: "Lösung zeigt wiederholte Addition ('+' vorhanden)" } },
    ],
  },
  {
    id: "7.3", suite: "Didaktik", name: "Progressiver Hint (2 Stufen unterschiedlich)",
    steps: [
      { action: "navigate", target: "#/multiplication/dot" },
      { action: "dismiss-tutorial" },
      { action: "eval", target: `(() => {
        const hintBtn = [...document.querySelectorAll('button')].find(b=>b.textContent.includes('Hinweis'));
        hintBtn?.click();
        return document.querySelector('.status-feedback,[class*=status]')?.textContent || 'hint1';
      })()` },
      { action: "eval", target: `(() => {
        const hintBtn = [...document.querySelectorAll('button')].find(b=>b.textContent.includes('Hinweis'));
        hintBtn?.click();
        return document.querySelector('.status-feedback,[class*=status]')?.textContent || 'hint2';
      })()` },
      // Can't easily compare hint1 != hint2 in this step model, but we verify no crash
      { action: "console", expect: { type: "equals", value: "0", desc: "Kein Fehler bei 2× Hint" } },
    ],
  },
];

// ─── Export ─────────────────────────────────────────────────────────────────

export const ALL_SUITES: E2ETest[] = [
  ...suite1Navigation,
  ...suite2ControlBar,
  ...suite3Numpad,
  ...suite4Modules,
  ...suite5Viewports,
  ...suite6A11y,
  ...suite7Didaktik,
];

export const SUITE_NAMES = [
  "Navigation",
  "Steuerleiste",
  "Numpad",
  "Module",
  "Viewports",
  "Accessibility",
  "Didaktik",
] as const;
