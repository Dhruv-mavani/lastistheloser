const CHALLENGE_TYPES = [
    'CLICK', 'COLOR_MATCH', 'TYPE', 'WAIT_TRAP', 'MOVING_TARGET',
    'MATH', 'SEQUENCE', 'REACTION_FAST', 'SHAPE_CLICK', 'FIND_NUMBER'
];

class GameLogic {
    constructor(io, room) {
        this.io = io;
        this.room = room;
        this.currentRound = 0;
        this.activePlayers = [...room.players];
        this.spectators = []; // Players who are out but still in room
        this.responses = [];
        this.timer = null;
        this.maxRounds = 30;
        this.difficulty = 1; // 1 to 6 (increments every 5 rounds)
    }

    start() {
        this.room.status = 'PLAYING';
        this.nextRound();
    }

    nextRound() {
        if (this.currentRound >= this.maxRounds || this.activePlayers.length <= 1) {
            this.endGame();
            return;
        }

        this.currentRound++;
        this.difficulty = Math.min(6, Math.floor((this.currentRound - 1) / 5) + 1);
        this.responses = [];

        // Preparation phase
        this.io.to(this.room.id).emit('roundPreparing', {
            round: this.currentRound,
            playersRemaining: this.activePlayers.length
        });

        setTimeout(() => {
            const baseTime = 5000;
            const reduction = (this.difficulty - 1) * 600;
            const roundTimeout = Math.max(1500, baseTime - reduction);

            const challenge = this.generateChallenge();

            this.io.to(this.room.id).emit('newRound', {
                round: this.currentRound,
                challenge: challenge,
                playersRemaining: this.activePlayers.length,
                timeLimit: roundTimeout,
                difficulty: this.difficulty
            });

            // Set round timer
            this.timer = setTimeout(() => this.endRound(), roundTimeout + (challenge.delay || 0));
        }, 3000); // 3 second prep
    }

    generateChallenge() {
        const type = CHALLENGE_TYPES[Math.floor(Math.random() * CHALLENGE_TYPES.length)];
        let challenge = { type };

        switch (type) {
            case 'CLICK':
                challenge.instruction = 'CLICK THE BUTTON FAST!';
                break;
            case 'COLOR_MATCH':
                const colors = ['RED', 'BLUE', 'GREEN', 'YELLOW', 'PURPLE', 'ORANGE', 'CYAN', 'MAGENTA'];
                const count = Math.min(8, 4 + Math.floor(this.difficulty / 2));
                challenge.colors = colors.slice(0, count);
                challenge.targetColor = challenge.colors[Math.floor(Math.random() * challenge.colors.length)];
                challenge.instruction = `CLICK THE ${challenge.targetColor} CIRCLE`;
                break;
            case 'TYPE':
                const wordPool = [
                    'PANIC', 'REACT', 'SURVIVE', 'CHAOS', 'NINJA', 'SPEED', 'TURBO', 'REFLEX',
                    'EXTREME', 'CHALLENGE', 'LEGEND', 'MASTER', 'LIGHTNING', 'GALAXY', 'DYNAMO'
                ];
                challenge.targetWord = wordPool[Math.floor(Math.random() * wordPool.length)];
                challenge.instruction = `TYPE: ${challenge.targetWord}`;
                break;
            case 'WAIT_TRAP':
                challenge.instruction = 'DO NOT CLICK... WAIT FOR IT';
                challenge.delay = 1500 + Math.random() * 2500;
                break;
            case 'MOVING_TARGET':
                challenge.instruction = 'HIT THE TARGET!';
                challenge.speed = 1 + (this.difficulty * 0.5);
                break;
            case 'MATH':
                const a = Math.floor(Math.random() * (10 * this.difficulty));
                const b = Math.floor(Math.random() * (10 * this.difficulty));
                challenge.answer = a + b;
                challenge.instruction = `SOLVE: ${a} + ${b}`;
                break;
            case 'SEQUENCE':
                const seqLen = 2 + Math.floor(this.difficulty / 2);
                challenge.sequence = Array.from({ length: seqLen }, () => Math.floor(Math.random() * 4));
                challenge.instruction = 'MEMORIZE THE SEQUENCE';
                break;
            case 'REACTION_FAST':
                challenge.instruction = 'CLICK AS SOON AS IT TURNS GREEN';
                challenge.delay = 1000 + Math.random() * 3000;
                break;
            case 'SHAPE_CLICK':
                const shapes = ['SQUARE', 'CIRCLE', 'TRIANGLE', 'STAR'];
                challenge.targetShape = shapes[Math.floor(Math.random() * shapes.length)];
                challenge.instruction = `CLICK THE ${challenge.targetShape}`;
                break;
            case 'FIND_NUMBER':
                const nums = Array.from({ length: 9 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
                challenge.targetNum = nums[Math.floor(Math.random() * nums.length)];
                challenge.numbers = nums;
                challenge.instruction = `FIND AND CLICK: ${challenge.targetNum}`;
                break;
        }

        return challenge;
    }

    handleResponse(playerId, responseData) {
        const player = this.activePlayers.find(p => p.id === playerId);
        if (!player) return;
        if (this.responses.find(r => r.playerId === playerId)) return;

        this.responses.push({
            playerId,
            nickname: player.nickname,
            time: Date.now(),
            reactionTime: responseData.reactionTime,
            valid: responseData.valid
        });

        if (this.responses.length === this.activePlayers.length) {
            clearTimeout(this.timer);
            this.endRound();
        }
    }

    endRound() {
        const respondedIds = this.responses.map(r => r.playerId);
        const nonResponders = this.activePlayers.filter(p => !respondedIds.includes(p.id));

        let eliminatedPlayer = null;

        if (nonResponders.length > 0) {
            eliminatedPlayer = nonResponders[Math.floor(Math.random() * nonResponders.length)];
        } else {
            const invalidResponses = this.responses.filter(r => !r.valid);
            if (invalidResponses.length > 0) {
                eliminatedPlayer = this.activePlayers.find(p => p.id === invalidResponses[0].playerId);
            } else {
                this.responses.sort((a, b) => b.reactionTime - a.reactionTime);
                eliminatedPlayer = this.activePlayers.find(p => p.id === this.responses[0].playerId);
            }
        }

        if (eliminatedPlayer) {
            this.spectators.push(eliminatedPlayer);
            this.activePlayers = this.activePlayers.filter(p => p.id !== eliminatedPlayer.id);

            this.io.to(this.room.id).emit('roundResult', {
                eliminated: eliminatedPlayer.nickname,
                responses: this.responses,
                ragebait: this.getRagebait(eliminatedPlayer.nickname),
                round: this.currentRound
            });

            if (this.activePlayers.length <= 1) {
                setTimeout(() => this.endGame(), 2000);
            } else {
                setTimeout(() => this.nextRound(), 3500);
            }
        }
    }

    endGame() {
        const winner = this.activePlayers.length === 1 ? this.activePlayers[0].nickname : "NO ONE (DRAW)";
        this.io.to(this.room.id).emit('gameOver', {
            winner,
            rounds: this.currentRound,
            room: {
                id: this.room.id,
                players: [...this.activePlayers, ...this.spectators],
                status: 'LOBBY',
                hostId: this.room.hostId,
                minPlayers: this.room.minPlayers
            }
        });

        // Reset for rematch
        this.room.status = 'LOBBY';
        this.room.gameLogic = null;
        this.room.players = [...this.activePlayers, ...this.spectators]; // Combine everyone back
        this.activePlayers = [];
        this.spectators = [];
    }

    getRagebait(nickname) {
        const baits = [
            `${nickname} clearly hasn't unlocked their hands yet.`,
            `Breaking news: ${nickname} holds the world record for being slow.`,
            `${nickname}, don't quit your day job. Unless it requires speed.`,
            `Error 404: ${nickname}'s reflexes not found.`,
            `Even Internet Explorer reacted faster than ${nickname}.`,
            `${nickname} is basically a human buffering icon.`,
            `The turtle community has elected ${nickname} as their leader.`,
            `Skill issue? No, ${nickname} has a soul issue.`,
            `If confusion was a sport, ${nickname} would be an Olympian.`
        ];
        return baits[Math.floor(Math.random() * baits.length)];
    }
}

module.exports = GameLogic;
