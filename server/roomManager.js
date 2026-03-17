const GameLogic = require('./gameLogic');

class RoomManager {
    constructor(io) {
        this.io = io;
        this.rooms = new Map(); // roomId -> roomData
    }

    createRoom(isPrivate = false) {
        const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        const room = {
            id: roomId,
            players: [],
            isPrivate,
            status: 'LOBBY',
            gameLogic: null,
            maxPlayers: 10,
            minPlayers: 2,
            hostId: null,
            countdown: null
        };
        this.rooms.set(roomId, room);
        return room;
    }

    getRoom(roomId) {
        return this.rooms.get(roomId);
    }

    getPlayer(socketId) {
        for (const room of this.rooms.values()) {
            const player = room.players.find(p => p.id === socketId);
            if (player) return player;
        }
        return null;
    }

    getPublicRoomData(room) {
        return {
            id: room.id,
            players: room.players,
            isPrivate: room.isPrivate,
            status: room.status,
            maxPlayers: room.maxPlayers,
            minPlayers: room.minPlayers,
            hostId: room.hostId
        };
    }

    joinRoom(roomId, player) {
        const room = this.rooms.get(roomId);
        if (!room) return { error: 'Room not found' };
        if (room.players.length >= room.maxPlayers) return { error: 'Room full' };
        if (room.status !== 'LOBBY') return { error: 'Game already started' };

        // Set host if not already set
        if (!room.hostId) {
            room.hostId = player.id;
        }

        room.players.push(player);
        player.roomId = roomId;

        return { room: this.getPublicRoomData(room) };
    }

    startManualCountdown(room, hostId) {
        if (room.hostId !== hostId) return { error: 'Only host can start' };
        if (room.players.length < room.minPlayers) return { error: 'Not enough players' };
        if (room.countdown) return { error: 'Already starting' };

        let count = 5;
        room.countdown = setInterval(() => {
            this.io.to(room.id).emit('lobbyCountdown', { count });
            if (count <= 0) {
                clearInterval(room.countdown);
                room.countdown = null;
                room.gameLogic = new GameLogic(this.io, room);
                room.gameLogic.start();
            }
            count--;
        }, 1000);
        return { success: true };
    }

    leaveRoom(socketId) {
        for (const [id, room] of this.rooms) {
            const playerIndex = room.players.findIndex(p => p.id === socketId);
            if (playerIndex !== -1) {
                const player = room.players[playerIndex];
                room.players.splice(playerIndex, 1);

                // Host migration
                if (room.hostId === socketId) {
                    room.hostId = room.players.length > 0 ? room.players[0].id : null;
                }

                this.io.to(room.id).emit('playerLeft', {
                    nickname: player.nickname,
                    players: room.players,
                    hostId: room.hostId
                });

                if (room.players.length < room.minPlayers && room.countdown) {
                    clearInterval(room.countdown);
                    room.countdown = null;
                    this.io.to(room.id).emit('lobbyCountdown', { count: null });
                }

                if (room.players.length === 0) {
                    this.rooms.delete(id);
                }
                return;
            }
        }
    }

    findQuickMatch(player) {
        // Find public rooms with space
        for (const [id, room] of this.rooms) {
            if (!room.isPrivate && room.status === 'LOBBY' && room.players.length < room.maxPlayers) {
                return this.joinRoom(id, player);
            }
        }
        // No room found, create one
        const newRoom = this.createRoom(false);
        return this.joinRoom(newRoom.id, player);
    }
}

module.exports = RoomManager;
