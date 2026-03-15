import { WebSocket, WebSocketServer } from 'ws';

const PORT = Number.parseInt(process.env.WS_PORT ?? '8080', 10);
const wss = new WebSocketServer({ port: PORT });

let nextClientNumber = 1;

function sendJson(socket, message) {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(message));
}

function broadcast(message) {
  const serialized = JSON.stringify(message);

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(serialized);
    }
  }
}

function buildUpdate(incomingType, payload, sourceClientId) {
  const [resource, action] = incomingType.split(':');

  return {
    type: `${resource}:update`,
    action,
    payload,
    sourceClientId,
    timestamp: new Date().toISOString(),
  };
}

function parseIncomingMessage(rawData) {
  let parsed;

  try {
    parsed = JSON.parse(rawData.toString());
  } catch {
    return {
      ok: false,
      error: 'Invalid JSON payload. Expected a JSON object.',
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      ok: false,
      error: 'Message must be a JSON object.',
    };
  }

  const allowedTypes = new Set([
    'transaction:add',
    'transaction:edit',
    'transaction:delete',
    'budget:add',
    'budget:edit',
    'budget:delete',
  ]);

  if (!allowedTypes.has(parsed.type)) {
    return {
      ok: false,
      error: 'Unsupported message type. Use transaction:add|edit|delete or budget:add|edit|delete.',
    };
  }

  return {
    ok: true,
    value: {
      type: parsed.type,
      payload: parsed.payload ?? null,
    },
  };
}

wss.on('connection', (socket) => {
  const clientId = `client-${nextClientNumber++}`;

  console.log(`[ws] ${clientId} connected. totalClients=${wss.clients.size}`);

  sendJson(socket, {
    type: 'system:welcome',
    clientId,
    message: 'Connected to expense tracker WebSocket server.',
    serverTime: new Date().toISOString(),
  });

  socket.on('message', (rawData) => {
    const incoming = parseIncomingMessage(rawData);

    if (!incoming.ok) {
      sendJson(socket, {
        type: 'system:error',
        message: incoming.error,
      });
      return;
    }

    const update = buildUpdate(incoming.value.type, incoming.value.payload, clientId);
    broadcast(update);
  });

  socket.on('close', () => {
    console.log(`[ws] ${clientId} disconnected. totalClients=${wss.clients.size}`);
  });

  socket.on('error', (error) => {
    console.error(`[ws] ${clientId} socket error:`, error.message);
  });
});

wss.on('listening', () => {
  console.log(`[ws] server listening on ws://localhost:${PORT}`);
  console.log('[ws] accepted message types: transaction:add|edit|delete and budget:add|edit|delete');
});

wss.on('error', (error) => {
  console.error('[ws] server error:', error.message);
});

function shutdown() {
  console.log('[ws] shutting down WebSocket server...');

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.close(1001, 'Server shutting down');
    }
  }

  wss.close(() => {
    console.log('[ws] server closed');
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
