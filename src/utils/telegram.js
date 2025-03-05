import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// 检查必要的环境变量
const requiredEnvVars = {
  'NEXT_PUBLIC_SUPABASE_URL': process.env.NEXT_PUBLIC_SUPABASE_URL,
  'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY,
  'TELEGRAM_TOKEN': process.env.TELEGRAM_TOKEN
};

for (const [name, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    throw new Error(`缺少必要的环境变量: ${name}`);
  }
}

// 初始化 Supabase 客户端
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 帮助信息
const HELP_MESSAGE = `
🔍 <b>钱包监控机器人使用指南</b>

基础命令：
/help - 显示此帮助信息
/start - 开始使用机器人

钱包管理：
/add_wallet [钱包地址] [备注名] - 添加新的钱包监控
/remove_wallet [钱包地址] - 删除监控的钱包
/list_wallets [页码] - 列出所有监控的钱包
/search_wallet [关键词] - 搜索钱包（地址或备注）

数据统计：
/stats - 显示监控统计信息
/recent_txs [数量] - 显示最近的交易记录

高级功能：
/set_alert [钱包地址] [金额] - 设置大额交易提醒
/watchlist - 查看特别关注的钱包

使用示例：
➊ 添加钱包监控
/add_wallet 7NsAJ6DYM7qRzxVXWCGwqZpBEQUVCwS6gQUAi5kXCzVj 大户A

➋ 设置大额提醒
/set_alert 7NsAJ6DYM7qRzxVXWCGwqZpBEQUVCwS6gQUAi5kXCzVj 10000

➌ 查看最近交易
/recent_txs 5
`;

// 发送 Telegram 消息
export async function sendTelegramMessage(message, chatId = null, replyToMessageId = null) {
  if (!message) {
    throw new Error('消息内容不能为空');
  }

  if (!chatId) {
    throw new Error('聊天 ID 不能为空');
  }

  const botToken = process.env.TELEGRAM_TOKEN;
  console.log('使用的 bot token:', botToken);
  
  if (!botToken) {
    throw new Error('TELEGRAM_TOKEN 环境变量未设置');
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  console.log('请求 URL:', url);

  try {
    const messageData = {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };

    if (replyToMessageId && Number.isInteger(replyToMessageId) && replyToMessageId > 0) {
      messageData.reply_to_message_id = replyToMessageId;
    }

    console.log('发送消息数据:', JSON.stringify(messageData));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messageData),
    });

    const data = await response.json();
    console.log('Telegram API 响应:', data);
    
    if (!data.ok) {
      if (messageData.reply_to_message_id && data.description?.includes('message to be replied not found')) {
        delete messageData.reply_to_message_id;
        return sendTelegramMessage(message, chatId);
      }
      throw new Error(`Telegram API 错误: ${data.description || '未知错误'}`);
    }
    
    return data;
  } catch (error) {
    console.error('发送 Telegram 消息错误:', error);
    if (replyToMessageId && error.message.includes('message to be replied not found')) {
      return sendTelegramMessage(message, chatId);
    }
    throw error;
  }
}

// 处理基本命令
async function handleBasicCommand(command) {
  switch (command.toLowerCase()) {
    case '/start':
    case '/help':
      return HELP_MESSAGE;
    default:
      return '🚧 该功能正在开发中...\n\n使用 /help 查看可用命令。';
  }
}

// 处理传入的 Telegram 更新
export async function handleTelegramUpdate(update) {
  // 验证更新对象的结构
  if (!update?.message?.chat?.id) {
    console.error('无效的 Telegram 更新:', update);
    return;
  }

  const chatId = update.message.chat.id;
  const messageId = update.message.message_id;

  try {
    if (update.message.text) {
      const command = update.message.text.split(' ')[0];
      const response = await handleBasicCommand(command);
      
      // 发送响应消息，如果回复失败则发送普通消息
      try {
        await sendTelegramMessage(response, chatId, messageId);
      } catch (error) {
        if (error.message.includes('message to be replied not found')) {
          await sendTelegramMessage(response, chatId);
        } else {
          throw error;
        }
      }
    }
  } catch (error) {
    console.error('处理 Telegram 更新错误:', error);
    await sendTelegramMessage('处理命令时发生错误，请稍后重试。', chatId);
  }
}

