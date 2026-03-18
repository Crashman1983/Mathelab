/**
 * Anwendungs-Einstiegspunkt.
 * Initialisiert App-Shell, registriert Module, stellt Session wieder her.
 */

import "@styles/base.css";
import "@styles/components.css";
import "@styles/challenge.css";

import { initShell } from "@app/shell";
import { DIFFICULTIES } from "@app/module-framework";
import { appState } from "@core/state";
import "@app/challenge"; // Register window.__challengeActive early

// ─── Module Imports ─────────────────────────────────────────────────────────
import { netzeV2Registration } from "@modules/netze/v2";
import { symmetryV2Registration } from "@modules/symmetry/v2";
import { chanceV2Registration } from "@modules/chance/v2";
import { timeV2Registration } from "@modules/time/v2";
import { measuresV2Registration } from "@modules/measures/v2";
import { numbersV2Registration } from "@modules/numbers/v2";
import { geometryV2Registration } from "@modules/geometry/v2";
import { fractionsV2Registration } from "@modules/fractions/v2";
import { multiplicationV2Registration } from "@modules/multiplication/v2";
import { additionV2Registration } from "@modules/addition/v2";
import { subtractionV2Registration } from "@modules/subtraction/v2";
import { algorithmsV2Registration } from "@modules/algorithms/v2";
import { coordinatesV2Registration } from "@modules/coordinates/v2";
import { patternsV2Registration } from "@modules/patterns/v2";

// ─── Registrations (Reihenfolge = didaktische Progression) ──────────────────
const moduleRegistrations = [
  // Phase 1 – Zahlverständnis
  numbersV2Registration,
  patternsV2Registration,
  // Phase 2 – Grundrechenarten
  additionV2Registration,
  subtractionV2Registration,
  multiplicationV2Registration,
  algorithmsV2Registration,
  // Phase 3 – Brüche
  fractionsV2Registration,
  // Phase 4 – Größen & Messen
  measuresV2Registration,
  timeV2Registration,
  // Phase 5 – Geometrie & Raum
  geometryV2Registration,
  symmetryV2Registration,
  netzeV2Registration,
  coordinatesV2Registration,
  // Phase 6 – Daten & Zufall
  chanceV2Registration,
];

// ─── Bootstrap ──────────────────────────────────────────────────────────────

function bootstrap(): void {
  // Clean up corrupted localStorage entries on startup (Baustein 12)
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith("mathelabor_")) {
        try {
          const val = localStorage.getItem(key);
          if (val && val !== "null" && val.startsWith("{")) JSON.parse(val);
        } catch { localStorage.removeItem(key!); }
      }
    }
  } catch { /* localStorage blocked in private browsing */ }

  // Initialisiere App-Shell (Navigation, Theme, Resize, Router, Crash Recovery)
  const shell = initShell();

  // Registriere Module
  shell.registerMany(moduleRegistrations);

  // Schwierigkeitsauswahl auf der Startseite
  const heroEl = document.querySelector(".home-view__hero");
  if (heroEl) {
    const diffSelector = document.createElement("div");
    diffSelector.className = "difficulty-selector";
    diffSelector.id = "home-difficulty-selector";

    const currentDiff = appState.get("difficulty") ?? 2;

    for (const d of DIFFICULTIES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `difficulty-selector__btn${d.level === currentDiff ? " difficulty-selector__btn--active" : ""}`;
      btn.dataset.level = String(d.level);
      btn.innerHTML = `
        <span class="difficulty-selector__icon">${d.icon}</span>
        <span class="difficulty-selector__label">${d.label}</span>
        <span class="difficulty-selector__desc">${d.desc ?? ""}</span>
      `;
      btn.addEventListener("click", () => {
        appState.set("difficulty", d.level);
        // Update active state
        for (const b of diffSelector.querySelectorAll(".difficulty-selector__btn")) {
          b.classList.toggle("difficulty-selector__btn--active",
            (b as HTMLElement).dataset.level === String(d.level));
        }
        // Update topbar badge if visible
        const badge = document.getElementById("difficulty-badge");
        if (badge) badge.textContent = `${d.icon} ${d.label}`;
      });
      diffSelector.appendChild(btn);
    }

    heroEl.appendChild(diffSelector);
  }

  // Füge Home-Karten hinzu
  const cardsContainer = document.getElementById("home-module-cards");
  if (cardsContainer) {
    for (const reg of moduleRegistrations) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "module-card";
      card.innerHTML = `
        <span class="module-card__icon">${reg.icon}</span>
        <span class="module-card__text">
          <span class="module-card__title">${reg.label}</span>
          <span class="module-card__desc">${reg.description}</span>
        </span>
      `;
      card.addEventListener("click", () => {
        shell.activateModule(reg.id);
      });
      cardsContainer.appendChild(card);
    }
  }

  // Challenge-Karte auf der Startseite
  if (cardsContainer) {
    const challengeCard = document.createElement("button");
    challengeCard.type = "button";
    challengeCard.className = "module-card module-card--challenge";
    challengeCard.innerHTML = `
      <span class="module-card__icon">⏱</span>
      <span class="module-card__text">
        <span class="module-card__title">Challenge</span>
        <span class="module-card__desc">Teste dein Wissen! Alle Module auf Zeit.</span>
      </span>
    `;
    challengeCard.addEventListener("click", () => {
      import("./app/challenge-rally").then(({ startRallyFromHome }) => {
        startRallyFromHome(shell, moduleRegistrations);
      });
    });
    cardsContainer.appendChild(challengeCard);
  }

  // Home-Button verknüpfen
  document.getElementById("nav-home")?.addEventListener("click", () => {
    shell.showHome();
  });

  // Session wiederherstellen
  shell.restoreSession();
}

// Starte nach DOM-Bereitschaft
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
