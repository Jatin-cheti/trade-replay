import { Router } from "express";
import { config, serverTime, symbols, search, history, marks, timescaleMarks } from "../controllers/datafeed.controller.js";

const router = Router();

router.get("/config", config);
router.get("/server_time", serverTime);
router.get("/symbols", symbols);
router.get("/search", search);
router.get("/history", history);
router.get("/marks", marks);
router.get("/timescale_marks", timescaleMarks);

export default router;
