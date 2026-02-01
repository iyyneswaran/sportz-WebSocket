import { WebSocket, WebSocketServer } from "ws";

/**
 * Sends a JSON-serialized payload over the socket only if the socket is open.
 * 
 * @param {WebSocket} socket - The WebSocket to send the message on.
 * @param {*} payload - The value to serialize with JSON.stringify and transmit.
 */
function sendJson(socket, payload) {
    if (socket.readyState !== WebSocket.OPEN) return;

    socket.send(JSON.stringify(payload))
}

/**
 * Broadcasts a JSON-serializable payload to all connected WebSocket clients that are open.
 * @param {import('ws').WebSocketServer} wss - WebSocket server whose clients will receive the payload.
 * @param {any} payload - Value that will be serialized with `JSON.stringify` and sent to each open client.
 */
function broadcast(wss, payload) {
    for (const client of wss.clients) {
        if (client.readyState !== WebSocket.OPEN) continue;

        client.send(JSON.stringify(payload))
    }
}

/**
 * Attach a WebSocket server to an existing HTTP/S server and expose helpers for broadcasting events.
 *
 * @param {import('http').Server|import('https').Server} server - The HTTP or HTTPS server to bind the WebSocket server to.
 * @returns {{ broadcastMatchCreated: (match: any) => void }} An object containing helpers:
 *  - `broadcastMatchCreated(match)`: broadcasts a `match_created` event with the provided match data to all connected clients.
 */
export function attachWebSocketServer(server) {
    const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 1024 * 1024 })

    wss.on('connection', (socket) => {
        sendJson(socket, { type: 'welcome' });

        socket.on('error', console.error);
    })

    function broadcastMatchCreated(match) {
        broadcast(wss, { type: 'match_created', data: match });
    }

    return { broadcastMatchCreated }
}