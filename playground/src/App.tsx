import { useEffect, useRef } from "react";
import { useLocalMedia } from "@arabaykaa/react-webrtc-call";

export default function App() {
  const { stream, error } = useLocalMedia({ video: false, audio: true });
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  if (error) return <p>Ошибка: {error.message}</p>;
  return (
    <p>
      {stream
        ? `Микрофон подключён: ${stream.getAudioTracks()[0]?.label}`
        : "Запрашиваю доступ..."}
    </p>
  );
}
