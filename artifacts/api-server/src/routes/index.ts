import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pconnectRouter from "./pconnect";

const router: IRouter = Router();

router.use(healthRouter);
router.use(pconnectRouter);

export default router;
