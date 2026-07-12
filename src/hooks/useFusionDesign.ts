import { useEffect, useMemo, useRef, useState } from 'react';
import { buildFusionDesign, createPlaceholderFusionDesign, type FusionDesign, type FusionProjectInput } from '../utils/fusion';

type DesignWorkerRequest = {
  requestId: number;
  revision: number;
  projectHash: string;
  project: FusionProjectInput;
};

type DesignWorkerResponse =
  | {
      requestId: number;
      revision: number;
      projectHash: string;
      design: FusionDesign;
    }
  | {
      requestId: number;
      revision: number;
      projectHash: string;
      error: string;
    };

type CalculationState = 'idle' | 'pending' | 'complete' | 'stale' | 'error';

type DesignCalculationResult = {
  revision: number;
  projectHash: string;
  design: FusionDesign;
};

type UseFusionDesignResult = {
  design: FusionDesign;
  calculationState: CalculationState;
  isDesignPending: boolean;
  isDesignCurrent: boolean;
  workerError: string | null;
  retry: () => void;
};

const CALCULATION_DEBOUNCE_MS = 200;

function isCurrentResult(result: DesignCalculationResult | null, project: FusionProjectInput) {
  return result?.revision === project.revision && result.projectHash === project.projectHash;
}

export function useFusionDesign(project: FusionProjectInput): UseFusionDesignResult {
  const placeholderDesign = useMemo(() => createPlaceholderFusionDesign(project), [project]);
  const [result, setResult] = useState<DesignCalculationResult | null>(null);
  const [calculationState, setCalculationState] = useState<CalculationState>('idle');
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const requestIdRef = useRef(0);
  const activeWorkerRef = useRef<Worker | null>(null);
  const cacheRef = useRef(new Map<string, DesignCalculationResult>());

  const retry = () => {
    setWorkerError(null);
    setRetryToken((value) => value + 1);
  };

  useEffect(() => {
    const cached = cacheRef.current.get(project.projectHash) ?? null;
    if (cached && isCurrentResult(cached, project)) {
      setResult(cached);
      setCalculationState('complete');
      setWorkerError(null);
      return () => undefined;
    }

    setCalculationState((current) => {
      if (current === 'error' && workerError) {
        return 'error';
      }
      return result && !isCurrentResult(result, project) ? 'stale' : 'pending';
    });
    setWorkerError(null);

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const request: DesignWorkerRequest = {
      requestId,
      revision: project.revision,
      projectHash: project.projectHash,
      project,
    };

    const debounceHandle = window.setTimeout(() => {
      if (typeof Worker === 'undefined') {
        window.setTimeout(() => {
          try {
            const design = buildFusionDesign(project);
            const nextResult: DesignCalculationResult = {
              revision: request.revision,
              projectHash: request.projectHash,
              design,
            };
            cacheRef.current.set(request.projectHash, nextResult);
            setResult(nextResult);
            setCalculationState(isCurrentResult(nextResult, project) ? 'complete' : 'stale');
            setWorkerError(null);
          } catch (error) {
            setCalculationState('error');
            setWorkerError(error instanceof Error ? error.message : 'Scientific calculation failed.');
          }
        }, 0);
        return;
      }

      activeWorkerRef.current?.terminate();
      const worker = new Worker(new URL('../workers/design.worker.ts', import.meta.url), { type: 'module' });
      activeWorkerRef.current = worker;

      const handleMessage = (event: MessageEvent<DesignWorkerResponse>) => {
        const payload = event.data;
        if (payload.requestId !== requestIdRef.current) {
          return;
        }

        if ('design' in payload) {
          const nextResult: DesignCalculationResult = {
            revision: payload.revision,
            projectHash: payload.projectHash,
            design: payload.design,
          };
          cacheRef.current.set(payload.projectHash, nextResult);
          setResult(nextResult);
          setCalculationState(isCurrentResult(nextResult, project) ? 'complete' : 'stale');
          setWorkerError(null);
        } else {
          setCalculationState('error');
          setWorkerError(payload.error || 'Design worker failed.');
        }

        worker.terminate();
        if (activeWorkerRef.current === worker) {
          activeWorkerRef.current = null;
        }
      };

      const handleError = () => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setCalculationState('error');
        setWorkerError('Design worker failed. Review the project and use Retry to calculate again.');
        worker.terminate();
        if (activeWorkerRef.current === worker) {
          activeWorkerRef.current = null;
        }
      };

      worker.addEventListener('message', handleMessage);
      worker.addEventListener('error', handleError);
      worker.postMessage(request satisfies DesignWorkerRequest);
    }, CALCULATION_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(debounceHandle);
      activeWorkerRef.current?.terminate();
      activeWorkerRef.current = null;
    };
  }, [project, retryToken]);

  useEffect(
    () => () => {
      activeWorkerRef.current?.terminate();
      activeWorkerRef.current = null;
    },
    [],
  );

  const isDesignCurrent = isCurrentResult(result, project);

  return {
    design: result?.design ?? placeholderDesign,
    calculationState,
    isDesignPending: calculationState === 'pending',
    isDesignCurrent,
    workerError,
    retry,
  };
}
