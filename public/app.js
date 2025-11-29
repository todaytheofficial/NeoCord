// --- Инициализация и Глобальные Переменные ---
const socket = io();
let currentUser = { id: null, profileName: 'Guest', avatarUrl: '/images/default-anon-avatar.png', status: 'online', friends: [] };
let activeChat = { id: null, name: null, avatar: null };

// --- DOM Элементы ---
const bodyEl = document.body;
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const userDropdownMenu = document.getElementById('user-dropdown-menu');
const chatHeader = document.getElementById('chat-header');
const currentAvatarTopEl = document.getElementById('current-avatar-top');
const onlineFriendsList = document.getElementById('online-friends');
const pendingInvitesList = document.getElementById('pending-invites');
const networkUsersList = document.getElementById('network-users');
const settingsModal = document.getElementById('settings-modal');
const settingAvatarPreview = document.getElementById('setting-avatar-preview');
const voiceButton = document.getElementById('voice-record-button');
const pendingCountEl = document.getElementById('pending-count');

// Нижний виджет профиля
const bottomProfileWidget = document.getElementById('bottom-profile-widget');
const bottomAvatarEl = bottomProfileWidget ? bottomProfileWidget.querySelector('.profile-avatar') : null;
const bottomStatusDot = bottomProfileWidget ? bottomProfileWidget.querySelector('.status-dot') : null;
const bottomNameEl = bottomProfileWidget ? bottomProfileWidget.querySelector('#profile-name-bottom') : null;

// --- SVG Icon Definitions (Для надежной работы иконок) ---
const SVG_ICONS = {
    settings: '<svg viewBox="0 0 24 24"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.39-1.07-.75-1.68-1.03l-.42-2.53c-.07-.2-.25-.34-.46-.34H12c-.21 0-.39.14-.44.34l-.42 2.53c-.61.28-1.16.64-1.68 1.03l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.12.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.39 1.07.75 1.68 1.03l.42 2.53c.07.2.25.34.46.34h4c.21 0 .39-.14.44-.34l.42-2.53c.61-.28 1.16-.64 1.68-1.03l2.49 1c.22.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>',
    logout: '<svg viewBox="0 0 24 24"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>',
    user_group: '<svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3s-1.33-3-2.99-3S13 6.34 13 8s1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3s-1.34-3-3-3S5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.48.87 2.5 2.24 2.5 3.45V19h6v-2.5c0-2.33-4.67-3.5-7.53-3.5z"/></svg>',
    mic: '<svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-2.99c0 3.53-2.61 6.43-6 6.94V21h-2v-2.06c-3.39-.51-6-3.41-6-6.94H3c0 4.19 3.57 7.67 8 8.4V22h2v-2.4c4.43-.73 8-4.21 8-8.4h-2.7z"/></svg>',
    paperclip: '<svg viewBox="0 0 24 24"><path d="M16.5 6v11.5c0 2.21-1.79 4-4s-4-1.79-4-4V7.5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5V16c0 .55-.45 1-1 1s-1-.45-1-1V7.5H12v8.5c0 1.38-1.12 2.5-2.5 2.5s-2.5-1.12-2.5-2.5V6H7v10.5c0 2.21 1.79 4 4 4s4-1.79 4-4V6h1.5z"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
    globe: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.78l4.49 4.49-1.93 3.49zm3.62-1.92l-2.08-3.74 3.74-2.08c1.33.6 2.44 1.48 3.25 2.54l-4.91 3.28zm4.55-5.63c-.15-.09-3.23-1.9-6.17-1.9s-6.02 1.81-6.17 1.9L4.03 12c.62-3.89 3.97-7 7.97-7s7.35 3.11 7.97 7l-4.79 3.38zm-1.89 3.06l-3.33-1.92-3.33 1.92c-.67-.88-1.2-1.86-1.52-2.9l4.85-3.38 4.85 3.38c-.32 1.04-.85 2.02-1.52 2.9z"/></svg>',
    add_user: '<svg viewBox="0 0 24 24"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 3c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm9 0c-.29 0-.62.02-.97.05 1.48.87 2.5 2.24 2.5 3.45V19h6v-2.5c0-2.33-4.67-3.5-7.53-3.5z"/></svg>',
};

function getIconSVG(iconName) {
    return SVG_ICONS[iconName] || '';
}

// --- Инициализация: Получение Профиля ---

/**
 * Применяет сохраненную тему (dark/light).
 */
function applyTheme(theme) {
    if (theme === 'light') {
        bodyEl.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
    } else {
        bodyEl.classList.remove('light-theme');
        localStorage.setItem('theme', 'dark');
    }
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) themeSelect.value = theme;
}

/**
 * Обновляет состояние индикатора статуса (точки).
 */
function updateStatusDot(dotElement, status) {
    dotElement.classList.remove('online', 'away', 'offline');
    dotElement.classList.add(status);
}

/**
 * Загружает данные профиля текущего пользователя.
 */
async function fetchProfile() {
    applyTheme(localStorage.getItem('theme') || 'dark'); 

    try {
        const response = await fetch('/api/profile');
        if (response.status === 401) {
            window.location.href = '/login.html';
            return;
        }
        const user = await response.json();
        currentUser = {
            id: user.id,
            profileName: user.profileName,
            avatarUrl: user.avatarUrl,
            status: user.status || 'online',
            friends: user.friends || []
        };
        
        updateProfileUI(currentUser);
        requestNotificationPermission();
        // 1. Регистрируем сокет для получения real-time обновлений
        socket.emit('register socket', currentUser.id);
        // 2. Загружаем данные друзей и сети
        fetchFriendData(); 

    } catch (error) {
        console.error('Error fetching profile:', error);
    }
}

/**
 * Обновляет элементы интерфейса данными пользователя.
 */
function updateProfileUI(user) {
    document.getElementById('profile-name-top').textContent = user.profileName;
    currentAvatarTopEl.style.backgroundImage = `url(${user.avatarUrl})`;
    
    // Обновление нижнего виджета
    if (bottomProfileWidget) {
        bottomAvatarEl.style.backgroundImage = `url(${user.avatarUrl})`;
        bottomNameEl.textContent = user.profileName;
        updateStatusDot(bottomStatusDot, user.status);
    }
}

// --- Меню и Настройки ---

function toggleUserMenu() {
    userDropdownMenu.classList.toggle('hidden');
}

function logoutUser() {
    document.cookie = 'auth_token=; Max-Age=0; path=/';
    window.location.href = '/login.html';
}

// Переключение вкладок друзей
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        document.querySelectorAll('.friend-list-view').forEach(list => list.classList.add('hidden'));
        
        if (e.currentTarget.dataset.tab === 'online') {
            onlineFriendsList.classList.remove('hidden');
        } else if (e.currentTarget.dataset.tab === 'pending') {
            pendingInvitesList.classList.remove('hidden');
        } else if (e.currentTarget.dataset.tab === 'network') {
            networkUsersList.classList.remove('hidden');
        }
    });
});

function changeTheme(theme) {
    applyTheme(theme);
}

function changeLanguage(lang) {
    localStorage.setItem('language', lang);
    console.log(`Language set to: ${lang}`);
}

/**
 * Открывает модальное окно настроек.
 */
function openSettingsModal() {
    userDropdownMenu.classList.add('hidden');
    
    // Установка текущего имени и аватарки
    document.getElementById('new-username').value = currentUser.profileName;
    settingAvatarPreview.style.backgroundImage = `url(${currentUser.avatarUrl})`;
    
    // Установка текущих настроек
    document.getElementById('theme-select').value = localStorage.getItem('theme') || 'dark';
    document.getElementById('language-select').value = localStorage.getItem('language') || 'ru';
    
    // BUGFIX: Убедиться, что display: flex
    settingsModal.style.display = 'flex';
}

function closeSettingsModal() {
    settingsModal.style.display = 'none';
}

/**
 * Имитация сохранения аватарки (в реальности сохраняет Data URL в currentUser).
 */
function saveAvatar() {
    const fileInput = document.getElementById('avatar-upload-input');
    const file = fileInput.files[0];

    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const tempUrl = e.target.result;
            // В боевом приложении здесь был бы API-вызов для загрузки на сервер
            currentUser.avatarUrl = tempUrl; 
            updateProfileUI(currentUser);
            closeSettingsModal();
        }
        reader.readAsDataURL(file);
    } else {
        alert('Please select a file.');
    }
}


// --- Управление Друзьями ---

async function fetchFriendData() {
    try {
        const response = await fetch('/api/friends');
        if (!response.ok) throw new Error('Failed to fetch friends');
        
        const data = await response.json();
        
        loadFriendListUI(data.friends || []);
        loadPendingInvitesUI(data.pendingInvites || []);
        loadNetworkUsersUI(data.networkUsers || []);

    } catch (error) {
        console.error('Error fetching friend data:', error);
    }
}

function loadFriendListUI(friends) {
    onlineFriendsList.innerHTML = '';

    friends.forEach(friend => {
        const item = document.createElement('li');
        item.classList.add('friend-item');
        item.setAttribute('data-friend-id', friend.id);
        item.onclick = () => openChat(friend);
        
        item.innerHTML = `
            <div class="profile-avatar-container">
                <div class="profile-avatar message-avatar" style="background-image: url(${friend.avatarUrl});"></div>
                <div class="status-dot offline"></div> </div>
            <div class="friend-item-info">
                <strong>${friend.profileName}</strong>
                <span class="friend-item-status offline">Offline</span>
            </div>
            <button class="icon-button">${getIconSVG('send')}</button>
        `;
        onlineFriendsList.appendChild(item);
    });
}

function loadPendingInvitesUI(invites) {
    pendingInvitesList.innerHTML = '';
    
    // Обновление счетчика приглашений
    const inviteCount = invites.length;
    pendingCountEl.textContent = inviteCount;
    const pendingTab = document.querySelector('.tab-button[data-tab="pending"]');
    
    if (inviteCount > 0) {
        pendingTab.classList.add('notification-badge');
        pendingTab.setAttribute('data-count', inviteCount);
    } else {
        pendingTab.classList.remove('notification-badge');
        pendingTab.removeAttribute('data-count');
    }
    
    if (inviteCount === 0) {
        pendingInvitesList.innerHTML = '<li style="text-align: center; color: var(--text-secondary); padding: 20px;">No pending invites.</li>';
        return;
    }

    invites.forEach(invite => {
        const item = document.createElement('li');
        item.classList.add('pending-invite-item');
        item.setAttribute('data-sender-id', invite.id);

        item.innerHTML = `
            <div style="display: flex; align-items: center;">
                <div class="profile-avatar message-avatar" style="background-image: url(${invite.avatarUrl}); width: 30px; height: 30px; margin-right: 10px;"></div>
                <div class="friend-item-info">
                    <strong>${invite.profileName}</strong>
                </div>
            </div>
            <div class="invite-actions">
                <button class="accept-button" onclick="respondToInvite('${invite.id}', 'accept')">Accept</button>
                <button class="decline-button" onclick="respondToInvite('${invite.id}', 'decline')">Decline</button>
            </div>
        `;
        pendingInvitesList.appendChild(item);
    });
}

function loadNetworkUsersUI(users) {
    networkUsersList.innerHTML = '';
    
    if (users.length === 0) {
        networkUsersList.innerHTML = '<li style="text-align: center; color: var(--text-secondary); padding: 20px;">All users are friends or have pending status.</li>';
        return;
    }

    users.forEach(user => {
        const item = document.createElement('li');
        item.classList.add('network-user-item');
        item.innerHTML = `
            <div style="display: flex; align-items: center;">
                <div class="profile-avatar message-avatar" style="background-image: url(${user.avatarUrl}); width: 30px; height: 30px; margin-right: 10px;"></div>
                <div class="friend-item-info">
                    <strong>${user.profileName}</strong>
                </div>
            </div>
            <div class="invite-actions">
                <button class="add-user-button" onclick="sendFriendInvite('${user.profileName}')">
                    ${getIconSVG('add_user')} Добавить
                </button>
            </div>
        `;
        networkUsersList.appendChild(item);
    });
}

/**
 * Отправляет приглашение другу. Может принимать имя пользователя из кнопки или из инпута.
 * @param {string} username - Имя пользователя для отправки приглашения.
 */
async function sendFriendInvite(username = null) {
    const targetUsername = username || document.getElementById('add-friend-input').value.trim();
    if (!targetUsername) return;

    const inviteStatusEl = document.getElementById('invite-status');
    inviteStatusEl.textContent = 'Sending...';

    try {
        const response = await fetch('/api/friends/invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUsername })
        });

        const result = await response.json();
        
        if (response.ok) {
            inviteStatusEl.textContent = `Invitation sent to ${targetUsername}!`;
            document.getElementById('add-friend-input').value = '';
            fetchFriendData(); // Обновить списки
        } else {
            inviteStatusEl.textContent = `Error: ${result.message}`;
        }
    } catch (error) {
        inviteStatusEl.textContent = 'Network error.';
    }
}

async function respondToInvite(senderId, action) {
    try {
        const response = await fetch('/api/friends/respond', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderId, action })
        });
        
        if (response.ok) {
            fetchFriendData(); // Обновить списки
        } else {
            console.error('Failed to respond to invite.');
        }
    } catch (error) {
        console.error('Network error responding to invite:', error);
    }
}


// --- Логика Чата / Socket Handlers ---

function addMessageToChat(senderName, content, timestamp, avatarUrl) {
    const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('chat-message');
    
    const isCurrentUser = senderName === currentUser.profileName;
    if (isCurrentUser) {
        messageDiv.classList.add('current-user');
    }

    const avatarDiv = document.createElement('div');
    avatarDiv.classList.add('message-avatar');
    avatarDiv.style.backgroundImage = `url(${avatarUrl})`;
    
    const contentWrapper = document.createElement('div');
    contentWrapper.classList.add('message-content-wrapper');

    contentWrapper.innerHTML = `
        <span class="message-header">
            <strong>${senderName}</strong> 
            <small>${timeStr}</small>
        </span>
        <div class="message-content">${content}</div>
    `;
    
    // Порядок элементов зависит от того, кто отправил
    if (isCurrentUser) {
        messageDiv.appendChild(contentWrapper);
        messageDiv.appendChild(avatarDiv);
    } else {
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentWrapper);
    }
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function openChat(friend) {
    activeChat = { id: friend.id, name: friend.profileName, avatar: friend.avatarUrl };
    
    chatHeader.innerHTML = `
        <div class="profile-avatar message-avatar" style="background-image: url(${friend.avatarUrl}); margin-right: 10px;"></div>
        <h2>${friend.profileName}</h2>
    `;
    document.getElementById('message-input-area').classList.remove('hidden');
    messagesContainer.innerHTML = ''; // Очистка чата

    // Загрузка истории
    try {
        const response = await fetch(`/api/dms/${friend.id}`);
        const history = await response.json();
        
        history.forEach(msg => {
            addMessageToChat(msg.senderName, msg.content, msg.timestamp, msg.avatarUrl);
        });

    } catch (error) {
        messagesContainer.innerHTML = '<div style="text-align: center; color: var(--error-color); padding: 20px;">Could not load chat history.</div>';
        console.error('Error loading DMs:', error);
    }
}

sendButton.addEventListener('click', () => {
    const content = messageInput.value.trim();
    if (content && activeChat.id) {
        const messageData = {
            senderId: currentUser.id,
            recipientId: activeChat.id,
            senderName: currentUser.profileName,
            content: content,
            timestamp: Date.now(),
            avatarUrl: currentUser.avatarUrl
        };
        socket.emit('send direct message', messageData);
        messageInput.value = ''; 
        messageInput.style.height = '45px'; // Сброс размера
    }
});

// Автоматическое изменение размера поля ввода
messageInput.addEventListener('input', () => {
    messageInput.style.height = '45px';
    const scrollHeight = messageInput.scrollHeight;
    messageInput.style.height = Math.min(scrollHeight, 200) + 'px';
});

// Обработка входящих сообщений в реальном времени
socket.on('new direct message', (data) => {
    const isRecipient = data.recipientId === currentUser.id;
    const isActiveChat = data.senderId === activeChat.id || data.recipientId === activeChat.id;

    if (isActiveChat) {
        addMessageToChat(data.senderName, data.content, data.timestamp, data.avatarUrl);
    }
    
    if (isRecipient && !isActiveChat) {
        showBrowserNotification(data.senderName, data.content);
    }
});

// Обновление при получении приглашения
socket.on('friend invite received', (senderData) => {
    fetchFriendData(); 
    showBrowserNotification('NeoCord', `New friend request from ${senderData.profileName}!`);
});

// Обновление при принятии/отклонении
socket.on('friend list updated', (data) => {
    fetchFriendData(); 
    if (data.status === 'accept') {
        showBrowserNotification('NeoCord', `Friend request accepted!`);
    }
});

// Обновление статусов друзей
socket.on('status update', (data) => {
    const friendItem = document.querySelector(`.friend-item[data-friend-id="${data.userId}"]`);
    if (friendItem) {
        const friendItemStatusEl = friendItem.querySelector('.friend-item-status');
        const friendItemDotEl = friendItem.querySelector('.status-dot');
        
        if (friendItemStatusEl) {
            friendItemStatusEl.textContent = data.status.charAt(0).toUpperCase() + data.status.slice(1);
            friendItemStatusEl.className = `friend-item-status ${data.status}`;
        }
        if (friendItemDotEl) {
            updateStatusDot(friendItemDotEl, data.status);
        }
    }
});

// --- Web Notifications API ---

function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission();
    }
}

function showBrowserNotification(senderName, content) {
    const plainTextContent = content.replace(/<[^>]+>/g, '').substring(0, 100);

    if (Notification.permission === 'granted') {
        new Notification(`${senderName}`, {
            body: plainTextContent,
            icon: currentUser.avatarUrl,
            tag: 'neocord-message'
        });
    }
}


// --- Мультимедиа и Голос ---

let isRecording = false;

voiceButton.addEventListener('click', () => {
    if (!activeChat.id) return;
    
    if (!isRecording) {
        voiceButton.classList.add('recording');
        isRecording = true;
        // Здесь должна быть логика начала записи
    } else {
        voiceButton.classList.remove('recording');
        isRecording = false;
        // Здесь должна быть логика остановки и отправки
        
        const contentHTML = `
            <div class="voice-message-imitation">
                <span class="custom-icon icon-mic" style="color: var(--error-color);">${getIconSVG('mic')}</span> 
                <span><strong>Voice Message (0:05)</strong></span>
                <span style="font-size: 0.8em; color: var(--text-secondary); margin-left: 10px;">(Imitation)</span>
            </div>
        `;
        const messageData = {
            senderId: currentUser.id,
            recipientId: activeChat.id,
            senderName: currentUser.profileName,
            content: contentHTML,
            timestamp: Date.now(),
            avatarUrl: currentUser.avatarUrl
        };
        socket.emit('send direct message', messageData);
    }
});

function handleFileUpload(event) {
    if (!activeChat.id) {
        alert("Please open a chat before sending files.");
        event.target.value = '';
        return;
    }
    
    const file = event.target.files[0];
    if (!file) return;

    if (confirm(`Send file: ${file.name}?`)) {
        // В реальном приложении файл загружается на сервер
        const tempUrl = URL.createObjectURL(file);
        
        let contentHTML = '';
        if (file.type.startsWith('image')) {
            contentHTML = `<img src="${tempUrl}" alt="${file.name}" style="max-width: 100%; max-height: 200px; border-radius: 5px;">`;
        } else {
            contentHTML = `<a href="${tempUrl}" target="_blank" style="color: var(--accent-color); text-decoration: underline;">Download File: ${file.name} (${(file.size / 1024).toFixed(1)} KB)</a>`;
        }
        
        const messageData = {
            senderId: currentUser.id,
            recipientId: activeChat.id,
            senderName: currentUser.profileName,
            content: contentHTML,
            timestamp: Date.now(),
            avatarUrl: currentUser.avatarUrl
        };
        socket.emit('send direct message', messageData);
    }
    event.target.value = '';
}


// --- DOM Content Loaded / Setup ---
document.addEventListener('DOMContentLoaded', () => {
    // Вставка SVG-иконок
    document.getElementById('friends-icon-header').innerHTML = getIconSVG('user_group');
    document.getElementById('mic-icon-button').innerHTML = getIconSVG('mic');
    document.getElementById('paperclip-icon-button').innerHTML = getIconSVG('paperclip');
    document.getElementById('send-icon-button').innerHTML = getIconSVG('send');
    document.getElementById('settings-icon-menu').innerHTML = getIconSVG('settings');
    document.getElementById('logout-icon-menu').innerHTML = getIconSVG('logout');
    document.getElementById('close-icon-modal').innerHTML = getIconSVG('close');
    
    // Иконка для вкладки Network
    const networkTabIcon = document.getElementById('network-icon-header');
    if (networkTabIcon) networkTabIcon.innerHTML = getIconSVG('globe');
    
    // Кнопка настроек в нижнем виджете
    const settingsIconEl = document.getElementById('settings-icon-bottom');
    if (settingsIconEl) {
        settingsIconEl.innerHTML = getIconSVG('settings');
        settingsIconEl.onclick = openSettingsModal;
    }
    
    // Привязка функции отправки приглашения к инпуту в GUI
    const manualInviteButton = document.querySelector('.add-friend-wrapper button');
    if(manualInviteButton) {
        manualInviteButton.onclick = () => sendFriendInvite(null);
    }
});


fetchProfile();