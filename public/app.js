// Initialization
const socket = io();
let currentUser = { id: null, profileName: 'Guest', avatarUrl: null, friends: [] };
let activeChat = { id: null, name: null, avatar: null };

// DOM Elements
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


// --- Initialization: Get Profile Data ---
async function fetchProfile() {
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
            friends: user.friends || []
        };
        
        // Update UI
        document.getElementById('profile-name-top').textContent = currentUser.profileName;
        currentAvatarTopEl.style.backgroundImage = `url(${currentUser.avatarUrl})`;
        
        requestNotificationPermission();

        socket.emit('register socket', currentUser.id);
        
        fetchFriendData(); 

    } catch (error) {
        console.error('Error fetching profile:', error);
        window.location.href = '/login.html';
    }
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
                <span class="friend-item-status">Online</span>
            </div>
            <button class="icon-button"><span class="custom-icon icon-send"></span></button>
        `;
        onlineFriendsList.appendChild(item);
    });
}

function loadPendingInvitesUI(invites) {
    pendingInvitesList.innerHTML = '';
    
    // Обновляем счетчик
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
            // Socket.IO на сервере сам уведомит обоих об обновлении, 
            // но мы вызываем fetchFriendData() здесь на всякий случай, чтобы UI обновился немедленно.
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
    // 1. Установить активный чат
    activeChat = { id: friend.id, name: friend.profileName, avatar: friend.avatarUrl };
    
    // 2. Обновить UI чата
    chatHeader.innerHTML = `
        <div class="profile-avatar message-avatar" style="background-image: url(${friend.avatarUrl}); margin-right: 10px;"></div>
        <h2>${friend.profileName}</h2>
    `;
    document.getElementById('message-input-area').classList.remove('hidden');
    messagesContainer.innerHTML = '';
    
    // 3. Загрузить историю ЛС
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

// Адаптивное изменение размера textarea (Кастомный Textbox)
messageInput.addEventListener('input', () => {
    messageInput.style.height = '45px'; // Минимальная высота
    const scrollHeight = messageInput.scrollHeight;
    messageInput.style.height = Math.min(scrollHeight, 200) + 'px'; // Максимум 200px
});

// --- Socket.IO Handlers ---

socket.on('new direct message', (data) => {
    // Если сообщение для текущего активного чата, отображаем его
    if (data.senderId === activeChat.id || (data.recipientId === currentUser.id && data.senderId === activeChat.id)) {
        addMessageToChat(data.senderName, data.content, data.timestamp, data.avatarUrl);
    }
    
    // Уведомление на сайте и в браузере, если чат неактивен
    if (data.senderId !== activeChat.id) {
        showBrowserNotification(data.senderName, data.content);
    }
});

socket.on('friend invite received', (senderData) => {
    console.log('New invite received:', senderData);
    fetchFriendData(); 
    showBrowserNotification('NeoCord', `New friend request from ${senderData.profileName}!`);
});

socket.on('friend list updated', (data) => {
    console.log('Friend list updated:', data.status);
    fetchFriendData(); 
    if (data.status === 'accept') {
        showBrowserNotification('NeoCord', `Friend request accepted!`);
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
            icon: '/images/default-anon-avatar.png',
            tag: 'neocord-message' // Группировка уведомлений
        });
    }
}

// --- Settings Modal Logic ---
function openSettingsModal() {
    userDropdownMenu.classList.add('hidden');
    document.getElementById('new-username').value = currentUser.profileName;
    settingAvatarPreview.style.backgroundImage = currentAvatarTopEl.style.backgroundImage;
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
            currentAvatarTopEl.style.backgroundImage = `url(${tempUrl})`;
            settingAvatarPreview.style.backgroundImage = `url(${tempUrl})`;
            currentUser.avatarUrl = tempUrl;
            console.log('Avatar updated in UI (Backend upload logic needed).');
            closeSettingsModal();
        }
        reader.readAsDataURL(file);
    } else {
        alert('Please select a file.');
    }
}

// --- Multimedia and Voice (Imitation) ---
let isRecording = false;

voiceButton.addEventListener('click', () => {
    if (!activeChat.id) return;
    
    if (!isRecording) {
        console.log('Start recording...');
        voiceButton.classList.add('recording');
        isRecording = true;
    } else {
        console.log('Stop recording. Sending voice message...');
        voiceButton.classList.remove('recording');
        isRecording = false;
        
        const contentHTML = `
            <div style="background: ${getComputedStyle(document.body).getPropertyValue('--accent-darker')}; padding: 10px; border-radius: 5px;">
                <span class="custom-icon icon-mic" style="margin-right: 5px;"></span> Voice Message (Imitation)
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


// Start application flow
fetchProfile();