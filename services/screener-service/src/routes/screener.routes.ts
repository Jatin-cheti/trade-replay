import { Router } from "express";
import { list, stats, search, symbol } from "../controllers/screener.controller.js";
import { screenAuth, listScreens, createScreen, updateScreen, deleteScreen, copyScreen } from "../controllers/screen.controller.js";

const router = Router();

// Public screener endpoints
router.get("/list", list);
router.get("/stats", stats);
router.get("/search", search);
router.get("/symbol/:symbol", symbol);

// Authenticated screen CRUD
router.get("/screens", screenAuth, listScreens);
router.post("/screens", screenAuth, createScreen);
router.put("/screens/:id", screenAuth, updateScreen);
router.delete("/screens/:id", screenAuth, deleteScreen);
router.post("/screens/:id/copy", screenAuth, copyScreen);

export default router;
