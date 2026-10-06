import { useEffect, useRef, useState } from "react";
import { useLocalMedia, useVideoCall } from "react-webrtc-call";
import "./App.css";

const SIGNALING_URL = "ws://localhost:8080";
// Режим «только аудио» включается добавлением ?audio к адресу страницы
const audioOnly = new URLSearchParams(window.location.search).has("audio");

function statusDotClass(state: string) {
  if (state === "connected" || state === "completed")
    return "status-dot status-dot--connected";
  if (state === "failed" || state === "disconnected" || state === "closed")
    return "status-dot status-dot--failed";
  if (state === "connecting" || state === "new" || state === "checking")
    return "status-dot status-dot--connecting";
  return "status-dot";
}

function Video({
  stream,
  muted = false,
  self = false,
  label,
  connectionState,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  self?: boolean;
  label: string;
  connectionState?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <div className={`video-tile${self ? " video-tile--self" : ""}`}>
      {stream ? (
        <video ref={ref} autoPlay playsInline muted={muted} />
      ) : (
        <div className="video-tile__empty">Нет видео</div>
      )}
      <div className="video-tile__label">
        {connectionState && (
          <span className={statusDotClass(connectionState)} />
        )}
        {label}
      </div>
    </div>
  );
}

export default function App() {
  const [roomId, setRoomId] = useState("test-room");
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState("");
  const [touched, setTouched] = useState({ name: false, roomId: false });

  const nameValid = name.trim().length > 0;
  const roomIdValid = roomId.trim().length > 0;
  const canJoin = nameValid && roomIdValid;

  const { stream, error: mediaError } = useLocalMedia({
    video: !audioOnly,
    audio: true,
  });
  const { status, error, participants } = useVideoCall({
    signalingUrl: SIGNALING_URL,
    roomId,
    name: name || "Guest",
    localStream: stream,
    enabled: joined,
  });

  if (mediaError)
    return (
      <div className="call">
        <p className="error-banner">
          Ошибка доступа к устройствам: {mediaError.message}
        </p>
      </div>
    );

  return (
    <div className="call">
      <div className="call-bar">
        <div className="call-bar__field">
          <label htmlFor="user-name">
            Имя <span className="required-mark">*</span>
          </label>
          <input
            id="user-name"
            className={`room-input${
              touched.name && !nameValid ? " room-input--invalid" : ""
            }`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            disabled={joined}
            placeholder="Ваше имя"
            required
          />
        </div>
        <div className="call-bar__field">
          <label htmlFor="room-id">
            Комната <span className="required-mark">*</span>
          </label>
          <input
            id="room-id"
            className={`room-input${
              touched.roomId && !roomIdValid ? " room-input--invalid" : ""
            }`}
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, roomId: true }))}
            disabled={joined}
            placeholder="Название комнаты"
            required
          />
        </div>

        <button
          className={`join-button${joined ? " join-button--leave" : ""}`}
          onClick={() => setJoined((j) => !j)}
          disabled={!stream || (!joined && !canJoin)}
        >
          {joined ? "Выйти" : "Войти"}
        </button>

        <span className="status-pill">
          <span className={statusDotClass(status)} />
          {status}
          {audioOnly && " · только аудио"}
        </span>
      </div>

      {error && <p className="error-banner">{error.message}</p>}

      <div className="video-grid">
        <Video stream={stream} muted self label="Вы" />

        {participants.map((p) => (
          <Video
            key={p.peerId}
            stream={p.stream}
            label={p.name}
            connectionState={p.connectionState}
          />
        ))}
      </div>
    </div>
  );
}
