import { useEffect, useRef, useState } from 'react';
import { buildFusionDesign, type FusionDesign, type FusionProjectInput } from '../utils/fusion';

type DesignWorkerRequest = {
  requestId: number;
  project: FusionProjectInput;
};

type DesignWorkerResponse =
  | {
      requestId: number;
      design: FusionDesign;
    }
  | {
      requestId: number;
      error: string;
    };

export function useFusionDesign(project: FusionProjectInput): { design: FusionDesign; isDesignPending: boolean } {
  const [design, setDesign] = useState<FusionDesign>(() => buildFusionDesign(project));
  const [isDesignPending, setIsDesignPending] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (typeof Worker === 'undefined') {
      setDesign(buildFusionDesign(project));
      setIsDesignPending(false);
      return;
    }

    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('../workers/design.worker.ts', import.meta.url), { type: 'module' });
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsDesignPending(true);

    const handleMessage = (event: MessageEvent<DesignWorkerResponse>) => {
      if (event.data.requestId !== requestIdRef.current) {
        return;
      }

      if ('design' in event.data) {
        setDesign(event.data.design);
      } else {
        setDesign(buildFusionDesign(project));
      }
      setIsDesignPending(false);
    };

    const handleError = () => {
      setDesign(buildFusionDesign(project));
      setIsDesignPending(false);
    };

    const worker = workerRef.current;
    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);
    worker.postMessage({ requestId, project } satisfies DesignWorkerRequest);

    return () => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
    };
  }, [project]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  return {
    design,
    isDesignPending,
  };
}
