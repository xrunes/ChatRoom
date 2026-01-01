let selectedAvatarFile = null;

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('avatar-upload').addEventListener('change', handleAvatarUpload);
    document.getElementById('remove-avatar').addEventListener('click', removeAvatar);
    document.getElementById('cancel-btn').addEventListener('click', cancelCreate);
    document.getElementById('create-user-form').addEventListener('submit', createUser);
});

// 处理头像上传
function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // 检查文件类型
    if (!file.type.startsWith('image/')) {
        alert('请选择图片文件');
        return;
    }
    
    selectedAvatarFile = file;
    
    // 预览头像
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('avatar-preview').src = e.target.result;
    };
    reader.readAsDataURL(file);
    
    // 显示移除按钮
    document.getElementById('remove-avatar').style.display = 'inline-block';
}

// 移除头像
function removeAvatar() {
    selectedAvatarFile = null;
    document.getElementById('avatar-upload').value = '';
    document.getElementById('avatar-preview').src = 'images/default-avatar.png';
    document.getElementById('remove-avatar').style.display = 'none';
}

// 取消创建
function cancelCreate() {
    if (confirm('确定要取消创建用户吗？已填写的信息将丢失。')) {
        window.location.href = 'index.html';
    }
}

// 创建用户
async function createUser(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    
    if (!username) {
        alert('请输入用户名');
        return;
    }
    
    if (username.length > 20) {
        alert('用户名不能超过20个字符');
        return;
    }
    
    const formData = new FormData();
    formData.append('username', username);
    
    if (selectedAvatarFile) {
        formData.append('avatar', selectedAvatarFile);
    }
    
    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            window.location.href = 'index.html';
        } else {
            const error = await response.json();
            alert('创建用户失败: ' + error.error);
        }
    } catch (error) {
        console.error('创建用户错误:', error);
        alert('创建用户失败');
    }
}