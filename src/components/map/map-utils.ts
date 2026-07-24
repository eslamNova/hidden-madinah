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
 * Category-colored pin as an accessible <button>: 44px hit area wrapping a
 * 30px visual circle.
 */
export function createPinElement(color: string, label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", label);
  Object.assign(button.style, {
    width: "44px",
    height: "44px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "none",
    padding: "0",
    cursor: "pointer",
  });
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
  button.appendChild(dot);
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