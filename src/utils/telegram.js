import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// 初始化 Supabase 客户端
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const messageData = {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };

    // 只有在提供了有效的 message_id 时才添加回复参数
    if (replyToMessageId && Number.isInteger(replyToMessageId) && replyToMessageId > 0) {
      messageData.reply_to_message_id = replyToMessageId;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messageData),
    });

    const data = await response.json();
    
    if (!data.ok) {
      // 如果是回复消息失败，尝试发送普通消息
      if (messageData.reply_to_message_id && data.description?.includes('message to be replied not found')) {
        delete messageData.reply_to_message_id;
        return sendTelegramMessage(message, chatId);
      }
      throw new Error(`Telegram API 错误: ${data.description || '未知错误'}`);
    }
    
    return data;
  } catch (error) {
    console.error('发送 Telegram 消息错误:', error);
    // 如果是回复消息失败，尝试发送普通消息
    if (replyToMessageId && error.message.includes('message to be replied not found')) {
      return sendTelegramMessage(message, chatId);
    }
    throw error;
  }
}

// 验证 Solana 钱包地址
function isValidSolanaAddress(address) {
  // Solana 地址是 base58 编码的 32 字节公钥
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
}

// 处理添加钱包命令
async function handleAddWallet(chatId, messageId, args) {
  if (args.length < 1) {
    return sendTelegramMessage('❌ 请提供钱包地址\n\n示例：/add_wallet 地址 [备注名]', chatId, messageId);
  }

  const walletAddress = args[0];
  const label = args[1] || '未命名钱包';

  if (!isValidSolanaAddress(walletAddress)) {
    return sendTelegramMessage('❌ 无效的 Solana 钱包地址', chatId, messageId);
  }

  try {
    // 检查钱包是否已存在
    const { data: existingWallet } = await supabase
      .from('monitored_wallets')
      .select('*')
      .eq('wallet_address', walletAddress)
      .eq('chat_id', chatId)
      .single();

    if (existingWallet) {
      return sendTelegramMessage('❌ 该钱包已在监控列表中', chatId, messageId);
    }

    // 添加新钱包
    const { error } = await supabase
      .from('monitored_wallets')
      .insert([
        {
          wallet_address: walletAddress,
          label: label,
          chat_id: chatId,
          created_at: new Date().toISOString()
        }
      ]);

    if (error) throw error;

    return sendTelegramMessage(`✅ 成功添加钱包监控\n\n地址：${walletAddress}\n备注：${label}`, chatId, messageId);
  } catch (error) {
    console.error('添加钱包错误:', error);
    return sendTelegramMessage('❌ 添加钱包失败，请稍后重试', chatId, messageId);
  }
}

// 处理基本命令
async function handleBasicCommand(command, args, chatId, messageId) {
  switch (command.toLowerCase()) {
    case '/start':
    case '/help':
      return sendTelegramMessage(HELP_MESSAGE, chatId, messageId);
    case '/add_wallet':
      return handleAddWallet(chatId, messageId, args);
    default:
      return sendTelegramMessage('🚧 该功能正在开发中...\n\n使用 /help 查看可用命令。', chatId, messageId);
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
      const parts = update.message.text.split(' ');
      const command = parts[0];
      const args = parts.slice(1);
      
      const response = await handleBasicCommand(command, args, chatId, messageId);
      console.log('命令处理成功:', command);
    }
  } catch (error) {
    console.error('处理 Telegram 更新错误:', error);
    await sendTelegramMessage('处理命令时发生错误，请稍后重试。', chatId);
  }
}

