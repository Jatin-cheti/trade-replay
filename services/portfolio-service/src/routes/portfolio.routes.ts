import { Router } from "express";
import { portfolioAuth, getCurrent, listSaved, getById, create, update } from "../controllers/portfolio.controller.js";

const router = Router();

router.use(portfolioAuth);
router.get("/current", getCurrent);
router.get("/", listSaved);
router.get("/:portfolioId", getById);
router.post("/", create);
router.put("/:portfolioId", update);

export default router;
