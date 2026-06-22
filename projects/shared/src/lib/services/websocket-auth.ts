const WS_AUTH_SUBPROTOCOL = 'nexconnect.jwt';

function resolveWsPath(path: string, apiBaseUrl?: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!apiBaseUrl) return normalizedPath;

  const apiPath = new URL(apiBaseUrl, window.location.origin).pathname.replace(
    /\/$/,
    '',
  );
  const basePrefix = apiPath.endsWith('/api')
    ? apiPath.slice(0, -4)
    : apiPath;

  if (!basePrefix || normalizedPath.startsWith(`${basePrefix}/`)) {
    return normalizedPath;
  }

  return `${basePrefix}${normalizedPath}`.replace(/\/{2,}/g, '/');
}

function resolveWsOrigin(apiBaseUrl?: string): string {
  const fallbackProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

  if (!apiBaseUrl) {
    return `${fallbackProtocol}//${window.location.host}`;
  }

  const apiUrl = new URL(apiBaseUrl, window.location.origin);
  const isAbsoluteApiUrl = /^[a-z][a-z\d+\-.]*:\/\//i.test(apiBaseUrl);

  if (!isAbsoluteApiUrl) {
    return `${fallbackProtocol}//${window.location.host}`;
  }

  const wsProtocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${apiUrl.host}`;
}

export function buildWebSocketUrl(
  socketPath: string,
  apiBaseUrl?: string,
): string {
  // Expected behavior:
  // /api + /ws/orders -> ws(s)://current-host/ws/orders
  // http://localhost:8000/api + /ws/orders -> ws://localhost:8000/ws/orders
  // https://api.example.com/sa/api + /ws/orders -> wss://api.example.com/sa/ws/orders
  return `${resolveWsOrigin(apiBaseUrl)}${resolveWsPath(socketPath, apiBaseUrl)}`;
}

export function openAuthenticatedWebSocket(
  path: string,
  token: string | null,
  apiBaseUrl?: string,
): WebSocket {
  const wsUrl = buildWebSocketUrl(path, apiBaseUrl);

  if (token) {
    return new WebSocket(wsUrl, [WS_AUTH_SUBPROTOCOL, token]);
  }

  return new WebSocket(wsUrl);
}
