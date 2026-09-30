import { WebSocketServer } from "ws";
import { randomUUID } from "crypto";

const wss = new WebSocketServer({ port: 8080 });
const rooms = new Map(); // roomId -> Map<peerId, { ws, name }>

wss.on("connection", (ws) => {
  const peerId = randomUUID();
  let roomId = null;

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === "join") {
      roomId = msg.roomId;
      const name = String(msg.name || "Guest").slice(0, 50);

      if (!rooms.has(roomId)) rooms.set(roomId, new Map());
      const room = rooms.get(roomId);

      const peers = [...room].map(([id, p]) => ({ peerId: id, name: p.name }));
      ws.send(JSON.stringify({ type: "joined", peerId, peers }));
      room.forEach((other) =>
        other.ws.send(JSON.stringify({ type: "peer-joined", peerId, name })),
      );

      room.set(peerId, { ws, name });
    }

    if (msg.type === "signal" && roomId) {
      const target = rooms.get(roomId)?.get(msg.to);
      target?.ws.send(
        JSON.stringify({ type: "signal", from: peerId, data: msg.data }),
      );
    }
  });

  ws.on("close", () => {
    if (!roomId) return;
    const room = rooms.get(roomId);
    room?.delete(peerId);
    room?.forEach((other) =>
      other.ws.send(JSON.stringify({ type: "peer-left", peerId })),
    );
    if (room?.size === 0) rooms.delete(roomId);
  });
});

console.log("Signaling server running on ws://localhost:8080");
