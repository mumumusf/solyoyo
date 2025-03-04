# Solana 钱包监控机器人

一个强大的 Solana 钱包监控工具，支持监控多个钱包的交易活动，并通过 Telegram 机器人进行实时通知。

## 主要功能

- 🔍 监控多个钱包的交易活动
- 📊 实时交易数据分析
- 🤖 Telegram 机器人交互
- ⭐️ 特别关注功能
- 💰 大额交易提醒
- 📈 交易统计分析

## 快速开始

### 1. 环境准备

1. 克隆代码库：
```bash
git clone https://github.com/mumumusf/solyoyo.git
cd solyoyo
```

2. 安装依赖：
```bash
npm install
```

3. 配置环境变量：
- 复制 `.env.example` 到 `.env`
- 填入必要的 API Keys 和配置信息

### 2. 配置 Telegram 机器人

1. 通过 [@BotFather](https://t.me/BotFather) 创建机器人
2. 获取机器人 Token 和频道 ID
3. 在 `.env` 文件中填入相关信息

### 3. 设置数据库

1. 创建 Supabase 项目
2. 执行 `schema.sql` 中的 SQL 语句创建数据库表
3. 在 Supabase 中开启 Realtime 功能

### 4. 部署

1. 安装 Vercel CLI：
```bash
npm i -g vercel
```

2. 登录 Vercel：
```bash
vercel login
```

3. 部署项目：
```bash
vercel --prod
```

4. 设置 Webhook：
```bash
npm run setup:telegram
```

5. 启动监控：
```bash
npm run monitor
```

## Telegram 机器人命令

基础命令：
- `/start` - 开始使用机器人
- `/help` - 显示帮助信息

钱包管理：
- `/add_wallet <钱包地址> <备注名>` - 添加新钱包
- `/remove_wallet <钱包地址>` - 删除钱包
- `/list_wallets [页码]` - 查看钱包列表
- `/search_wallet <关键词>` - 搜索钱包
- `/rename_wallet <钱包地址> <新备注名>` - 重命名钱包

数据统计：
- `/stats` - 查看监控统计
- `/top_wallets` - 查看最活跃钱包
- `/recent_txs [数量]` - 查看最近交易

高级功能：
- `/set_alert <钱包地址> <金额>` - 设置大额提醒
- `/watchlist` - 查看特别关注
- `/add_watch <钱包地址>` - 添加特别关注
- `/remove_watch <钱包地址>` - 取消特别关注

## 注意事项

1. 确保所有 API Keys 安全保存，不要提交到代码库
2. Webhook URL 必须是 HTTPS
3. 机器人需要在群组中具有管理员权限
4. 建议先在私聊中测试功能

## 技术栈

- Next.js
- Supabase
- Helius API
- Telegram Bot API
- DeepSeek AI
- Shyft API

## 贡献

欢迎提交 Issues 和 Pull Requests！

## 许可证

MIT License 