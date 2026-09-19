import { useEffect, useLayoutEffect, useState } from 'react';

/**
 * Scroll behaviour of the landing page, from one passive scroll listener:
 *  - `active`: the section being read, which highlights its tab in the header.
 *    A section counts once its top passes 35% of the window height.
 *  - `scrolled`: whether the page has moved at all (the header gets its border).
 *  - the margin rail's fill: how far down the page the reader is, written to the
 *    rail element as the CSS variable --progress (no React re-render per frame).
 */
export function useLandingScroll(sectionIds, railRef) {
  const [active, setActive] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const marker = window.innerHeight * 0.35;
      let current = null;
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= marker) current = id;
      }
      // At the very bottom the last section is being read, even if it is short.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        current = sectionIds[sectionIds.length - 1];
      }
      setActive(current); // React skips the render when the value is unchanged
      setScrolled(window.scrollY > 8);

      const rail = railRef.current;
      if (rail) {
        const box = rail.getBoundingClientRect();
        const progress = Math.min(1, Math.max(0, (marker - box.top) / box.height));
        rail.style.setProperty('--progress', progress.toFixed(4));
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
    };
  }, [sectionIds, railRef]);

  return { active, scrolled };
}

/**
 * Blocks marked `data-reveal` rise into place the first time they scroll into
 * view (CSS in styles/index.css). The hiding class is added before the first
 * paint and only once this runs, so without JavaScript everything is visible.
 * Only put `data-reveal` on elements that are always rendered.
 */
export function useReveal(rootRef) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );
    root.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));
    root.classList.add('reveal-on');
    return () => observer.disconnect();
  }, [rootRef]);
}
