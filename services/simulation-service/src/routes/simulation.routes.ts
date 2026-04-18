import { Router } from "express";
import { simAuth, init, control, seek, trade, state, listTrades } from "../controllers/simulation.controller.js";

const router = Router();

router.use(simAuth);
router.post("/init", init);
router.post("/control", control);
router.post("/seek", seek);
router.post("/trade", trade);
router.get("/state", state);
router.get("/trades", listTrades);

export default router;
