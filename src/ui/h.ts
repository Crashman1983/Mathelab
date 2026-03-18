/**
 * h() — Minimal Hyperscript Helper (Baustein 3).
 *
 * Type-safe DOM building. Replaces innerHTML strings.
 * ~60 lines of core logic.
 */

type Child = HTMLElement | SVGElement | string | number | null | undefined | false;

type Props<K extends keyof HTMLElementTagNameMap> = Partial<
  Omit<HTMLElementTagNameMap[K], "style" | "children" | "classList">
> & {
  style?: Partial<CSSStyleDeclaration> | string;
  class?: string;
  data?: Record<string, string>;
  on?: Partial<Record<keyof HTMLElementEventMap, EventListener>>;
};

/**
 * Create an HTML element with attributes and children.
 *
 * @example
 * h("div", { class: "panel", style: { padding: "16px" } },
 *   h("h2", {}, "Title"),
 *   h("button", { on: { click: handleClick } }, "OK"),
 * )
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Props<K> | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);

  if (props) {
    const { style, class: cls, data, on, ...rest } = props;

    // Class
    if (cls) el.className = cls;

    // Style
    if (style) {
      if (typeof style === "string") {
        el.style.cssText = style;
      } else {
        for (const [k, v] of Object.entries(style)) {
          if (v !== undefined && v !== null) {
            el.style.setProperty(
              k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`),
              String(v),
            );
          }
        }
      }
    }

    // Data attributes
    if (data) {
      for (const [k, v] of Object.entries(data)) {
        el.dataset[k] = v;
      }
    }

    // Event listeners
    if (on) {
      for (const [event, handler] of Object.entries(on)) {
        if (handler) el.addEventListener(event, handler);
      }
    }

    // Remaining DOM properties
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined && v !== null) {
        (el as Record<string, unknown>)[k] = v;
      }
    }
  }

  // Children
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (typeof child === "string" || typeof child === "number") {
      el.appendChild(document.createTextNode(String(child)));
    } else {
      el.appendChild(child);
    }
  }

  return el;
}
