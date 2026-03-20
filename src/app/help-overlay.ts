/**
 * Hilfe & Info Overlay
 *
 * Erklärt Zweck, Didaktik und Bedienung der Mathewerkstatt.
 * Geöffnet über den "?" Button auf der Startseite.
 * Geschlossen via X-Button, Klick auf Backdrop oder ESC.
 */

import { playClickSound } from "@core/sounds";

let overlayEl: HTMLElement | null = null;

// ─── Public API ──────────────────────────────────────────────────────────────

export function openHelpOverlay(): void {
  if (overlayEl) return;

  const overlay = document.createElement("div");
  overlay.className = "help-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Hilfe und Informationen zur Mathewerkstatt");

  const modal = document.createElement("div");
  modal.className = "help-modal";
  modal.innerHTML = buildContent();

  modal.querySelector(".help-modal__close")?.addEventListener("click", () => {
    closeHelpOverlay();
    playClickSound();
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeHelpOverlay();
      playClickSound();
    }
  });

  document.addEventListener("keydown", onKeyDown);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlayEl = overlay;

  // Fokus auf Schließen-Button setzen
  (modal.querySelector(".help-modal__close") as HTMLElement | null)?.focus();
}

// ─── Close ───────────────────────────────────────────────────────────────────

function closeHelpOverlay(): void {
  overlayEl?.remove();
  overlayEl = null;
  document.removeEventListener("keydown", onKeyDown);
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    closeHelpOverlay();
    playClickSound();
  }
}

// ─── Content ─────────────────────────────────────────────────────────────────

function buildContent(): string {
  return `
    <div class="help-modal__header">
      <h1 class="help-modal__title">🔢 Mathewerkstatt Bayern 3/4</h1>
      <button class="help-modal__close" type="button" aria-label="Hilfe schließen">✕</button>
    </div>

    <div class="help-modal__body">

      <!-- Was ist die App? -->
      <section class="help-section">
        <h2 class="help-section__title">📖 Was ist die Mathewerkstatt?</h2>
        <p>
          Die <strong>Mathewerkstatt Bayern 3/4</strong> ist ein kostenloses, werbefreies
          Unterrichtswerkzeug für den Mathematikunterricht in der Grundschule
          (Klasse 3 und 4, Lehrplan Bayern). Die App läuft vollständig im Browser –
          ohne Installation, ohne Anmeldung und ohne Internetzugang.
        </p>
        <p>
          Sie orientiert sich am <strong>LehrplanPLUS Bayern</strong> und deckt alle
          wesentlichen Lernbereiche von Klasse 3/4 ab: Zahlverständnis, Grundrechenarten,
          Brüche, Größen &amp; Messen, Geometrie sowie Daten &amp; Zufall.
        </p>
      </section>

      <!-- Für wen? -->
      <section class="help-section">
        <h2 class="help-section__title">🎯 Für wen ist die App?</h2>
        <p>
          Primär für <strong>Lehrkräfte als Präsentationswerkzeug</strong> am Smartboard,
          am Tablet oder am Laptop. Die Lehrkraft steuert das Tempo – keine Aufgabe
          wechselt automatisch, kein Timer startet von alleine.
        </p>
        <p>
          Die App kann ergänzend auch im Einzel- oder Partnerarbeit-Modus eingesetzt
          werden, z. B. auf Schüler-Tablets.
        </p>
      </section>

      <!-- Warum? -->
      <section class="help-section">
        <h2 class="help-section__title">💡 Warum diese App?</h2>
        <ul class="help-list">
          <li><strong>Kostenlos und werbefrei</strong> – kein Abo, keine versteckten Kosten</li>
          <li><strong>Datenschutzkonform</strong> – keine Daten verlassen das Gerät</li>
          <li><strong>Offline-fähig</strong> – funktioniert ohne Internetzugang</li>
          <li><strong>Kein Account</strong> – sofort nutzbar, kein Login</li>
          <li><strong>Smartboard-optimiert</strong> – große Touch-Targets, gut sichtbare Schrift</li>
          <li><strong>Legasthenie-freundlich</strong> – Atkinson Hyperlegible Schrift, TTS-Funktion</li>
        </ul>
      </section>

      <!-- Didaktik -->
      <section class="help-section">
        <h2 class="help-section__title">🧠 Didaktische Grundlagen</h2>
        <p>
          Die App orientiert sich an <strong>Jean Piagets Theorie der konkret-operationalen
          Entwicklungsphase</strong> (8–11 Jahre): Mathematische Konzepte werden visuell
          und gegenständlich dargestellt, bevor abstrakte Symbole eingeführt werden.
        </p>
        <ul class="help-list">
          <li>
            <strong>Fehler als Lernmoment</strong> – kein rotes X, kein Buzzer.
            Ermutigendes Feedback wie „Fast!", „Probier nochmal!"
          </li>
          <li>
            <strong>Progressives Hinweissystem</strong> – die Lehrkraft bestimmt,
            wann ein Hinweis gezeigt wird (💡-Taste). Optional: automatische Hilfe
            nach mehreren Fehlversuchen
          </li>
          <li>
            <strong>Kein Speed-Lob</strong> – Verständnis und Strategie stehen im
            Vordergrund, nicht Schnelligkeit
          </li>
          <li>
            <strong>Maximale Arbeitsgedächtnis-Schonung</strong> – nie mehr als
            4–5 sichtbare Auswahloptionen gleichzeitig
          </li>
        </ul>
      </section>

      <!-- Bedienung -->
      <section class="help-section">
        <h2 class="help-section__title">🕹 Grundlegende Bedienung</h2>

        <h3 class="help-subsection__title">Schwierigkeitsgrad wählen</h3>
        <p>
          Auf der Startseite stehen drei Stufen zur Auswahl:
        </p>
        <ul class="help-list">
          <li>🐥 <strong>Junior</strong> – Zahlenraum bis 100, einfache Aufgaben</li>
          <li>⭐ <strong>Checker</strong> – Zahlenraum bis 1.000, mittleres Niveau</li>
          <li>🚀 <strong>BossBaby</strong> – Zahlenraum bis 1.000.000, anspruchsvoll</li>
        </ul>

        <h3 class="help-subsection__title">Modul starten</h3>
        <p>
          Einfach eine der Kacheln auf der Startseite antippen. Das Modul öffnet sich
          mit einem kurzen Tutorial. Mit <strong>„Los geht's!"</strong> startet die
          erste Aufgabe.
        </p>

        <h3 class="help-subsection__title">Steuerleiste (unten)</h3>
        <div class="help-controls">
          <div class="help-control">
            <span class="help-control__icon">💡</span>
            <span><strong>Hinweis</strong> – zeigt einen schrittweisen Tipp zur aktuellen Aufgabe. Die Punkte neben dem Button zeigen, wie viele Hinweise noch verfügbar sind.</span>
          </div>
          <div class="help-control">
            <span class="help-control__icon">📖</span>
            <span><strong>Lösung</strong> – zeigt die vollständige Lösung mit Erklärung.</span>
          </div>
          <div class="help-control">
            <span class="help-control__icon">→</span>
            <span><strong>Nächste Aufgabe</strong> – generiert eine neue Aufgabe (gleicher Typ und Schwierigkeitsgrad).</span>
          </div>
          <div class="help-control">
            <span class="help-control__icon">🔄</span>
            <span><strong>Zurücksetzen</strong> – setzt die aktuelle Aufgabe zurück, ohne eine neue zu generieren.</span>
          </div>
          <div class="help-control">
            <span class="help-control__icon">⚙️</span>
            <span><strong>Weitere Optionen</strong> – Sprint-Challenge starten, Aufgabentyp wechseln, automatische Hilfe ein-/ausschalten.</span>
          </div>
        </div>

        <h3 class="help-subsection__title">Aufgabentypen wechseln</h3>
        <p>
          Die Chips direkt über dem Canvas (z. B. „Punktfeld", „Sprünge", „Division")
          wechseln den Aufgabentyp innerhalb eines Moduls.
        </p>

        <h3 class="help-subsection__title">Tastaturkürzel</h3>
        <div class="help-keys">
          <div class="help-key"><kbd>Leertaste</kbd> Nächste Aufgabe</div>
          <div class="help-key"><kbd>H</kbd> Hinweis</div>
          <div class="help-key"><kbd>L</kbd> Lösung</div>
          <div class="help-key"><kbd>1–9</kbd> Antwort eingeben</div>
          <div class="help-key"><kbd>Alt+0</kbd> Startseite</div>
          <div class="help-key"><kbd>Alt+1–9</kbd> Modul direkt wechseln</div>
          <div class="help-key"><kbd>ESC</kbd> Overlay schließen</div>
        </div>
      </section>

      <!-- Sprint-Challenge -->
      <section class="help-section">
        <h2 class="help-section__title">⏱ Sprint-Challenge &amp; Rallye</h2>
        <p>
          <strong>Sprint-Challenge:</strong> So viele Aufgaben wie möglich in 2, 5 oder
          10 Minuten lösen – innerhalb eines Moduls. Starten über ⚙️ → „Sprint-Challenge".
        </p>
        <p>
          <strong>Modul-Rallye:</strong> Eine Aufgabe pro Modul – alle Module nacheinander
          auf Zeit absolvieren. Starten über die „Challenge"-Kachel auf der Startseite.
        </p>
        <p>
          Beide Modi können über den <strong>⏸-Button</strong> in der Timer-Leiste pausiert
          und mit „⏯ Weitermachen" fortgesetzt oder vorzeitig beendet werden.
        </p>
      </section>

      <!-- Barrierefreiheit -->
      <section class="help-section">
        <h2 class="help-section__title">♿ Barrierefreiheit</h2>
        <ul class="help-list">
          <li>
            <strong>🔊 Vorlesen (TTS)</strong> – Aufgabentexte werden per Text-to-Speech
            vorgelesen. Ein-/Ausschalten über den 🔊-Button in der Topbar.
            Die App wählt automatisch die beste verfügbare deutsche Stimme.
          </li>
          <li>
            <strong>☀️ Hell/Dunkel-Modus</strong> – über den ☀️-Button in der Topbar
            umschalten. Der Modus wird für zukünftige Besuche gespeichert.
          </li>
          <li>
            <strong>Atkinson Hyperlegible</strong> – diese Schriftart wurde speziell
            für Menschen mit Legasthenie entwickelt (Braille Institute).
          </li>
          <li>
            <strong>Reduzierte Bewegung</strong> – die App respektiert die
            Systemeinstellung „Bewegung reduzieren" (prefers-reduced-motion).
          </li>
        </ul>
      </section>

      <!-- Datenschutz -->
      <section class="help-section help-section--legal">
        <h2 class="help-section__title">🔒 Datenschutz &amp; Rechtliches</h2>
        <ul class="help-list">
          <li>
            <strong>Keine Datenübertragung durch die App:</strong> Die App selbst
            sendet keinerlei Daten an externe Server. Es werden keine Cookies gesetzt,
            kein Tracking durchgeführt, keine Analytics erhoben.
          </li>
          <li>
            <strong>Lokale Speicherung:</strong> Lernfortschritt, Schwierigkeitsgrad
            und Einstellungen werden ausschließlich im Browser-Speicher (localStorage)
            Ihres Geräts gespeichert. Diese Daten verlassen das Gerät nicht.
          </li>
          <li>
            <strong>Hosting durch GitHub Pages (Microsoft):</strong> Diese App wird
            über GitHub Pages bereitgestellt. Beim Zugriff über
            <a href="https://crashman1983.github.io/Mathelab/" target="_blank"
               rel="noopener noreferrer" class="help-link">github.io</a>
            erfasst GitHub (Microsoft) serverseitig technische Zugriffsdaten,
            insbesondere <strong>IP-Adressen und Zeitstempel</strong>, zur
            Sicherstellung des Betriebs und zur Erfüllung gesetzlicher Pflichten.
            Die App hat darauf keinen Zugriff und keine Kontrolle darüber.
            Weitere Informationen:
            <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"
               target="_blank" rel="noopener noreferrer" class="help-link">
              GitHub Datenschutzerklärung
            </a>.
          </li>
          <li>
            <strong>Kein Profiling:</strong> Es werden weder durch die App noch durch
            den Betreiber Nutzerprofile erstellt.
          </li>
          <li>
            <strong>Kein kommerzieller Zweck:</strong> Diese App ist ein privates,
            nicht-kommerzielles Bildungsprojekt ohne wirtschaftlichen Hintergrund.
          </li>
          <li>
            <strong>Open Source:</strong> Der Quellcode ist öffentlich einsehbar auf
            <a href="https://github.com/Crashman1983/Mathelab" target="_blank"
               rel="noopener noreferrer" class="help-link">GitHub</a>.
          </li>
        </ul>
      </section>

      <!-- Footer -->
      <div class="help-footer">
        Mathewerkstatt Bayern 3/4 · Kostenloses, nicht-kommerzielles Bildungsprojekt ·
        <a href="https://github.com/Crashman1983/Mathelab" target="_blank"
           rel="noopener noreferrer" class="help-link">github.com/Crashman1983/Mathelab</a>
      </div>

    </div>
  `;
}
