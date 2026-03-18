/**
 * Minimaler App-Event-Bus.
 * Ermöglicht lose Kopplung zwischen App-Shell und Modulen.
 * Kein globaler State – alles über typisierte Events.
 */

import type { AppEvent, AppEventType, AppEventListener } from "./types.js";

class EventBus {
  private listeners = new Map<AppEventType, Set<AppEventListener>>();

  on(type: AppEventType, listener: AppEventListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
    // Returns unsubscribe function
    return () => this.off(type, listener);
  }

  off(type: AppEventType, listener: AppEventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(event: AppEvent): void {
    this.listeners.get(event.type)?.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error(`[EventBus] Error in listener for "${event.type}":`, err);
      }
    });
  }
}

export const appEvents = new EventBus();
