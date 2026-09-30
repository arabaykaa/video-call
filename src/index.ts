export { useLocalMedia } from "./react/use-local-media";

export { useVideoCall } from "./react/use-video-call";
export type {
  UseVideoCallOptions,
  RemoteParticipant,
  CallStatus,
} from "./react/use-video-call";

export { SignalingClient } from "./core/signaling-client";
export type {
  SignalData,
  SignalingEvents,
  PeerInfo,
} from "./core/signaling-client";

export { PeerConnection } from "./core/peer-connection";
export type { PeerConnectionOptions } from "./core/peer-connection";
