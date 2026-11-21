const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" },
    pingTimeout: 7000,
    pingInterval: 3000,
    maxHttpBufferSize: 1e6
});

const OWNER_LOGIN = "Izmaylov";
const OWNER_PASSWORD = "233223";

app.use(express.static(__dirname));

const WORDS_BASE = [
    { word: "Къонах", translation: "Достойный мужчина / Витязь" },
    { word: "Эздел", translation: "Ингушский кодекс чести и этики" },
    { word: "Лоам", translation: "Гора" },
    { word: "Хьаша", translation: "Гость" },
    { word: "Г1ала", translation: "Жилая башня" },
    { word: "ВIов", translation: "Боевая башня" },
    { word: "хьоалчаг1", translation: "Свадьба / Праздник / Веселье" },
    { word: "Тамада", translation: "Распорядитель застолья" },
    { word: "Джейрах", translation: "Горный район Ингушетии" },
    { word: "Лезгинка", translation: "Традиционный кавказский танец" },
    { word: "Кинжал", translation: "Традиционное холодное оружие" },
    { word: "Тейп", translation: "Родовое объединение / Клан" },
    { word: "Магас", translation: "Город солнца / Столица" },
    { word: "Отар", translation: "Пастбище / Отара овец" },
    { word: "берх", translation: "Традиционное национальное блюдо" },
    { word: "Кунацкая", translation: "Комната для приема уважаемых гостей" },
    { word: "Старейшина", translation: "Уважаемый глава рода / Глава совета" },
    { word: "Г1алг1ай", translation: "Ингуши (самоназвание)" },
    { word: "Сигал", translation: "Небо" },
    { word: "Борз", translation: "Волк" },
    { word: "Денал", translation: "Мужество / Стойкость" },
    { word: "Нана", translation: "Мать" },
    { word: "Даьхе", translation: "Родина" },
    { word: "Ираз", translation: "Счастье" },
    { word: "Ц1ай", translation: "Огонь / Праздник" },
    { word: "Доттаг1а", translation: "Друг" },
    { word: "Малейк", translation: "Ангел" },
    { word: "Aьрзи", translation: "Орел" },
    { word: "Малх", translation: "Солнце" },
    { word: "Бетта", translation: "Луна" },
    { word: "Седкъа", translation: "Звезда" },
    { word: "Дог", translation: "Сердце" },
    { word: "Мотт", translation: "Язык / Речь" },
    { word: "Йо1", translation: "Девушка / Дочь" },
    { word: "во1", translation: "Парень / Сын" },
    { word: "Ков", translation: "Ворота / Двор" },
    { word: "Говр", translation: "Конь / Лошадь" },
    { word: "Ча", translation: "Медведь" },
    { word: "Лом", translation: "Лев" },
    { word: "Шовда", translation: "Родник / Ключ" },
    { word: "Хи", translation: "Вода" },
    { word: "Гаьн", translation: "Дерево" },
    { word: "Са", translation: "Душа / Свет" },
    { word: "Толам", translation: "Победа" },
    { word: "Нур", translation: "Сияние / Луч" },
    { word: "Даьра", translation: "Ущелье" },
    { word: "Г1алг1а", translation: "Ингуш" },
    { word: "Вахар", translation: "Жизнь" },
    { word: "Дика", translation: "Добро / Хорошо" }
];
const roomsData = {};

function getLobbyState() {
    const publicCount = roomsData['public_test'] ? Object.keys(roomsData['public_test'].users).length : 0;
    const openRooms = [];
    for (const [id, r] of Object.entries(roomsData)) {
        if (id !== 'public_test' && r.isOpen) {
            const count = Object.keys(r.users).length;
            if (count > 0) {
                openRooms.push({
                    id,
                    count,
                    max: r.isTeamMode ? 20 : 50,
                    isTeamMode: r.isTeamMode,
                    host: r.hostName || 'Игрок'
                });
            }
        }
    }
    return { publicCount, openRooms };
}

function broadcastLobbyState() {
    io.emit('lobbyState', getLobbyState());
}

io.on('connection', (socket) => {
    socket.on('getLobbyState', () => {
        socket.emit('lobbyState', getLobbyState());
    });

    socket.on('joinRoom', (data) => {
        const { room, user, login, password, isOpen, isTeamMode } = data;
        if (!roomsData[room]) {
            roomsData[room] = {
                users: {},
                currentLeader: null,
                currentWord: null,
                timer: null,
                timeLeft: 120,
                gameOver: false,
                winnerName: "",
                isOpen: Boolean(isOpen),
                isTeamMode: Boolean(isTeamMode),
                hostName: user || 'Игрок',
                teamScores: { green: 0, gold: 0 },
                nextTeamTurn: 'green',
                activeTeam: 'green',
                skipVotes: new Set(),
                gameStarted: false
            };
        }
        const currentRoom = roomsData[room];
        const count = Object.keys(currentRoom.users).length;
        const maxPlayers = currentRoom.isTeamMode ? 20 : 50;

        if (count >= maxPlayers) {
            return socket.emit('roomFull', {
                message: currentRoom.isTeamMode
                    ? "⛺ Командная комната заполнена! Максимум 20 игроков."
                    : "⛺ Извините, эта комната переполнена! Максимум 50 игроков."
            });
        }

        let role = 'Игрок';
        let finalName = user;
        if (login === OWNER_LOGIN && password === OWNER_PASSWORD) {
            role = 'Owner';
            finalName = "Izmaylov";
        } else {
            if (room !== 'public_test' && count === 0) role = 'Администратор';
            if (user.toLowerCase() === OWNER_LOGIN.toLowerCase()) finalName = "Игрок_" + Math.floor(Math.random() * 900 + 100);
        }

        let assignedTeam = null;
        if (currentRoom.isTeamMode) {
            const greenCount = Object.values(currentRoom.users).filter(u => u.team === 'green').length;
            const goldCount = Object.values(currentRoom.users).filter(u => u.team === 'gold').length;
            assignedTeam = greenCount <= goldCount ? 'green' : 'gold';
        }

        currentRoom.users[socket.id] = {
            name: finalName,
            score: 0,
            isLeader: false,
            role: role,
            mutedUntil: 0,
            micMutedUntil: 0,
            team: assignedTeam
        };

        if (count === 0) currentRoom.hostName = finalName;

        socket.join(room);
        socket.currentRoomName = room;

        if (role === 'Owner') {
            io.to(room).emit('serverChatMessage', { user: '👑 Система', text: '⚡ В комнату вошел Создатель игры: <b><span style="color:#ef4444;">Izmaylov</span></b>!' });
        } else {
            io.to(room).emit('serverChatMessage', { user: 'Система', text: '🤝 Игрок <b>' + finalName + '</b> вошел в игру.' });
        }

        socket.emit('initRole', {
            role: role,
            isTeamMode: currentRoom.isTeamMode,
            team: assignedTeam,
            gameStarted: currentRoom.gameStarted
        });

        sendUserList(room);
        broadcastLobbyState();

        if (currentRoom.gameOver) {
            socket.emit('serverGameOver', {
                winner: currentRoom.winnerName,
                podium: getTop3(currentRoom),
                isTeamMode: currentRoom.isTeamMode,
                teamScores: currentRoom.teamScores
            });
        } else {
            socket.emit('serverTimerUpdate', { timeLeft: currentRoom.timeLeft });
        }
    });
    socket.on('clientSwitchTeam', (data) => {
        const currentRoom = roomsData[data.room];
        if (!currentRoom || !currentRoom.isTeamMode || currentRoom.gameStarted) return;
        const user = currentRoom.users[socket.id];
        if (!user) return;
        const targetTeam = user.team === 'green' ? 'gold' : 'green';
        const targetCount = Object.values(currentRoom.users).filter(u => u.team === targetTeam).length;
        if (targetCount >= 10) {
            return socket.emit('serverChatMessage', { user: 'Система', text: '⚠️ В этой команде уже максимум 10 игроков!' });
        }
        user.team = targetTeam;
        socket.emit('teamChanged', { team: targetTeam });
        sendUserList(data.room);
    });

    socket.on('clientStartRound', (data) => {
        const currentRoom = roomsData[data.room];
        if (!currentRoom || currentRoom.gameOver) return;
        const starter = currentRoom.users[socket.id];
        if (!starter) return;

        if (currentRoom.isTeamMode) {
            if (starter.role !== 'Owner' && starter.role !== 'Администратор') {
                return socket.emit('serverChatMessage', { user: 'Система', text: '⚠️ В командном режиме игру запускает Администратор комнаты!' });
            }
            const greens = Object.values(currentRoom.users).filter(u => u.team === 'green').length;
            const golds = Object.values(currentRoom.users).filter(u => u.team === 'gold').length;
            if (greens < 1 || golds < 1) {
                return socket.emit('serverChatMessage', { user: 'Система', text: '⚠️ В каждой команде должен быть хотя бы 1 игрок!' });
            }
        } else {
            if (Object.keys(currentRoom.users).length < 2) {
                return socket.emit('serverChatMessage', { user: 'Система', text: '⚠️ Для игры нужно как минимум 2 игрока!' });
            }
        }
        currentRoom.gameStarted = true;
        startNewRound(data.room);
    });

    socket.on('clientVoteSkip', (data) => {
        const currentRoom = roomsData[data.room];
        if (!currentRoom || currentRoom.gameOver || !currentRoom.currentWord) return;
        if (socket.id === currentRoom.currentLeader) return;
        if (!currentRoom.users[socket.id]) return;

        currentRoom.skipVotes.add(socket.id);
        const totalGuessers = Math.max(1, Object.keys(currentRoom.users).length - 1);
        const needed = Math.floor(totalGuessers / 2) + 1;
        const currentVotes = currentRoom.skipVotes.size;

        io.to(data.room).emit('skipVoteUpdate', { current: currentVotes, needed: needed });

        if (currentVotes >= needed) {
            clearInterval(currentRoom.timer);
            const skippedWord = currentRoom.currentWord.word;
            const skippedTrans = currentRoom.currentWord.translation;
            currentRoom.currentWord = null;
            currentRoom.skipVotes.clear();
            io.to(data.room).emit('forceStopMic');
            io.to(data.room).emit('serverChatMessage', {
                user: '⏭️ Голосование',
                text: 'Игроки проголосовали за смену слова! Пропущено: <b>' + skippedWord + '</b> (' + skippedTrans + ').'
            });
            setTimeout(() => startNewRound(data.room), 2500);
        }
    });
    socket.on('clientSpoilerPenalty', (data) => {
        const currentRoom = roomsData[data.room];
        if (!currentRoom || currentRoom.gameOver || !currentRoom.currentWord) return;
        const mod = currentRoom.users[socket.id];
        if (!mod || (mod.role !== 'Owner' && mod.role !== 'Администратор' && mod.role !== 'Модератор')) return;

        const leader = currentRoom.users[currentRoom.currentLeader];
        clearInterval(currentRoom.timer);
        const spoiledWord = currentRoom.currentWord.word;
        currentRoom.currentWord = null;

        if (leader) {
            leader.score = Math.max(0, leader.score - 5);
        }
        io.to(data.room).emit('forceStopMic');
        io.to(data.room).emit('serverChatMessage', {
            user: '⚠️ Анти-спойлер',
            text: 'Ведущий <b>' + (leader ? leader.name : '') + '</b> произнёс слово в эфире и получил штраф <b>-5 очков</b>! Слово было: <b>' + spoiledWord + '</b>.'
        });
        sendUserList(data.room);
        setTimeout(() => startNewRound(data.room), 3000);
    });

    socket.on('clientMuteMic', (data) => {
        const { room, targetId } = data;
        const currentRoom = roomsData[room];
        if (!currentRoom) return;
        const req = currentRoom.users[socket.id];
        const target = currentRoom.users[targetId];
        if (!req || !target || target.role === 'Owner') return;
        if (req.role !== 'Owner' && req.role !== 'Администратор' && req.role !== 'Модератор') return;
        if (req.role === 'Модератор' && (target.role === 'Администратор' || target.role === 'Модератор')) return;
        if (req.role === 'Администратор' && target.role === 'Администратор') return;

        target.micMutedUntil = Date.now() + 30000;
        io.to(targetId).emit('forceStopMic');
        io.to(room).emit('serverChatMessage', {
            user: '🔇 Эфир',
            text: 'Игроку <b>' + target.name + '</b> отключен микрофон на 30 секунд.'
        });
        sendUserList(room);
    });

    socket.on('clientBuyItem', (data) => {
        const { room, itemType, targetId } = data;
        const currentRoom = roomsData[room];
        if (!currentRoom || currentRoom.gameOver || !currentRoom.users[socket.id]) return;
        const buyer = currentRoom.users[socket.id];

        if (itemType === 'hint') {
            if (buyer.score < 5) return socket.emit('serverChatMessage', { user: 'Система', text: '❌ Недостаточно очков! Нужно: 5.' });
            if (!currentRoom.currentWord) return;
            buyer.score -= 5;
            const first = currentRoom.currentWord.word.charAt(0).toUpperCase();
            io.to(room).emit('serverChatMessage', { user: 'Магазин', text: '💡 Игрок <b>' + buyer.name + '</b> купил подсказку! Первая буква: <b style="color:#f59e0b; font-size:16px;">"' + first + '..."</b> (Букв: ' + currentRoom.currentWord.word.length + ')' });
        } else if (itemType === 'freeze') {
            if (buyer.score < 10) return socket.emit('serverChatMessage', { user: 'Система', text: '❌ Недостаточно очков! Нужно: 10.' });
            if (!currentRoom.users[targetId] || targetId === currentRoom.currentLeader) return;
            if (currentRoom.users[targetId].role === 'Owner') return socket.emit('serverChatMessage', { user: 'Система', text: '🛑 Вы не можете заморозить Создателя.' });
            buyer.score -= 10;
            currentRoom.users[targetId].mutedUntil = Date.now() + 15000;
            io.to(room).emit('serverChatMessage', { user: 'Магазин', text: '❄️ <b>' + buyer.name + '</b> заморозил чат игроку <b>' + currentRoom.users[targetId].name + '</b> на 15 сек!' });
        } else if (itemType === 'rush') {
            if (buyer.score < 15) return socket.emit('serverChatMessage', { user: 'Система', text: '❌ Недостаточно очков! Нужно: 15.' });
            buyer.score -= 15;
            currentRoom.timeLeft = Math.max(5, currentRoom.timeLeft - 20);
            io.to(room).emit('serverChatMessage', { user: 'Магазин', text: '⏳ <b>' + buyer.name + '</b> ускорил время! У ведущего отняли 20 секунд!' });
        }
        sendUserList(room);
    });
    socket.on('clientChatMessage', (data) => {
        const { room, text } = data;
        const currentRoom = roomsData[room];
        if (!currentRoom || !currentRoom.users[socket.id]) return;
        const sender = currentRoom.users[socket.id];

        if (sender.mutedUntil && Date.now() < sender.mutedUntil) {
            const sec = Math.ceil((sender.mutedUntil - Date.now()) / 1000);
            return socket.emit('serverChatMessage', { user: '❄️ Заморозка', text: 'Ваш чат заморожен! Осталось: ' + sec + ' сек.' });
        }
        if (currentRoom.gameOver) return io.to(room).emit('serverChatMessage', { user: sender.name, text, team: sender.team });

        if (socket.id === currentRoom.currentLeader) {
            if (currentRoom.currentWord && text.toLowerCase().includes(currentRoom.currentWord.word.toLowerCase())) {
                return socket.emit('serverChatMessage', { user: 'Система', text: '⚠️ Нельзя писать само загаданное слово в чат!' });
            }
            return io.to(room).emit('serverChatMessage', { user: '👑 ' + sender.name + ' (Ведущий)', text, team: sender.team });
        }

        const canGuess = !currentRoom.isTeamMode || (sender.team === currentRoom.activeTeam);

        if (canGuess && currentRoom.currentWord && text.trim().toLowerCase() === currentRoom.currentWord.word.toLowerCase()) {
            clearInterval(currentRoom.timer);
            sender.score += 10;
            const leader = currentRoom.users[currentRoom.currentLeader];
            if (leader) leader.score += 5;

            if (currentRoom.isTeamMode && sender.team) {
                currentRoom.teamScores[sender.team] += 10;
            }

            const w = currentRoom.currentWord.word;
            const tr = currentRoom.currentWord.translation;
            currentRoom.currentWord = null;
            currentRoom.skipVotes.clear();
            io.to(room).emit('forceStopMic');

            const teamTag = currentRoom.isTeamMode ? (sender.team === 'green' ? ' [🟢 Магас]' : ' [🟡 Джейрах]') : '';
            io.to(room).emit('serverChatMessage', {
                user: '🎉 ПОБЕДА В РАУНДЕ',
                text: 'Игрок <b>' + sender.name + '</b>' + teamTag + ' угадал слово: <b style="color:#10b981; font-size:16px;">' + w + '</b> (' + tr + ')! (+10 очков)'
            });

            const targetWinScore = currentRoom.isTeamMode ? 100 : 50;
            const teamWon = currentRoom.isTeamMode && (currentRoom.teamScores.green >= targetWinScore || currentRoom.teamScores.gold >= targetWinScore);
            const soloWon = !currentRoom.isTeamMode && (sender.score >= 50 || (leader && leader.score >= 50));

            if (teamWon || soloWon) {
                let winnerTitle = "";
                if (currentRoom.isTeamMode) {
                    winnerTitle = currentRoom.teamScores.green >= targetWinScore ? "🟢 Команда Магаса" : "🟡 Команда Джейраха";
                } else {
                    winnerTitle = (sender.score >= 50 ? sender : leader).name;
                }
                currentRoom.gameOver = true;
                currentRoom.winnerName = winnerTitle;
                io.to(room).emit('serverChatMessage', { user: '🏆 ПОБЕДИТЕЛЬ', text: '🌟 <b>' + winnerTitle + '</b> одерживает победу в матче!' });
                io.to(room).emit('serverGameOver', {
                    winner: winnerTitle,
                    podium: getTop3(currentRoom),
                    isTeamMode: currentRoom.isTeamMode,
                    teamScores: currentRoom.teamScores
                });
                return sendUserList(room);
            }
            sendUserList(room);
            return setTimeout(() => startNewRound(room), 3000);
        }
        io.to(room).emit('serverChatMessage', { user: sender.name, text, team: sender.team });
    });

    socket.on('clientGiveUp', (data) => {
        const currentRoom = roomsData[data.room];
        if (!currentRoom || currentRoom.gameOver || socket.id !== currentRoom.currentLeader) return;
        clearInterval(currentRoom.timer);
        const w = currentRoom.currentWord ? currentRoom.currentWord.word : "";
        const tr = currentRoom.currentWord ? currentRoom.currentWord.translation : "";
        currentRoom.currentWord = null;
        currentRoom.skipVotes.clear();
        io.to(data.room).emit('forceStopMic');
        io.to(data.room).emit('serverChatMessage', { user: '🏳️ Сдача', text: 'Ведущий сдался. Слово было: <b>' + w + '</b> (' + tr + ').' });
        setTimeout(() => startNewRound(data.room), 3000);
    });
    socket.on('clientRestartGame', (data) => {
        const currentRoom = roomsData[data.room];
        if (!currentRoom) return;
        const req = currentRoom.users[socket.id];
        if (!req || (req.role !== 'Owner' && req.role !== 'Администратор')) return;
        currentRoom.gameOver = false;
        currentRoom.winnerName = "";
        currentRoom.currentWord = null;
        currentRoom.currentLeader = null;
        currentRoom.teamScores = { green: 0, gold: 0 };
        currentRoom.nextTeamTurn = 'green';
        currentRoom.skipVotes.clear();
        clearInterval(currentRoom.timer);
        for (let id in currentRoom.users) {
            currentRoom.users[id].score = 0;
            currentRoom.users[id].isLeader = false;
            currentRoom.users[id].mutedUntil = 0;
            currentRoom.users[id].micMutedUntil = 0;
        }
        io.to(data.room).emit('forceStopMic');
        io.to(data.room).emit('serverChatMessage', { user: '🔄 Новая игра', text: 'Счет всех игроков обнулен! Начинается новая игра!' });
        io.to(data.room).emit('serverGameReset');
        sendUserList(data.room);
        setTimeout(() => startNewRound(data.room), 2000);
    });

    socket.on('clientSetRole', (data) => {
        const { room, targetId, newRole } = data;
        const currentRoom = roomsData[room];
        if (!currentRoom) return;
        const req = currentRoom.users[socket.id];
        const target = currentRoom.users[targetId];
        if (!req || !target || target.role === 'Owner') return;
        if (req.role !== 'Owner' && req.role !== 'Администратор') return;
        if (req.role === 'Администратор' && target.role === 'Администратор') return;
        target.role = newRole;
        io.to(room).emit('serverChatMessage', { user: '🛡️ Совет', text: 'Игрок <b>' + target.name + '</b> назначен на должность: <b>' + newRole + '</b>.' });
        io.to(targetId).emit('initRole', { role: newRole, isTeamMode: currentRoom.isTeamMode, team: target.team, gameStarted: currentRoom.gameStarted });
        sendUserList(room);
    });

    socket.on('clientKickUser', (data) => {
        const { room, targetId } = data;
        const currentRoom = roomsData[room];
        if (!currentRoom) return;
        const req = currentRoom.users[socket.id];
        const target = currentRoom.users[targetId];
        if (!req || !target || target.role === 'Owner') return;
        if (req.role !== 'Owner' && req.role !== 'Администратор' && req.role !== 'Модератор') return;
        if (req.role === 'Модератор' && (target.role === 'Администратор' || target.role === 'Модератор')) return;
        if (req.role === 'Администратор' && target.role === 'Администратор') return;
        io.to(room).emit('serverChatMessage', { user: '🚫 Изгнание', text: 'Игрок <b>' + target.name + '</b> был исключен из комнаты.' });
        io.to(targetId).emit('kickedFromRoom');
        const s = io.sockets.sockets.get(targetId);
        if (s) s.leave(room);
        delete currentRoom.users[targetId];
        sendUserList(room);
        broadcastLobbyState();
    });

    socket.on('sendReaction', (data) => io.to(data.room).emit('receiveReaction', { emoji: data.emoji }));

    socket.on('voice-data', (data) => {
        const room = data?.room || socket.currentRoomName;
        const currentRoom = roomsData[room];
        if (!room || !currentRoom || !currentRoom.users[socket.id] || !data?.pcm) return;
        const u = currentRoom.users[socket.id];
        if (u.micMutedUntil && Date.now() < u.micMutedUntil) return;
        socket.to(room).emit('voice-data', { pcm: data.pcm, sampleRate: data.sampleRate || 48000 });
    });

    socket.on('voice-speaking', (data) => {
        const room = data?.room || socket.currentRoomName;
        const currentRoom = roomsData[room];
        if (room && currentRoom && currentRoom.users[socket.id]) {
            const u = currentRoom.users[socket.id];
            if (u.micMutedUntil && Date.now() < u.micMutedUntil && data.isSpeaking) return;
            socket.to(room).emit('voice-speaking', { userId: socket.id, name: u.name, isSpeaking: data.isSpeaking });
        }
    });

    socket.on('disconnect', () => {
        const room = socket.currentRoomName;
        const currentRoom = roomsData[room];
        if (!room || !currentRoom || !currentRoom.users[socket.id]) return;
        const leftName = currentRoom.users[socket.id].name;
        const wasLeader = (socket.id === currentRoom.currentLeader);
        const wasAdmin = (currentRoom.users[socket.id].role === 'Администратор');
        delete currentRoom.users[socket.id];
        const ids = Object.keys(currentRoom.users);
        if (ids.length === 0) {
            clearInterval(currentRoom.timer);
            delete roomsData[room];
            broadcastLobbyState();
            return;
        }
        io.to(room).emit('serverChatMessage', { user: 'Система', text: '👋 Игрок <b>' + leftName + '</b> покинул игру.' });
        if (wasAdmin && room !== 'public_test') {
            const nextId = ids.find(id => currentRoom.users[id].role !== 'Owner');
            if (nextId) {
                currentRoom.users[nextId].role = 'Администратор';
                io.to(room).emit('serverChatMessage', { user: '🛡️ Совет', text: 'Новым Администратором назначен <b>' + currentRoom.users[nextId].name + '</b>.' });
                io.to(nextId).emit('initRole', { role: 'Администратор', isTeamMode: currentRoom.isTeamMode, team: currentRoom.users[nextId].team, gameStarted: currentRoom.gameStarted });
            }
        }
        sendUserList(room);
        broadcastLobbyState();
        if (wasLeader && !currentRoom.gameOver) {
            clearInterval(currentRoom.timer);
            io.to(room).emit('forceStopMic');
            io.to(room).emit('serverChatMessage', { user: 'Система', text: 'Ведущий вышел. Смена хода...' });
            setTimeout(() => startNewRound(room), 2000);
        }
    });
});

function getTop3(currentRoom) {
    return Object.values(currentRoom.users)
        .map(u => ({ name: u.name, score: u.score, team: u.team }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
}

function startNewRound(room) {
    const currentRoom = roomsData[room];
    if (!currentRoom || currentRoom.gameOver) return;
    const ids = Object.keys(currentRoom.users);

    if (currentRoom.isTeamMode) {
        const greens = ids.filter(id => currentRoom.users[id].team === 'green');
        const golds = ids.filter(id => currentRoom.users[id].team === 'gold');
        if (greens.length < 1 || golds.length < 1) {
            currentRoom.gameStarted = false;
            return io.to(room).emit('serverChatMessage', { user: 'Система', text: '⏸️ Ожидание игроков в обеих командах...' });
        }
    } else if (ids.length < 2) {
        return io.to(room).emit('serverChatMessage', { user: 'Система', text: '⏸️ Ожидание игроков для продолжения (нужно минимум 2)...' });
    }

    clearInterval(currentRoom.timer);
    currentRoom.timeLeft = 120;
    currentRoom.skipVotes.clear();
    io.to(room).emit('forceStopMic');

    for (let id of ids) currentRoom.users[id].isLeader = false;

    let pool = ids;
    if (currentRoom.isTeamMode) {
        currentRoom.activeTeam = currentRoom.nextTeamTurn;
        currentRoom.nextTeamTurn = currentRoom.nextTeamTurn === 'green' ? 'gold' : 'green';
        pool = ids.filter(id => currentRoom.users[id].team === currentRoom.activeTeam);
    }

    let cand = pool.filter(id => id !== currentRoom.currentLeader);
    if (cand.length === 0) cand = pool;
    const nextId = cand[Math.floor(Math.random() * cand.length)];
    currentRoom.currentLeader = nextId;
    currentRoom.users[nextId].isLeader = true;

    const w = WORDS_BASE[Math.floor(Math.random() * WORDS_BASE.length)];
    currentRoom.currentWord = w;
    sendUserList(room);

    const lName = currentRoom.users[nextId].name;
    const teamNotice = currentRoom.isTeamMode
        ? (currentRoom.activeTeam === 'green' ? ' (Ход 🟢 Команды Магаса)' : ' (Ход 🟡 Команды Джейраха)')
        : '';

    io.to(room).emit('serverChatMessage', { user: '🎲 Новый раунд', text: 'Ведущим выбран: <b>' + lName + '</b>' + teamNotice + '!' });

    for (let id of ids) {
        const u = currentRoom.users[id];
        const canGuess = !currentRoom.isTeamMode || (u.team === currentRoom.activeTeam);
        if (id === nextId) {
            io.to(id).emit('roundStarted', { isLeader: true, word: w.word, translation: w.translation, leaderName: lName, isTeamMode: currentRoom.isTeamMode, activeTeam: currentRoom.activeTeam, canGuess: false });
        } else {
            io.to(id).emit('roundStarted', { isLeader: false, leaderName: lName, isTeamMode: currentRoom.isTeamMode, activeTeam: currentRoom.activeTeam, canGuess: canGuess });
        }
    }

    currentRoom.timer = setInterval(() => {
        currentRoom.timeLeft--;
        io.to(room).emit('serverTimerUpdate', { timeLeft: currentRoom.timeLeft });
        if (currentRoom.timeLeft <= 0) {
            clearInterval(currentRoom.timer);
            const mw = currentRoom.currentWord ? currentRoom.currentWord.word : "";
            const mt = currentRoom.currentWord ? currentRoom.currentWord.translation : "";
            currentRoom.currentWord = null;
            currentRoom.skipVotes.clear();
            io.to(room).emit('forceStopMic');
            io.to(room).emit('serverChatMessage', { user: '⏱️ Время вышло!', text: 'Никто не угадал. Слово было: <b>' + mw + '</b> (' + mt + ').' });
            setTimeout(() => startNewRound(room), 3000);
        }
    }, 1000);
}

function sendUserList(room) {
    const currentRoom = roomsData[room];
    if (!currentRoom) return;
    const arr = Object.keys(currentRoom.users).map(id => ({
        id,
        name: currentRoom.users[id].name,
        score: currentRoom.users[id].score,
        isLeader: currentRoom.users[id].isLeader,
        role: currentRoom.users[id].role,
        team: currentRoom.users[id].team,
        micMuted: currentRoom.users[id].micMutedUntil > Date.now()
    }));
    io.to(room).emit('updateUserList', {
        users: arr,
        isTeamMode: currentRoom.isTeamMode,
        teamScores: currentRoom.teamScores,
        gameStarted: currentRoom.gameStarted
    });
}

const PORT = process.env.PORT || 80;
http.listen(PORT, () => console.log('Сервер Са Дош запущен на порту: ' + PORT));
