import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// 检查必要的环境变量
function checkRequiredEnvVars() {
  const requiredEnvVars = {
    'SUPABASE_URL': process.env.SUPABASE_URL,
    'SUPABASE_KEY': process.env.SUPABASE_KEY,
    'TELEGRAM_TOKEN': process.env.TELEGRAM_TOKEN
  };

  const missingVars = Object.entries(requiredEnvVars)
    .filter(([_, value]) => !value)
    .map(([name]) => name);

  if (missingVars.length > 0) {
    throw new Error(`缺少必要的环境变量: ${missingVars.join(', ')}`);
  }
}

// 初始化 Supabase 客户端
let supabase;
try {
  checkRequiredEnvVars();
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );
} catch (error) {
  console.error('初始化 Supabase 客户端失败:', error);
  supabase = null;
}

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

// 验证 Solana 钱包地址
function isValidSolanaAddress(address) {
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
}

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

// 处理添加钱包命令
async function handleAddWallet(chatId, messageId, args) {
  if (!supabase) {
    return sendTelegramMessage('❌ 系统配置错误，请联系管理员', chatId, messageId);
  }

  if (args.length < 1) {
    return sendTelegramMessage('❌ 请提供钱包地址\n\n示例：/add_wallet 地址 [备注名]', chatId, messageId);
  }

  const walletAddress = args[0];
  const label = args[1] || '未命名钱包';

  if (!isValidSolanaAddress(walletAddress)) {
    return sendTelegramMessage('❌ 无效的 Solana 钱包地址', chatId, messageId);
  }

  try {
    const { data: existingWallet } = await supabase
      .from('monitored_wallets')
      .select('*')
      .eq('wallet_address', walletAddress)
      .eq('chat_id', chatId)
      .single();

    if (existingWallet) {
      return sendTelegramMessage('❌ 该钱包已在监控列表中', chatId, messageId);
    }

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

// 处理删除钱包命令
async function handleRemoveWallet(chatId, messageId, args) {
  if (!supabase) {
    return sendTelegramMessage('❌ 系统配置错误，请联系管理员', chatId, messageId);
  }

  if (args.length < 1) {
    return sendTelegramMessage('❌ 请提供要删除的钱包地址', chatId, messageId);
  }

  const walletAddress = args[0];

  try {
    const { error } = await supabase
      .from('monitored_wallets')
      .delete()
      .eq('wallet_address', walletAddress)
      .eq('chat_id', chatId);

    if (error) throw error;

    return sendTelegramMessage(`✅ 已删除钱包监控：${walletAddress}`, chatId, messageId);
  } catch (error) {
    console.error('删除钱包错误:', error);
    return sendTelegramMessage('❌ 删除钱包失败，请稍后重试', chatId, messageId);
  }
}

// 处理列出钱包命令
async function handleListWallets(chatId, messageId, args) {
  if (!supabase) {
    return sendTelegramMessage('❌ 系统配置错误，请联系管理员', chatId, messageId);
  }

  const page = parseInt(args[0]) || 1;
  const pageSize = 10;
  const offset = (page - 1) * pageSize;

  try {
    const { data: wallets, error, count } = await supabase
      .from('monitored_wallets')
      .select('*', { count: 'exact' })
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    if (!wallets || wallets.length === 0) {
      return sendTelegramMessage('📝 您还没有添加任何钱包监控', chatId, messageId);
    }

    const totalPages = Math.ceil(count / pageSize);
    const walletList = wallets.map((w, i) => 
      `${i + 1 + offset}. ${w.label}\n└ ${w.wallet_address}`
    ).join('\n\n');

    const message = `📋 监控钱包列表 (第 ${page}/${totalPages} 页)\n\n${walletList}\n\n使用 /list_wallets [页码] 查看其他页`;
    return sendTelegramMessage(message, chatId, messageId);
  } catch (error) {
    console.error('获取钱包列表错误:', error);
    return sendTelegramMessage('❌ 获取钱包列表失败，请稍后重试', chatId, messageId);
  }
}

// 处理搜索钱包命令
async function handleSearchWallet(chatId, messageId, args) {
  if (!supabase) {
    return sendTelegramMessage('❌ 系统配置错误，请联系管理员', chatId, messageId);
  }

  if (args.length < 1) {
    return sendTelegramMessage('❌ 请提供搜索关键词', chatId, messageId);
  }

  const keyword = args.join(' ');

  try {
    const { data: wallets, error } = await supabase
      .from('monitored_wallets')
      .select('*')
      .eq('chat_id', chatId)
      .or(`label.ilike.%${keyword}%,wallet_address.ilike.%${keyword}%`)
      .limit(10);

    if (error) throw error;

    if (!wallets || wallets.length === 0) {
      return sendTelegramMessage('❌ 未找到匹配的钱包', chatId, messageId);
    }

    const walletList = wallets.map((w, i) => 
      `${i + 1}. ${w.label}\n└ ${w.wallet_address}`
    ).join('\n\n');

    return sendTelegramMessage(`🔍 搜索结果：\n\n${walletList}`, chatId, messageId);
  } catch (error) {
    console.error('搜索钱包错误:', error);
    return sendTelegramMessage('❌ 搜索钱包失败，请稍后重试', chatId, messageId);
  }
}

// 处理设置提醒命令
async function handleSetAlert(chatId, messageId, args) {
  if (!supabase) {
    return sendTelegramMessage('❌ 系统配置错误，请联系管理员', chatId, messageId);
  }

  if (args.length < 2) {
    return sendTelegramMessage('❌ 请提供钱包地址和金额\n\n示例：/set_alert 钱包地址 1000', chatId, messageId);
  }

  const walletAddress = args[0];
  const amount = parseFloat(args[1]);

  if (!isValidSolanaAddress(walletAddress)) {
    return sendTelegramMessage('❌ 无效的 Solana 钱包地址', chatId, messageId);
  }

  if (isNaN(amount) || amount <= 0) {
    return sendTelegramMessage('❌ 无效的金额', chatId, messageId);
  }

  try {
    const { data: wallet } = await supabase
      .from('monitored_wallets')
      .select('*')
      .eq('wallet_address', walletAddress)
      .eq('chat_id', chatId)
      .single();

    if (!wallet) {
      return sendTelegramMessage('❌ 该钱包不在您的监控列表中', chatId, messageId);
    }

    const { error } = await supabase
      .from('wallet_alerts')
      .upsert([
        {
          wallet_address: walletAddress,
          chat_id: chatId,
          alert_amount: amount,
          updated_at: new Date().toISOString()
        }
      ]);

    if (error) throw error;

    return sendTelegramMessage(`✅ 已设置提醒\n\n钱包：${walletAddress}\n金额：${amount} SOL`, chatId, messageId);
  } catch (error) {
    console.error('设置提醒错误:', error);
    return sendTelegramMessage('❌ 设置提醒失败，请稍后重试', chatId, messageId);
  }
}

// 处理查看特别关注列表命令
async function handleWatchlist(chatId, messageId) {
  if (!supabase) {
    return sendTelegramMessage('❌ 系统配置错误，请联系管理员', chatId, messageId);
  }

  try {
    const { data: alerts, error } = await supabase
      .from('wallet_alerts')
      .select(`
        *,
        monitored_wallets (
          label
        )
      `)
      .eq('chat_id', chatId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    if (!alerts || alerts.length === 0) {
      return sendTelegramMessage('📝 您还没有设置任何提醒', chatId, messageId);
    }

    const alertList = alerts.map((a, i) => 
      `${i + 1}. ${a.monitored_wallets?.label || '未命名钱包'}\n└ ${a.wallet_address}\n└ 提醒金额：${a.alert_amount} SOL`
    ).join('\n\n');

    return sendTelegramMessage(`👀 特别关注列表：\n\n${alertList}`, chatId, messageId);
  } catch (error) {
    console.error('获取特别关注列表错误:', error);
    return sendTelegramMessage('❌ 获取特别关注列表失败，请稍后重试', chatId, messageId);
  }
}

// 处理统计信息命令
async function handleStats(chatId, messageId) {
  if (!supabase) {
    return sendTelegramMessage('❌ 系统配置错误，请联系管理员', chatId, messageId);
  }

  try {
    const { data: stats, error } = await supabase
      .from('monitored_wallets')
      .select('*')
      .eq('chat_id', chatId);

    if (error) throw error;

    const totalWallets = stats?.length || 0;
    const message = `📊 监控统计\n\n总监控钱包数：${totalWallets}`;
    
    return sendTelegramMessage(message, chatId, messageId);
  } catch (error) {
    console.error('获取统计信息错误:', error);
    return sendTelegramMessage('❌ 获取统计信息失败，请稍后重试', chatId, messageId);
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
    case '/remove_wallet':
      return handleRemoveWallet(chatId, messageId, args);
    case '/list_wallets':
      return handleListWallets(chatId, messageId, args);
    case '/search_wallet':
      return handleSearchWallet(chatId, messageId, args);
    case '/set_alert':
      return handleSetAlert(chatId, messageId, args);
    case '/watchlist':
      return handleWatchlist(chatId, messageId);
    case '/stats':
      return handleStats(chatId, messageId);
    default:
      return sendTelegramMessage('🚧 该功能正在开发中...\n\n使用 /help 查看可用命令。', chatId, messageId);
  }
}

// 处理传入的 Telegram 更新
export async function handleTelegramUpdate(update) {
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
      
      await handleBasicCommand(command, args, chatId, messageId);
      console.log('命令处理成功:', command);
    }
  } catch (error) {
    console.error('处理 Telegram 更新错误:', error);
    await sendTelegramMessage('处理命令时发生错误，请稍后重试。', chatId);
  }
}

