import { useEffect, useRef, useState } from 'react';

/**
 * Debounce a value to reduce the number of expensive computations triggered by user input.
 * @param value The input value to debounce
 * @param delay Debounce delay in milliseconds (default 300ms)
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  const timer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    timer.current && clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(value), delay);
    return () => {
      timer.current && clearTimeout(timer.current);
    };
  }, [value, delay]);

  return debounced;
}
