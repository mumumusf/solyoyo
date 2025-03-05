import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// 检查必要的环境变量
const requiredEnvVars = {
  'SUPABASE_URL': process.env.SUPABASE_URL,
  'SUPABASE_KEY': process.env.SUPABASE_KEY,
  'TELEGRAM_TOKEN': process.env.TELEGRAM_TOKEN
};

for (const [name, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    throw new Error(`缺少必要的环境变量: ${name}`);
  }
}

// 初始化 Supabase 客户端
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// 用户状态管理
const userStates = new Map();

// 用户状态类型
const StateType = {
  NONE: 'NONE',
  WAITING_FOR_WALLET: 'WAITING_FOR_WALLET',
  WAITING_FOR_NAME: 'WAITING_FOR_NAME'
};

// 帮助信息
const HELP_MESSAGE = `
🔍 <b>钱包监控机器人使用指南</b>

基础命令：
/help - 显示此帮助信息
/start - 开始使用机器人

钱包管理：
/add - 添加新的钱包监控
/remove - 删除监控的钱包
/list - 列出所有监控的钱包
/search - 搜索钱包

数据统计：
/stats - 显示监控统计信息
/recent - 显示最近的交易记录

高级功能：
/alert - 设置大额交易提醒
/watch - 查看特别关注的钱包
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
async function handleAddWallet(chatId, text) {
  const state = userStates.get(chatId) || { type: StateType.NONE };

  if (state.type === StateType.NONE) {
    userStates.set(chatId, { type: StateType.WAITING_FOR_WALLET });
    return '请输入要监控的钱包地址：';
  }

  if (state.type === StateType.WAITING_FOR_WALLET) {
    // 验证钱包地址格式
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(text)) {
      return '❌ 无效的 Solana 钱包地址格式，请重新输入：';
    }

    userStates.set(chatId, { 
      type: StateType.WAITING_FOR_NAME,
      walletAddress: text 
    });
    return '钱包地址验证通过！\n请为这个钱包输入一个备注名称：';
  }

  if (state.type === StateType.WAITING_FOR_NAME) {
    const { walletAddress } = state;
    const name = text;

    try {
      // 检查钱包是否已存在
      const { data: existingWallet } = await supabase
        .from('wallets')
        .select()
        .eq('address', walletAddress)
        .eq('chat_id', chatId)
        .single();

      if (existingWallet) {
        userStates.delete(chatId);
        return `❌ 该钱包已在监控列表中：\n地址：${walletAddress}\n备注：${existingWallet.name}`;
      }

      // 添加新钱包
      const { error } = await supabase
        .from('wallets')
        .insert([{
          address: walletAddress,
          name: name,
          chat_id: chatId,
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;

      userStates.delete(chatId);
      return `✅ 成功添加钱包到监控列表\n\n📝 地址：${walletAddress}\n📌 备注：${name}\n\n您可以：\n1️⃣ 继续添加新钱包，请输入 /add\n2️⃣ 查看钱包列表，请输入 /list`;
    } catch (error) {
      console.error('添加钱包错误:', error);
      userStates.delete(chatId);
      return '❌ 添加钱包失败，请稍后重试';
    }
  }
}

// 处理钱包删除命令
async function handleRemoveWallet(chatId, text) {
  const state = userStates.get(chatId) || { type: StateType.NONE };

  if (state.type === StateType.NONE) {
    // 获取用户的钱包列表
    try {
      const { data: wallets, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!wallets || wallets.length === 0) {
        return '📝 监控列表为空\n\n使用 /add 命令添加钱包';
      }

      let message = '请选择要删除的钱包序号：\n\n';
      wallets.forEach((wallet, index) => {
        message += `${index + 1}. ${wallet.name}\n`;
        message += `📝 ${wallet.address}\n\n`;
      });

      userStates.set(chatId, { 
        type: StateType.WAITING_FOR_WALLET,
        wallets: wallets
      });

      return message;
    } catch (error) {
      console.error('获取钱包列表错误:', error);
      return '❌ 获取钱包列表失败，请稍后重试';
    }
  }

  if (state.type === StateType.WAITING_FOR_WALLET) {
    const index = parseInt(text) - 1;
    const { wallets } = state;

    if (isNaN(index) || index < 0 || index >= wallets.length) {
      return '❌ 无效的序号，请重新输入：';
    }

    const wallet = wallets[index];

    try {
      const { error } = await supabase
        .from('wallets')
        .delete()
        .eq('address', wallet.address)
        .eq('chat_id', chatId);

      if (error) throw error;

      userStates.delete(chatId);
      return `✅ 已从监控列表中删除钱包\n\n📝 地址：${wallet.address}\n📌 备注：${wallet.name}\n\n您可以：\n1️⃣ 继续删除钱包，请输入 /remove\n2️⃣ 查看钱包列表，请输入 /list`;
    } catch (error) {
      console.error('删除钱包错误:', error);
      userStates.delete(chatId);
      return '❌ 删除钱包失败，请稍后重试';
    }
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
      return '📝 监控列表为空\n\n使用 /add 命令添加钱包';
    }

    const totalPages = Math.ceil(count / pageSize);
    let message = `📋 监控钱包列表 (第 ${page}/${totalPages} 页)\n\n`;
    
    wallets.forEach((wallet, index) => {
      message += `${index + 1 + offset}. ${wallet.name}\n`;
      message += `📝 ${wallet.address}\n`;
      message += `⏰ ${new Date(wallet.created_at).toLocaleString()}\n\n`;
    });

    if (page < totalPages) {
      message += `\n👉 使用 /list ${page + 1} 查看下一页`;
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
    return '❌ 请提供搜索关键词\n\n示例：/search 大户';
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
async function handleBasicCommand(command, chatId, text) {
  switch (command.toLowerCase()) {
    case '/start':
    case '/help':
      userStates.delete(chatId);
      return HELP_MESSAGE;
    case '/add':
      return await handleAddWallet(chatId, text);
    case '/remove':
      return await handleRemoveWallet(chatId, text);
    case '/list':
      userStates.delete(chatId);
      return await handleListWallets(chatId, []);
    case '/search':
      userStates.delete(chatId);
      return await handleSearchWallet(chatId, [text]);
    default:
      // 检查是否在等待用户输入
      const state = userStates.get(chatId);
      if (state) {
        switch (state.type) {
          case StateType.WAITING_FOR_WALLET:
            if (state.wallets) {
              // 如果 wallets 存在，说明是删除操作
              return await handleRemoveWallet(chatId, text);
            } else {
              // 否则是添加操作
              return await handleAddWallet(chatId, text);
            }
          case StateType.WAITING_FOR_NAME:
            return await handleAddWallet(chatId, text);
          default:
            return '🚧 该功能正在开发中...\n\n使用 /help 查看可用命令。';
        }
      }
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
  const text = update.message.text;

  try {
    if (text) {
      const [command] = text.split(' ');
      const response = await handleBasicCommand(command, chatId, text);
      
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

