# @arabaykaa/react-webrtc-call

React-хуки для P2P видеозвонков на WebRTC. Без SFU/TURN-инфраструктуры "из коробки" — пакет даёт вам сигналинг-клиент и готовые React-хуки, а медиапотоки идут напрямую между браузерами.

- 🎥 `useLocalMedia` — доступ к камере/микрофону
- 🤝 `useVideoCall` — подключение к комнате, обмен сигналами, список участников с их стримами
- 🔌 Минимальный WebSocket-сервер сигналинга включён в репозиторий (`signaling-server/`)
- 📦 ESM + CJS, есть типы TypeScript

## Содержание

- [Установка](#установка)
- [Быстрый старт](#быстрый-старт)
- [Сигналинг-сервер](#сигналинг-сервер)
- [API](#api)
  - [`useLocalMedia`](#uselocalmedia)
  - [`useVideoCall`](#usevideocall)
  - [`SignalingClient`](#signalingclient)
  - [`PeerConnection`](#peerconnection)
- [Playground (демо)](#playground-демо)
- [Как это работает](#как-это-работает)
- [Лицензия](#лицензия)

## Установка

```bash
npm install @arabaykaa/react-webrtc-call
```

Пакет требует `react >= 18` как peer dependency.

## Быстрый старт

```tsx
import { useLocalMedia, useVideoCall } from "@arabaykaa/react-webrtc-call";

function Call() {
  const { stream, error: mediaError } = useLocalMedia({ video: true, audio: true });

  const { status, error, participants } = useVideoCall({
    signalingUrl: "ws://localhost:8080",
    roomId: "my-room",
    name: "Alice",
    localStream: stream,
    enabled: !!stream,
  });

  if (mediaError) return <p>Нет доступа к камере/микрофону: {mediaError.message}</p>;

  return (
    <div>
      <p>Статус: {status}</p>
      {error && <p>Ошибка: {error.message}</p>}

      <video autoPlay playsInline muted ref={(el) => el && (el.srcObject = stream)} />

      {participants.map((p) => (
        <video
          key={p.peerId}
          autoPlay
          playsInline
          ref={(el) => el && (el.srcObject = p.stream)}
        />
      ))}
    </div>
  );
}
```

Для работы нужен запущенный сигналинг-сервер (см. ниже) — он используется только для обмена SDP/ICE, видео и аудио идут peer-to-peer.

## Сигналинг-сервер

В репозитории есть готовый минимальный сервер на `ws` (`signaling-server/server.js`). Он хранит комнаты в памяти и рассылает участникам события `joined` / `peer-joined` / `peer-left` / `signal`.

```bash
cd signaling-server
npm install
node server.js
# Signaling server running on ws://localhost:8080
```

Это референсная реализация — для продакшена замените хранение комнат в памяти на подходящее вам решение (Redis и т.п.) и добавьте авторизацию/лимиты, сохранив тот же протокол сообщений.

## API

### `useLocalMedia`

Запрашивает `getUserMedia` и отдаёт локальный поток. Поток автоматически останавливается при размонтировании компонента.

```ts
const { stream, error } = useLocalMedia(constraints?: MediaStreamConstraints);
```

| Параметр | Тип | По умолчанию | Описание |
|---|---|---|---|
| `constraints` | `MediaStreamConstraints` | `{ video: true, audio: true }` | Ограничения для `getUserMedia` |

Возвращает:

| Поле | Тип | Описание |
|---|---|---|
| `stream` | `MediaStream \| null` | Локальный медиапоток или `null`, пока не получен |
| `error` | `Error \| null` | Ошибка доступа к устройствам |

### `useVideoCall`

Подключается к сигналинг-серверу, входит в комнату и управляет WebRTC-соединениями со всеми участниками.

```ts
const { status, error, participants } = useVideoCall(options: UseVideoCallOptions);
```

Опции (`UseVideoCallOptions`):

| Параметр | Тип | Обязателен | Описание |
|---|---|---|---|
| `signalingUrl` | `string` | да | Адрес WebSocket сигналинг-сервера, напр. `ws://localhost:8080` |
| `roomId` | `string` | да | Идентификатор комнаты |
| `localStream` | `MediaStream \| null` | да | Локальный поток (например, из `useLocalMedia`) |
| `name` | `string` | нет | Имя участника, по умолчанию `"Guest"` |
| `iceServers` | `RTCIceServer[]` | нет | Свои STUN/TURN-серверы. По умолчанию используется публичный STUN Google |
| `enabled` | `boolean` | нет | Включает/выключает звонок, по умолчанию `true` |

Пока `enabled` равен `false` или `localStream` равен `null`, подключение не устанавливается. Изменение `signalingUrl`, `roomId`, `localStream` или `enabled` пересоздаёт соединение с нуля.

Возвращает:

| Поле | Тип | Описание |
|---|---|---|
| `status` | `"idle" \| "connecting" \| "connected" \| "error"` | Текущий статус звонка |
| `error` | `Error \| null` | Ошибка подключения к сигналинг-серверу |
| `participants` | `RemoteParticipant[]` | Список удалённых участников |

`RemoteParticipant`:

| Поле | Тип | Описание |
|---|---|---|
| `peerId` | `string` | Уникальный id участника |
| `name` | `string` | Имя, с которым участник вошёл в комнату |
| `stream` | `MediaStream \| null` | Медиапоток участника (появляется после установления соединения) |
| `connectionState` | `RTCPeerConnectionState` | Состояние WebRTC-соединения с этим участником |

### `SignalingClient`

Низкоуровневый клиент сигналинга поверх WebSocket. Используется внутри `useVideoCall`, но экспортируется отдельно для кастомных сценариев.

```ts
import { SignalingClient } from "@arabaykaa/react-webrtc-call";

const signaling = new SignalingClient("ws://localhost:8080");

await signaling.connect();
signaling.join("room-id", "Alice");

signaling.on("joined", (peerId, peers) => { /* ... */ });
signaling.on("peerJoined", (peer) => { /* ... */ });
signaling.on("peerLeft", (peerId) => { /* ... */ });
signaling.on("signal", (from, data) => { /* ... */ });
signaling.on("close", () => { /* ... */ });

signaling.sendSignal(peerId, data);
signaling.disconnect();
```

### `PeerConnection`

Обёртка над `RTCPeerConnection`, реализующая "вежливый/невежливый" (polite/impolite) перекат при одновременном обмене offer'ами (perfect negotiation pattern). Тоже используется внутри `useVideoCall`.

```ts
import { PeerConnection } from "@arabaykaa/react-webrtc-call";

const peer = new PeerConnection({
  remotePeerId: "peer-id",
  polite: true, // true — для тех, кто уже был в комнате; false — для новых участников
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  sendSignal: (data) => signaling.sendSignal("peer-id", data),
  onRemoteStream: (stream) => { /* ... */ },
  onStateChange: (state) => { /* ... */ },
});

peer.addLocalStream(localStream);
peer.handleSignal(data); // данные, пришедшие через SignalingClient
peer.close();
```

## Playground (демо)

В папке `playground/` лежит готовое demo-приложение на Vite + React, использующее пакет.

```bash
# 1. Собрать пакет
npm run build

# 2. Запустить сигналинг-сервер
cd signaling-server && npm install && node server.js

# 3. В другом терминале — запустить playground
cd playground
npm install
npm run dev
```

Откройте указанный Vite адрес в двух вкладках/браузерах, введите одинаковый `roomId` — и увидите видео друг друга. Добавьте `?audio` к адресу страницы, чтобы войти в режиме "только аудио".

## Как это работает

1. Клиент получает локальный медиапоток через `useLocalMedia`.
2. `useVideoCall` подключается к сигналинг-серверу по WebSocket и входит в комнату (`roomId`).
3. Сервер сообщает новому участнику список тех, кто уже в комнате, и уведомляет остальных о новом участнике.
4. Для каждой пары участников создаётся `RTCPeerConnection`; SDP-offer/answer и ICE-кандидаты передаются через сигналинг-сервер, а не напрямую.
5. После обмена ICE-кандидатами видео/аудио начинают идти peer-to-peer, минуя сервер.
6. Сигналинг-сервер используется только для координации подключения — он не видит и не передаёт содержимое звонка.

## Лицензия

MIT
