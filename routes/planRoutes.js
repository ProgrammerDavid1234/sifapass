import express from "express";
import { createPlan, getAllPlans, updatePlan, deletePlan } from "../controllers/planController.js";

const router = express.Router();

router.post("/", createPlan);
router.get("/", getAllPlans);
router.put("/:id", updatePlan);
router.delete("/:id", deletePlan);

export default router;
