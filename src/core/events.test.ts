/**
 * Tests für den App-Event-Bus (src/core/events.ts).
 */
import { describe, it, expect, vi } from "vitest";
import { appEvents } from "./events";
import type { AppEvent } from "./types";

describe("EventBus", () => {
  it("on registriert Listener und emit ruft ihn auf", () => {
    const listener = vi.fn();
    appEvents.on("module:activated", listener);
    const event: AppEvent = { type: "module:activated", payload: "test" };
    appEvents.emit(event);
    expect(listener).toHaveBeenCalledWith(event);
    appEvents.off("module:activated", listener);
  });

  it("emit ruft keine Listener für andere Event-Typen auf", () => {
    const listener = vi.fn();
    appEvents.on("module:activated", listener);
    appEvents.emit({ type: "module:deactivated" } as AppEvent);
    expect(listener).not.toHaveBeenCalled();
    appEvents.off("module:activated", listener);
  });

  it("on gibt unsubscribe-Funktion zurück", () => {
    const listener = vi.fn();
    const unsub = appEvents.on("module:activated", listener);
    unsub();
    appEvents.emit({ type: "module:activated", payload: "test" } as AppEvent);
    expect(listener).not.toHaveBeenCalled();
  });

  it("off entfernt spezifischen Listener", () => {
    const listener = vi.fn();
    appEvents.on("module:activated", listener);
    appEvents.off("module:activated", listener);
    appEvents.emit({ type: "module:activated", payload: "test" } as AppEvent);
    expect(listener).not.toHaveBeenCalled();
  });

  it("mehrere Listener für gleichen Typ werden alle aufgerufen", () => {
    const l1 = vi.fn();
    const l2 = vi.fn();
    const unsub1 = appEvents.on("module:activated", l1);
    const unsub2 = appEvents.on("module:activated", l2);
    appEvents.emit({ type: "module:activated", payload: "test" } as AppEvent);
    expect(l1).toHaveBeenCalledTimes(1);
    expect(l2).toHaveBeenCalledTimes(1);
    unsub1();
    unsub2();
  });

  it("Listener-Fehler wird gefangen und beeinträchtigt andere Listener nicht", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const throwingListener = () => { throw new Error("test"); };
    const normalListener = vi.fn();
    const unsub1 = appEvents.on("module:activated", throwingListener);
    const unsub2 = appEvents.on("module:activated", normalListener);
    appEvents.emit({ type: "module:activated", payload: "test" } as AppEvent);
    expect(normalListener).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalled();
    unsub1();
    unsub2();
    errSpy.mockRestore();
  });

  it("emit ohne registrierte Listener wirft keinen Fehler", () => {
    expect(() => {
      appEvents.emit({ type: "theme:changed" } as AppEvent);
    }).not.toThrow();
  });

  it("doppeltes off wirft keinen Fehler", () => {
    const listener = vi.fn();
    appEvents.on("module:activated", listener);
    appEvents.off("module:activated", listener);
    expect(() => {
      appEvents.off("module:activated", listener);
    }).not.toThrow();
  });
});
