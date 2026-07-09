import app from "./app";
import { logger } from "./lib/logger";
import { bootstrapDatabase } from "./lib/bootstrap";

const rawPort = process.env["PORT"] || "5000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

bootstrapDatabase()
  .then(() => {
    const server = app.listen(port, "0.0.0.0", () => {
      logger.info({ port }, "Server listening on http://0.0.0.0:" + port);
    });
    server.on("error", (err) => {
      logger.error({ err }, "Error starting server");
      process.exit(1);
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to bootstrap database, exiting");
    process.exit(1);
  });
