type InitMessage = { type: "INIT"; payload: { canvas: OffscreenCanvas; width: number; height: number } };
type RenderMessage = { type: "RENDER_CANDLES"; payload: { candles: Array<{ close: number }> } };
type WorkerMessage = InitMessage | RenderMessage | { type: "PAUSE" } | { type: "RESUME" };

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let paused = false;

function drawFallback(candles: Array<{ close: number }>): void {
  if (!ctx || !canvas || paused) {
    return;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#1f7a8c";
  ctx.lineWidth = 1.5;

  if (candles.length < 2) {
    return;
  }

  const closes = candles.map((c) => c.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = Math.max(1e-6, max - min);

  ctx.beginPath();
  closes.forEach((value, index) => {
    const x = (index / (closes.length - 1)) * canvas.width;
    const y = canvas.height - ((value - min) / span) * canvas.height;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
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
