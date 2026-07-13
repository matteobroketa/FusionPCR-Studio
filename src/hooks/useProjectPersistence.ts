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

export function useProjectPersistence(
  storageKey: string,
  project: FusionProjectInput,
): UseProjectPersistenceResult {
  const serializedProject = useMemo(() => serializeProject(project), [project]);
  const lastSavedRef = useRef<string | null>(null);
  const [persistenceState, setPersistenceState] =
    useState<PersistenceState>('idle');
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

    try {
      if (lastSavedRef.current === null) {
        const existing = window.localStorage.getItem(storageKey);
        if (existing === serializedProject) {
          lastSavedRef.current = serializedProject;
        }
      }
    } catch (error) {
      const failureHandle = window.setTimeout(() => {
        setPersistenceState('failed');
        setPersistenceError(
          error instanceof Error ? error.message : 'Local persistence failed.',
        );
      }, 0);
      return () => {
        window.clearTimeout(failureHandle);
      };
    }

    if (lastSavedRef.current === serializedProject) {
      const savedHandle = window.setTimeout(() => {
        setPersistenceState('saved');
        setPersistenceError(null);
      }, 0);
      return () => {
        window.clearTimeout(savedHandle);
      };
    }

    const idleHandle = window.setTimeout(() => {
      setPersistenceState('idle');
      setPersistenceError(null);
    }, 0);

    const debounceHandle = window.setTimeout(() => {
      setPersistenceState('saving');
      try {
        window.localStorage.setItem(storageKey, serializedProject);
        lastSavedRef.current = serializedProject;
        setPersistenceState('saved');
        setPersistenceError(null);
      } catch (error) {
        setPersistenceState('failed');
        setPersistenceError(
          error instanceof Error ? error.message : 'Local persistence failed.',
        );
      }
    }, PERSISTENCE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(idleHandle);
      window.clearTimeout(debounceHandle);
    };
  }, [retryToken, serializedProject, storageKey]);

  return {
    persistenceState,
    persistenceError,
    retryPersistence,
  };
}
