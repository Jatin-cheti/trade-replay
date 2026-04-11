import { getIndicator } from '../registry';
import { registerBuiltins } from '../builtins/index';
import type { IndicatorComputeContext } from '../types';
import type {
  IndicatorWorkerRequest,
  IndicatorWorkerResponse,
  IndicatorWorkerResultItem,
} from './indicatorWorkerProtocol';

registerBuiltins();

function sliceContext(source: IndicatorWorkerRequest['source'], start: number, end: number): IndicatorComputeContext {
  return {
    times: source.times.slice(start, end + 1),
    open: source.open.slice(start, end + 1),
    high: source.high.slice(start, end + 1),
    low: source.low.slice(start, end + 1),
    close: source.close.slice(start, end + 1),
    volume: source.volume.slice(start, end + 1),
    params: {},
  };
}

self.onmessage = (event: MessageEvent<IndicatorWorkerRequest>) => {
  const request = event.data;

  try {
    const ctxSlice = sliceContext(request.source, request.window.start, request.window.end);
    const results: IndicatorWorkerResultItem[] = [];

    for (const instance of request.instances) {
      const def = getIndicator(instance.indicatorId);
      if (!def) continue;

      const result = def.compute({ ...ctxSlice, params: instance.params });
      results.push({
        instanceId: instance.instanceId,
        outputs: result.outputs.slice(0, instance.outputCount),
      });
    }

    const response: IndicatorWorkerResponse = {
      requestId: request.requestId,
      window: request.window,
      results,
    };
    postMessage(response);
  } catch (error) {
    const response: IndicatorWorkerResponse = {
      requestId: request.requestId,
      window: request.window,
      results: [],
      error: error instanceof Error ? error.message : 'Unknown indicator worker error',
    };
    postMessage(response);
  }
};
