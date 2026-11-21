const socket = io();
const urlParams = new URLSearchParams(window.location.search);

let currentUsername = urlParams.get('name') || 'Игрок_' + Math.floor(Math.random() * 1000);
const currentRoom = urlParams.get('room') || 'public_test';
const isOpenRoom = urlParams.get('open') === '1';
const isTeamRoom = urlParams.get('team') === '1';

const authLogin = localStorage.getItem('owner_login') || localStorage.getItem('ownerLogin') || '';
const authPassword = localStorage.getItem('owner_pass') || localStorage.getItem('ownerPassword') || '';

let myRole = 'Игрок';
let myTeam = null;
let amILeader = false;
let currentGameOver = false;
let isTeamModeActive = false;

const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const usersList = document.getElementById('usersList');
const userCountField = document.getElementById('userCountField');
const gameStatus = document.getElementById('gameStatus');
const timerField = document.getElementById('timerField');
const roleTitle = document.getElementById('roleTitle');
const wordDisplay = document.getElementById('wordDisplay');
const roleDescription = document.getElementById('roleDescription');
const startRoundBtn = document.getElementById('startRoundBtn');
const giveUpBtn = document.getElementById('giveUpBtn');
const voteSkipBtn = document.getElementById('voteSkipBtn');
const spoilerBtn = document.getElementById('spoilerBtn');
const reactionLayer = document.getElementById('reactionLayer');
const roomCodeBadge = document.getElementById('roomCodeBadge');
const teamScoreBar = document.getElementById('teamScoreBar');
const greenScoreVal = document.getElementById('greenScoreVal');
const goldScoreVal = document.getElementById('goldScoreVal');
const switchTeamBtn = document.getElementById('switchTeamBtn');
const podiumBox = document.getElementById('podiumBox');
const podiumList = document.getElementById('podiumList');

if (roomCodeBadge) {
    roomCodeBadge.innerText = currentRoom === 'public_test' ? '⛺ Общая' : '🔑 ' + currentRoom;
}

window.exitRoom = function() {
    if (confirm('Выйти из комнаты на главный экран?')) {
        window.location.href = 'index.html';
    }
};

window.copyRoomLink = function() {
    if (currentRoom === 'public_test') return;
    const inviteUrl = `${window.location.origin}/index.html?room=${encodeURIComponent(currentRoom)}`;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(inviteUrl).then(() => {
            alert('🔗 Ссылка-приглашение в комнату скопирована:\n' + inviteUrl);
        }).catch(() => {
            prompt('Скопируйте ссылку для друзей:', inviteUrl);
        });
    } else {
        prompt('Скопируйте ссылку для друзей:', inviteUrl);
    }
};

window.mentionPlayer = function(name) {
    if (!messageInput) return;
    messageInput.value = `@${name}, ` + messageInput.value;
    messageInput.focus();
};

const mainContent = document.querySelector('.main-content');
if (mainContent && currentRoom === 'public_test') {
    const publicBanner = document.createElement('div');
    publicBanner.style.background = 'linear-gradient(90deg, #111c16, #1a2e23, #111c16)';
    publicBanner.style.borderBottom = '1px solid #10b981';
    publicBanner.style.color = '#10b981';
    publicBanner.style.textAlign = 'center';
    publicBanner.style.padding = '5px 10px';
    publicBanner.style.fontSize = '11px';
    publicBanner.style.fontWeight = '700';
    publicBanner.innerHTML = '🌍 БЫСТРАЯ ОБЩАЯ ИГРА (БЕЗ АДМИНОВ И ПРАВИЛ)';
    mainContent.insertBefore(publicBanner, mainContent.firstChild);
}
const leaderboard = document.getElementById('leaderboard');
if (leaderboard) {
    const shopContainer = document.createElement('div');
    shopContainer.style.marginTop = '8px';
    shopContainer.style.paddingTop = '8px';
    shopContainer.style.borderTop = '1px dashed #23332b';
    shopContainer.style.display = 'flex';
    shopContainer.style.gap = '6px';
    shopContainer.style.flexWrap = 'wrap';
    shopContainer.innerHTML = `
        <span style="width:100%; font-size:11px; color:#f59e0b; font-weight:700;">🛒 Магазин предметов:</span>
        <button id="buyHintBtn" style="flex:1; background:#14221b; border:1px solid #f59e0b; color:#f59e0b; font-size:10px; padding:5px; border-radius:6px; cursor:pointer; font-weight:700;">💡 Буква (5)</button>
        <button id="buyRushBtn" style="flex:1; background:#14221b; border:1px solid #ef4444; color:#ef4444; font-size:10px; padding:5px; border-radius:6px; cursor:pointer; font-weight:700;">⏳ -20 сек (15)</button>
    `;
    leaderboard.appendChild(shopContainer);

    document.getElementById('buyHintBtn').addEventListener('click', () => {
        socket.emit('clientBuyItem', { room: currentRoom, itemType: 'hint' });
    });
    document.getElementById('buyRushBtn').addEventListener('click', () => {
        socket.emit('clientBuyItem', { room: currentRoom, itemType: 'rush' });
    });
}

const restartBtn = document.createElement('button');
restartBtn.id = 'restartGameBtn';
restartBtn.innerText = '🔄 Начать Новую Игру';
restartBtn.style.background = '#f59e0b';
restartBtn.style.border = 'none';
restartBtn.style.borderRadius = '8px';
restartBtn.style.color = '#000';
restartBtn.style.padding = '10px 20px';
restartBtn.style.fontWeight = '800';
restartBtn.style.cursor = 'pointer';
restartBtn.style.display = 'none';
if (startRoundBtn && startRoundBtn.parentNode) {
    startRoundBtn.parentNode.appendChild(restartBtn);
}

socket.emit('joinRoom', {
    room: currentRoom,
    user: currentUsername,
    login: authLogin,
    password: authPassword,
    isOpen: isOpenRoom,
    isTeamMode: isTeamRoom
});

socket.on('roomFull', (data) => {
    alert(data.message);
    window.location.href = 'index.html';
});

socket.on('initRole', (data) => {
    myRole = data.role;
    isTeamModeActive = Boolean(data.isTeamMode);
    myTeam = data.team || null;

    if (myRole === 'Owner') currentUsername = "Izmaylov";

    if (isTeamModeActive && teamScoreBar) {
        teamScoreBar.style.display = 'flex';
        if (switchTeamBtn) {
            switchTeamBtn.style.display = data.gameStarted ? 'none' : 'inline-block';
        }
        if (startRoundBtn && !data.gameStarted) {
            if (myRole === 'Owner' || myRole === 'Администратор') {
                startRoundBtn.innerText = '⚔️ Начать командную битву';
                startRoundBtn.style.display = 'inline-block';
            } else {
                startRoundBtn.style.display = 'none';
                if (roleDescription) roleDescription.innerText = 'Выберите команду сверху и ожидайте старта от Администратора...';
            }
        }
    }

    if (currentGameOver && (myRole === 'Owner' || myRole === 'Администратор')) {
        restartBtn.style.display = 'inline-block';
    }
});

socket.on('teamChanged', (data) => {
    myTeam = data.team;
});

if (switchTeamBtn) {
    switchTeamBtn.addEventListener('click', () => {
        socket.emit('clientSwitchTeam', { room: currentRoom });
    });
}

socket.on('kickedFromRoom', () => {
    alert('🚫 Вы были исключены из комнаты!');
    window.location.href = 'index.html';
});
if (startRoundBtn) startRoundBtn.addEventListener('click', () => socket.emit('clientStartRound', { room: currentRoom }));
if (giveUpBtn) giveUpBtn.addEventListener('click', () => {
    if (confirm("Хац сона (Сдаться)? Слово будет потеряно.")) socket.emit('clientGiveUp', { room: currentRoom });
});
if (voteSkipBtn) voteSkipBtn.addEventListener('click', () => {
    socket.emit('clientVoteSkip', { room: currentRoom });
    voteSkipBtn.disabled = true;
    voteSkipBtn.style.opacity = '0.6';
});
if (spoilerBtn) spoilerBtn.addEventListener('click', () => {
    if (confirm("Ведущий произнёс слово в эфире? Отменить раунд и списать -5 очков?")) {
        socket.emit('clientSpoilerPenalty', { room: currentRoom });
    }
});
restartBtn.addEventListener('click', () => socket.emit('clientRestartGame', { room: currentRoom }));

function sendMessage() {
    if (!messageInput) return;
    const text = messageInput.value.trim();
    if (text !== '') {
        socket.emit('clientChatMessage', { room: currentRoom, text: text });
        messageInput.value = '';
    }
}
if (sendBtn) sendBtn.addEventListener('click', sendMessage);
if (messageInput) messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

function sendEmoji(emoji) {
    socket.emit('sendReaction', { room: currentRoom, emoji: emoji });
}
const em1 = document.getElementById('emoji1');
const em2 = document.getElementById('emoji2');
const em3 = document.getElementById('emoji3');
const em4 = document.getElementById('emoji4');
if (em1) em1.addEventListener('click', () => sendEmoji('🔥'));
if (em2) em2.addEventListener('click', () => sendEmoji('😂'));
if (em3) em3.addEventListener('click', () => sendEmoji('😮'));
if (em4) em4.addEventListener('click', () => sendEmoji('☝️'));

socket.on('receiveReaction', (data) => {
    if (!reactionLayer) return;
    const el = document.createElement('div');
    el.className = 'floating-emoji';
    el.innerText = data.emoji;
    el.style.left = Math.floor(Math.random() * 75 + 10) + '%';
    reactionLayer.appendChild(el);
    setTimeout(() => el.remove(), 2200);
});

socket.on('serverChatMessage', (data) => {
    if (!chatMessages) return;
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg';
    if (data.text && data.text.includes('@' + currentUsername)) {
        msgDiv.classList.add('chat-mention');
    }
    const teamDot = data.team === 'green' ? '🟢 ' : (data.team === 'gold' ? '🟡 ' : '');
    msgDiv.innerHTML = `<span style="color:#10b981; font-weight:700;">${teamDot}${data.user}:</span> ${data.text}`;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on('serverTimerUpdate', (data) => {
    if (timerField) timerField.innerText = '⏱️ ' + data.timeLeft + 'с';
});

socket.on('skipVoteUpdate', (data) => {
    if (voteSkipBtn) {
        voteSkipBtn.innerText = `⏭️ Сменить слово (${data.current}/${data.needed})`;
    }
});

socket.on('roundStarted', (data) => {
    currentGameOver = false;
    amILeader = data.isLeader;
    if (podiumBox) podiumBox.style.display = 'none';
    if (switchTeamBtn) switchTeamBtn.style.display = 'none';
    if (gameStatus) gameStatus.innerText = 'Раунд идет!';
    if (startRoundBtn) startRoundBtn.style.display = 'none';
    restartBtn.style.display = 'none';

    const canModerate = (myRole === 'Owner' || myRole === 'Администратор' || myRole === 'Модератор') && currentRoom !== 'public_test';
    if (spoilerBtn) spoilerBtn.style.display = canModerate ? 'inline-block' : 'none';

    if (data.isLeader) {
        if (roleTitle) { roleTitle.innerText = 'ВАША РОЛЬ: ВЕДУЩИЙ'; roleTitle.style.color = '#f59e0b'; }
        if (wordDisplay) { wordDisplay.innerText = data.word; wordDisplay.style.color = '#ffffff'; }
        if (roleDescription) roleDescription.innerText = 'Перевод: ' + data.translation + '. Объясните это слово голосом или в чате!';
        if (giveUpBtn) giveUpBtn.style.display = 'inline-block';
        if (voteSkipBtn) voteSkipBtn.style.display = 'none';
    } else {
        const teamInfo = data.isTeamMode ? (data.activeTeam === 'green' ? ' (🟢 Магас)' : ' (🟡 Джейрах)') : '';
        if (roleTitle) { roleTitle.innerText = 'ВЕДУЩИЙ: ' + data.leaderName.toUpperCase() + teamInfo; roleTitle.style.color = '#10b981'; }
        if (wordDisplay) { wordDisplay.innerText = data.canGuess ? 'Угадывайте слово!' : 'Ход команды соперника'; wordDisplay.style.color = data.canGuess ? '#10b981' : '#9ca3af'; }
        if (roleDescription) roleDescription.innerText = data.canGuess ? 'Слушайте ведущего или читайте подсказки в чате!' : 'Сейчас угадывает команда соперников.';
        if (giveUpBtn) giveUpBtn.style.display = 'none';
        if (voteSkipBtn) {
            voteSkipBtn.style.display = 'inline-block';
            voteSkipBtn.disabled = false;
            voteSkipBtn.style.opacity = '1';
            voteSkipBtn.innerText = '⏭️ Сменить слово';
        }
    }
});

socket.on('serverGameOver', (data) => {
    currentGameOver = true;
    if (gameStatus) gameStatus.innerText = 'Игра окончена!';
    if (roleTitle) { roleTitle.innerText = '🏆 ПОБЕДИТЕЛЬ МАТЧА'; roleTitle.style.color = '#f59e0b'; }
    if (wordDisplay) { wordDisplay.innerText = data.winner; wordDisplay.style.color = '#10b981'; }
    if (roleDescription) roleDescription.innerText = 'Поздравляем победителей! Итоги матча ниже:';
    if (giveUpBtn) giveUpBtn.style.display = 'none';
    if (voteSkipBtn) voteSkipBtn.style.display = 'none';
    if (spoilerBtn) spoilerBtn.style.display = 'none';
    if (startRoundBtn) startRoundBtn.style.display = 'none';

    if (podiumBox && podiumList && data.podium) {
        const medals = ['🥇 1 место', '🥈 2 место', '🥉 3 место'];
        podiumList.innerHTML = data.podium.map((p, idx) => {
            const tIcon = p.team === 'green' ? '🟢 ' : (p.team === 'gold' ? '🟡 ' : '');
            return `<div style="display:flex; justify-content:space-between; padding:4px 6px; background:#14221b; border-radius:6px;"><span><b>${medals[idx] || ''}:</b> ${tIcon}${p.name}</span><span style="color:#10b981; font-weight:800;">${p.score} очк.</span></div>`;
        }).join('');
        podiumBox.style.display = 'block';
    }

    if (myRole === 'Owner' || myRole === 'Администратор') {
        restartBtn.style.display = 'inline-block';
    }
});

socket.on('serverGameReset', () => {
    currentGameOver = false;
    restartBtn.style.display = 'none';
    if (podiumBox) podiumBox.style.display = 'none';
    if (gameStatus) gameStatus.innerText = 'Ожидание игроков';
    if (roleTitle) { roleTitle.innerText = 'НОВАЯ ИГРА'; roleTitle.style.color = '#888'; }
    if (wordDisplay) { wordDisplay.innerText = 'Приготовьтесь!'; wordDisplay.style.color = '#10b981'; }
    if (roleDescription) roleDescription.innerText = 'Раунд начнется через секунду...';
});
socket.on('updateUserList', (data) => {
    const users = data.users;
    if (userCountField) userCountField.innerText = 'Игроков: ' + users.length;

    if (data.isTeamMode && teamScoreBar) {
        teamScoreBar.style.display = 'flex';
        if (greenScoreVal && data.teamScores) greenScoreVal.innerText = data.teamScores.green || 0;
        if (goldScoreVal && data.teamScores) goldScoreVal.innerText = data.teamScores.gold || 0;
        if (switchTeamBtn) switchTeamBtn.style.display = data.gameStarted ? 'none' : 'inline-block';
    }

    if (!usersList) return;
    usersList.innerHTML = '';
    users.sort((a, b) => b.score - a.score);

    users.forEach((u) => {
        const isMe = (u.id === socket.id);
        let roleBadge = '';
        let nameColor = '#f4f6f5';

        if (u.role === 'Owner') {
            roleBadge = '<span style="color:#ef4444; font-weight:800; font-size:10px;"> [👑 Owner]</span>';
            nameColor = '#ef4444';
        } else if (u.role === 'Администратор') {
            roleBadge = '<span style="color:#f59e0b; font-weight:700; font-size:10px;"> [⭐ Админ]</span>';
            nameColor = '#f59e0b';
        } else if (u.role === 'Модератор') {
            roleBadge = '<span style="color:#3b82f6; font-weight:700; font-size:10px;"> [🛡️ Модер]</span>';
            nameColor = '#60a5fa';
        }

        const teamIcon = u.team === 'green' ? '🟢 ' : (u.team === 'gold' ? '🟡 ' : '');
        const leaderIcon = u.isLeader ? ' 🎤' : '';
        const muteIcon = u.micMuted ? ' 🔇' : '';

        let controlsHtml = '';
        if (!isMe && u.role !== 'Owner' && currentRoom !== 'public_test') {
            if (myRole === 'Owner' || (myRole === 'Администратор' && u.role !== 'Администратор')) {
                controlsHtml += u.role === 'Модератор'
                    ? `<button class="ctrl-btn" onclick="setRole('${u.id}', 'Игрок')" style="background:#374151;">Снять</button>`
                    : `<button class="ctrl-btn" onclick="setRole('${u.id}', 'Модератор')" style="background:#2563eb;">+Модер</button>`;
            }
            if (myRole === 'Owner' || (myRole === 'Администратор' && u.role !== 'Администратор') || (myRole === 'Модератор' && u.role === 'Игрок')) {
                controlsHtml += `<button class="ctrl-btn" onclick="muteUserMic('${u.id}')" style="background:#d97706;">🔇 Мут</button>`;
                controlsHtml += `<button class="ctrl-btn" onclick="kickUser('${u.id}')" style="background:#dc2626;">Кик</button>`;
            }
        }
        if (!isMe && u.role !== 'Owner' && !u.isLeader) {
            controlsHtml += `<button class="ctrl-btn" onclick="freezeUser('${u.id}')" style="background:#0891b2;">❄️10</button>`;
        }

        const card = document.createElement('div');
        card.className = 'player-card-row';
        card.innerHTML = `
            <div class="player-card-top">
                <div style="min-width:0;">
                    <span class="player-name-link" onclick="mentionPlayer('${u.name}')" style="color:${nameColor}; font-weight:${u.role === 'Owner' ? '800' : '600'}; font-size:13px;">${teamIcon}${u.name}</span>${leaderIcon}${muteIcon}${roleBadge}
                </div>
                <div style="color:#10b981; font-weight:800; font-size:12px; flex-shrink:0;">${u.score} очк.</div>
            </div>
            ${controlsHtml ? `<div class="player-card-controls">${controlsHtml}</div>` : ''}
        `;
        usersList.appendChild(card);
    });
});

window.setRole = function(targetId, newRole) {
    socket.emit('clientSetRole', { room: currentRoom, targetId: targetId, newRole: newRole });
};

window.muteUserMic = function(targetId) {
    socket.emit('clientMuteMic', { room: currentRoom, targetId: targetId });
};

window.kickUser = function(targetId) {
    if (confirm('Вы точно хотите исключить этого игрока из комнаты?')) {
        socket.emit('clientKickUser', { room: currentRoom, targetId: targetId });
    }
};

window.freezeUser = function(targetId) {
    socket.emit('clientBuyItem', { room: currentRoom, itemType: 'freeze', targetId: targetId });
};

const micBtn = document.getElementById('micBtn');
const speakerBadge = document.getElementById('speakerBadge');
const speakerName = document.getElementById('speakerName');

let localStream = null;
let isVoiceActive = false;
let recordContext = null;
let playContext = null;
let processorNode = null;
let sourceNode = null;
let nextPlayTime = 0;
const activeSpeakers = new Map();
let lastSpeaking = false;

function initPlayContext() {
    if (!playContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        playContext = new AudioCtx();
    }
    if (playContext.state === 'suspended') {
        playContext.resume().catch(() => {});
    }
}

document.addEventListener('touchstart', initPlayContext);
document.addEventListener('click', initPlayContext);

if (micBtn) {
    micBtn.addEventListener('click', async () => {
        initPlayContext();
        if (!isVoiceActive) await startVoiceChat();
        else stopVoiceChat();
    });
}

async function startVoiceChat() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: false
        });
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        recordContext = new AudioCtx();
        sourceNode = recordContext.createMediaStreamSource(localStream);
        processorNode = recordContext.createScriptProcessor(4096, 1, 1);

        processorNode.onaudioprocess = (e) => {
            if (!isVoiceActive) return;
            const inputData = e.inputBuffer.getChannelData(0);
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) sum += Math.abs(inputData[i]);
            const avg = (sum / inputData.length) * 100;
            const speaking = avg > 1.2;

            if (speaking !== lastSpeaking) {
                lastSpeaking = speaking;
                updateSpeakerUI(socket.id, currentUsername, speaking);
                socket.emit('voice-speaking', { room: currentRoom, isSpeaking: speaking });
            }

            if (speaking) {
                const pcm16 = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    const s = Math.max(-1, Math.min(1, inputData[i]));
                    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }
                socket.emit('voice-data', { room: currentRoom, pcm: pcm16.buffer, sampleRate: recordContext.sampleRate });
            }
        };

        sourceNode.connect(processorNode);
        processorNode.connect(recordContext.destination);
        isVoiceActive = true;
        micBtn.classList.add('active');
    } catch (err) {
        alert('Не удалось включить микрофон. Проверьте разрешения браузера.');
    }
}

function stopVoiceChat() {
    isVoiceActive = false;
    if (micBtn) micBtn.classList.remove('active');
    if (processorNode) { processorNode.disconnect(); processorNode = null; }
    if (sourceNode) { sourceNode.disconnect(); sourceNode = null; }
    if (recordContext) { recordContext.close().catch(() => {}); recordContext = null; }
    if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
    lastSpeaking = false;
    socket.emit('voice-speaking', { room: currentRoom, isSpeaking: false });
    updateSpeakerUI(socket.id, '', false);
}

socket.on('forceStopMic', () => {
    if (isVoiceActive) stopVoiceChat();
});

socket.on('voice-data', (data) => {
    try {
        initPlayContext();
        if (!playContext || playContext.state !== 'running') return;
        const pcm16 = new Int16Array(data.pcm);
        const float32 = new Float32Array(pcm16.length);
        for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 0x8000;
        const rate = data.sampleRate || 48000;
        const audioBuffer = playContext.createBuffer(1, float32.length, rate);
        audioBuffer.getChannelData(0).set(float32);
        const bufferSource = playContext.createBufferSource();
        bufferSource.buffer = audioBuffer;
        bufferSource.connect(playContext.destination);
        const now = playContext.currentTime;
        if (nextPlayTime < now) nextPlayTime = now + 0.05;
        bufferSource.start(nextPlayTime);
        nextPlayTime += audioBuffer.duration;
    } catch (e) {}
});

function updateSpeakerUI(userId, name, isSpeaking) {
    if (!speakerBadge || !speakerName) return;
    if (isSpeaking) activeSpeakers.set(userId, name);
    else activeSpeakers.delete(userId);
    if (activeSpeakers.size > 0) {
        speakerName.textContent = Array.from(activeSpeakers.values()).join(', ');
        speakerBadge.style.display = 'inline-block';
    } else {
        speakerBadge.style.display = 'none';
    }
}

socket.on('voice-speaking', ({ userId, name, isSpeaking }) => {
    updateSpeakerUI(userId, name, isSpeaking);
});
