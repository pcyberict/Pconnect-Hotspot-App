import { pool } from "@workspace/db";
import { seed } from "./seed";

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());