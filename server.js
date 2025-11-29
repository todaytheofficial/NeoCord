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
const io = new Server(server);

const USERS_FILE = 'users.json';
const PORT = 3000;
const SALT_ROUNDS = 10;
const DEFAULT_AVATAR = '/images/default-anon-avatar.png'; // Убедитесь, что этот файл существует в public/images

// --- Middleware Setup ---
app.use(express.json()); // Для парсинга JSON-тел запросов
app.use(cookieParser()); // Для работы с HTTP-куками
app.use(express.static(path.join(__dirname, 'public'))); // Обслуживание статики

// --- 💾 JSON Data Management Functions ---
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

async function saveUsers(users) {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

// --- 🔒 Authentication Middleware ---
async function authenticateUser(req, res, next) {
    const token = req.cookies.auth_token;
    if (!token) {
        return res.status(401).send({ message: 'Authentication required' });
    }

    const users = await loadUsers();
    let authenticatedUser = null;

    // Ищем пользователя по токену сессии
    for (const username in users) {
        if (users[username].sessionToken === token) {
            authenticatedUser = users[username];
            break;
        }
    }
    
    if (authenticatedUser) {
        req.user = authenticatedUser;
        return next();
    }
    
    res.clearCookie('auth_token');
    res.status(401).send({ message: 'Invalid session token' });
}

// --- 💬 Direct Message (DM) Storage ---

async function saveMessage(senderId, recipientId, messageData) {
    const users = await loadUsers();
    
    // Находим ключи (usernames) по ID
    const senderKey = Object.keys(users).find(key => users[key].id === senderId);
    const recipientKey = Object.keys(users).find(key => users[key].id === recipientId);

    if (!senderKey || !recipientKey) return;

    // Инициализация dms (Direct Messages)
    if (!users[senderKey].dms) users[senderKey].dms = {};
    if (!users[recipientKey].dms) users[recipientKey].dms = {};

    // Инициализация чата, если не существует
    if (!users[senderKey].dms[recipientId]) users[senderKey].dms[recipientId] = [];
    if (!users[recipientKey].dms[senderId]) users[recipientKey].dms[senderId] = [];
    
    // Сохраняем сообщение у обоих пользователей
    users[senderKey].dms[recipientId].push(messageData);
    users[recipientKey].dms[senderId].push(messageData);

    await saveUsers(users);
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
        pendingInvites: [],
        sessionToken: sessionToken,
        avatarUrl: DEFAULT_AVATAR,
        dms: {}
    };

    await saveUsers(users);
    
    res.cookie('auth_token', sessionToken, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }); 
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

    res.cookie('auth_token', newSessionToken, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.send({ message: 'Login successful', profileName: user.profileName, userId: user.id, avatarUrl: user.avatarUrl });
});

app.get('/', async (req, res) => {
    if (req.cookies.auth_token) {
        return res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/api/profile', authenticateUser, (req, res) => {
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

// --- 🔑 API Endpoints: Friends ---

app.get('/api/friends', authenticateUser, async (req, res) => {
    const users = await loadUsers();
    
    const friendIDs = req.user.friends || [];
    const inviteIDs = req.user.pendingInvites || [];
    
    const userMap = {};
    for (const username in users) {
        userMap[users[username].id] = {
            id: users[username].id,
            profileName: users[username].profileName,
            avatarUrl: users[username].avatarUrl
        };
    }

    const friendList = friendIDs.map(id => userMap[id]).filter(user => user);
    const inviteList = inviteIDs.map(id => userMap[id]).filter(user => user);

    res.json({ friends: friendList, pendingInvites: inviteList });
});


app.post('/api/friends/invite', authenticateUser, async (req, res) => {
    const { targetUsername } = req.body;
    const senderId = req.user.id;
    
    const users = await loadUsers();
    const targetUser = users[targetUsername];

    if (!targetUser) {
        return res.status(404).send({ message: 'User not found.' });
    }
    if (targetUser.id === senderId) {
         return res.status(400).send({ message: 'You cannot invite yourself.' });
    }
    if ((targetUser.pendingInvites || []).includes(senderId) || (targetUser.friends || []).includes(senderId)) {
        return res.status(400).send({ message: 'Invitation already sent or already friends.' });
    }

    // 1. Добавляем ID отправителя в pendingInvites получателя
    targetUser.pendingInvites = [...(targetUser.pendingInvites || []), senderId];
    await saveUsers(users);

    // 2. Отправляем уведомление получателю через Socket.IO
    const targetSocketId = activeUsers.get(targetUser.id);
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
    const { senderId, action } = req.body; // action: 'accept' или 'decline'
    const recipientId = req.user.id;
    
    const users = await loadUsers();
    
    const recipientKey = req.user.profileName;
    const senderKey = Object.keys(users).find(key => users[key].id === senderId);

    if (!senderKey) {
        return res.status(404).send({ message: 'Sender not found.' });
    }
    
    const recipientUser = users[recipientKey];
    const senderUser = users[senderKey];

    // 1. Удаляем ID отправителя из pendingInvites получателя
    recipientUser.pendingInvites = (recipientUser.pendingInvites || []).filter(id => id !== senderId);

    if (action === 'accept') {
        // 2. Добавляем ID друг друга в списки друзей, если их там еще нет
        if (!(recipientUser.friends || []).includes(senderId)) {
            recipientUser.friends = [...(recipientUser.friends || []), senderId];
        }
        if (!(senderUser.friends || []).includes(recipientId)) {
            senderUser.friends = [...(senderUser.friends || []), recipientId];
        }
    }
    
    await saveUsers(users);

    // 3. Отправляем уведомление обоим пользователям об обновлении списка
    const senderSocketId = activeUsers.get(senderId);
    
    if (senderSocketId) {
        io.to(senderSocketId).emit('friend list updated', { status: action });
    }
    
    io.to(activeUsers.get(recipientId)).emit('friend list updated', { status: action });

    res.send({ message: `Invitation ${action}ed.` });
});


// --- 💬 Socket.IO Real-Time Messaging and Friends ---

const activeUsers = new Map(); 

io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('register socket', (userId) => {
        if (userId) {
            activeUsers.set(userId, socket.id);
            console.log(`User ${userId} registered socket: ${socket.id}`);
            io.emit('status update', { userId: userId, status: 'online' });
        }
    });
    
    socket.on('send direct message', async (data) => {
        // data: { senderId, recipientId, senderName, content, timestamp, avatarUrl }
        
        await saveMessage(data.senderId, data.recipientId, data);

        // Отправляем отправителю обратно
        socket.emit('new direct message', data); 

        // Отправляем получателю, если онлайн
        const recipientSocketId = activeUsers.get(data.recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('new direct message', data);
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        for (const [userId, socketId] of activeUsers.entries()) {
            if (socketId === socket.id) {
                activeUsers.delete(userId);
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