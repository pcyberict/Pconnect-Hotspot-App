import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
// Site image settings are sent as data URLs when an admin uploads an image.
// Allow the documented 5MB image limit plus base64/request overhead.
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// API responses contain authenticated and frequently changing application
// state. Prevent browsers and reverse proxies from turning a fresh settings
// read into an empty 304 response after an admin saves changes.
app.disable("etag");
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.use("/api", router);

export default app;
