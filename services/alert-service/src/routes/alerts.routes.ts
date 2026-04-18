import { Router } from "express";
import { alertAuth, create, listAlerts, remove, alertStats } from "../controllers/alerts.controller.js";

const router = Router();

router.use(alertAuth);
router.post("/", create);
router.get("/", listAlerts);
router.delete("/:id", remove);
router.get("/stats", alertStats);

export default router;
