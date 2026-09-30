// Type of data that participants will send each other via server
export type SignalData =
  | { type: "description"; description: RTCSessionDescriptionInit } // offer or answer
  | { type: "candidate"; candidate: RTCIceCandidateInit }; // ICE-candidate

// Type of message that client will send to a client
type ClientMessage =
  | { type: "join"; roomId: string }
  | { type: "signal"; to: string; data: SignalData };

// Type of message that server will send to a client
type ServerMessage =
  | { type: "joined"; peerId: string; peers: string[] }
  | { type: "peer-joined"; peerId: string }
  | { type: "peer-left"; peerId: string }
  | { type: "signal"; from: string; data: SignalData };

// Type of availabel events to subscribe outro
export interface SignalingEvents {
  joined: (peerId: string, peers: string[]) => void;
  peerJoined: (peerId: string) => void;
  peerLeft: (peerId: string) => void;
  signal: (from: string, data: SignalData) => void;
  close: () => void;
}

type Listener = (...args: unknown[]) => void;

export class SignalingClient {
  private ws: WebSocket | null = null;
  private listeners = new Map<keyof SignalingEvents, Set<Listener>>();

  constructor(private readonly url: string) {}

  // Connecting to a server, Promise will end when connection will open
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;

      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error(`Cannot connect to ${this.url}`));
      ws.onclose = () => this.emit("close");
      ws.onmessage = (e) => this.handleMessage(e.data);
    });
  }

  join(roomId: string) {
    this.send({ type: "join", roomId });
  }

  sendSignal(to: string, data: SignalData) {
    this.send({ type: "signal", to, data });
  }

  // Subscription on event (returning function to unsubscribe)
  on<K extends keyof SignalingEvents>(
    event: K,
    callback: SignalingEvents[K],
  ): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    const set = this.listeners.get(event)!;
    set.add(callback as Listener);
    return () => set.delete(callback as Listener);
  }

  disconnect() {
    this.listeners.clear();
    this.ws?.close();
    this.ws = null;
  }

  private send(message: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private emit<K extends keyof SignalingEvents>(
    event: K,
    ...args: Parameters<SignalingEvents[K]>
  ) {
    this.listeners.get(event)?.forEach((callback) => callback(...args));
  }

  private handleMessage(raw: unknown) {
    let message: ServerMessage;
    try {
      message = JSON.parse(String(raw)) as ServerMessage;
    } catch {
      return;
    }

    switch (message.type) {
      case "joined":
        this.emit("joined", message.peerId, message.peers);
        break;
      case "peer-joined":
        this.emit("peerJoined", message.peerId);
        break;
      case "peer-left":
        this.emit("peerLeft", message.peerId);
        break;
      case "signal":
        this.emit("signal", message.from, message.data);
        break;
    }
  }
}
