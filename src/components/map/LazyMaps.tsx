"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import dynamic from "next/dynamic";
import type { PlaceMap } from "./PlaceMap";
import type { RouteMap } from "./RouteMap";

function MapSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-ink/10"
    />
  );
}

const PlaceMapInner = dynamic(() => import("./PlaceMap").then((m) => m.PlaceMap), {
  ssr: false,
  loading: MapSkeleton,
});

const RouteMapInner = dynamic(() => import("./RouteMap").then((m) => m.RouteMap), {
  ssr: false,
  loading: MapSkeleton,
});

/**
 * next/dynamic fetches its chunk as soon as the component renders — i.e. at
 * page load, not "when the map scrolls into use". This hook supplies the
 * missing half: nothing mounts (so nothing downloads — maplibre ~230kB gz +
 * the 420kB RTL plugin + style/glyphs/tiles) until the placeholder comes
 * within 600px of the viewport. Many readers never reach the map at all.
 */
function useNearViewport() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (!("IntersectionObserver" in window)) {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);

  return { ref, near };
}

export function PlaceMapLazy(props: ComponentProps<typeof PlaceMap>) {
  const { ref, near } = useNearViewport();
  return <div ref={ref}>{near ? <PlaceMapInner {...props} /> : <MapSkeleton />}</div>;
}

export function RouteMapLazy(props: ComponentProps<typeof RouteMap>) {
  const { ref, near } = useNearViewport();
  return <div ref={ref}>{near ? <RouteMapInner {...props} /> : <MapSkeleton />}</div>;
}
