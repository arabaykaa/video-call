import { useEffect, useRef, useState } from "react";
import { SignalingClient, type PeerInfo } from "../core/signaling-client";
import { PeerConnection } from "../core/peer-connection";

export type CallStatus = "idle" | "connecting" | "connected" | "error";

export interface RemoteParticipant {
  peerId: string;
  name: string;
  stream: MediaStream | null;
  connectionState: RTCPeerConnectionState;
}

export interface UseVideoCallOptions {
  signalingUrl: string;
  roomId: string;
  localStream: MediaStream | null;
  name?: string;
  iceServers?: RTCIceServer[];
  enabled?: boolean;
}

export function useVideoCall({
  signalingUrl,
  roomId,
  localStream,
  name = "Guest",
  iceServers,
  enabled = true,
}: UseVideoCallOptions) {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);

  // iceServers храним в ref, чтобы новый массив на каждом рендере не перезапускал звонок
  const iceServersRef = useRef(iceServers);
  const nameRef = useRef(name);

  useEffect(() => {
    nameRef.current = name;
  });

  useEffect(() => {
    iceServersRef.current = iceServers;
  });

  useEffect(() => {
    if (!enabled || !localStream) return;

    let cancelled = false;
    const stream = localStream;
    const signaling = new SignalingClient(signalingUrl);
    const peers = new Map<string, PeerConnection>();

    const updateParticipant = (
      peerId: string,
      patch: Partial<RemoteParticipant>,
    ) => {
      setParticipants((prev) =>
        prev.map((p) => (p.peerId === peerId ? { ...p, ...patch } : p)),
      );
    };

    const createPeer = (
      { peerId, name: peerName }: PeerInfo,
      polite: boolean,
    ) => {
      const peer = new PeerConnection({
        remotePeerId: peerId,
        polite,
        iceServers: iceServersRef.current,
        sendSignal: (data) => signaling.sendSignal(peerId, data),
        onRemoteStream: (remoteStream) =>
          updateParticipant(peerId, { stream: remoteStream }),
        onStateChange: (state) =>
          updateParticipant(peerId, { connectionState: state }),
      });

      peers.set(peerId, peer);
      setParticipants((prev) => [
        ...prev.filter((p) => p.peerId !== peerId),
        { peerId, name: peerName, stream: null, connectionState: "new" },
      ]);
      peer.addLocalStream(stream);
    };

    const removePeer = (peerId: string) => {
      peers.get(peerId)?.close();
      peers.delete(peerId);
      setParticipants((prev) => prev.filter((p) => p.peerId !== peerId));
    };

    // Мы вошли: со всеми, кто уже в комнате, соединяемся как «вежливые»
    signaling.on("joined", (_myId, existingPeers) => {
      setStatus("connected");
      existingPeers.forEach((peer) => createPeer(peer, true));
    });

    // Кто-то вошёл после нас: с ним мы «невежливые»
    signaling.on("peerJoined", (peer) => createPeer(peer, false));

    signaling.on("peerLeft", removePeer);

    signaling.on("signal", (from, data) => {
      peers.get(from)?.handleSignal(data);
    });

    signaling.on("close", () => {
      if (cancelled) return;
      setStatus("error");
      setError(new Error("Connection to signaling server lost"));
    });

    setStatus("connecting");
    setError(null);

    signaling
      .connect()
      .then(() => {
        if (!cancelled) signaling.join(roomId, nameRef.current);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setStatus("error");
        setError(err);
      });

    // Очистка: выход из звонка при размонтировании или смене параметров
    return () => {
      cancelled = true;
      peers.forEach((peer) => peer.close());
      peers.clear();
      signaling.disconnect();
      setParticipants([]);
      setStatus("idle");
    };
  }, [signalingUrl, roomId, localStream, enabled]);

  return { status, error, participants };
}
