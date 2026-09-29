import { useEffect, useRef } from "react";
import { useLocalMedia } from "@arabaykaa/react-webrtc-call";

export default function App() {
  const { stream, error } = useLocalMedia();
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  if (error) return <p>Ошибка: {error.message}</p>;
  return <video ref={ref} autoPlay playsInline muted style={{ width: 480 }} />;
}
