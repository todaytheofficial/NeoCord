// Initialization
const socket = io();
let currentUser = { id: null, profileName: 'Guest', avatarUrl: null, status: 'online', friends: [] };
let activeChat = { id: null, name: null, avatar: null };

// DOM Elements
const bodyEl = document.body;
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const userDropdownMenu = document.getElementById('user-dropdown-menu');
const chatHeader = document.getElementById('chat-header');
const currentAvatarTopEl = document.getElementById('current-avatar-top');
const onlineFriendsList = document.getElementById('online-friends');
const pendingInvitesList = document.getElementById('pending-invites');
const inviteStatusEl = document.getElementById('invite-status');
const settingsModal = document.getElementById('settings-modal');
const settingAvatarPreview = document.getElementById('setting-avatar-preview');
const voiceButton = document.getElementById('voice-record-button');
const pendingCountEl = document.getElementById('pending-count');

// Нижний виджет профиля
const bottomProfileWidget = document.getElementById('bottom-profile-widget');
const bottomAvatarEl = bottomProfileWidget ? bottomProfileWidget.querySelector('.profile-avatar') : null;
const bottomStatusDot = bottomProfileWidget ? bottomProfileWidget.querySelector('.status-dot') : null;
const bottomNameEl = bottomProfileWidget ? bottomProfileWidget.querySelector('#profile-name-bottom') : null;


// --- SVG Icon Definitions (Инлайн SVG) ---
const SVG_ICONS = {
    settings: '<svg viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-3-3l-.08-.54C8.42 11.2 8.5 11.08 8.5 11c0-.08-.08-.2-.14-.46l.08-.54 1.1-.88c-.14-.2-.27-.42-.4-.64l-1.1-.88-.47-.28c-.2.27-.42.5-.64.73l-.75-.46c-.23.23-.46.46-.73.69L6.1 8.24c-.1.2-.2.4-.2.64 0 .23.1.43.2.64l.47.28-.75.46c-.23.23-.46.46-.69.73l.28.47 1.1.88c.14.2.27.42.4.64l-1.1.88zM14.5 13c0 .55.45 1 1 1s1-.45 1-1-.45-1-1-1-1 .45-1 1zm0 2c0 .55.45 1 1 1s1-.45 1-1-.45-1-1-1-1 .45-1 1z"/></svg>',
    logout: '<svg viewBox="0 0 24 24"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>',
    user_group: '<svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3s-1.33-3-2.99-3S13 6.34 13 8s1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3s-1.34-3-3-3S5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.48.87 2.5 2.24 2.5 3.45V19h6v-2.5c0-2.33-4.67-3.5-7.53-3.5z"/></svg>',
    mic: '<svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-2.99c0 3.53-2.61 6.43-6 6.94V21h-2v-2.06c-3.39-.51-6-3.41-6-6.94H3c0 4.19 3.57 7.67 8 8.4V22h2v-2.4c4.43-.73 8-4.21 8-8.4h-2.7z"/></svg>',
    paperclip: '<svg viewBox="0 0 24 24"><path d="M16.5 6v11.5c0 2.21-1.79 4-4s-4-1.79-4-4V7.5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5V16c0 .55-.45 1-1 1s-1-.45-1-1V7.5H12v8.5c0 1.38-1.12 2.5-2.5 2.5s-2.5-1.12-2.5-2.5V6H7v10.5c0 2.21 1.79 4 4 4s4-1.79 4-4V6h1.5z"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
    theme_light: '<svg viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm0-13c-.55 0-1 .45-1 1v2c0 .55.45 1 1 1s1-.45 1-1V3c0-.55-.45-1-1-1zm-7 12c.55 0 1 .45 1 1v2c0 .55-.45 1-1 1s-1-.45-1-1v-2c0-.55.45-1 1-1zM12 21c-.55 0-1 .45-1 1v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1zm8-9c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1s-1 .45-1 1v2c0 .55.45 1 1 1zm-8 4c-3.31 0-6-2.69-6-6S8.69 4 12 4s6 2.69 6 6-2.69 6-6 6zm10 2v2c0 .55-.45 1-1 1s-1-.45-1-1v-2c0-.55.45-1 1-1s1 .45 1 1zM2 13v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1z"/></svg>',
};

// Функция для вставки SVG в DOM
function getIconSVG(iconName) {
    return SVG_ICONS[iconName] || '';
}

// --- Initialization: Get Profile Data ---
async function fetchProfile() {
    // 1. Применяем тему из localStorage перед загрузкой
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

        socket.emit('register socket', currentUser.id);
        
        fetchFriendData(); 

    } catch (error) {
        console.error('Error fetching profile:', error);
        // Не перенаправляем, если ошибка не 401 (например, ошибка сети), просто показываем ошибку
    }
}

function updateProfileUI(user) {
    document.getElementById('profile-name-top').textContent = user.profileName;
    currentAvatarTopEl.style.backgroundImage = `url(${user.avatarUrl})`;
    
    // Вставляем иконки в виджеты
    document.getElementById('settings-icon-bottom').innerHTML = getIconSVG('settings');

    if (bottomProfileWidget) {
        bottomAvatarEl.style.backgroundImage = `url(${user.avatarUrl})`;
        bottomNameEl.textContent = user.profileName;
        updateStatusDot(bottomStatusDot, user.status);
    }
}

function updateStatusDot(dotElement, status) {
    dotElement.classList.remove('online', 'away', 'offline');
    dotElement.classList.add(status);
}

// --- Menu and Layout Logic ---
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
        e.target.classList.add('active');
        
        document.querySelectorAll('.friend-list-view').forEach(list => list.classList.add('hidden'));
        
        if (e.target.dataset.tab === 'online') {
            onlineFriendsList.classList.remove('hidden');
        } else if (e.target.dataset.tab === 'pending') {
            pendingInvitesList.classList.remove('hidden');
        }
    });
});

// --- Theme Management ---
function applyTheme(theme) {
    if (theme === 'light') {
        bodyEl.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
        document.getElementById('theme-select').value = 'light';
    } else {
        bodyEl.classList.remove('light-theme');
        localStorage.setItem('theme', 'dark');
        document.getElementById('theme-select').value = 'dark';
    }
}

function changeTheme(theme) {
    applyTheme(theme);
}

// --- Friend Management ---

async function fetchFriendData() {
    try {
        const response = await fetch('/api/friends');
        if (!response.ok) throw new Error('Failed to fetch friends');
        
        const data = await response.json();
        
        loadFriendListUI(data.friends || []);
        loadPendingInvitesUI(data.pendingInvites || []);

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
            <div class="profile-avatar message-avatar" style="background-image: url(${friend.avatarUrl});"></div>
            <div class="friend-item-info">
                <strong>${friend.profileName}</strong>
                <span class="friend-item-status online">Online</span>
            </div>
            <button class="icon-button">${getIconSVG('send')}</button>
        `;
        onlineFriendsList.appendChild(item);
    });
}

function loadPendingInvitesUI(invites) {
    pendingInvitesList.innerHTML = '';
    
    pendingCountEl.textContent = invites.length;
    const pendingTab = document.querySelector('.tab-button[data-tab="pending"]');
    if (invites.length > 0) {
        pendingTab.classList.add('notification-badge');
        pendingTab.setAttribute('data-count', invites.length);
    } else {
        pendingTab.classList.remove('notification-badge');
        pendingTab.removeAttribute('data-count');
    }
    
    invites.forEach(invite => {
        const item = document.createElement('li');
        item.classList.add('pending-invite-item');
        item.setAttribute('data-sender-id', invite.id);

        item.innerHTML = `
            <div class="profile-avatar message-avatar" style="background-image: url(${invite.avatarUrl}); width: 30px; height: 30px;"></div>
            <div class="friend-item-info">
                <strong>${invite.profileName}</strong>
            </div>
            <div class="invite-actions">
                <button class="accept-button" onclick="respondToInvite('${invite.id}', 'accept')">Accept</button>
                <button class="decline-button" onclick="respondToInvite('${invite.id}', 'decline')">Decline</button>
            </div>
        `;
        pendingInvitesList.appendChild(item);
    });
}

async function sendFriendInvite() {
    const targetUsername = document.getElementById('add-friend-input').value.trim();
    if (!targetUsername) return;

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
            fetchFriendData(); 
        } else {
            console.error('Failed to respond to invite.');
        }
    } catch (error) {
        console.error('Network error responding to invite:', error);
    }
}


// --- Chat Logic ---

function addMessageToChat(senderName, content, timestamp, avatarUrl) {
    const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('chat-message');
    
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
    
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentWrapper);
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
    messagesContainer.innerHTML = '';
    
    try {
        const response = await fetch(`/api/dms/${friend.id}`);
        const history = await response.json();
        
        history.forEach(msg => {
            addMessageToChat(msg.senderName, msg.content, msg.timestamp, msg.avatarUrl);
        });

    } catch (error) {
        messagesContainer.innerHTML = 'Could not load chat history.';
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
        messageInput.style.height = '45px';
    }
});

// Адаптивное изменение размера textarea
messageInput.addEventListener('input', () => {
    messageInput.style.height = '45px';
    const scrollHeight = messageInput.scrollHeight;
    messageInput.style.height = Math.min(scrollHeight, 200) + 'px';
});

// --- Socket.IO Handlers ---

socket.on('new direct message', (data) => {
    const isSender = data.senderId === currentUser.id;
    const isRecipient = data.recipientId === currentUser.id;
    const isActiveChat = data.senderId === activeChat.id || data.recipientId === activeChat.id;

    if (isActiveChat) {
        addMessageToChat(data.senderName, data.content, data.timestamp, data.avatarUrl);
    }
    
    if (isRecipient && !isActiveChat) {
        showBrowserNotification(data.senderName, data.content);
    }
});

socket.on('friend invite received', (senderData) => {
    fetchFriendData(); 
    showBrowserNotification('NeoCord', `New friend request from ${senderData.profileName}!`);
});

socket.on('friend list updated', (data) => {
    fetchFriendData(); 
    if (data.status === 'accept') {
        showBrowserNotification('NeoCord', `Friend request accepted!`);
    }
});

socket.on('status update', (data) => {
    const friendItemStatusEl = document.querySelector(`.friend-item[data-friend-id="${data.userId}"] .friend-item-status`);
    if (friendItemStatusEl) {
        friendItemStatusEl.textContent = data.status.charAt(0).toUpperCase() + data.status.slice(1);
        friendItemStatusEl.className = `friend-item-status ${data.status}`;
    }
});


// --- Web Notifications API ---
function requestNotificationPermission() {
    if ('Notification' in window) {
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

// --- Settings Modal Logic ---
function openSettingsModal() {
    userDropdownMenu.classList.add('hidden');
    
    // Инициализация полей
    document.getElementById('new-username').value = currentUser.profileName;
    settingAvatarPreview.style.backgroundImage = `url(${currentUser.avatarUrl})`;
    
    // Загрузка текущих настроек
    document.getElementById('theme-select').value = localStorage.getItem('theme') || 'dark';
    document.getElementById('language-select').value = localStorage.getItem('language') || 'ru';
    
    // Вставляем иконки в настройки
    document.getElementById('theme-select-icon').innerHTML = getIconSVG('theme_light');
    
    settingsModal.style.display = 'flex';
}

function closeSettingsModal() {
    settingsModal.style.display = 'none';
}

function saveAvatar() {
    const fileInput = document.getElementById('avatar-upload-input');
    const file = fileInput.files[0];

    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const tempUrl = e.target.result;
            // Обновление UI
            currentUser.avatarUrl = tempUrl;
            updateProfileUI(currentUser);
            
            // TODO: В реальном приложении: POST запрос на сервер для сохранения аватара
            console.log('Avatar updated in UI. (Save to backend required)');
            closeSettingsModal();
        }
        reader.readAsDataURL(file);
    } else {
        alert('Please select a file.');
    }
}

function changeLanguage(lang) {
    localStorage.setItem('language', lang);
    console.log(`Language set to: ${lang}`);
    // Здесь была бы логика перезагрузки текста UI
}


// --- Multimedia and Voice (Имитация) ---
let isRecording = false;

voiceButton.addEventListener('click', () => {
    if (!activeChat.id) return;
    
    if (!isRecording) {
        voiceButton.classList.add('recording');
        isRecording = true;
    } else {
        voiceButton.classList.remove('recording');
        isRecording = false;
        
        const contentHTML = `
            <div class="voice-message-imitation">
                <span class="custom-icon icon-mic" style="color: var(--error-color);"></span> 
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
    if (!activeChat.id) return;
    
    const file = event.target.files[0];
    if (!file) return;

    if (confirm(`Send file: ${file.name}?`)) {
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
    // Вставка SVG-иконок в статические элементы HTML
    document.getElementById('friends-icon-header').innerHTML = getIconSVG('user_group');
    document.getElementById('mic-icon-button').innerHTML = getIconSVG('mic');
    document.getElementById('paperclip-icon-button').innerHTML = getIconSVG('paperclip');
    document.getElementById('send-icon-button').innerHTML = getIconSVG('send');
    document.getElementById('settings-icon-menu').innerHTML = getIconSVG('settings');
    document.getElementById('logout-icon-menu').innerHTML = getIconSVG('logout');
    document.getElementById('close-icon-modal').innerHTML = getIconSVG('close');
});


fetchProfile();