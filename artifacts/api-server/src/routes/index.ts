import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog";
import storageRouter from "./storage";
import communityRouter from "./community";

const router: IRouter = Router();

router.use(healthRouter);
router.use(catalogRouter);
router.use(storageRouter);
router.use(communityRouter);

export default router;
