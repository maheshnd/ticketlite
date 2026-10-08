import type { FastifyInstance } from "fastify";

// Module-level variables run ONCE, when Lambda first loads this file (a cold start).
// Lambda then keeps the same process ("execution environment") for later requests (warm starts),
// so these values survive between requests:
//   - same bornAt + count going up  => warm: the same copy of the function handled it
//   - new bornAt + count back to 1  => cold: a brand-new copy was started
// Never keep user data here. Each copy has its own memory and can disappear at any time.
const bornAt = new Date().toISOString();
let count = 0;

// GET /copy-info: shows which copy of the function answered.
export function copyInfoRoutes(app: FastifyInstance) {
  app.get("/copy-info", async () => {
    count++;
    return { bornAt, count };
  });
}
