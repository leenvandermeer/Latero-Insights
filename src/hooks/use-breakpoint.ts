"use client";

import { useEffect, useState } from "react";

const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1440,
  "3xl": 1920,
  "4k": 2560,
} as const;

type Breakpoint = keyof typeof BREAKPOINTS;

function getBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS["4k"]) return "4k";
  if (width >= BREAKPOINTS["3xl"]) return "3xl";
  if (width >= BREAKPOINTS["2xl"]) return "2xl";
  if (width >= BREAKPOINTS.xl) return "xl";
  if (width >= BREAKPOINTS.lg) return "lg";
  if (width >= BREAKPOINTS.md) return "md";
  return "sm";
}

export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("lg");

  useEffect(() => {
    function update() {
      setBreakpoint(getBreakpoint(window.innerWidth));
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return {
    breakpoint,
    isMobile: breakpoint === "sm",
    isTablet: breakpoint === "md",
    // 1024–1279px: sidebar collapsed by default, user can expand (LADR-013)
    isSmallDesktop: breakpoint === "lg",
    // ≥1280px: sidebar expanded by default (LADR-013)
    isDesktop: breakpoint === "xl" || breakpoint === "2xl" || breakpoint === "3xl" || breakpoint === "4k",
    isWide: breakpoint === "2xl" || breakpoint === "3xl" || breakpoint === "4k",
    is4k: breakpoint === "4k",
  };
}

export { BREAKPOINTS };
export type { Breakpoint };
