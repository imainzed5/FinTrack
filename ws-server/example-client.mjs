import WebSocket from 'ws';

const WS_URL = process.env.WS_URL ?? 'ws://localhost:8080';
const client = new WebSocket(WS_URL);

function send(type, payload) {
  const message = { type, payload };
  client.send(JSON.stringify(message));
  console.log('[client] sent:', message);
}

client.on('open', () => {
  console.log(`[client] connected to ${WS_URL}`);

  const now = new Date().toISOString();

  send('transaction:add', {
    id: 'tx-demo-1',
    amount: 24.5,
    category: 'Food',
    description: 'Lunch',
    date: now,
  });

  setTimeout(() => {
    send('transaction:edit', {
      id: 'tx-demo-1',
      amount: 27,
      category: 'Food',
      description: 'Lunch + drink',
      date: now,
    });
  }, 1500);

  setTimeout(() => {
    send('transaction:delete', {
      id: 'tx-demo-1',
    });
  }, 3000);

  setTimeout(() => {
    client.close();
  }, 4500);
});

client.on('message', (data) => {
  try {
    const parsed = JSON.parse(data.toString());
    console.log('[client] received:', parsed);
  } catch {
    console.log('[client] received non-JSON message:', data.toString());
  }
});

client.on('close', (code, reasonBuffer) => {
  const reason = reasonBuffer?.toString() || '(no reason)';
  console.log(`[client] disconnected. code=${code} reason=${reason}`);
});

client.on('error', (error) => {
  console.error('[client] socket error:', error.message);
});
