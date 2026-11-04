'use client';

import * as React from 'react';

const NUMBER = /(\d[\d,]*(?:\.\d+)?)/g;

/** Re-draws every number inside `text` at fraction `t` of its target, keeping its commas and decimals. */
function interpolate(text: string, from: string | null, t: number): string {
  const fromNums = from ? Array.from(from.matchAll(NUMBER), (m) => Number(m[1].replace(/,/g, ''))) : [];
  let i = 0;
  return text.replace(NUMBER, (raw) => {
    const target = Number(raw.replace(/,/g, ''));
    const start = fromNums[i++] ?? 0;
    const decimals = raw.includes('.') ? raw.split('.')[1].length : 0;
    const value = start + (target - start) * t;
    return value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: raw.includes(','),
    });
  });
}

/**
 * Counts the numbers in a formatted value up from zero on first show, and from
 * the old value to the new one on live updates ("303,165 ₮", "4 / 9",
 * "164.9 kWh" all work). Anything that is not a string renders as-is.
 */
export function CountUp({ value, duration = 900 }: { value: React.ReactNode; duration?: number }) {
  const text = typeof value === 'string' || typeof value === 'number' ? String(value) : null;
  const [shown, setShown] = React.useState(() => (text ? interpolate(text, null, 0) : null));
  const previous = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (text === null) return;
    // `previous` is only updated once an animation lands, so a re-run of this
    // effect (React dev mode runs it twice) starts over instead of skipping.
    const from = previous.current;
    if (from === text) return;

    // Reduced motion: jump straight to the value on the first frame.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const length = reduce ? 0 : duration;

    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const p = length > 0 ? Math.min(1, (now - started) / length) : 1;
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(interpolate(text, from, eased));
      if (p < 1) frame = requestAnimationFrame(tick);
      else previous.current = text;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, duration]);

  if (text === null) return <>{value}</>;
  return <>{shown ?? text}</>;
}
