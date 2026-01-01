let socket;
let currentUser;

document.addEventListener('DOMContentLoaded', function() {
    // 获取URL参数中的用户ID
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('userId');
    
    if (!userId) {
        alert('用户ID无效');
        window.location.href = 'index.html';
        return;
    }
    
    initializeChat(userId);
});

// 初始化聊天室
async function initializeChat(userId) {
    try {
        // 获取当前用户信息
        const response = await fetch('/api/users');
        const users = await response.json();
        currentUser = users.find(user => user.id === userId);
        
        if (!currentUser) {
            alert('用户不存在');
            window.location.href = 'index.html';
            return;
        }
        
        // 更新界面显示
        document.getElementById('current-user-name').textContent = currentUser.username;
        document.getElementById('current-user-avatar').src = `/chat_data/avatars/${currentUser.avatar}`;
        document.getElementById('current-user-avatar').onerror = function() {
            this.src = 'images/default-avatar.png';
        };
        
        // 连接WebSocket
        socket = io();
        
        // 用户加入聊天室
        socket.emit('user_joined', currentUser);
        
        // 加载历史消息
        await loadMessages();
        
        // 设置事件监听
        setupEventListeners();
        
        // 滚动到底部
        scrollToBottom();
    } catch (error) {
        console.error('初始化聊天室错误:', error);
        alert('初始化聊天室失败');
    }
}

// 设置事件监听
function setupEventListeners() {
    // 发送消息
    document.getElementById('send-btn').addEventListener('click', sendTextMessage);
    document.getElementById('message-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendTextMessage();
        }
    });
    
    // 图片上传
    document.getElementById('image-input').addEventListener('change', handleImageUpload);
    
    // 切换用户
    document.getElementById('back-to-users').addEventListener('click', function() {
        window.location.href = 'index.html';
    });
    
    // 图片预览
    document.querySelector('.close').addEventListener('click', closeImagePreview);
    document.getElementById('image-preview-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeImagePreview();
        }
    });
    
    // WebSocket事件
    socket.on('new_message', handleNewMessage);
    socket.on('user_joined', handleUserJoined);
    socket.on('user_left', handleUserLeft);
}

// 加载历史消息
async function loadMessages() {
    try {
        const response = await fetch('/api/messages');
        const messages = await response.json();
        
        const messagesContainer = document.getElementById('messages-container');
        
        messages.forEach(message => {
            displayMessage(message, false);
        });
    } catch (error) {
        console.error('加载消息错误:', error);
    }
}

// 发送文字消息
function sendTextMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    
    if (content === '') {
        return;
    }
    
    socket.emit('text_message', {
        content: content,
        sender: currentUser
    });
    
    input.value = '';
}

// 处理图片上传
async function handleImageUpload(e) {
    const files = e.target.files;
    
    if (files.length === 0) {
        return;
    }
    
    for (let file of files) {
        try {
            const formData = new FormData();
            formData.append('image', file);
            
            const response = await fetch('/api/upload-image', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                
                socket.emit('image_message', {
                    filename: result.filename,
                    originalName: result.originalName,
                    fileSize: result.size,
                    sender: currentUser
                });
            } else {
                const error = await response.json();
                alert('上传图片失败: ' + error.error);
            }
        } catch (error) {
            console.error('上传图片错误:', error);
            alert('上传图片失败');
        }
    }
    
    // 清空input，允许选择相同文件
    e.target.value = '';
}

// 处理新消息
function handleNewMessage(message) {
    displayMessage(message, true);
}

// 显示消息
function displayMessage(message, shouldScroll = true) {
    const messagesContainer = document.getElementById('messages-container');
    const messageElement = document.createElement('div');
    
    const isOwnMessage = message.sender.id === currentUser.id;
    messageElement.className = `message ${isOwnMessage ? 'own' : 'other'}`;
    
    // 设置消息背景色
    if (!isOwnMessage) {
        messageElement.style.backgroundColor = message.sender.color + '20'; // 添加透明度
    }
    
    const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (message.type === 'text') {
        messageElement.innerHTML = `
            <div class="message-header">
                <img src="/chat_data/avatars/${message.sender.avatar}" alt="${message.sender.username}" class="message-avatar" onerror="this.src='images/default-avatar.png'">
                <span class="message-sender">${message.sender.username}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-content">${escapeHtml(message.content)}</div>
        `;
    } else if (message.type === 'image') {
        const fileSize = formatFileSize(message.fileSize);
        messageElement.innerHTML = `
            <div class="message-header">
                <img src="/chat_data/avatars/${message.sender.avatar}" alt="${message.sender.username}" class="message-avatar" onerror="this.src='images/default-avatar.png'">
                <span class="message-sender">${message.sender.username}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-content image-message">
                <img src="/chat_data/images/${message.filename}" alt="图片" class="chat-image" onclick="previewImage('${message.filename}', '${message.originalName}', ${message.fileSize})">
                <div class="image-info">
                    <span class="original-name">${message.originalName}</span>
                    <span class="file-size">(${fileSize})</span>
                </div>
            </div>
        `;
    }
    
    messagesContainer.appendChild(messageElement);
    
    if (shouldScroll) {
        scrollToBottom();
    }
}

// 处理用户加入
function handleUserJoined(user) {
    if (user.id === currentUser.id) return;
    
    const messagesContainer = document.getElementById('messages-container');
    const systemMessage = document.createElement('div');
    systemMessage.className = 'system-message';
    systemMessage.textContent = `${user.username} 加入了聊天室`;
    
    messagesContainer.appendChild(systemMessage);
    scrollToBottom();
}

// 处理用户离开
function handleUserLeft(user) {
    const messagesContainer = document.getElementById('messages-container');
    const systemMessage = document.createElement('div');
    systemMessage.className = 'system-message';
    systemMessage.textContent = `${user.username} 离开了聊天室`;
    
    messagesContainer.appendChild(systemMessage);
    scrollToBottom();
}

// 滚动到底部
function scrollToBottom() {
    const messagesContainer = document.getElementById('messages-container');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 预览图片
function previewImage(filename, originalName, fileSize) {
    const modal = document.getElementById('image-preview-modal');
    const previewImage = document.getElementById('preview-image');
    const previewFilename = document.getElementById('preview-filename');
    const previewFilesize = document.getElementById('preview-filesize');
    const downloadLink = document.getElementById('download-link');
    
    previewImage.src = `/chat_data/images/${filename}`;
    previewFilename.textContent = originalName;
    previewFilesize.textContent = formatFileSize(fileSize);
    downloadLink.href = `/chat_data/images/${filename}`;
    downloadLink.download = originalName;
    
    modal.style.display = 'block';
}

// 关闭图片预览
function closeImagePreview() {
    document.getElementById('image-preview-modal').style.display = 'none';
}

// 工具函数

// 转义HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}