import { useEffect, useMemo, useRef, useState } from 'react';
import type { FusionProjectInput } from '../utils/fusion';
import { normalizeImportedProject } from '../utils/project';

export type PersistenceState = 'idle' | 'saving' | 'saved' | 'failed';

type UseProjectPersistenceResult = {
  persistenceState: PersistenceState;
  persistenceError: string | null;
  recoverySnapshot: string | null;
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
  const initialProjectRef = useRef(serializedProject);
  const initialStorageCheckedRef = useRef(false);
  const recoveryRef = useRef<{
    raw: string;
    key: string;
    saved: boolean;
  } | null>(null);
  const [recoverySnapshot, setRecoverySnapshot] = useState<string | null>(null);
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
        if (!initialStorageCheckedRef.current) {
          if (existing !== null) {
            let readable = false;
            try {
              readable =
                normalizeImportedProject(JSON.parse(existing)) !== null;
            } catch {
              /* Preserve the original bytes below. */
            }
            if (!readable) {
              recoveryRef.current = {
                raw: existing,
                key:
                  storageKey +
                  '-recovery-' +
                  Date.now() +
                  '-' +
                  Math.random().toString(36).slice(2),
                saved: false,
              };
            }
          }
          initialStorageCheckedRef.current = true;
        }
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

    const recovery = recoveryRef.current;
    if (
      recovery &&
      !recovery.saved &&
      serializedProject === initialProjectRef.current
    ) {
      const recoveryHandle = window.setTimeout(() => {
        setRecoverySnapshot(recovery.raw);
        setPersistenceState('failed');
        setPersistenceError(
          'The saved project could not be opened. Its original contents are preserved; download the recovery file before continuing.',
        );
      }, 0);
      return () => window.clearTimeout(recoveryHandle);
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
      if (recovery) setRecoverySnapshot(recovery.raw);
    }, 0);

    const debounceHandle = window.setTimeout(() => {
      setPersistenceState('saving');
      try {
        if (recovery && !recovery.saved) {
          const existingRecovery = window.localStorage.getItem(recovery.key);
          if (existingRecovery !== null && existingRecovery !== recovery.raw) {
            throw new Error(
              'Recovery storage already exists; the original project has not been overwritten.',
            );
          }
          if (existingRecovery === null)
            window.localStorage.setItem(recovery.key, recovery.raw);
          if (window.localStorage.getItem(recovery.key) !== recovery.raw) {
            throw new Error(
              'The recovery copy could not be verified. The original project has not been overwritten.',
            );
          }
          recovery.saved = true;
        }
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
    recoverySnapshot,
    retryPersistence,
  };
}
