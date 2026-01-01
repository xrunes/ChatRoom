document.addEventListener('DOMContentLoaded', function() {
    loadUsers();
    
    document.getElementById('create-user-btn').addEventListener('click', function() {
        window.location.href = 'create-user.html';
    });
});

// 加载用户列表
async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        const users = await response.json();
        
        const userList = document.getElementById('user-list');
        userList.innerHTML = '';
        
        if (users.length === 0) {
            userList.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">暂无用户，请创建新用户</p>';
            return;
        }
        
        // 按最后使用时间排序
        users.sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed));
        
        users.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = 'user-item';
            userElement.setAttribute('data-user-id', user.id);
            
            userElement.innerHTML = `
                <img src="/chat_data/avatars/${user.avatar}" alt="${user.username}" class="avatar" onerror="this.src='images/default-avatar.png'">
                <div class="user-info">
                    <div class="user-name">${user.username}</div>
                    <div class="user-meta">最后使用: ${formatDate(user.lastUsed)}</div>
                </div>
                <button class="delete-btn" onclick="event.stopPropagation(); deleteUser('${user.id}')">删除</button>
            `;
            
            userElement.addEventListener('click', () => {
                selectUser(user.id);
            });
            
            userList.appendChild(userElement);
        });
    } catch (error) {
        console.error('加载用户列表错误:', error);
        alert('加载用户列表失败');
    }
}

// 选择用户
async function selectUser(userId) {
    try {
        // 更新最后使用时间
        await fetch(`/api/users/${userId}/last-used`, { method: 'PUT' });
        // 进入聊天室
        window.location.href = `chat.html?userId=${userId}`;
    } catch (error) {
        console.error('选择用户错误:', error);
        alert('选择用户失败');
    }
}

// 删除用户
async function deleteUser(userId) {
    if (!confirm('确定要删除这个用户吗？此操作不可撤销。')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
        
        if (response.ok) {
            loadUsers(); // 重新加载列表
        } else {
            const error = await response.json();
            alert('删除用户失败: ' + error.error);
        }
    } catch (error) {
        console.error('删除用户错误:', error);
        alert('删除用户失败');
    }
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) {
        return '刚刚';
    } else if (diffMins < 60) {
        return `${diffMins}分钟前`;
    } else if (diffHours < 24) {
        return `${diffHours}小时前`;
    } else if (diffDays < 7) {
        return `${diffDays}天前`;
    } else {
        return date.toLocaleDateString();
    }
}