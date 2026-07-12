import { useEffect, useMemo, useRef, useState } from 'react';
import type { FusionProjectInput } from '../utils/fusion';

export type PersistenceState = 'idle' | 'saving' | 'saved' | 'failed';

type UseProjectPersistenceResult = {
  persistenceState: PersistenceState;
  persistenceError: string | null;
  retryPersistence: () => void;
};

const PERSISTENCE_DEBOUNCE_MS = 200;

function serializeProject(project: FusionProjectInput) {
  return JSON.stringify(project);
}

export function useProjectPersistence(storageKey: string, project: FusionProjectInput): UseProjectPersistenceResult {
  const serializedProject = useMemo(() => serializeProject(project), [project]);
  const lastSavedRef = useRef<string | null>(null);
  const [persistenceState, setPersistenceState] = useState<PersistenceState>(() => {
    if (typeof window === 'undefined') {
      return 'idle';
    }

    try {
      const existing = window.localStorage.getItem(storageKey);
      if (existing === serializedProject) {
        lastSavedRef.current = serializedProject;
        return 'saved';
      }
    } catch {
      return 'failed';
    }

    return 'idle';
  });
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const retryPersistence = () => {
    setPersistenceError(null);
    setRetryToken((value) => value + 1);
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return () => undefined;
    }

    if (lastSavedRef.current === serializedProject) {
      setPersistenceState('saved');
      setPersistenceError(null);
      return () => undefined;
    }

    setPersistenceState('idle');
    setPersistenceError(null);

    const debounceHandle = window.setTimeout(() => {
      setPersistenceState('saving');
      try {
        window.localStorage.setItem(storageKey, serializedProject);
        lastSavedRef.current = serializedProject;
        setPersistenceState('saved');
        setPersistenceError(null);
      } catch (error) {
        setPersistenceState('failed');
        setPersistenceError(error instanceof Error ? error.message : 'Local persistence failed.');
      }
    }, PERSISTENCE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(debounceHandle);
    };
  }, [retryToken, serializedProject, storageKey]);

  return {
    persistenceState,
    persistenceError,
    retryPersistence,
  };
}
