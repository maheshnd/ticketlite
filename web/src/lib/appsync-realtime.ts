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

const toBase64 = (value: object) => btoa(JSON.stringify(value));

export function subscribe<TResult, TVariables>(
  document: TypedDocumentString<TResult, TVariables>,
  variables: TVariables,
  onData: (data: TResult) => void,
  WebSocketImpl: typeof WebSocket = WebSocket, // replaceable in tests
): () => void {
  const url = new URL(APPSYNC_URL);
  const host = url.host; // the GraphQL host signs the request, even on the realtime domain
  const realtimeUrl = `wss://${host.replace("appsync-api", "appsync-realtime-api")}/graphql`;
  const id = crypto.randomUUID();
  let socket: WebSocket | undefined;
  let keepAliveTimer: ReturnType<typeof setTimeout> | undefined;
  let retryDelay = 1000;
  let closedByUs = false;

  function connect() {
    // Step 1: the auth header goes base64-encoded in the URL (browsers can't set WebSocket headers).
    const header = toBase64({ host, ...authHeaders() });
    socket = new WebSocketImpl(`${realtimeUrl}?header=${header}&payload=e30=`, ["graphql-ws"]);
    socket.onopen = () => socket?.send(JSON.stringify({ type: "connection_init" }));
    socket.onmessage = (event) => handle(JSON.parse(String(event.data)) as Message);
    socket.onclose = () => {
      clearTimeout(keepAliveTimer);
      // Reconnect with exponential backoff (1s, 2s, 4s ... max 30s), unless we closed it on purpose.
      if (!closedByUs) setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30_000);
    };
  }

  function handle(message: Message) {
    switch (message.type) {
      case "connection_ack": {
        // Step 2 done. Step 3: start the subscription. Its own auth goes in `extensions`.
        retryDelay = 1000;
        resetKeepAlive(message.payload?.connectionTimeoutMs ?? 300_000);
        const data = JSON.stringify({ query: document.toString(), variables });
        socket?.send(
          JSON.stringify({
            id,
            type: "start",
            payload: { data, extensions: { authorization: { host, ...authHeaders() } } },
          }),
        );
        break;
      }
      case "ka": // Step 4: AppSync is alive. If no "ka" arrives in time, close and reconnect.
        resetKeepAlive();
        break;
      case "data":
        if (message.id === id) onData(message.payload?.data as TResult);
        break;
    }
  }

  let timeoutMs = 300_000;
  function resetKeepAlive(newTimeout?: number) {
    if (newTimeout) timeoutMs = newTimeout;
    clearTimeout(keepAliveTimer);
    keepAliveTimer = setTimeout(() => socket?.close(), timeoutMs);
  }

  connect();

  // Step 5: the caller calls this to unsubscribe (e.g. when the page unmounts).
  return () => {
    closedByUs = true;
    clearTimeout(keepAliveTimer);
    if (socket?.readyState === WebSocketImpl.OPEN) socket.send(JSON.stringify({ id, type: "stop" }));
    socket?.close();
  };
}
