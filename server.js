const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs/promises');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Разрешаем CORS для разработки
        methods: ["GET", "POST"]
    }
});

const USERS_FILE = 'users.json';
const PORT = 3000;
const SALT_ROUNDS = 10;
const DEFAULT_AVATAR = '/images/default-anon-avatar.png'; 

// --- Middleware Setup ---
app.use(express.json());
app.use(cookieParser());
// Обслуживание статических файлов из папки 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- 💾 JSON Data Management Functions ---

/**
 * Загружает данные пользователей из users.json.
 */
async function loadUsers() {
    try {
        const data = await fs.readFile(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('User file not found, initializing empty DB.');
            return {};
        }
        console.error('Error loading users:', error);
        return {};
    }
}

/**
 * Сохраняет данные пользователей в users.json.
 * @param {object} users - Объект с данными всех пользователей.
 */
async function saveUsers(users) {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

/**
 * Сохраняет прямое сообщение (DM) для обоих участников чата.
 * @param {string} senderId - ID отправителя.
 * @param {string} recipientId - ID получателя.
 * @param {object} messageData - Объект сообщения.
 */
async function saveMessage(senderId, recipientId, messageData) {
    const users = await loadUsers();
    
    // Находим ключи (имена пользователей) по ID, т.к. хранилище usesrs[username]
    const senderKey = Object.keys(users).find(key => users[key].id === senderId);
    const recipientKey = Object.keys(users).find(key => users[key].id === recipientId);

    if (!senderKey || !recipientKey) return;

    if (!users[senderKey].dms) users[senderKey].dms = {};
    if (!users[recipientKey].dms) users[recipientKey].dms = {};

    if (!users[senderKey].dms[recipientId]) users[senderKey].dms[recipientId] = [];
    if (!users[recipientKey].dms[senderId]) users[recipientKey].dms[senderId] = [];
    
    users[senderKey].dms[recipientId].push(messageData);
    users[recipientKey].dms[senderId].push(messageData);

    await saveUsers(users);
}

// --- Middleware: User Authentication ---

/**
 * Проверяет сессионный токен из куки и добавляет объект пользователя в req.user.
 */
async function authenticateUser(req, res, next) {
    const token = req.cookies.auth_token;
    if (!token) {
        return res.status(401).send({ message: 'Authentication required' });
    }

    const users = await loadUsers();
    let authenticatedUser = null;

    // Ищем пользователя по токену
    for (const username in users) {
        if (users[username].sessionToken === token) {
            authenticatedUser = users[username];
            break;
        }
    }
    
    if (authenticatedUser) {
        // Найдено, прикрепляем пользователя к запросу
        req.user = authenticatedUser;
        // Нам также нужен его ключ (username) для сохранения изменений
        req.userKey = Object.keys(users).find(key => users[key].id === authenticatedUser.id); 
        return next();
    }
    
    // Недействительный токен
    res.clearCookie('auth_token');
    res.status(401).send({ message: 'Invalid session token' });
}

// --- 🔑 API Endpoints: Auth & Profile ---

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).send({ message: 'Username and password are required.' });
    }

    const users = await loadUsers();
    if (users[username]) {
        return res.status(409).send({ message: 'Username already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const sessionToken = uuidv4(); 
    const userId = uuidv4();

    users[username] = {
        id: userId,
        password: hashedPassword,
        profileName: username,
        friends: [],
        pendingInvites: [], // Приглашения, которые я получил
        sessionToken: sessionToken,
        avatarUrl: DEFAULT_AVATAR,
        dms: {}
    };

    await saveUsers(users);
    
    res.cookie('auth_token', sessionToken, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000, path: '/' }); 
    res.status(201).send({ message: 'Registration successful', profileName: username, userId: userId, avatarUrl: DEFAULT_AVATAR });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const users = await loadUsers();
    const user = users[username];

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).send({ message: 'Invalid username or password.' });
    }
    
    const newSessionToken = uuidv4();
    user.sessionToken = newSessionToken;
    await saveUsers(users);

    res.cookie('auth_token', newSessionToken, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000, path: '/' });
    res.send({ message: 'Login successful', profileName: user.profileName, userId: user.id, avatarUrl: user.avatarUrl });
});

app.get('/api/profile', authenticateUser, (req, res) => {
    // Возвращаем данные текущего аутентифицированного пользователя
    res.json({ 
        id: req.user.id,
        profileName: req.user.profileName,
        friends: req.user.friends || [],
        pendingInvites: req.user.pendingInvites || [],
        avatarUrl: req.user.avatarUrl || DEFAULT_AVATAR,
        dms: req.user.dms || {}
    });
});

app.get('/api/dms/:recipientId', authenticateUser, (req, res) => {
    const recipientId = req.params.recipientId;
    const chatHistory = req.user.dms && req.user.dms[recipientId] ? req.user.dms[recipientId] : [];
    
    res.json(chatHistory);
});


// --- 🔑 API Endpoints: Friends Management ---

app.get('/api/friends', authenticateUser, async (req, res) => {
    const users = await loadUsers();
    
    const friendIDs = req.user.friends || [];
    const inviteIDs = req.user.pendingInvites || [];
    const mySentInvites = req.user.sentInvites || []; // Учитываем отправленные мной
    
    const userMap = {};
    const allUsers = Object.values(users).map(user => ({
        id: user.id,
        profileName: user.profileName,
        avatarUrl: user.avatarUrl
    }));
    
    allUsers.forEach(user => userMap[user.id] = user);

    const friendList = friendIDs.map(id => userMap[id]).filter(user => user);
    const inviteList = inviteIDs.map(id => userMap[id]).filter(user => user);
    
    // Фильтруем список всех пользователей для вкладки "В сети"
    const nonFriends = allUsers.filter(user => 
        user.id !== req.user.id && // Не я сам
        !friendIDs.includes(user.id) && // Не друзья
        !inviteIDs.includes(user.id) && // Я ему не отправлял (он хранит мое приглашение) - нет, это те, кто отправил мне
        !mySentInvites.includes(user.id) // Я ему не отправлял
    );

    res.json({ friends: friendList, pendingInvites: inviteList, networkUsers: nonFriends });
});


app.post('/api/friends/invite', authenticateUser, async (req, res) => {
    const { targetUsername } = req.body;
    const senderId = req.user.id;
    const senderUsername = req.userKey;
    
    const users = await loadUsers();
    
    // Ищем целевого пользователя по имени
    const targetKey = Object.keys(users).find(key => users[key].profileName === targetUsername);
    const targetUser = users[targetKey];

    if (!targetUser) {
        return res.status(404).send({ message: 'User not found.' });
    }
    
    const targetId = targetUser.id;

    if (targetId === senderId) {
         return res.status(400).send({ message: 'You cannot invite yourself.' });
    }

    // Проверяем статус:
    const targetFriends = targetUser.friends || [];
    const targetPendingInvites = targetUser.pendingInvites || [];

    if (targetFriends.includes(senderId) || req.user.friends.includes(targetId)) {
        return res.status(400).send({ message: 'You are already friends.' });
    }
    
    if (targetPendingInvites.includes(senderId)) {
        return res.status(400).send({ message: 'Invitation is already pending from you.' });
    }
    
    // Проверка, не отправил ли получатель приглашение мне (обратная ситуация)
    if (req.user.pendingInvites.includes(targetId)) {
        return res.status(400).send({ message: 'This user has already sent you an invitation.' });
    }

    // 1. Добавляем ID отправителя в pendingInvites получателя
    targetUser.pendingInvites = [...(targetUser.pendingInvites || []), senderId];
    
    // 2. (Опционально) Добавляем ID получателя в sentInvites отправителя для удобства фильтрации
    req.user.sentInvites = [...(req.user.sentInvites || []), targetId];
    
    // Сохраняем обоих пользователей (отправителя и получателя)
    users[targetKey] = targetUser;
    users[senderUsername] = req.user;
    await saveUsers(users);

    // 3. Отправляем уведомление получателю через Socket.IO
    const targetSocketId = activeUsers.get(targetId);
    if (targetSocketId) {
        io.to(targetSocketId).emit('friend invite received', { 
            id: req.user.id, 
            profileName: req.user.profileName, 
            avatarUrl: req.user.avatarUrl 
        });
    }

    res.send({ message: 'Invitation sent successfully.' });
});


app.post('/api/friends/respond', authenticateUser, async (req, res) => {
    const { senderId, action } = req.body;
    const recipientId = req.user.id;
    const recipientKey = req.userKey; // Ключ текущего пользователя
    
    const users = await loadUsers();
    
    const senderEntry = Object.entries(users).find(([, u]) => u.id === senderId);

    if (!senderEntry) {
        return res.status(404).send({ message: 'Sender not found.' });
    }
    
    const [senderKey, senderUser] = senderEntry;
    const recipientUser = users[recipientKey];

    // 1. Удаляем ID отправителя из pendingInvites получателя
    recipientUser.pendingInvites = (recipientUser.pendingInvites || []).filter(id => id !== senderId);
    
    // 2. Удаляем ID получателя из sentInvites отправителя
    senderUser.sentInvites = (senderUser.sentInvites || []).filter(id => id !== recipientId);


    if (action === 'accept') {
        // 3. Добавляем ID друг друга в списки друзей
        if (!(recipientUser.friends || []).includes(senderId)) {
            recipientUser.friends = [...(recipientUser.friends || []), senderId];
        }
        if (!(senderUser.friends || []).includes(recipientId)) {
            senderUser.friends = [...(senderUser.friends || []), recipientId];
        }
    }
    
    // Сохраняем обоих пользователей
    users[senderKey] = senderUser;
    users[recipientKey] = recipientUser;
    await saveUsers(users);

    // 4. Отправляем уведомление обоим пользователям об обновлении списка
    const senderSocketId = activeUsers.get(senderId);
    
    if (senderSocketId) {
        io.to(senderSocketId).emit('friend list updated', { status: action });
    }
    
    // Отправляем получателю
    io.to(activeUsers.get(recipientId)).emit('friend list updated', { status: action });

    res.send({ message: `Invitation ${action}ed.` });
});


// --- 🔑 API Endpoints: HTML Views ---

// Основной маршрут: перенаправляет на index.html (если аутентифицирован) или login.html
app.get('/', async (req, res) => {
    if (req.cookies.auth_token) {
        return res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Маршрут для страницы регистрации
app.get('/register.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Маршрут для страницы входа
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});


// --- 💬 Socket.IO Real-Time Messaging and Friends ---

const activeUsers = new Map(); // Map<userId, socketId>

io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Регистрирует ID пользователя с его текущим Socket ID
    socket.on('register socket', (userId) => {
        if (userId) {
            // Удаляем старый сокет, если он есть
            for (const [existingUserId, existingSocketId] of activeUsers.entries()) {
                if (existingSocketId === socket.id) {
                    activeUsers.delete(existingUserId);
                    break;
                }
            }
            activeUsers.set(userId, socket.id);
            console.log(`User ${userId} registered socket: ${socket.id}`);
            // Уведомляем всех друзей об обновлении статуса
            io.emit('status update', { userId: userId, status: 'online' });
        }
    });
    
    // Обработка прямого сообщения
    socket.on('send direct message', async (data) => {
        // data: { senderId, recipientId, senderName, content, timestamp, avatarUrl }
        
        await saveMessage(data.senderId, data.recipientId, data);

        // Отправляем отправителю обратно 
        socket.emit('new direct message', data); 

        // Отправляем получателю, если онлайн
        const recipientSocketId = activeUsers.get(data.recipientId);
        if (recipientSocketId) {
            // Убеждаемся, что не отправляем сообщение самому себе дважды, если это разные сокеты
            if (recipientSocketId !== socket.id) {
                io.to(recipientSocketId).emit('new direct message', data);
            }
        }
    });

    // Обработка отключения
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        // Находим ID пользователя, связанный с отключенным сокетом
        for (const [userId, socketId] of activeUsers.entries()) {
            if (socketId === socket.id) {
                activeUsers.delete(userId);
                // Уведомляем всех друзей об обновлении статуса
                io.emit('status update', { userId: userId, status: 'offline' });
                break;
            }
        }
    });
});

// --- 🚀 Server Start ---
server.listen(PORT, () => {
    console.log(`NeoCord Server running on http://localhost:${PORT}`);
});