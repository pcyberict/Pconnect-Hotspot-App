import app from "./app";
import { bootstrapDatabase } from "./bootstrap";
import { logger } from "./lib/logger";

// Coolify uses PORT for the public container port (80 in the combined image).
// Keep the API's internal port independently configurable.
const rawPort = process.env["API_PORT"] ?? process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await bootstrapDatabase();
logger.info("Database schema and seed data are ready");

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
