/**
 * Module Lifecycle Integration Tests.
 *
 * Tests multi-cycle state transitions that unit tests miss:
 * - presentationMode: Start → Solve → Nächste → still interactive (no deadlock)
 * - Numpad→onKeyDown delegation for modules with custom key handling
 * - Hint progression across multiple wrong attempts
 * - Hint index resets on new task
 *
 * Uses defineModule() with a minimal test module.
 * Tests via DOM interaction (button clicks, status-box reads) — no __moduleTestAPI
 * dependency since that requires activate() which needs a real Canvas.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { defineModule } from "./module-framework";
import type { ModuleDefinition } from "./module-framework";
import { text } from "@canvas/nodes/text";

// ─── Minimal Test Module Definition ──────────────────────────────────────────

interface TestTask {
  question: string;
  answer: number;
  type: string;
}

function createTestModuleDef(
  overrides: Partial<ModuleDefinition<TestTask, Record<string, never>>> = {},
): ModuleDefinition<TestTask, Record<string, never>> {
  return {
    id: "lifecycle-test",
    label: "Lifecycle Test",
    icon: "🧪",
    description: "Test module",
    flowType: "task",
    input: "numberPad",
    taskTypes: [
      { id: "basic", label: "Basic", icon: "📝" },
    ],
    generate: () => ({ question: "1+1", answer: 2, type: "basic" }),
    check: (_task, answer) => ({
      correct: answer === 2,
      feedback: answer === 2 ? "Richtig!" : "Probier nochmal!",
    }),
    hints: () => ["Hint 1: Denke nach", "Hint 2: Fast da", "Hint 3: Schau genau", "Hint 4: Lösung nahe"],
    getSolution: () => ({ text: "Die Antwort ist 2." }),
    buildScene: () => text("Test"),
    initialState: () => ({}),
    ...overrides,
  };
}

// ─── DOM Helpers ─────────────────────────────────────────────────────────────

function createContainer(): HTMLElement {
  const el = document.createElement("section");
  el.id = "view-lifecycle-test";
  document.body.appendChild(el);
  if (!document.getElementById("topbar-chips")) {
    const chips = document.createElement("div");
    chips.id = "topbar-chips";
    chips.setAttribute("hidden", "");
    document.body.appendChild(chips);
  }
  return el;
}

function clickButton(container: HTMLElement, label: string): boolean {
  for (const b of container.querySelectorAll("button")) {
    if (b.textContent?.includes(label)) {
      (b as HTMLButtonElement).click();
      return true;
    }
  }
  return false;
}

function getStatusText(container: HTMLElement): string {
  for (const sb of container.querySelectorAll(".status-box")) {
    if (sb.textContent) return sb.textContent;
  }
  return "";
}

function typeAndSubmit(container: HTMLElement, digits: string): void {
  for (const d of digits.split("")) {
    clickButton(container, d);
  }
  clickButton(container, "OK");
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Module Lifecycle — Numpad→onKeyDown delegation", () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    container = createContainer();
  });

  it("numpad click calls onKeyDown when module defines it", () => {
    const onKeyDownSpy = vi.fn(() => true);
    const def = createTestModuleDef({ onKeyDown: onKeyDownSpy });
    const reg = defineModule(def);
    const module = reg.factory();
    module.mount(container);

    // Find and click numpad "5"
    const numpadBtns = container.querySelectorAll(".v2-numpad__btn");
    let clicked = false;
    for (const b of numpadBtns) {
      if (b.textContent?.trim() === "5" && b.getAttribute("data-digit") === "5") {
        (b as HTMLButtonElement).click();
        clicked = true;
        break;
      }
    }

    expect(clicked).toBe(true);
    expect(onKeyDownSpy).toHaveBeenCalledWith("5", expect.anything());
  });

  it("numpad click uses normal handler when onKeyDown returns false", () => {
    const onKeyDownSpy = vi.fn(() => false);
    const def = createTestModuleDef({ onKeyDown: onKeyDownSpy });
    const reg = defineModule(def);
    const module = reg.factory();
    module.mount(container);

    // Click "5"
    for (const b of container.querySelectorAll("[data-digit='5']")) {
      (b as HTMLButtonElement).click();
      break;
    }

    expect(onKeyDownSpy).toHaveBeenCalled();
    // Normal handler: display shows "5"
    const display = container.querySelector(".v2-numpad__display");
    expect(display?.textContent).toBe("5");
  });

  it("numpad click uses normal handler when no onKeyDown defined", () => {
    const def = createTestModuleDef(); // no onKeyDown
    const reg = defineModule(def);
    const module = reg.factory();
    module.mount(container);

    for (const b of container.querySelectorAll("[data-digit='3']")) {
      (b as HTMLButtonElement).click();
      break;
    }

    const display = container.querySelector(".v2-numpad__display");
    expect(display?.textContent).toBe("3");
  });
});

describe("Module Lifecycle — Hint progression", () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    container = createContainer();
  });

  it("hints advance through all 4 levels on repeated clicks", () => {
    const def = createTestModuleDef();
    const reg = defineModule(def);
    const module = reg.factory();
    module.mount(container);

    const hints = ["Hint 1: Denke nach", "Hint 2: Fast da", "Hint 3: Schau genau", "Hint 4: Lösung nahe"];

    for (let i = 0; i < 4; i++) {
      clickButton(container, "Hinweis");
      const statusText = getStatusText(container);
      expect(statusText).toContain(hints[i]);
    }
  });

  it("hint index resets on new task (→ Nächste)", () => {
    const def = createTestModuleDef();
    const reg = defineModule(def);
    const module = reg.factory();
    module.mount(container);

    // Use 2 hints
    clickButton(container, "Hinweis");
    clickButton(container, "Hinweis");
    expect(getStatusText(container)).toContain("Hint 2");

    // Click Nächste
    clickButton(container, "Nächste");

    // Click Hinweis — should show Hint 1 again (reset)
    clickButton(container, "Hinweis");
    expect(getStatusText(container)).toContain("Hint 1");
  });
});

describe("Module Lifecycle — Correct/Wrong feedback", () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    container = createContainer();
  });

  it("correct answer shows positive feedback", () => {
    const def = createTestModuleDef();
    const reg = defineModule(def);
    const module = reg.factory();
    module.mount(container);

    typeAndSubmit(container, "2");
    expect(getStatusText(container)).toContain("Richtig!");
  });

  it("wrong answer shows encouraging feedback", () => {
    const def = createTestModuleDef();
    const reg = defineModule(def);
    const module = reg.factory();
    module.mount(container);

    typeAndSubmit(container, "9");
    expect(getStatusText(container)).toContain("Probier nochmal!");
  });

  it("session counter updates after correct and wrong answers", () => {
    const def = createTestModuleDef();
    const reg = defineModule(def);
    const module = reg.factory();
    module.mount(container);

    // 1 correct
    typeAndSubmit(container, "2");
    clickButton(container, "Nächste");

    // 1 wrong
    typeAndSubmit(container, "9");
    clickButton(container, "Nächste");

    // 1 correct
    typeAndSubmit(container, "2");

    // Counter should show "2/3 ✅"
    const counter = container.querySelector(".control-bar__center span");
    expect(counter?.textContent).toContain("2/3");
  });
});

describe("Module Lifecycle — Solution display", () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    container = createContainer();
  });

  it("Lösung button shows solution text", () => {
    const def = createTestModuleDef();
    const reg = defineModule(def);
    const module = reg.factory();
    module.mount(container);

    clickButton(container, "Lösung");
    expect(getStatusText(container)).toContain("Die Antwort ist 2");
  });
});

describe("Module Lifecycle — no presentationMode (KISS)", () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    container = createContainer();
  });

  it("no Starten overlay exists after mount", () => {
    const def = createTestModuleDef();
    const reg = defineModule(def);
    const module = reg.factory();
    module.mount(container);

    const overlay = container.querySelector(".start-overlay");
    expect(overlay).toBeNull();
  });

  it("module is directly interactive — no Starten gate", () => {
    const def = createTestModuleDef();
    const reg = defineModule(def);
    const module = reg.factory();
    module.mount(container);

    typeAndSubmit(container, "2");
    expect(getStatusText(container)).toContain("Richtig!");
  });

  it("Nächste keeps module interactive through multiple cycles", () => {
    const def = createTestModuleDef();
    const reg = defineModule(def);
    const module = reg.factory();
    module.mount(container);

    for (let cycle = 0; cycle < 3; cycle++) {
      typeAndSubmit(container, "2");
      expect(getStatusText(container)).toContain("Richtig!");
      clickButton(container, "Nächste");
    }

    // Still works after 3 cycles
    typeAndSubmit(container, "9");
    expect(getStatusText(container)).toContain("Probier nochmal!");
  });
});

describe("Module Lifecycle — Tutorial on chip switch", () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    container = createContainer();
  });

  it("tutorial dialog appears when switching task type via chip", () => {
    const def = createTestModuleDef({
      tutorial: (taskType: string) => [{ title: `Tutorial ${taskType}`, text: `Erklärung für ${taskType}` }],
      taskTypes: [
        { id: "basic", label: "Basic", icon: "📝" },
        { id: "advanced", label: "Advanced", icon: "🚀" },
      ],
    });
    const reg = defineModule(def);
    const module = reg.factory();
    module.mount(container);

    // Click "Advanced" chip (in topbar-chips, not in container)
    const chipsEl = document.getElementById("topbar-chips")!;
    clickButton(chipsEl, "Advanced");

    // Tutorial dialog should appear for the new task type
    const tutorial = container.querySelector('[role="dialog"]');
    expect(tutorial).not.toBeNull();
    expect(tutorial?.textContent).toContain("Tutorial");
  });

  it("tutorial dialog can be closed and module is interactive", () => {
    const def = createTestModuleDef({
      tutorial: () => [{ title: "So geht's", text: "Erklärung" }],
      taskTypes: [
        { id: "basic", label: "Basic", icon: "📝" },
        { id: "advanced", label: "Advanced", icon: "🚀" },
      ],
    });
    const reg = defineModule(def);
    const module = reg.factory();
    module.mount(container);

    // Switch task type → tutorial appears
    clickButton(document.getElementById("topbar-chips")!, "Advanced");
    clickButton(container, "Los geht's!");

    // Should be interactive after tutorial close
    typeAndSubmit(container, "2");
    expect(getStatusText(container)).toContain("Richtig!");
  });

  it("module without tutorial stays interactive on chip switch", () => {
    const def = createTestModuleDef({
      tutorial: undefined,
      taskTypes: [
        { id: "basic", label: "Basic", icon: "📝" },
        { id: "advanced", label: "Advanced", icon: "🚀" },
      ],
    });
    const reg = defineModule(def);
    const module = reg.factory();
    module.mount(container);

    // Switch task type — no tutorial
    clickButton(document.getElementById("topbar-chips")!, "Advanced");

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeNull();

    // Should accept input immediately
    typeAndSubmit(container, "2");
    expect(getStatusText(container)).toContain("Richtig!");
  });
});
