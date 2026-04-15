import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken";
import { createSimulationController, csvUploadMiddleware } from "../controllers/simulationController";
import { SimulationService } from "../services/simulationService";
import { SimulationEngine } from "../services/simulationEngine";

export function createSimulationRoutes(engine: SimulationEngine) {
  const router = Router();
  const controller = createSimulationController(new SimulationService(engine));

  router.use(verifyToken);
  router.post("/init", controller.init);
  router.post("/control", controller.control);
  router.post("/seek", controller.seek);
  router.post("/trade", controller.trade);
  router.post("/currency", controller.setCurrency);
  router.post("/portfolio/import", csvUploadMiddleware, controller.importPortfolio);
  router.get("/assets/filters", controller.assetFilters);
  router.get("/assets", controller.assets);
  router.post("/search/click", controller.searchClick);
  router.post("/search/impression", controller.searchImpression);
  router.get("/state", controller.state);

  return router;
}
