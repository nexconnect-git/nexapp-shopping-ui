import { signal } from '@angular/core';
import { openAuthenticatedWebSocket } from '@shared/public-api';

/** Reconnects with the current access token and releases every timer on close. */
export class AdminLiveSocket {
  state = signal<
    'connecting' | 'connected' | 'reconnecting' | 'paused' | 'closed'
  >('connecting');
  lastMessage = signal<Date | null>(null);
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  private socket?: WebSocket;
  private disposed = false;
  private retries = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private handshake?: ReturnType<typeof setTimeout>;
  constructor(
    private path: string,
    private token: () => string | null,
    private baseUrl: string,
    private factory = openAuthenticatedWebSocket
  ) {
    this.connect();
  }
  private connect() {
    if (this.disposed) return;
    const token = this.token();
    if (!token) {
      this.state.set('closed');
      return;
    }
    if (typeof document !== 'undefined' && document.hidden) {
      this.state.set('paused');
      this.timer = setTimeout(() => this.connect(), 5000);
      return;
    }
    this.state.set(this.retries ? 'reconnecting' : 'connecting');
    try {
      const socket = this.factory(this.path, token, this.baseUrl);
      this.socket = socket;
      this.handshake = setTimeout(() => {
        socket.onclose = null;
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.close();
        if (!this.disposed) this.schedule();
      }, 10000);
      socket.onopen = () => {
        if (this.disposed) return;
        clearTimeout(this.handshake);
        this.retries = 0;
        this.state.set('connected');
      };
      socket.onmessage = (event) => {
        if (this.disposed) return;
        this.lastMessage.set(new Date());
        try {
          this.onmessage?.(event);
        } catch {
          this.onerror?.(new Event('invalid-message'));
        }
      };
      socket.onerror = (event) => {
        if (!this.disposed) this.onerror?.(event);
      };
      socket.onclose = (event) => {
        clearTimeout(this.handshake);
        if (this.disposed) return;
        if ([1008, 4001, 4401, 4403].includes(event.code)) {
          this.state.set('closed');
          return;
        }
        this.schedule();
      };
    } catch {
      this.schedule();
    }
  }
  private schedule() {
    clearTimeout(this.timer);
    this.state.set('reconnecting');
    this.timer = setTimeout(
      () => this.connect(),
      Math.min(30000, 1000 * 2 ** Math.min(this.retries++, 5))
    );
  }
  close() {
    this.disposed = true;
    clearTimeout(this.timer);
    clearTimeout(this.handshake);
    if (this.socket) {
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.onclose = null;
      this.socket.onopen = null;
      this.socket.close();
    }
    this.state.set('closed');
  }
}

export function openAdminLiveSocket(
  path: string,
  token: () => string | null,
  baseUrl: string
) {
  return new AdminLiveSocket(path, token, baseUrl);
}
