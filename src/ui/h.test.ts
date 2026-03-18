/**
 * Tests für h() — Minimaler Hyperscript-Helper.
 * Prüft Element-Erstellung, Props, Events, Children.
 */
import { describe, it, expect, vi } from "vitest";
import { h } from "./h";

describe("h() Hyperscript-Helper", () => {
  it("Erstellt korrekten Element-Typ (div → HTMLDivElement)", () => {
    const el = h("div");
    expect(el).toBeInstanceOf(HTMLDivElement);
    expect(el.tagName).toBe("DIV");
  });

  it("Erstellt button Element", () => {
    const el = h("button");
    expect(el).toBeInstanceOf(HTMLButtonElement);
    expect(el.tagName).toBe("BUTTON");
  });

  it("Setzt className über class-Prop", () => {
    const el = h("div", { class: "foo" });
    expect(el.className).toBe("foo");
  });

  it("Setzt id über props", () => {
    const el = h("div", { id: "bar" });
    expect(el.id).toBe("bar");
  });

  it("Setzt Style als Objekt", () => {
    const el = h("div", { style: { color: "red" } });
    expect(el.style.color).toBe("red");
  });

  it("Setzt data-Attribute", () => {
    const el = h("div", { data: { testid: "foo" } });
    expect(el.dataset.testid).toBe("foo");
  });

  it("Hängt Event-Listener an", () => {
    const handler = vi.fn();
    const el = h("button", { on: { click: handler } });
    el.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("Fügt String-Children als TextContent hinzu", () => {
    const el = h("span", null, "hello");
    expect(el.textContent).toBe("hello");
  });

  it("Fügt Number-Children hinzu", () => {
    const el = h("span", null, 42);
    expect(el.textContent).toBe("42");
  });

  it("Fügt Element-Children an", () => {
    const child = h("span");
    const el = h("div", null, child);
    expect(el.firstChild).toBe(child);
    expect(el.firstChild!.nodeName).toBe("SPAN");
  });

  it("Ignoriert null/undefined/false Children", () => {
    const el = h("div", null, null, false, undefined, "text");
    // Nur ein TextNode für "text"
    expect(el.childNodes).toHaveLength(1);
    expect(el.textContent).toBe("text");
  });

  it("Funktioniert ohne props (null)", () => {
    const el = h("div", null);
    expect(el).toBeInstanceOf(HTMLDivElement);
    expect(el.className).toBe("");
  });

  it("Funktioniert ohne children", () => {
    const el = h("div", { class: "empty" });
    expect(el.childNodes).toHaveLength(0);
    expect(el.className).toBe("empty");
  });

  it("Verschachtelte h()-Aufrufe erzeugen korrekte DOM-Struktur", () => {
    const ul = h("ul", null, h("li", null, "A"), h("li", null, "B"));
    expect(ul.tagName).toBe("UL");
    expect(ul.children).toHaveLength(2);
    expect(ul.children[0].tagName).toBe("LI");
    expect(ul.children[0].textContent).toBe("A");
    expect(ul.children[1].tagName).toBe("LI");
    expect(ul.children[1].textContent).toBe("B");
  });
});
