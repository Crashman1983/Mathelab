/**
 * AppStateManager — Typed, versioned wrapper around localStorage.
 *
 * Consolidates all persistent state into a single JSON blob with
 * typed accessors and migration support for schema changes.
 */

import { safeGetLocalStorage, safeSetLocalStorage } from "./utils";

// ─── Schema ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = "mathelabor_state";
const CURRENT_VERSION = 1;

export interface StateSchema {
  version: number;
  theme: "dark" | "light";
  difficulty: number;
  onboarding: Record<string, boolean>;
  /** Per module/taskType: tutorial dismissed by user ("module/taskType" → true) */
  tutorialDismissed?: Record<string, boolean>;
  /** Per-module/taskType stats: key = "moduleId" or "moduleId:taskType" */
  stats: Record<string, { attempts: number; correct: number }>;
  /** Challenge mode results history */
  challengeHistory?: Array<{
    date: string;
    mode: "sprint" | "rally";
    moduleId?: string;
    taskType?: string;
    timeLimit: number;
    correct: number;
    total: number;
    errors: number;
    elapsed: number;
  }>;
}

function defaultState(): StateSchema {
  return {
    version: CURRENT_VERSION,
    theme: "dark",
    difficulty: 2, // Default: Checker (3. Klasse)
    onboarding: {},
    stats: {},
  };
}

// ─── Migration from legacy keys ──────────────────────────────────────────────

function migrateLegacyKeys(): Partial<StateSchema> {
  const partial: Partial<StateSchema> = {};

  // Theme
  const theme = safeGetLocalStorage("mathelabor_theme");
  if (theme === "light" || theme === "dark") {
    partial.theme = theme;
  }

  // Difficulty
  const diff = safeGetLocalStorage("mathelabor-difficulty");
  if (diff) {
    const n = Number(diff);
    if (n >= 1 && n <= 3) partial.difficulty = n;
  }

  // Onboarding flags (mathelabor_onboarding_{moduleId})
  const onboarding: Record<string, boolean> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("mathelabor_onboarding_")) {
        const moduleId = key.replace("mathelabor_onboarding_", "");
        if (localStorage.getItem(key) === "done") {
          onboarding[moduleId] = true;
        }
      }
    }
  } catch { /* private mode */ }
  if (Object.keys(onboarding).length > 0) {
    partial.onboarding = onboarding;
  }

  return partial;
}

// ─── AppStateManager ─────────────────────────────────────────────────────────

class AppStateManager {
  private data: StateSchema;

  constructor() {
    this.data = this.load();
  }

  private load(): StateSchema {
    const raw = safeGetLocalStorage(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as StateSchema;
        if (parsed.version === CURRENT_VERSION) {
          return { ...defaultState(), ...parsed };
        }
        // Future: migration from older versions
      } catch { /* corrupt data */ }
    }

    // First run or corrupt — migrate from legacy keys
    const base = defaultState();
    const legacy = migrateLegacyKeys();
    const merged = { ...base, ...legacy, version: CURRENT_VERSION };
    this.persist(merged);
    return merged;
  }

  private persist(data?: StateSchema): void {
    const d = data ?? this.data;
    try {
      safeSetLocalStorage(STORAGE_KEY, JSON.stringify(d));
    } catch { /* quota exceeded */ }
  }

  // ── Typed Accessors ────────────────────────────────────────────────────────

  get<K extends keyof StateSchema>(key: K): StateSchema[K] {
    return this.data[key];
  }

  set<K extends keyof StateSchema>(key: K, value: StateSchema[K]): void {
    this.data[key] = value;
    this.persist();

    // Keep legacy keys in sync for backward compat during transition
    if (key === "theme") {
      safeSetLocalStorage("mathelabor_theme", value as string);
    } else if (key === "difficulty") {
      safeSetLocalStorage("mathelabor-difficulty", String(value));
    }
  }

  // ── Convenience: Onboarding ────────────────────────────────────────────────

  isOnboardingDone(moduleId: string): boolean {
    return this.data.onboarding[moduleId] === true;
  }

  markOnboardingDone(moduleId: string): void {
    this.data.onboarding[moduleId] = true;
    this.persist();
    // Legacy sync
    safeSetLocalStorage(`mathelabor_onboarding_${moduleId}`, "done");
  }

  // ── Convenience: Tutorial Dismiss ──────────────────────────────────────────

  /** Check if tutorial was dismissed for a module/taskType key like "addition/numberline" */
  isTutorialDismissed(key: string): boolean {
    return this.data.tutorialDismissed?.[key] === true;
  }

  /** Dismiss tutorial for a module/taskType key */
  dismissTutorial(key: string): void {
    if (!this.data.tutorialDismissed) this.data.tutorialDismissed = {};
    this.data.tutorialDismissed[key] = true;
    this.persist();
  }

  /** Re-enable tutorial for a module/taskType key */
  resetTutorialDismiss(key: string): void {
    if (this.data.tutorialDismissed) {
      delete this.data.tutorialDismissed[key];
      this.persist();
    }
  }

  // ── Convenience: Challenge History ─────────────────────────────────────────

  getChallengeHistory(): StateSchema["challengeHistory"] & [] {
    return this.data.challengeHistory ?? [];
  }

  saveChallengeResult(result: NonNullable<StateSchema["challengeHistory"]>[number]): void {
    if (!this.data.challengeHistory) this.data.challengeHistory = [];
    this.data.challengeHistory.push(result);
    // Keep last 100 results max
    if (this.data.challengeHistory.length > 100) {
      this.data.challengeHistory = this.data.challengeHistory.slice(-100);
    }
    this.persist();
  }

  // ── Convenience: Stats ─────────────────────────────────────────────────────

  recordStat(moduleId: string, taskType: string, correct: boolean): void {
    const globalKey = "__global__";
    const moduleKey = `${moduleId}:${taskType}`;

    for (const key of [globalKey, moduleKey]) {
      if (!this.data.stats[key]) {
        this.data.stats[key] = { attempts: 0, correct: 0 };
      }
      this.data.stats[key].attempts++;
      if (correct) this.data.stats[key].correct++;
    }
    this.persist();
  }

  getStats(key?: string): { attempts: number; correct: number } {
    const k = key ?? "__global__";
    return this.data.stats[k] ?? { attempts: 0, correct: 0 };
  }

  getModuleStats(moduleId: string, taskType?: string): { attempts: number; correct: number } {
    if (taskType) return this.getStats(`${moduleId}:${taskType}`);
    // Aggregate all task types for this module
    let attempts = 0;
    let correct = 0;
    for (const [key, stat] of Object.entries(this.data.stats)) {
      if (key.startsWith(`${moduleId}:`)) {
        attempts += stat.attempts;
        correct += stat.correct;
      }
    }
    return { attempts, correct };
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

export const appState = new AppStateManager();
