"use client";

import { useEffect } from "react";
import { useBarePath } from "@/lib/use-lang";

/**
 * Marks full-bleed media routes (story landing, tours) on <html> so the page
 * ground behind them is dark instead of the light gradient — otherwise any
 * sliver the panels don't cover (iOS safe areas, rubber-band overscroll)
 * flashes sand around the photography.
 */
export function ImmersiveBody() {
  // Without the /en prefix, so the English landing ("/en") is immersive too.
  const pathname = useBarePath();
  const immersive = pathname === "/" || pathname.endsWith("/tour");

  useEffect(() => {
    const html = document.documentElement;
    if (immersive) html.dataset.immersive = "1";
    else delete html.dataset.immersive;
    return () => {
      delete html.dataset.immersive;
    };
  }, [immersive]);

  return null;
}
