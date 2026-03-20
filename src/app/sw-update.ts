/**
 * Service-Worker-Update-Banner
 *
 * Lauscht auf den nativen SW `controllerchange`-Event.
 * Wenn ein neuer Service Worker die Kontrolle übernimmt (nach skipWaiting),
 * erscheint ein Banner mit einem "Jetzt aktualisieren"-Button.
 *
 * Kein virtual:pwa-register nötig — funktioniert mit jedem SW-Setup.
 */

export function initSWUpdate(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  // Merken ob beim Laden bereits ein SW aktiv war.
  // Erste Aktivierung = kein Update, sondern Erst-Installation → Banner unterdrücken.
  let isInitialActivation = !navigator.serviceWorker.controller;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (isInitialActivation) {
      // Erst-Aktivierung des SW — kein Update, kein Banner.
      isInitialActivation = false;
      return;
    }
    // Neuer SW hat Kontrolle übernommen → neue Version verfügbar
    showUpdateBanner(() => window.location.reload());
  });
}

function showUpdateBanner(onUpdate: () => void): void {
  if (document.querySelector(".sw-update-banner")) return;

  const banner = document.createElement("div");
  banner.className = "sw-update-banner";
  banner.setAttribute("role", "alert");
  banner.setAttribute("aria-live", "polite");
  banner.innerHTML = `
    <span class="sw-update-banner__text">🆕 Neue Version verfügbar</span>
    <button type="button" class="sw-update-banner__btn">Jetzt aktualisieren</button>
    <button type="button" class="sw-update-banner__close" aria-label="Schließen">✕</button>
  `;

  const hide = (): void => {
    banner.classList.add("sw-update-banner--hiding");
    setTimeout(() => banner.remove(), 300);
  };

  banner.querySelector(".sw-update-banner__btn")?.addEventListener("click", () => {
    banner.remove();
    onUpdate();
  });

  banner.querySelector(".sw-update-banner__close")?.addEventListener("click", hide);

  document.body.appendChild(banner);

  // Auto-dismiss nach 30 Sekunden
  setTimeout(() => {
    if (document.contains(banner)) hide();
  }, 30_000);
}
