const socket = io();

const screens = {
    landing: document.getElementById('landing-screen'),
    lobby: document.getElementById('lobby-screen'),
    game: document.getElementById('game-screen'),
    result: document.getElementById('result-screen')
};

const nicknameInput = document.getElementById('nickname-input');
const playNowBtn = document.getElementById('play-now-btn');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const roomCodeInput = document.getElementById('room-code-input');

// Lobby Elements
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const chatMessages = document.getElementById('chat-messages');
const playerGrid = document.getElementById('player-grid');
const roomCodeDisplay = document.querySelector('#room-code-display span');
const lobbyStatus = document.getElementById('lobby-status');
const lobbyTimerContainer = document.getElementById('lobby-timer-container');
const lobbyCountdown = document.getElementById('lobby-countdown');
const leaveRoomBtn = document.getElementById('leave-room-btn');
const startGameBtn = document.getElementById('start-game-btn');

// Overlay Elements
const howToPlayBtn = document.getElementById('how-to-play-btn');
const howToPlayOverlay = document.getElementById('how-to-play-overlay');
const closeHowToBtn = document.getElementById('close-how-to-btn');

// Game Elements
const hudLevel = document.getElementById('hud-level');
const hudAlive = document.getElementById('hud-alive');
const hudTimerBar = document.getElementById('hud-timer-bar');
const challengeContent = document.getElementById('challenge-content');
const prepOverlay = document.getElementById('prep-overlay');
const prepCountdown = document.getElementById('prep-countdown');

// Sounds
const sounds = {
    lobby: document.getElementById('sound-lobby'),
    timeout: document.getElementById('sound-timeout'),
    eliminated: document.getElementById('sound-eliminated'),
    survived: document.getElementById('sound-survived')
};

function playSound(name) {
    if (sounds[name]) {
        sounds[name].currentTime = 0;
        sounds[name].play().catch(e => console.log('Audio error:', e));
    }
}

let currentNickname = '';
let currentRoom = null;
let timerInterval = null;

const challengeUI = new ChallengeUI(challengeContent, (data) => {
    socket.emit('response', data);
    challengeContent.innerHTML = `
        <h1 class="font-title pulse">TASK COMPLETED</h1>
        <p class="accent-text">WAITING FOR OTHER LOSERS...</p>
    `;
    stopHUDTimer();
});

function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
}

// Event Listeners
playNowBtn.addEventListener('click', () => {
    currentNickname = nicknameInput.value.trim() || 'Anonymous' + Math.floor(Math.random() * 1000);
    socket.emit('quickMatch', { nickname: currentNickname });
});

createRoomBtn.addEventListener('click', () => {
    currentNickname = nicknameInput.value.trim() || 'Anonymous';
    socket.emit('createRoom', { nickname: currentNickname });
});

joinRoomBtn.addEventListener('click', () => {
    currentNickname = nicknameInput.value.trim() || 'Anonymous';
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    if (roomCode) {
        socket.emit('joinRoom', { nickname: currentNickname, roomId: roomCode });
    } else {
        alert('PLEASE ENTER ROOM CODE!');
    }
});

leaveRoomBtn.addEventListener('click', () => {
    socket.emit('leaveRoom');
    showScreen('landing');
});

startGameBtn.addEventListener('click', () => {
    socket.emit('startGame');
});

sendChatBtn.addEventListener('click', sendChat);
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChat(); });

// Menu & Overlay Handlers
if (howToPlayBtn) {
    howToPlayBtn.addEventListener('click', () => window.location.href = 'howtoplay.html');
}
if (closeHowToBtn && howToPlayOverlay) {
    closeHowToBtn.addEventListener('click', () => howToPlayOverlay.classList.add('hidden'));
}

// Mobile touch support - more compatible approach
[playNowBtn, createRoomBtn, joinRoomBtn, howToPlayBtn].forEach(btn => {
    if (btn) {
        btn.addEventListener('touchstart', () => {
            btn.style.opacity = '0.7';
        });
        btn.addEventListener('touchend', () => {
            btn.style.opacity = '1';
        });
    }
});

function sendChat() {
    const msg = chatInput.value.trim();
    if (msg) {
        socket.emit('chat', { nickname: currentNickname, message: msg });
        chatInput.value = '';
    }
}

function addSystemMessage(text) {
    const msgEl = document.createElement('div');
    msgEl.className = 'chat-msg system';
    msgEl.innerHTML = `<span class="text">${text}</span>`;
    chatMessages.appendChild(msgEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Socket Handlers
socket.on('roomJoined', (data) => {
    currentRoom = data.room;
    roomCodeDisplay.innerText = data.room.id;
    showScreen('lobby');

    // Clear old chat
    chatMessages.innerHTML = '';

    updateLobbyUI(data.room);

    // Add system message
    addSystemMessage(`JOINED ROOM: ${data.room.id}`);
});

socket.on('playerLeft', (data) => {
    if (currentRoom) {
        currentRoom.players = data.players;
        currentRoom.hostId = data.hostId;
    }
    updateLobbyUI(currentRoom);
    addSystemMessage('A PLAYER LEFT THE ROOM.');
});

socket.on('chat', (data) => {
    const msgEl = document.createElement('div');
    msgEl.className = 'chat-msg';
    msgEl.innerHTML = `<span class="sender">${data.sender}:</span><span class="text">${data.message}</span>`;
    chatMessages.appendChild(msgEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on('lobbyCountdown', (data) => {
    if (data.count === null) {
        lobbyTimerContainer.classList.add('hidden');
        lobbyStatus.classList.remove('hidden');
        return;
    }
    if (data.count === 5) playSound('lobby'); // "Chaloo" on start countdown
    lobbyStatus.classList.add('hidden');
    lobbyTimerContainer.classList.remove('hidden');
    lobbyCountdown.innerText = data.count;
});

socket.on('roundPreparing', (data) => {
    showScreen('game');
    prepOverlay.classList.remove('hidden');
    challengeContent.classList.add('hidden');
    let count = 3;
    prepCountdown.innerText = count;
    // Clear any previous countdown
    if (window.prepInterval) clearInterval(window.prepInterval);
    window.prepInterval = setInterval(() => {
        count--;
        if (count > 0) {
            prepCountdown.innerText = count;
        } else {
            clearInterval(window.prepInterval);
        }
    }, 1000);
});

socket.on('newRound', (data) => {
    if (window.prepInterval) clearInterval(window.prepInterval);
    showScreen('game');
    prepOverlay.classList.add('hidden');
    challengeContent.classList.remove('hidden');
    hudLevel.innerText = data.round;
    hudAlive.innerText = data.playersRemaining;
    challengeUI.startChallenge(data.challenge);
    startHUDTimer(data.timeLimit);
});

socket.on('roundResult', (data) => {
    showScreen('result');
    stopHUDTimer();

    const isEliminated = (data.eliminated === currentNickname);
    if (isEliminated) {
        playSound('eliminated'); // "teri-gand-mari" on loss (only for eliminated)
    } else {
        playSound('survived'); // "wow-kya-ladka-hai" on surviving (only for survivors)
    }

    screens.result.innerHTML = `
        <h2 class="font-title ${isEliminated ? 'error-text' : ''}">
            ${isEliminated ? 'YOU ARE OUT!' : `${data.eliminated.toUpperCase()} ELIMINATED!`}
        </h2>
        <p class="ragebait">"${data.ragebait}"</p>
        <div class="leaderboard">
            ${data.responses.sort((a, b) => a.reactionTime - b.reactionTime).map(r => `
                <div class="result-item ${r.nickname === data.eliminated ? 'eliminated' : ''}">
                    <span>${r.nickname}</span>
                    <span>${r.valid ? r.reactionTime + 'ms' : 'FAIL'}</span>
                </div>
            `).join('')}
        </div>
        <p class="pulse">PREPARING NEXT ROUND...</p>
    `;
});

socket.on('gameOver', (data) => {
    showScreen('result');
    playSound('survived'); // "wow-kya-ladka-hai" (Global on gameOver)

    screens.result.innerHTML = `
        <h1 class="font-title green-text">MATCH OVER</h1>
        <h2 class="accent-text">WINNER: ${data.winner}</h2>
        <p>REMATCH IN 5 SECONDS...</p>
    `;
    setTimeout(() => {
        showScreen('lobby');
        updateLobbyUI(currentRoom);
    }, 5000);
});

function updateLobbyUI(room) {
    if (!room) return;
    playerGrid.innerHTML = room.players.map(p => {
        const isMe = p.id === socket.id;
        const isHost = p.id === room.hostId;
        return `
            <div class="player-card ${isMe ? 'is-me' : ''}">
                <div class="avatar">👤</div>
                <div class="name">${p.nickname}${isHost ? ' (HOST)' : ''}</div>
                ${isMe ? '<div class="me-badge">YOU</div>' : ''}
            </div>
        `;
    }).join('');

    const isHost = socket.id === room.hostId;
    if (isHost) {
        startGameBtn.classList.remove('hidden');
        startGameBtn.innerText = 'START MATCH';
        if (room.players.length >= room.minPlayers) {
            startGameBtn.disabled = false;
            lobbyStatus.innerText = 'READY TO START!';
            lobbyStatus.classList.add('green-text');
        } else {
            startGameBtn.disabled = true;
            lobbyStatus.innerText = `WAITING FOR ${room.minPlayers - room.players.length} MORE...`;
            lobbyStatus.classList.remove('green-text');
        }
    } else {
        startGameBtn.classList.add('hidden');
        lobbyStatus.innerText = 'WAITING FOR THE HOST...';
        lobbyStatus.classList.remove('green-text');
    }
}

function startHUDTimer(limit) {
    let start = Date.now();
    hudTimerBar.style.width = '100%';
    hudTimerBar.style.backgroundColor = 'var(--primary-accent)';
    hudTimerBar.parentElement.classList.remove('urgent');

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        let elapsed = Date.now() - start;
        let remaining = Math.max(0, 1 - (elapsed / limit));
        hudTimerBar.style.width = (remaining * 100) + '%';

        if (remaining < 0.3) {
            hudTimerBar.parentElement.classList.add('urgent');
        }

        if (remaining === 0) {
            clearInterval(timerInterval);
            playSound('timeout'); // "chicken-on-tree-screaming" on timeout
        }
    }, 50);
}

function stopHUDTimer() {
    clearInterval(timerInterval);
    hudTimerBar.style.width = '100%';
    hudTimerBar.parentElement.classList.remove('urgent');
}
