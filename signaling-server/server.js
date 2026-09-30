import { WebSocketServer } from "ws";
import { randomUUID } from "crypto";

const wss = new WebSocketServer({ port: 8080 });
const rooms = new Map();

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

    // client entering to room
    if (msg.type === "join") {
      roomId = msg.roomId;
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Map());
      }
      const room = rooms.get(roomId);

      // adding new participant id on existed participants
      ws.send(
        JSON.stringify({ type: "joined", peerId, peers: [...room.keys()] }),
      );

      // notify others about new user
      room.forEach((other) =>
        other.send(JSON.stringify({ type: "peer-joined", peerId })),
      );
      room.set(peerId, ws);
    }

    // Resending signal data (offer/answer/ICE) to exact participant
    if (msg.type === "signal" && roomId) {
      const target = rooms.get(roomId)?.get(msg.to);
      target?.send(
        JSON.stringify({ type: "signal", from: peerId, data: msg.data }),
      );
    }
  });

  ws.on("close", () => {
    if (!roomId) return;

    const room = rooms.get(roomId);
    room?.delete(peerId);
    room?.forEach((other) => {
      other.send(JSON.stringify({ type: "peer-left", peerId }));
    });
    if (room?.size === 0) rooms.delete(roomId);
  });
});

console.log("Signaling server running on ws://localhost:8080");
