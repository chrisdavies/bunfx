import { useEffect, useRef } from "preact/hooks";

/**
 * Like useEffect, but skips the first render.
 * Useful for running effects only when dependencies change after initial mount.
 */
export function useDidUpdateEffect(
  effect: () => void | (() => void),
  deps: readonly unknown[],
): void {
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    return effect();
  }, deps);
}
