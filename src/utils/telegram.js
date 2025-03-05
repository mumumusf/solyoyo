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

// 处理钱包添加命令
async function handleAddWallet(chatId, params) {
  if (params.length < 2) {
    return '❌ 请提供钱包地址和备注名\n\n示例：/add_wallet 7NsAJ6DYM7qRzxVXWCGwqZpBEQUVCwS6gQUAi5kXCzVj 大户A';
  }

  const [walletAddress, ...nameArr] = params;
  const name = nameArr.join(' ');

  try {
    // 验证钱包地址格式
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
      return '❌ 无效的 Solana 钱包地址格式';
    }

    // 检查钱包是否已存在
    const { data: existingWallet } = await supabase
      .from('wallets')
      .select()
      .eq('address', walletAddress)
      .eq('chat_id', chatId)
      .single();

    if (existingWallet) {
      return `❌ 该钱包已在监控列表中：\n地址：${walletAddress}\n备注：${existingWallet.name}`;
    }

    // 添加新钱包
    const { error } = await supabase
      .from('wallets')
      .insert([
        {
          address: walletAddress,
          name: name,
          chat_id: chatId,
          created_at: new Date().toISOString()
        }
      ]);

    if (error) throw error;

    return `✅ 成功添加钱包到监控列表\n\n📝 地址：${walletAddress}\n📌 备注：${name}`;
  } catch (error) {
    console.error('添加钱包错误:', error);
    return '❌ 添加钱包失败，请稍后重试';
  }
}

// 处理钱包删除命令
async function handleRemoveWallet(chatId, params) {
  if (params.length < 1) {
    return '❌ 请提供要删除的钱包地址\n\n示例：/remove_wallet 7NsAJ6DYM7qRzxVXWCGwqZpBEQUVCwS6gQUAi5kXCzVj';
  }

  const walletAddress = params[0];
  console.log('删除钱包 - 参数:', { chatId, walletAddress });

  try {
    // 检查钱包是否存在
    const { data: existingWallet, error: selectError } = await supabase
      .from('wallets')
      .select()
      .eq('address', walletAddress)
      .eq('chat_id', chatId)
      .single();

    console.log('查询结果:', { existingWallet, selectError });

    if (selectError) {
      console.error('查询钱包错误:', selectError);
      throw selectError;
    }

    if (!existingWallet) {
      return '❌ 该钱包不在监控列表中';
    }

    // 删除钱包
    const { error: deleteError } = await supabase
      .from('wallets')
      .delete()
      .eq('address', walletAddress)
      .eq('chat_id', chatId);

    console.log('删除结果:', { deleteError });

    if (deleteError) {
      console.error('删除钱包错误:', deleteError);
      throw deleteError;
    }

    return `✅ 已从监控列表中删除钱包\n\n📝 地址：${walletAddress}\n📌 备注：${existingWallet.name}`;
  } catch (error) {
    console.error('删除钱包错误:', error);
    return '❌ 删除钱包失败，请稍后重试';
  }
}

// 处理钱包列表命令
async function handleListWallets(chatId, params) {
  const page = params.length > 0 ? parseInt(params[0]) : 1;
  const pageSize = 10;
  const offset = (page - 1) * pageSize;

  try {
    // 获取总数
    const { count } = await supabase
      .from('wallets')
      .select('*', { count: 'exact' })
      .eq('chat_id', chatId);

    // 获取当前页数据
    const { data: wallets, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    if (!wallets || wallets.length === 0) {
      return '📝 监控列表为空\n\n使用 /add_wallet 命令添加钱包';
    }

    const totalPages = Math.ceil(count / pageSize);
    let message = `📋 监控钱包列表 (第 ${page}/${totalPages} 页)\n\n`;
    
    wallets.forEach((wallet, index) => {
      message += `${index + 1 + offset}. ${wallet.name}\n`;
      message += `📝 ${wallet.address}\n`;
      message += `⏰ ${new Date(wallet.created_at).toLocaleString()}\n\n`;
    });

    if (page < totalPages) {
      message += `\n👉 使用 /list_wallets ${page + 1} 查看下一页`;
    }

    return message;
  } catch (error) {
    console.error('获取钱包列表错误:', error);
    return '❌ 获取钱包列表失败，请稍后重试';
  }
}

// 处理钱包搜索命令
async function handleSearchWallet(chatId, params) {
  if (params.length < 1) {
    return '❌ 请提供搜索关键词\n\n示例：/search_wallet 大户';
  }

  const keyword = params.join(' ');

  try {
    const { data: wallets, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('chat_id', chatId)
      .or(`name.ilike.%${keyword}%,address.ilike.%${keyword}%`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    if (!wallets || wallets.length === 0) {
      return '❌ 未找到匹配的钱包';
    }

    let message = `🔍 搜索结果 "${keyword}"\n\n`;
    
    wallets.forEach((wallet, index) => {
      message += `${index + 1}. ${wallet.name}\n`;
      message += `📝 ${wallet.address}\n`;
      message += `⏰ ${new Date(wallet.created_at).toLocaleString()}\n\n`;
    });

    return message;
  } catch (error) {
    console.error('搜索钱包错误:', error);
    return '❌ 搜索钱包失败，请稍后重试';
  }
}

// 处理基本命令
async function handleBasicCommand(command, chatId, params = []) {
  switch (command.toLowerCase()) {
    case '/start':
    case '/help':
      return HELP_MESSAGE;
    case '/add_wallet':
      return await handleAddWallet(chatId, params);
    case '/remove_wallet':
      return await handleRemoveWallet(chatId, params);
    case '/list_wallets':
      return await handleListWallets(chatId, params);
    case '/search_wallet':
      return await handleSearchWallet(chatId, params);
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
      const [command, ...params] = update.message.text.split(' ');
      const response = await handleBasicCommand(command, chatId, params);
      
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

