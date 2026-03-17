const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const RoomManager = require('./roomManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const roomManager = new RoomManager(io);

const PORT = parseInt(process.env.PORT) || 3000;

app.use(express.static(path.join(__dirname, '../public')));

// Health check for Render
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Basic Socket.io connection handling
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('quickMatch', (data) => {
        const player = { id: socket.id, nickname: data.nickname };
        const result = roomManager.findQuickMatch(player);
        if (result.error) {
            socket.emit('error', result.error);
        } else {
            socket.join(result.room.id);
            io.to(result.room.id).emit('roomJoined', { room: result.room });
        }
    });

    socket.on('createRoom', (data) => {
        const player = { id: socket.id, nickname: data.nickname };
        const room = roomManager.createRoom(true);
        const result = roomManager.joinRoom(room.id, player);
        socket.join(room.id);
        socket.emit('roomJoined', { room: result.room });
    });

    socket.on('joinRoom', (data) => {
        const player = { id: socket.id, nickname: data.nickname };
        const result = roomManager.joinRoom(data.roomId, player);
        if (result.error) {
            socket.emit('error', result.error);
        } else {
            socket.join(result.room.id);
            io.to(result.room.id).emit('roomJoined', { room: result.room });
        }
    });

    socket.on('startGame', () => {
        const player = roomManager.getPlayer(socket.id);
        if (player && player.roomId) {
            const room = roomManager.getRoom(player.roomId);
            if (room) {
                const result = roomManager.startManualCountdown(room, socket.id);
                if (result.error) {
                    socket.emit('error', result.error);
                }
            }
        }
    });

    socket.on('response', (data) => {
        const player = roomManager.getPlayer(socket.id);
        if (player && player.roomId) {
            const room = roomManager.getRoom(player.roomId);
            if (room && room.gameLogic) {
                room.gameLogic.handleResponse(socket.id, data);
            }
        }
    });

    socket.on('chat', (data) => {
        const player = roomManager.getPlayer(socket.id);
        if (player && player.roomId) {
            io.to(player.roomId).emit('chat', {
                sender: player.nickname,
                message: data.message
            });
        }
    });

    socket.on('leaveRoom', () => {
        roomManager.leaveRoom(socket.id);
        socket.leaveAll(); // Basically leave rooms
    });

    socket.on('disconnecting', () => {
        roomManager.leaveRoom(socket.id);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('====================================');
    console.log(`SERVER STARTING...`);
    console.log(`PORT: ${PORT}`);
    console.log(`NODE_VERSION: ${process.version}`);
    console.log(`ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log(`DIRECTORY: ${__dirname}`);
    console.log('====================================');
});
