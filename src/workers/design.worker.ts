import { buildFusionDesign, type FusionProjectInput } from '../utils/fusion';

type DesignWorkerRequest = {
  requestId: number;
  project: FusionProjectInput;
};

self.addEventListener('message', (event: MessageEvent<DesignWorkerRequest>) => {
  try {
    const design = buildFusionDesign(event.data.project);
    self.postMessage({
      requestId: event.data.requestId,
      design,
    });
  } catch (error) {
    self.postMessage({
      requestId: event.data.requestId,
      error: error instanceof Error ? error.message : 'Design worker failed.',
    });
  }
});
