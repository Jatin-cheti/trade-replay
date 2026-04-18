import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken";
import {
  listScreens,
  createScreen,
  updateScreen,
  deleteScreen,
  copyScreen,
} from "../controllers/screenController";

export function createScreenRoutes() {
  const router = Router();

  router.use(verifyToken as any);

  router.get("/", listScreens as any);
  router.post("/", createScreen as any);
  router.put("/:id", updateScreen as any);
  router.delete("/:id", deleteScreen as any);
  router.post("/:id/copy", copyScreen as any);

  return router;
}
