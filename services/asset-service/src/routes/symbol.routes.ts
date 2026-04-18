import { Router } from "express";
import { search, getByTicker, list, catalog } from "../controllers/symbol.controller.js";

const router = Router();

router.get("/search", search);
router.get("/catalog", catalog);
router.get("/", list);
router.get("/:ticker", getByTicker);

export default router;
