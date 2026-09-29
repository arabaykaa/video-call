import { useEffect, useState } from "react";

export function useLocalMedia(
  constraints: MediaStreamConstraints = { video: true, audio: true },
) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    let local: MediaStream | null = null;

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((s) => {
        if (!active) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        local = s;
        setStream(s);
      })
      .catch((err) => {
        setError(err);
      });

    return () => {
      active = false;
      local?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { stream, error };
}
