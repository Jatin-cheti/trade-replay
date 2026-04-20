import type { RefObject } from 'react';
import type { ToolVariant } from '@/services/tools/toolRegistry';
import { toolCursor } from '@/services/tools/toolRegistry';

type ChartCanvasProps = {
  chartContainerRef: RefObject<HTMLDivElement>;
  overlayRef: RefObject<HTMLCanvasElement>;
  activeVariant: ToolVariant;
  overlayInteractive?: boolean;
  overlayCursor?: string;
  containerCursor?: string;
};

export default function ChartCanvas({
  chartContainerRef,
  overlayRef,
  activeVariant,
  overlayInteractive,
  overlayCursor,
  containerCursor,
}: ChartCanvasProps) {
  const isInteractive = overlayInteractive ?? activeVariant !== 'none';
  const cursor = overlayCursor ?? toolCursor[activeVariant];

  return (
    <>
      <div ref={chartContainerRef} data-testid="chart-container" className="h-full w-full" style={{ cursor: containerCursor ?? cursor }} />
      <canvas
        ref={overlayRef}
        aria-label="chart-drawing-overlay"
        tabIndex={0}
        className={`absolute inset-0 z-10 ${isInteractive ? 'pointer-events-auto' : 'pointer-events-none'}`}
        style={{ cursor }}
      />
    </>
  );
}
