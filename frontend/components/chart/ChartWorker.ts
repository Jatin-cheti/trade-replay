type InitMessage = { type: "INIT"; payload: { canvas: OffscreenCanvas; width: number; height: number } };
type RenderMessage = { type: "RENDER_CANDLES"; payload: { candles: Array<{ close: number }> } };
type WorkerMessage = InitMessage | RenderMessage | { type: "PAUSE" } | { type: "RESUME" };

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let paused = false;

function drawFallback(candles: Array<{ close: number }>): void {
  const localCanvas = canvas;
  const localCtx = ctx;
  if (!localCtx || !localCanvas || paused) {
    return;
  }
  localCtx.clearRect(0, 0, localCanvas.width, localCanvas.height);
  localCtx.strokeStyle = "#1f7a8c";
  localCtx.lineWidth = 1.5;

  if (candles.length < 2) {
    return;
  }

  const closes = candles.map((c) => c.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = Math.max(1e-6, max - min);

  localCtx.beginPath();
  closes.forEach((value, index) => {
    const x = (index / (closes.length - 1)) * localCanvas.width;
    const y = localCanvas.height - ((value - min) / span) * localCanvas.height;
    if (index === 0) {
      localCtx.moveTo(x, y);
    } else {
      localCtx.lineTo(x, y);
    }
  });
  localCtx.stroke();
}

self.onmessage = (event: MessageEvent<WorkerMessage>): void => {
  const message = event.data;
  if (message.type === "INIT") {
    canvas = message.payload.canvas;
    canvas.width = message.payload.width;
    canvas.height = message.payload.height;
    ctx = canvas.getContext("2d");
    return;
  }

  if (message.type === "PAUSE") {
    paused = true;
    return;
  }

  if (message.type === "RESUME") {
    paused = false;
    return;
  }

  if (message.type === "RENDER_CANDLES") {
    drawFallback(message.payload.candles);
  }
};
