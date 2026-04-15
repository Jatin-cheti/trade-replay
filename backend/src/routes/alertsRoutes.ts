import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken";
import { alertsController } from "../controllers/alertsController";

export function createAlertsRoutes(): Router {
  const router = Router();
  router.use(verifyToken);
  router.post("/", alertsController.create);
  router.get("/", alertsController.list);
  router.delete("/:id", alertsController.remove);
  router.get("/stats", alertsController.stats);
  return router;
}
