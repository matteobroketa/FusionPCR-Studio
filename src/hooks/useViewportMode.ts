import { useEffect, useState } from 'react';

export type ViewportMode = 'desktop' | 'tablet' | 'phone';

function classifyViewport(width: number): ViewportMode {
  if (width <= 640) {
    return 'phone';
  }
  if (width <= 1100) {
    return 'tablet';
  }
  return 'desktop';
}

export function useViewportMode() {
  const [viewportMode, setViewportMode] = useState<ViewportMode>(() => {
    if (typeof window === 'undefined') {
      return 'desktop';
    }
    return classifyViewport(window.innerWidth);
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const updateViewportMode = () => {
      setViewportMode(classifyViewport(window.innerWidth));
    };

    updateViewportMode();
    window.addEventListener('resize', updateViewportMode);
    return () => window.removeEventListener('resize', updateViewportMode);
  }, []);

  return viewportMode;
}
