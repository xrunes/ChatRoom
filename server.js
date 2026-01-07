const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// 确保数据目录存在
const CHAT_DATA_DIR = path.join(__dirname, 'chat_data');
const IMAGES_DIR = path.join(CHAT_DATA_DIR, 'images');
const AVATARS_DIR = path.join(CHAT_DATA_DIR, 'avatars');
const USERS_FILE = path.join(CHAT_DATA_DIR, 'users.json');
const MESSAGES_FILE = path.join(CHAT_DATA_DIR, 'messages.log');

async function ensureDirectories() {
  await fs.mkdir(CHAT_DATA_DIR, { recursive: true });
  await fs.mkdir(IMAGES_DIR, { recursive: true });
  await fs.mkdir(AVATARS_DIR, { recursive: true });
  
  // 初始化用户文件 - 确保格式正确
  try {
    await fs.access(USERS_FILE);
    // 文件存在，检查内容
    const data = await fs.readFile(USERS_FILE, 'utf8');
    if (data.trim() === '') {
      // 文件为空，写入正确格式
      await fs.writeFile(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
    } else {
      // 尝试解析，如果失败则重置
      JSON.parse(data);
    }
  } catch {
    // 文件不存在或格式错误，创建新文件
    await fs.writeFile(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
  }
  
  // 初始化消息文件
  try {
    await fs.access(MESSAGES_FILE);
  } catch {
    await fs.writeFile(MESSAGES_FILE, '');
  }
}

// 配置multer用于图片上传（无限制）
const imageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, IMAGES_DIR);
  },
  filename: function (req, file, cb) {
    const fileExt = path.extname(file.originalname);
    const randomString = Math.random().toString(36).substring(2, 8);
    const timestamp = Date.now();
    const filename = `image_${timestamp}_${randomString}${fileExt}`;
    cb(null, filename);
  }
});

const imageUpload = multer({ 
  storage: imageStorage,
  limits: { fileSize: Infinity }
});

// 配置multer用于头像上传（无限制）
const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, AVATARS_DIR);
  },
  filename: function (req, file, cb) {
    const fileExt = path.extname(file.originalname);
    const filename = `avatar_${uuidv4()}${fileExt}`;
    cb(null, filename);
  }
});

const avatarUpload = multer({ 
  storage: avatarStorage,
  limits: { fileSize: Infinity },
  fileFilter: function (req, file, cb) {
    // 允许所有文件类型
    cb(null, true);
  }
});

// 静态文件服务
app.use(express.static('public'));
app.use('/chat_data', express.static(CHAT_DATA_DIR));

// API路由

// 获取所有用户
app.get('/api/users', async (req, res) => {
  try {
    let usersData;
    try {
      const data = await fs.readFile(USERS_FILE, 'utf8');
      if (data.trim() === '') {
        // 如果文件为空，初始化空数组
        usersData = { users: [] };
      } else {
        usersData = JSON.parse(data);
      }
    } catch (error) {
      // 如果文件不存在或格式错误，初始化空数组
      console.log('用户文件读取失败，初始化为空:', error.message);
      usersData = { users: [] };
    }
    
    // 确保数据结构正确
    if (!usersData.users) {
      usersData.users = [];
    }
    
    res.json(usersData.users);
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// 创建新用户
app.post('/api/users', avatarUpload.single('avatar'), async (req, res) => {
  // 在创建用户路由中添加详细日志
  console.log('收到创建用户请求:', req.body);
  console.log('上传的文件:', req.file);

  try {
    const { username } = req.body;
    
    if (!username || username.trim() === '') {
      return res.status(400).json({ error: '用户名不能为空' });
    }
    
    // 读取现有用户 - 添加更健壮的错误处理
    let usersData = { users: [] };
    try {
      const data = await fs.readFile(USERS_FILE, 'utf8');
      if (data.trim() !== '') {
        usersData = JSON.parse(data);
      }
    } catch (error) {
      console.log('读取用户文件失败，使用空数据:', error.message);
    }
    
    // 确保数据结构正确
    if (!usersData.users) {
      usersData.users = [];
    }
    
    // 检查用户名是否已存在
    if (usersData.users.some(user => user.username === username)) {
      return res.status(400).json({ error: '用户名已存在' });
    }
    
    const userId = uuidv4();
    let avatarFilename = 'default-avatar.png';
    
    // 处理头像上传
    if (req.file) {
      avatarFilename = req.file.filename;
    }
    
    // 生成随机颜色用于用户消息区分
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    const userColor = colors[Math.floor(Math.random() * colors.length)];
    
    const newUser = {
      id: userId,
      username: username.trim(),
      avatar: avatarFilename,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      color: userColor
    };
    
    // 添加新用户
    usersData.users.push(newUser);
    
    // 保存回文件
    await fs.writeFile(USERS_FILE, JSON.stringify(usersData, null, 2));
    
    res.json(newUser);
  } catch (error) {
    console.error('创建用户错误:', error);
    res.status(500).json({ error: '创建用户失败: ' + error.message });
  }
});

// 删除用户
app.delete('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const usersData = JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
    const userIndex = usersData.users.findIndex(user => user.id === userId);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const deletedUser = usersData.users[userIndex];
    
    // 删除头像文件（如果不是默认头像）
    if (deletedUser.avatar !== 'default-avatar.png') {
      try {
        await fs.unlink(path.join(AVATARS_DIR, deletedUser.avatar));
      } catch (error) {
        console.log('删除头像文件失败:', error);
      }
    }
    
    // 从用户列表中移除
    usersData.users.splice(userIndex, 1);
    await fs.writeFile(USERS_FILE, JSON.stringify(usersData, null, 2));
    
    res.json({ message: '用户删除成功' });
  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({ error: '删除用户失败' });
  }
});

// 更新用户最后使用时间
app.put('/api/users/:userId/last-used', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const usersData = JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
    const user = usersData.users.find(user => user.id === userId);
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    user.lastUsed = new Date().toISOString();
    await fs.writeFile(USERS_FILE, JSON.stringify(usersData, null, 2));
    
    res.json({ message: '最后使用时间更新成功' });
  } catch (error) {
    console.error('更新最后使用时间错误:', error);
    res.status(500).json({ error: '更新失败' });
  }
});

// 图片上传
app.post('/api/upload-image', imageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }
    
    console.log(`图片上传成功: ${req.file.filename}, 大小: ${req.file.size} bytes`);
    
    res.json({
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    console.error('图片上传错误:', error);
    res.status(500).json({ error: '图片上传失败' });
  }
});

// 获取聊天记录
app.get('/api/messages', async (req, res) => {
  try {
    const data = await fs.readFile(MESSAGES_FILE, 'utf8');
    const messages = data.trim().split('\n')
      .filter(line => line.trim() !== '')
      .map(line => JSON.parse(line));
    res.json(messages);
  } catch (error) {
    console.error('获取消息错误:', error);
    res.status(500).json({ error: '获取消息失败' });
  }
});

// WebSocket连接处理
io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);
  
  // 用户加入聊天室
  socket.on('user_joined', (user) => {
    socket.user = user;
    socket.broadcast.emit('user_joined', user);
  });
  
  // 处理文字消息
  socket.on('text_message', async (data) => {
    try {
      const message = {
        id: uuidv4(),
        type: 'text',
        content: data.content,
        sender: data.sender,
        timestamp: new Date().toISOString()
      };
      
      // 保存到消息日志
      await fs.appendFile(MESSAGES_FILE, JSON.stringify(message) + '\n');
      
      // 广播消息
      io.emit('new_message', message);
    } catch (error) {
      console.error('处理文字消息错误:', error);
    }
  });
  
  // 处理图片消息
  socket.on('image_message', async (data) => {
    try {
      const message = {
        id: uuidv4(),
        type: 'image',
        filename: data.filename,
        originalName: data.originalName,
        fileSize: data.fileSize,
        sender: data.sender,
        timestamp: new Date().toISOString()
      };
      
      // 保存到消息日志
      await fs.appendFile(MESSAGES_FILE, JSON.stringify(message) + '\n');
      
      // 广播消息
      io.emit('new_message', message);
    } catch (error) {
      console.error('处理图片消息错误:', error);
    }
  });
  
  // 用户断开连接
  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id);
    if (socket.user) {
      socket.broadcast.emit('user_left', socket.user);
    }
  });
});

// 启动服务器
ensureDirectories().then(() => {
  server.listen(PORT, () => {
    console.log(`聊天室服务器运行在 http://localhost:${PORT}`);
    console.log(`局域网内其他设备可通过 http://你的IP:${PORT} 访问`);
  });
}).catch(error => {
  console.error('启动服务器失败:', error);
});