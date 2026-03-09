const WebSocket = require("ws");

const PORT = 3001;

const wss = new WebSocket.Server({ port: PORT });

const rooms = {};

console.log("🚀 WebSocket signaling server started");
console.log("📡 Running on: ws://localhost:" + PORT);

wss.on("connection", (ws) => {
  console.log("✅ New client connected");

  ws.on("message", (message) => {
    const data = JSON.parse(message);
    const room = data.room;

    if (!rooms[room]) {
      rooms[room] = [];
    }

    if (!rooms[room].includes(ws)) {
      rooms[room].push(ws);
    }

    rooms[room].forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  });

  ws.on("close", () => {
    console.log("❌ Client disconnected");
  });
});