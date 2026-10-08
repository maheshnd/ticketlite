// GET /api/copy-info: shows which copy ("execution environment") of the Lambda answered.
// Call it several times: same bornAt + count going up = warm start; new bornAt + count 1 = cold start.
// CONCEPT: cold-start
import type { App } from "../types";

// Module-level variables run ONCE, when Lambda first loads this file (a cold start).
// Lambda then keeps the same process for later requests (warm starts), so these values survive between them.
// Never keep user data here: each copy has its own memory and can disappear at any time.
const bornAt = new Date().toISOString();
let count = 0;

export function copyInfoRoutes(app: App) {
  app.get("/copy-info", async () => {
    count++;
    return { bornAt, count };
  });
}
