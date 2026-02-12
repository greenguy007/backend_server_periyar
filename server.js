const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;

// Create HTTP server for health checks
const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            uptime: process.uptime(),
            connections: wss.clients.size,
            timestamp: new Date().toISOString()
        }));
    } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Periyar Scale Server</title>
                <style>
                    body { font-family: Arial; max-width: 800px; margin: 50px auto; padding: 20px; }
                    .status { background: #2ecc71; color: white; padding: 20px; border-radius: 10px; }
                    .info { background: #f8f9fa; padding: 20px; border-radius: 10px; margin-top: 20px; }
                    code { background: #333; color: #0f0; padding: 2px 6px; border-radius: 3px; }
                </style>
            </head>
            <body>
                <div class="status">
                    <h1>✅ Periyar Scale WebSocket Server</h1>
                    <p>Server is running and ready to accept connections!</p>
                </div>
                <div class="info">
                    <h2>📡 Connection Information</h2>
                    <p><strong>WebSocket URL:</strong> <code>wss://${req.headers.host}/ws</code></p>
                    <p><strong>Active Connections:</strong> ${wss.clients.size}</p>
                    <p><strong>Server Uptime:</strong> ${Math.floor(process.uptime())} seconds</p>
                    <h3>🔌 How to Connect</h3>
                    <p>Use this WebSocket URL in your dashboard or ESP32:</p>
                    <pre style="background: #333; color: #0f0; padding: 10px; border-radius: 5px;">wss://${req.headers.host}/ws</pre>
                </div>
            </body>
            </html>
        `);
    }
});

// Create WebSocket server
const wss = new WebSocket.Server({ 
    server: server,
    path: '/ws'
});

console.log('╔════════════════════════════════════════╗');
console.log('║  PERIYAR SCALE WEBSOCKET SERVER       ║');
console.log('╚════════════════════════════════════════╝');
console.log(`🚀 Server starting on port ${PORT}`);
console.log(`📡 WebSocket path: /ws`);
console.log('════════════════════════════════════════\n');

// Store connected clients with metadata
const clients = new Map();

// Store recent weight history (last 100 readings)
const weightHistory = [];
const MAX_HISTORY = 100;

// Client ID counter
let clientIdCounter = 0;

wss.on('connection', (ws, req) => {
    const clientId = ++clientIdCounter;
    const clientIp = req.socket.remoteAddress;
    
    // Store client info
    clients.set(ws, {
        id: clientId,
        ip: clientIp,
        connectedAt: new Date(),
        type: 'unknown' // will be 'dashboard' or 'esp32'
    });
    
    console.log(`\n✅ [${new Date().toISOString()}] NEW CONNECTION`);
    console.log(`   Client ID: ${clientId}`);
    console.log(`   IP: ${clientIp}`);
    console.log(`   Active connections: ${wss.clients.size}`);
    
    // Send welcome message and history
    ws.send(JSON.stringify({
        type: 'welcome',
        data: {
            clientId: clientId,
            serverTime: new Date().toISOString(),
            message: 'Connected to Periyar Scale Server'
        }
    }));
    
    // Send recent history if available
    if (weightHistory.length > 0) {
        ws.send(JSON.stringify({
            type: 'history',
            data: weightHistory.slice(-20) // Send last 20 readings
        }));
        console.log(`   📤 Sent ${Math.min(20, weightHistory.length)} historical readings`);
    }
    
    // Handle incoming messages
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            const client = clients.get(ws);
            
            console.log(`\n📨 [${new Date().toISOString()}] MESSAGE from Client ${client.id}`);
            console.log(`   Type: ${data.type || 'weight'}`);
            
            // Handle different message types
            if (data.type === 'register') {
                // Client registration (dashboard or ESP32)
                client.type = data.clientType || 'unknown';
                client.scaleId = data.scaleId || 1;
                console.log(`   Registered as: ${client.type} (Scale ${client.scaleId})`);
                
            } else if (data.type === 'ping') {
                // Heartbeat
                ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                
            } else {
                // Weight data - handle different formats
                let weightData;
                
                if (data.weight !== undefined) {
                    // Format: {weight: 1234, unit: 'g'}
                    weightData = {
                        type: 'weight',
                        data: {
                            weight: data.weight,
                            unit: data.unit || 'g',
                            scaleId: data.scaleId || client.scaleId || 1,
                            timestamp: data.timestamp || Date.now(),
                            datetime: new Date().toISOString()
                        }
                    };
                } else if (data.value !== undefined) {
                    // Format: {value: 1234}
                    weightData = {
                        type: 'weight',
                        data: {
                            weight: data.value,
                            unit: 'g',
                            scaleId: data.scaleId || client.scaleId || 1,
                            timestamp: Date.now(),
                            datetime: new Date().toISOString()
                        }
                    };
                } else {
                    console.log('   ⚠️  Unknown message format');
                    return;
                }
                
                // Add to history
                weightHistory.push(weightData.data);
                if (weightHistory.length > MAX_HISTORY) {
                    weightHistory.shift();
                }
                
                console.log(`   Weight: ${weightData.data.weight} ${weightData.data.unit}`);
                console.log(`   Scale ID: ${weightData.data.scaleId}`);
                
                // Broadcast to all connected clients except sender
                const broadcast = JSON.stringify(weightData);
                let broadcastCount = 0;
                
                wss.clients.forEach((client) => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(broadcast);
                        broadcastCount++;
                    }
                });
                
                console.log(`   📡 Broadcasted to ${broadcastCount} clients`);
            }
            
        } catch (err) {
            console.error(`❌ Error processing message: ${err.message}`);
        }
    });
    
    // Handle client disconnect
    ws.on('close', () => {
        const client = clients.get(ws);
        const duration = ((Date.now() - client.connectedAt) / 1000).toFixed(0);
        
        console.log(`\n🔌 [${new Date().toISOString()}] CLIENT DISCONNECTED`);
        console.log(`   Client ID: ${client.id}`);
        console.log(`   Type: ${client.type}`);
        console.log(`   Duration: ${duration} seconds`);
        console.log(`   Active connections: ${wss.clients.size - 1}`);
        
        clients.delete(ws);
    });
    
    // Handle errors
    ws.on('error', (error) => {
        const client = clients.get(ws);
        console.error(`\n❌ [${new Date().toISOString()}] WebSocket error (Client ${client?.id}):`);
        console.error(`   ${error.message}`);
        clients.delete(ws);
    });
});

// Server-level error handling
wss.on('error', (error) => {
    console.error('\n❌ Server error:', error);
});

// Start server
server.listen(PORT, () => {
    console.log(`\n✅ Server is running!`);
    console.log(`   HTTP: http://localhost:${PORT}`);
    console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`   Health Check: http://localhost:${PORT}/health`);
    console.log('\n🎯 Ready to accept connections!\n');
});

// Graceful shutdown
const shutdown = () => {
    console.log('\n\n🛑 Shutting down server...');
    
    // Close all client connections
    wss.clients.forEach((client) => {
        client.close(1000, 'Server shutting down');
    });
    
    // Close WebSocket server
    wss.close(() => {
        console.log('✅ WebSocket server closed');
        
        // Close HTTP server
        server.close(() => {
            console.log('✅ HTTP server closed');
            console.log('👋 Goodbye!\n');
            process.exit(0);
        });
    });
    
    // Force exit after 10 seconds
    setTimeout(() => {
        console.error('⚠️  Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Log unhandled errors
process.on('uncaughtException', (error) => {
    console.error('\n💥 Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('\n💥 Unhandled Rejection at:', promise, 'reason:', reason);
});
