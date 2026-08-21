import {
  getRTLTextPluginStatus,
  setRTLTextPlugin,
  type Map as MaplibreMap,
} from "maplibre-gl";
import { RTL_TEXT_PLUGIN_URL } from "@/lib/maps";

/**
 * Registers the self-hosted RTL text plugin exactly once per app. Without it
 * Arabic labels render as disconnected glyphs. Safe to call from every map
 * component (PlaceMap, RouteMap, MapView, admin PinPicker).
 */
export function ensureRtlTextPlugin(): void {
  try {
    if (getRTLTextPluginStatus() === "unavailable") {
      // lazy=true: the worker fetches the plugin only when RTL text appears.
      void setRTLTextPlugin(RTL_TEXT_PLUGIN_URL, true);
    }
  } catch {
    // Already registered by another component instance.
  }
}

/**
 * Prefer Arabic names from the OpenMapTiles schema on every symbol layer that
 * renders a name (leaves ref/housenumber-driven layers untouched).
 */
export function applyArabicLabels(map: MaplibreMap): void {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== "symbol") continue;
    const current = map.getLayoutProperty(layer.id, "text-field");
    if (current && JSON.stringify(current).includes("name")) {
      map.setLayoutProperty(layer.id, "text-field", [
        "coalesce",
        ["get", "name:ar"],
        ["get", "name"],
      ]);
    }
  }
}

/**
 * Category-colored pin as an accessible <button>: 48px hit area (elderly-first
 * floor) wrapping a 30px visual circle, with the place name captioned below
 * (absolutely positioned so the marker anchor and hit target stay exact —
 * halo text-shadow keeps it readable over any tile).
 */
export function createPinElement(color: string, label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", label);
  // NEVER set `position` on the button itself: maplibre's .maplibregl-marker
  // class positions the marker absolutely, and an inline value overrides it —
  // every pin would fall back into normal flow and pile up at the map edges.
  // The caption anchors to this inner wrapper instead.
  Object.assign(button.style, {
    width: "48px",
    height: "48px",
    background: "transparent",
    border: "none",
    padding: "0",
    cursor: "pointer",
  });
  const inner = document.createElement("span");
  Object.assign(inner.style, {
    position: "relative",
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  });
  button.appendChild(inner);

  const dot = document.createElement("span");
  Object.assign(dot.style, {
    width: "30px",
    height: "30px",
    borderRadius: "9999px",
    backgroundColor: color,
    border: "3px solid #FAF6EF",
    boxShadow: "0 2px 6px rgba(46,46,51,0.4)",
    display: "block",
  });
  inner.appendChild(dot);

  // Caption colors follow the tile theme (markers are re-created on toggle).
  const dark = document.documentElement.dataset.theme === "dark";
  const caption = document.createElement("span");
  caption.textContent = label;
  Object.assign(caption.style, {
    position: "absolute",
    top: "100%",
    left: "50%",
    transform: "translateX(-50%)",
    marginTop: "-4px",
    maxWidth: "130px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "12px",
    fontWeight: "700",
    lineHeight: "1.4",
    color: dark ? "#faf6ef" : "#2e2e33",
    textShadow: dark
      ? "0 0 3px #141418, 0 0 3px #141418, 0 0 4px #141418, 0 1px 3px #141418"
      : "0 0 3px #faf6ef, 0 0 3px #faf6ef, 0 0 4px #faf6ef, 0 1px 3px #faf6ef",
    pointerEvents: "none",
  });
  inner.appendChild(caption);
  return button;
}

/** Numbered stop pin for route maps (Western numerals). */
export function createNumberedPinElement(n: number, color = "#1F5C3D"): HTMLDivElement {
  const el = document.createElement("div");
  Object.assign(el.style, {
    width: "34px",
    height: "34px",
    borderRadius: "9999px",
    backgroundColor: color,
    border: "3px solid #FAF6EF",
    boxShadow: "0 2px 6px rgba(46,46,51,0.4)",
    color: "#FAF6EF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "700",
    fontSize: "16px",
  });
  el.textContent = String(n);
  return el;
}