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
  return `${basePrefix}${normalizedPath}`.replace(/\/{2,}/g, '/');
}

export function openAuthenticatedWebSocket(
  path: string,
  token: string | null,
  apiBaseUrl?: string,
): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsPath = resolveWsPath(path, apiBaseUrl);
  const wsUrl = `${protocol}//${window.location.host}${wsPath}`;

  if (token) {
    return new WebSocket(wsUrl, [WS_AUTH_SUBPROTOCOL, token]);
  }

  return new WebSocket(wsUrl);
}
