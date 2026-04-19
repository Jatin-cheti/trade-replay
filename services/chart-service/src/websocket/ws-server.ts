import type { IncomingMessage } from "node:http";
import type { Server } from "node:http";
import { WebSocketServer } from "ws";
import { ChartManager } from "./chart-manager";
import { createWsHandler } from "./ws-handler";

export interface ChartWsServer {
  attach(server: Server): void;
  close(): void;
  manager: ChartManager;
}

function isRealtimePath(req: IncomingMessage): boolean {
  const url = req.url ?? "";
  return url.startsWith("/api/chart/realtime/");
}

export function createChartWsServer(): ChartWsServer {
  const manager = new ChartManager();
  const wss = new WebSocketServer({ noServer: true });
  const onConnection = createWsHandler(manager);
  wss.on("connection", onConnection);

  return {
    manager,
    attach(server: Server): void {
      server.on("upgrade", (req, socket, head) => {
        if (!isRealtimePath(req)) {
          socket.destroy();
          return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit("connection", ws, req);
        });
      });
    },
    close(): void {
      manager.closeAll();
      wss.close();
    },
  };
}
