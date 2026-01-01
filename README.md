# ChatRoom

A LAN based chatroom built with Node.js and Express, supporting text chat and image upload.

一个基于Nodejs和Express的局域网聊天系统，支持文本聊天与图片上传

## chat_data

用来存放聊天数据与用户数据，放在了`.gitignore`里，默认不进行同步，如需转移数据请务必自行保存

### avatars

用户自定义的头像目录

### images

聊天记录里上传的图片目录

### messages.log

聊天记录文件。如果想清除聊天数据又不想清除用户系统，只需删除该文件

### user.json

用户数据

## public/images

用来存放创建用户时的默认头像，如要更改默认头像需将图片命名为**default-avatar.png**
