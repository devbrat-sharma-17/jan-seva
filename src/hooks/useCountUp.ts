// ============================================================
// Cinematic Count-Up Hook — JAN-SEVA
// ============================================================
// Smooth, non-linear count-up animation triggered when statistics
// enter the viewport via IntersectionObserver. Plays once per session.

import { useState, useEffect, useRef, useCallback } from 'react';

export interface StatItem {
  target: number;
  suffix?: string;
  prefix?: string;
  formatter?: (val: number) => string;
  duration?: number;
}

interface UseCinematicStatsOptions {
  /** Viewport intersection ratio before triggering (e.g. 0.25 = 25% visible). */
  threshold?: number;
  /** Root margin for intersection observer. */
  rootMargin?: string;
  /** Global duration in ms if not overridden per stat item. Default: 1800ms. */
  duration?: number;
  /** Stagger delay in ms between items. Default: 0. */
  staggerMs?: number;
  /**
   * Hold the animation until the figures are real. Default: true.
   *
   * The animation runs ONCE. Where the targets arrive asynchronously —
   * the Hero's trust bar reads the complaint store on a deferred import
   * — firing before they land would count up to zero and then never run
   * again, permanently displaying a wrong number. Passing `false` until
   * the data is ready arms the observer only when there is something
   * true to animate towards.
   */
  enabled?: boolean;
}

/**
 * Easing function: Quartic ease-out.
 * Starts briskly and smoothly decelerates toward the target value.
 */
function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/** Default Indian numbering format: 12,480 */
function defaultFormat(val: number): string {
  return Math.round(val).toLocaleString('en-IN');
}

export function useCinematicStats<T extends HTMLElement = HTMLElement>(
  items: StatItem[],
  options: UseCinematicStatsOptions = {}
) {
  const {
    threshold = 0.25,
    rootMargin = '0px',
    duration: globalDuration = 1800,
    staggerMs = 0,
    enabled = true,
  } = options;

  const containerRef = useRef<T>(null);
  const hasAnimatedRef = useRef(false);
  const animationFramesRef = useRef<number[]>([]);

  // Initialize values to 0 (or final values if reduced-motion)
  const [displayValues, setDisplayValues] = useState<string[]>(() => {
    const isReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    return items.map((item) => {
      if (isReduced) {
        const fmt = item.formatter ?? defaultFormat;
        return `${item.prefix ?? ''}${fmt(item.target)}${item.suffix ?? ''}`;
      }
      const fmt = item.formatter ?? defaultFormat;
      return `${item.prefix ?? ''}${fmt(0)}${item.suffix ?? ''}`;
    });
  });

  const animateStats = useCallback(() => {
    // Cancel any in-flight frames
    animationFramesRef.current.forEach(cancelAnimationFrame);
    animationFramesRef.current = [];

    const isReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isReduced) {
      setDisplayValues(
        items.map((item) => {
          const fmt = item.formatter ?? defaultFormat;
          return `${item.prefix ?? ''}${fmt(item.target)}${item.suffix ?? ''}`;
        })
      );
      return;
    }

    const startTime = performance.now();
    const currentVals = new Array(items.length).fill(0);

    const step = (now: number) => {
      let isAllComplete = true;
      const updatedDisplay: string[] = [];

      items.forEach((item, index) => {
        const itemDelay = index * staggerMs;
        const elapsed = Math.max(0, now - startTime - itemDelay);
        const itemDuration = item.duration ?? globalDuration;

        const rawProgress = Math.min(1, elapsed / itemDuration);
        const easedProgress = easeOutQuart(rawProgress);

        const currentVal = Math.round(easedProgress * item.target);
        currentVals[index] = currentVal;

        const fmt = item.formatter ?? defaultFormat;
        updatedDisplay.push(`${item.prefix ?? ''}${fmt(currentVal)}${item.suffix ?? ''}`);

        if (rawProgress < 1) {
          isAllComplete = false;
        }
      });

      setDisplayValues(updatedDisplay);

      if (!isAllComplete) {
        const frameId = requestAnimationFrame(step);
        animationFramesRef.current = [frameId];
      } else {
        // Ensure final exact values settle cleanly
        setDisplayValues(
          items.map((item) => {
            const fmt = item.formatter ?? defaultFormat;
            return `${item.prefix ?? ''}${fmt(item.target)}${item.suffix ?? ''}`;
          })
        );
      }
    };

    const firstFrame = requestAnimationFrame(step);
    animationFramesRef.current = [firstFrame];
  }, [items, globalDuration, staggerMs]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || hasAnimatedRef.current || !enabled) return;

    // Check if reduced motion is preferred
    const isReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isReduced) {
      hasAnimatedRef.current = true;
      animateStats();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimatedRef.current) {
          hasAnimatedRef.current = true;
          animateStats();
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      animationFramesRef.current.forEach(cancelAnimationFrame);
    };
    // `enabled` is a dependency so that flipping it re-runs this and arms
    // the observer. If the bar is already on screen by then,
    // IntersectionObserver fires on `observe`, so nothing is missed.
  }, [threshold, rootMargin, animateStats, enabled]);

  return {
    containerRef,
    displayValues,
    hasAnimated: hasAnimatedRef.current,
  };
}
