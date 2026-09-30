import { useEffect, useRef, useState } from "react";
import { useLocalMedia, useVideoCall } from "@arabaykaa/react-webrtc-call";

const SIGNALING_URL = "ws://localhost:8080";
// Режим «только аудио» включается добавлением ?audio к адресу страницы
const audioOnly = new URLSearchParams(window.location.search).has("audio");

function Video({
  stream,
  muted = false,
}: {
  stream: MediaStream | null;
  muted?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      style={{ width: 320, height: 240, background: "#222", borderRadius: 8 }}
    />
  );
}

export default function App() {
  const [roomId, setRoomId] = useState("test-room");
  const [joined, setJoined] = useState(false);

  const { stream, error: mediaError } = useLocalMedia({
    video: !audioOnly,
    audio: true,
  });
  const { status, error, participants } = useVideoCall({
    signalingUrl: SIGNALING_URL,
    roomId,
    localStream: stream,
    enabled: joined,
  });

  if (mediaError)
    return <p>Ошибка доступа к устройствам: {mediaError.message}</p>;

  return (
    <div style={{ padding: 16, fontFamily: "sans-serif" }}>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <input
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          disabled={joined}
        />
        <button onClick={() => setJoined((j) => !j)} disabled={!stream}>
          {joined ? "Выйти" : "Войти"}
        </button>
        <span>
          Статус: {status}
          {audioOnly && " (только аудио)"}
        </span>
      </div>

      {error && <p style={{ color: "red" }}>{error.message}</p>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <div>
          <Video stream={stream} muted />
          <div>Вы</div>
        </div>

        {participants.map((p) => (
          <div key={p.peerId}>
            <Video stream={p.stream} />
            <div>
              {p.peerId.slice(0, 8)} — {p.connectionState}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
