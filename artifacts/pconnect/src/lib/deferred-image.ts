import { useEffect, useState } from "react";

/**
 * Let the initial HTML, React content, and controls paint before requesting
 * decorative background imagery. This is especially useful on slower mobile
 * connections and reverse-proxied deployments.
 */
export function useDeferredImage(delay = 100) {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setShouldLoad(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay]);

  return shouldLoad;
}