// A small client for AppSync's real-time (WebSocket) protocol, written by hand so every step is visible.
// CONCEPT: real-time, websockets
//   1. open wss://<id>.appsync-realtime-api.<region>.amazonaws.com/graphql?header=<base64 auth>&payload=e30=
//   2. send connection_init           -> receive connection_ack (tells us the keep-alive timeout)
//   3. send start (query + auth)      -> receive start_ack, then a "data" message per update
//   4. receive "ka" (keep-alive) regularly; if they stop, the connection is dead: reconnect
//   5. send stop to unsubscribe, then close
import type { TypedDocumentString } from "../gql/graphql";
import { APPSYNC_URL, authHeaders } from "./appsync";

type Message = { type: string; id?: string; payload?: { data?: unknown; connectionTimeoutMs?: number } };

// One subscription on its own WebSocket. Each method is one step of the protocol above.
class AppSyncSubscription<TResult> {
  private readonly id = crypto.randomUUID();
  private readonly host = new URL(APPSYNC_URL).host; // the GraphQL host signs requests, even on the realtime domain
  private socket?: WebSocket;
  private keepAliveTimer?: ReturnType<typeof setTimeout>;
  private keepAliveMs = 300_000;
  private retryDelay = 1000;
  private stopped = false;

  constructor(
    private readonly query: string,
    private readonly variables: unknown,
    private readonly onData: (data: TResult) => void,
    private readonly WebSocketImpl: typeof WebSocket,
  ) {}

  // Step 1: the auth header goes base64-encoded in the URL (browsers can't set WebSocket headers).
  connect() {
    const realtimeHost = this.host.replace("appsync-api", "appsync-realtime-api");
    const header = btoa(JSON.stringify({ host: this.host, ...authHeaders() }));
    this.socket = new this.WebSocketImpl(`wss://${realtimeHost}/graphql?header=${header}&payload=e30=`, [
      "graphql-ws",
    ]);
    this.socket.onopen = () => this.send({ type: "connection_init" });
    this.socket.onmessage = (event) => this.handle(JSON.parse(String(event.data)) as Message);
    this.socket.onclose = () => this.reconnect();
  }

  private handle(message: Message) {
    if (message.type === "connection_ack") this.start(message.payload?.connectionTimeoutMs);
    if (message.type === "ka") this.resetKeepAlive();
    if (message.type === "data" && message.id === this.id) this.onData(message.payload?.data as TResult);
  }

  // Steps 2-3: connected; start the subscription. Its own auth goes in `extensions`.
  private start(keepAliveMs = 300_000) {
    this.retryDelay = 1000;
    this.keepAliveMs = keepAliveMs;
    this.resetKeepAlive();
    const data = JSON.stringify({ query: this.query, variables: this.variables });
    const authorization = { host: this.host, ...authHeaders() };
    this.send({ id: this.id, type: "start", payload: { data, extensions: { authorization } } });
  }

  // Step 4: every "ka" restarts the timer. If it ever runs out, close the socket (which reconnects).
  private resetKeepAlive() {
    clearTimeout(this.keepAliveTimer);
    this.keepAliveTimer = setTimeout(() => this.socket?.close(), this.keepAliveMs);
  }

  // Reconnect with exponential backoff (1s, 2s, 4s ... max 30s), unless we stopped on purpose.
  private reconnect() {
    clearTimeout(this.keepAliveTimer);
    if (!this.stopped) setTimeout(() => this.connect(), this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, 30_000);
  }

  // Step 5: unsubscribe, then close.
  stop() {
    this.stopped = true;
    clearTimeout(this.keepAliveTimer);
    if (this.socket?.readyState === this.WebSocketImpl.OPEN) this.send({ id: this.id, type: "stop" });
    this.socket?.close();
  }

  private send(message: object) {
    this.socket?.send(JSON.stringify(message));
  }
}

// Starts a subscription; returns the function that stops it (e.g. when the page unmounts).
export function subscribe<TResult, TVariables>(
  document: TypedDocumentString<TResult, TVariables>,
  variables: TVariables,
  onData: (data: TResult) => void,
  WebSocketImpl: typeof WebSocket = WebSocket, // replaceable in tests
): () => void {
  const subscription = new AppSyncSubscription<TResult>(
    document.toString(),
    variables,
    onData,
    WebSocketImpl,
  );
  subscription.connect();
  return () => subscription.stop();
}
