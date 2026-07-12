import { buildFusionDesign, type FusionProjectInput } from '../utils/fusion';

type DesignWorkerRequest = {
  requestId: number;
  revision: number;
  projectHash: string;
  project: FusionProjectInput;
};

self.addEventListener('message', (event: MessageEvent<DesignWorkerRequest>) => {
  try {
    const design = buildFusionDesign(event.data.project);
    self.postMessage({
      requestId: event.data.requestId,
      revision: event.data.revision,
      projectHash: event.data.projectHash,
      design,
    });
  } catch (error) {
    self.postMessage({
      requestId: event.data.requestId,
      revision: event.data.revision,
      projectHash: event.data.projectHash,
      error: error instanceof Error ? error.message : 'Design worker failed.',
    });
  }
});
