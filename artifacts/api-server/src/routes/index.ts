import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog";
import storageRouter from "./storage";
import communityRouter from "./community";
import gameNightsRouter from "./gameNights";

const router: IRouter = Router();

router.use(healthRouter);
router.use(catalogRouter);
router.use(storageRouter);
router.use(communityRouter);
router.use(gameNightsRouter);

export default router;
