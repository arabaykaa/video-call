import type { SignalData } from "./signaling-client";

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

export interface PeerConnectionOptions {
  remotePeerId: string;
  polite: boolean;
  iceServers?: RTCIceServer[];
  sendSignal: (data: SignalData) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onStateChange?: (state: RTCPeerConnectionState) => void;
}

export class PeerConnection {
  readonly remotePeerId: string;
  private pc: RTCPeerConnection;
  private makingOffer = false;
  private ignoreOffer = false;
  private remoteStream = new MediaStream();

  constructor(private readonly options: PeerConnectionOptions) {
    this.remotePeerId = options.remotePeerId;
    this.pc = new RTCPeerConnection({
      iceServers: options.iceServers ?? DEFAULT_ICE_SERVERS,
    });

    // Браузер сообщает: «нужно (пере)согласовать соединение» — создаём offer
    this.pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await this.pc.setLocalDescription();
        this.sendDescription();
      } catch (err) {
        console.error("[PeerConnection] negotiation failed", err);
      } finally {
        this.makingOffer = false;
      }
    };

    // Браузер нашёл новый сетевой маршрут — отправляем его собеседнику
    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.options.sendSignal({
          type: "candidate",
          candidate: candidate.toJSON(),
        });
      }
    };

    // От собеседника пришла дорожка (видео или аудио)
    this.pc.ontrack = ({ track }) => {
      this.remoteStream.addTrack(track);
      this.options.onRemoteStream(this.remoteStream);
    };

    // Изменилось состояние соединения: connecting, connected, failed...
    this.pc.onconnectionstatechange = () => {
      this.options.onStateChange?.(this.pc.connectionState);
    };
  }

  addLocalStream(stream: MediaStream) {
    stream.getTracks().forEach((track) => this.pc.addTrack(track, stream));
  }

  // Обработка сообщения от собеседника (пришло через сигналинг-сервер)
  async handleSignal(data: SignalData) {
    try {
      if (data.type === "description") {
        const { description } = data;

        const offerCollision =
          description.type === "offer" &&
          (this.makingOffer || this.pc.signalingState !== "stable");

        this.ignoreOffer = !this.options.polite && offerCollision;
        if (this.ignoreOffer) return;

        await this.pc.setRemoteDescription(description);

        if (description.type === "offer") {
          await this.pc.setLocalDescription();
          this.sendDescription();
        }
      } else {
        try {
          await this.pc.addIceCandidate(data.candidate);
        } catch (err) {
          if (!this.ignoreOffer) throw err;
        }
      }
    } catch (err) {
      console.error("[PeerConnection] failed to handle signal", err);
    }
  }

  close() {
    this.pc.close();
  }

  private sendDescription() {
    const description = this.pc.localDescription;
    if (description) {
      this.options.sendSignal({
        type: "description",
        description: description.toJSON(),
      });
    }
  }
}
