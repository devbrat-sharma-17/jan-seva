import { useEffect, useRef, useCallback } from 'react';

interface UseScrollAnimationOptions {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}

export function useScrollAnimation<T extends HTMLElement = HTMLDivElement>(
  options: UseScrollAnimationOptions = {}
) {
  const { threshold = 0.15, rootMargin = '0px 0px -40px 0px', once = true } = options;
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      element.classList.add('animate-in');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
            if (once) {
              observer.unobserve(entry.target);
            }
          } else if (!once) {
            entry.target.classList.remove('animate-in');
          }
        });
      },
      { threshold, rootMargin }
    );

    // Observe the container and all children with animate-on-scroll class
    const animatableElements = element.querySelectorAll('.animate-on-scroll');
    animatableElements.forEach((el) => observer.observe(el));

    // Also observe the container itself if it has the class
    if (element.classList.contains('animate-on-scroll')) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return ref;
}

export function useInView(options: UseScrollAnimationOptions = {}) {
  const { threshold = 0.15, rootMargin = '0px' } = options;
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  const checkVisibility = useCallback(() => {
    const element = ref.current;
    if (!element || hasAnimated.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          hasAnimated.current = true;
          element.classList.add('animate-in');
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  useEffect(() => {
    return checkVisibility();
  }, [checkVisibility]);

  return ref;
}
