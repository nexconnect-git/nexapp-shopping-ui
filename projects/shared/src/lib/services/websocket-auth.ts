const WS_AUTH_SUBPROTOCOL = 'nexconnect.jwt';

export function openAuthenticatedWebSocket(
  path: string,
  token: string | null,
): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}${path}`;

  if (token) {
    return new WebSocket(wsUrl, [WS_AUTH_SUBPROTOCOL, token]);
  }

  return new WebSocket(wsUrl);
}
