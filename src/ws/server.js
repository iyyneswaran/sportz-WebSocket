import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../arcjet.js";

const matchSubscribers = new Map();

function subscribe(matchId, socket) {
    if (!matchSubscribers.has(matchId)) {
        matchSubscribers.set(matchId, new Set());
    }

    matchSubscribers.get(matchId).add(socket)
}

function unsubscribe(matchId, socket) {
    const subscribers = matchSubscribers.get(matchId);

    if (!subscribers) return;

    subscribers.delete(socket);

    if (subscribers.size === 0) {
        matchSubscribers.delete(matchId);
    }
}

function cleanupSubscriptions(socket) {
    if (!socket.subscriptions) return;
    for (const matchId of socket.subscriptions) {
        unsubscribe(matchId, socket);
    }
}


function sendJson(socket, payload) {
    if (socket.readyState !== WebSocket.OPEN) return;

    socket.send(JSON.stringify(payload))
}

function broadcastToAll(wss, payload) {
    for (const client of wss.clients) {
        if (client.readyState !== WebSocket.OPEN) continue;

        client.send(JSON.stringify(payload))
    }
}

function broadcastToMatch(matchId, payload) {
    const subscribers = matchSubscribers.get(matchId);
    if (!subscribers || subscribers.size === 0) return;

    const message = JSON.stringify(payload);

    for (const client of subscribers) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
}

function handleMessage(socket, data) {
    let message;

    try {
        message = JSON.parse(data.toString());
    } catch {
        sendJson(socket, { type: "error", message: "Invalid JSON" })
        return;
    }

    if (message?.type === "subscribe" && Number.isInteger(message.matchId)) {
        subscribe(message.matchId, socket);
        socket.subscriptions.add(message.matchId);
        sendJson(socket, { type: "Subscribed", matchId: message.matchId })
        return;
    }
 
    if (message?.type === "unsubscribe" && Number.isInteger(message.matchId)) {
        unsubscribe(message.matchId,socket);
        socket.subscriptions.delete(message.matchId);
        sendJson(socket, {type: "Unsubscribed", matchId: message.matchId})
    }
}

export function attachWebSocketServer(server) {
    const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 1024 * 1024 })

    wss.on('connection', async (ws, req) => {
        if (wsArcjet) {
            try {
                if (!req.headers['user-agent']) {
                    req.headers['user-agent'] = 'Unknown';
                }
                const decision = await wsArcjet.protect(req);
                if (decision.isDenied()) {
                    ws.close(429, 'Too Many Requests');
                    return;
                } else if (decision.isChallenged()) {
                    ws.close(403, 'Forbidden');
                    return;
                }
            } catch (e) {
                console.error('WS Connection error', e);
                ws.close(500, 'Internal Server Error');
                return;
            }
        }

        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });
        ws.on('error', console.error);

        ws.subscriptions = new Set();

        sendJson(ws, { type: 'welcome' });

        ws.on('message', (data) => {
            handleMessage(ws, data);
        })

        ws.on('error', () => {
            ws.terminate();
        })

        ws.on('close', () => {
            cleanupSubscriptions(ws);
        })

    });

    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on('close', () => clearInterval(interval));

    function broadcastMatchCreated(match) {
        broadcastToAll(wss, { type: 'match_created', data: match });
    }

    function broadcastCommentary(matchId, comment) {
        broadcastToMatch(matchId, {type: 'Commentary', data: comment})
    }

    return { broadcastMatchCreated, broadcastCommentary }
}
