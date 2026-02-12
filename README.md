# Periyar Scale WebSocket Server

Real-time WebSocket server for Periyar Scale weight monitoring system.

## 🚀 Features

- ✅ WebSocket server on `/ws` endpoint
- ✅ Multi-client support (ESP32 + Dashboards)
- ✅ Real-time data broadcasting
- ✅ Historical data storage (last 100 readings)
- ✅ Health check endpoint
- ✅ Automatic reconnection handling
- ✅ Client registration & tracking
- ✅ Comprehensive logging

## 📦 Installation

```bash
npm install
```

## 🏃 Running Locally

```bash
npm start
```

Server will start on `http://localhost:8080`

## 🌐 WebSocket Connection

**Local:**
```
ws://localhost:8080/ws
```

**Production (Render):**
```
wss://your-app-name.onrender.com/ws
```

## 📡 Message Format

### From ESP32/Client (Weight Data):
```json
{
  "weight": 1234,
  "unit": "g",
  "scaleId": 1,
  "timestamp": 1234567890
}
```

### From Server to Clients:
```json
{
  "type": "weight",
  "data": {
    "weight": 1234,
    "unit": "g",
    "scaleId": 1,
    "timestamp": 1234567890,
    "datetime": "2026-02-12T18:30:00.000Z"
  }
}
```

### Client Registration:
```json
{
  "type": "register",
  "clientType": "dashboard",
  "scaleId": 1
}
```

## 🔍 Health Check

Visit: `http://localhost:8080/health`

Response:
```json
{
  "status": "ok",
  "uptime": 123.45,
  "connections": 3,
  "timestamp": "2026-02-12T18:30:00.000Z"
}
```

## 🚀 Deploy to Render

1. Push this folder to GitHub
2. Create new Web Service on Render.com
3. Connect your GitHub repository
4. Render will automatically detect `package.json`
5. Deploy!

### Render Settings:
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Environment:** Node

## 📊 Supported Message Types

| Type | Direction | Description |
|------|-----------|-------------|
| `weight` | ESP32 → Server → Dashboard | Real-time weight data |
| `register` | Client → Server | Register client type & scale ID |
| `history` | Server → Client | Historical weight data |
| `welcome` | Server → Client | Connection confirmation |
| `ping/pong` | Both | Heartbeat/keep-alive |

## 🔧 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8080 | Server port |

## 📝 License

MIT
