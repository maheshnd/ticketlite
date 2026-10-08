// Mutation.publishSeatUpdate (IAM only, called by the booking saga). A NONE data source resolver: it
// writes nothing. AppSync simply returns the input, and every client subscribed to onSeatUpdate for that
// eventId receives it over its WebSocket. CONCEPT: real-time
import { type Context, util } from "@aws-appsync/utils";

export function request(ctx: Context<{ input: { eventId: string; availableSeats: number } }>) {
  return { payload: { ...ctx.args.input, updatedAt: util.time.nowISO8601() } };
}

export function response(ctx: Context) {
  return ctx.result;
}
