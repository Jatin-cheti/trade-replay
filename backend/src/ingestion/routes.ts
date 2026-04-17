/**
 * ingestion/routes.ts — Express routes for the ingestion pipeline.
 */
import { Router } from "express";
import {
  getIngestionStatus,
  startIngestion,
  resumeIngestion,
  stopIngestion,
} from "./controller";

export function createIngestionRoutes(): Router {
  const router = Router();

  router.get("/status", getIngestionStatus);
  router.post("/start", startIngestion);
  router.post("/resume", resumeIngestion);
  router.post("/stop", stopIngestion);

  return router;
}
