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
  WAITING_FOR_NAME: 'WAITING_FOR_NAME',
  WAITING_FOR_AMOUNT: 'WAITING_FOR_AMOUNT'
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

// 处理统计信息命令
async function handleStats(chatId) {
  try {
    // 获取钱包总数
    const { count: totalWallets } = await supabase
      .from('wallets')
      .select('*', { count: 'exact' })
      .eq('chat_id', chatId);

    // 获取今日新增钱包数
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: newWallets } = await supabase
      .from('wallets')
      .select('*', { count: 'exact' })
      .eq('chat_id', chatId)
      .gte('created_at', today.toISOString());

    // 获取特别关注的钱包数
    const { count: watchedWallets } = await supabase
      .from('wallets')
      .select('*', { count: 'exact' })
      .eq('chat_id', chatId)
      .eq('is_watched', true);

    // 获取设置了提醒的钱包数
    const { count: alertWallets } = await supabase
      .from('wallets')
      .select('*', { count: 'exact' })
      .eq('chat_id', chatId)
      .not('alert_amount', 'is', null);

    let message = `📊 <b>监控统计信息</b>\n\n`;
    message += `📝 监控钱包总数：${totalWallets || 0}\n`;
    message += `🆕 今日新增钱包：${newWallets || 0}\n`;
    message += `⭐️ 特别关注钱包：${watchedWallets || 0}\n`;
    message += `🔔 设置提醒钱包：${alertWallets || 0}\n`;

    return message;
  } catch (error) {
    console.error('获取统计信息错误:', error);
    return '❌ 获取统计信息失败，请稍后重试';
  }
}

// 处理最近交易命令
async function handleRecentTransactions(chatId, text) {
  const state = userStates.get(chatId) || { type: StateType.NONE };

  if (state.type === StateType.NONE) {
    userStates.set(chatId, { 
      type: StateType.WAITING_FOR_WALLET,
      action: 'recent'
    });

    try {
      const { data: wallets, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!wallets || wallets.length === 0) {
        userStates.delete(chatId);
        return '📝 监控列表为空\n\n使用 /add 命令添加钱包';
      }

      let message = '请选择要查看交易记录的钱包序号：\n\n';
      wallets.forEach((wallet, index) => {
        message += `${index + 1}. ${wallet.name}\n`;
        message += `📝 ${wallet.address}\n\n`;
      });

      return message;
    } catch (error) {
      console.error('获取钱包列表错误:', error);
      userStates.delete(chatId);
      return '❌ 获取钱包列表失败，请稍后重试';
    }
  }

  if (state.type === StateType.WAITING_FOR_WALLET && state.action === 'recent') {
    const index = parseInt(text) - 1;
    const { wallets } = state;

    if (isNaN(index) || index < 0 || index >= wallets.length) {
      return '❌ 无效的序号，请重新输入：';
    }

    const wallet = wallets[index];
    userStates.delete(chatId);

    // TODO: 这里需要接入 Helius API 获取实际的交易记录
    // 目前返回模拟数据
    return `🔄 最近交易记录\n钱包：${wallet.name}\n\n` +
           `1. 转入 10 SOL\n⏰ ${new Date().toLocaleString()}\n\n` +
           `2. 转出 5 SOL\n⏰ ${new Date(Date.now() - 3600000).toLocaleString()}\n\n` +
           `3. NFT 交易\n⏰ ${new Date(Date.now() - 7200000).toLocaleString()}\n\n` +
           `\n使用 /recent 继续查看其他钱包的交易记录`;
  }
}

// 处理交易提醒命令
async function handleAlert(chatId, text) {
  try {
    const state = userStates.get(chatId) || { type: StateType.NONE };
    console.log('Alert state:', state, 'Input:', text);

    if (state.type === StateType.NONE) {
      // 获取钱包列表
      const { data: wallets, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('获取钱包列表错误:', error);
        return '❌ 获取钱包列表失败，请稍后重试';
      }

      if (!wallets || wallets.length === 0) {
        return '📝 监控列表为空\n\n使用 /add 命令添加钱包';
      }

      // 保存钱包列表到状态
      userStates.set(chatId, {
        type: StateType.WAITING_FOR_WALLET,
        action: 'alert',
        wallets: wallets
      });

      // 构建选择消息
      let message = '请选择要设置交易提醒的钱包序号：\n\n';
      wallets.forEach((wallet, index) => {
        message += `${index + 1}. ${wallet.name}\n`;
        message += `📝 ${wallet.address}\n`;
        if (wallet.alert_amount) {
          message += `💰 当前提醒金额：${wallet.alert_amount} SOL\n`;
        }
        message += '\n';
      });

      return message;
    }

    if (state.type === StateType.WAITING_FOR_WALLET && state.action === 'alert') {
      const index = parseInt(text) - 1;
      const { wallets } = state;

      // 验证输入和状态
      if (!wallets || !Array.isArray(wallets)) {
        userStates.delete(chatId);
        return '❌ 系统错误，请重新使用 /alert 命令';
      }

      if (isNaN(index) || index < 0 || index >= wallets.length) {
        return '❌ 无效的序号，请重新输入：';
      }

      const selectedWallet = wallets[index];

      // 更新状态为等待金额输入
      userStates.set(chatId, {
        type: StateType.WAITING_FOR_AMOUNT,
        wallet: selectedWallet
      });

      return '请输入要提醒的金额（单位：SOL）：\n例如：输入 100 表示交易金额超过 100 SOL 时提醒';
    }

    if (state.type === StateType.WAITING_FOR_AMOUNT) {
      const amount = parseFloat(text);
      const { wallet } = state;

      // 验证输入和状态
      if (!wallet || !wallet.address) {
        userStates.delete(chatId);
        return '❌ 系统错误，请重新使用 /alert 命令';
      }

      if (isNaN(amount) || amount <= 0) {
        return '❌ 无效的金额，请输入大于 0 的数字：';
      }

      try {
        // 先查询当前状态
        const { data: currentWallet, error: queryError } = await supabase
          .from('wallets')
          .select('alert_amount')
          .eq('address', wallet.address)
          .eq('chat_id', chatId)
          .single();

        if (queryError) {
          console.error('查询钱包状态错误:', queryError);
          throw queryError;
        }

        // 更新数据库
        const { error: updateError } = await supabase
          .from('wallets')
          .update({
            alert_amount: amount,
            updated_at: new Date().toISOString()
          })
          .eq('address', wallet.address)
          .eq('chat_id', chatId);

        if (updateError) {
          console.error('更新提醒金额错误:', updateError);
          throw updateError;
        }

        // 清理状态
        userStates.delete(chatId);

        return `✅ 设置成功！\n\n📝 钱包：${wallet.name}\n💰 提醒金额：${amount} SOL\n\n当该钱包发生超过 ${amount} SOL 的交易时，我会立即通知您。\n\n您可以：\n1️⃣ 继续设置其他钱包的提醒，请输入 /alert\n2️⃣ 查看所有设置，请输入 /list`;
      } catch (error) {
        console.error('数据库操作错误:', error);
        throw error;
      }
    }

    return '❌ 系统错误，请重新使用 /alert 命令';
  } catch (error) {
    console.error('处理 alert 命令错误:', error);
    userStates.delete(chatId);
    return '❌ 设置提醒金额失败，请稍后重试';
  }
}

// 处理特别关注命令
async function handleWatch(chatId, text) {
  try {
    const state = userStates.get(chatId) || { type: StateType.NONE };
    console.log('Watch state:', state, 'Input:', text);

    if (state.type === StateType.NONE) {
      // 获取钱包列表
      const { data: wallets, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('获取钱包列表错误:', error);
        return '❌ 获取钱包列表失败，请稍后重试';
      }

      if (!wallets || wallets.length === 0) {
        return '📝 监控列表为空\n\n使用 /add 命令添加钱包';
      }

      // 保存钱包列表到状态
      userStates.set(chatId, {
        type: StateType.WAITING_FOR_WALLET,
        action: 'watch',
        wallets: wallets
      });

      // 构建选择消息
      let message = '请选择要切换特别关注状态的钱包序号：\n\n';
      wallets.forEach((wallet, index) => {
        message += `${index + 1}. ${wallet.name}\n`;
        message += `📝 ${wallet.address}\n`;
        message += wallet.is_watched ? '⭐️ 已特别关注\n' : '☆ 未特别关注\n';
        message += '\n';
      });

      return message;
    }

    if (state.type === StateType.WAITING_FOR_WALLET && state.action === 'watch') {
      const index = parseInt(text) - 1;
      const { wallets } = state;

      // 验证输入和状态
      if (!wallets || !Array.isArray(wallets)) {
        userStates.delete(chatId);
        return '❌ 系统错误，请重新使用 /watch 命令';
      }

      if (isNaN(index) || index < 0 || index >= wallets.length) {
        return '❌ 无效的序号，请重新输入：';
      }

      const selectedWallet = wallets[index];

      try {
        // 先查询当前状态
        const { data: currentWallet, error: queryError } = await supabase
          .from('wallets')
          .select('is_watched')
          .eq('address', selectedWallet.address)
          .eq('chat_id', chatId)
          .single();

        if (queryError) {
          console.error('查询钱包状态错误:', queryError);
          throw queryError;
        }

        const newWatchStatus = currentWallet ? !currentWallet.is_watched : true;

        // 更新数据库
        const { error: updateError } = await supabase
          .from('wallets')
          .update({
            is_watched: newWatchStatus,
            updated_at: new Date().toISOString()
          })
          .eq('address', selectedWallet.address)
          .eq('chat_id', chatId);

        if (updateError) {
          console.error('更新钱包状态错误:', updateError);
          throw updateError;
        }

        // 清理状态
        userStates.delete(chatId);

        return `✅ 设置成功！\n\n📝 钱包：${selectedWallet.name}\n${newWatchStatus ? '⭐️ 已添加到特别关注\n' : '☆ 已取消特别关注\n'}\n您可以：\n1️⃣ 继续设置其他钱包，请输入 /watch\n2️⃣ 查看所有设置，请输入 /list`;
      } catch (error) {
        console.error('数据库操作错误:', error);
        throw error;
      }
    }

    return '❌ 系统错误，请重新使用 /watch 命令';
  } catch (error) {
    console.error('处理 watch 命令错误:', error);
    userStates.delete(chatId);
    return '❌ 设置特别关注状态失败，请稍后重试';
  }
}

// 更新基本命令处理函数
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
    case '/stats':
      userStates.delete(chatId);
      return await handleStats(chatId);
    case '/recent':
      return await handleRecentTransactions(chatId, text);
    case '/alert':
      return await handleAlert(chatId, text);
    case '/watch':
      return await handleWatch(chatId, text);
    default:
      // 检查是否在等待用户输入
      const state = userStates.get(chatId);
      if (state) {
        switch (state.type) {
          case StateType.WAITING_FOR_WALLET:
            if (state.action === 'recent') {
              return await handleRecentTransactions(chatId, text);
            } else if (state.action === 'alert') {
              return await handleAlert(chatId, text);
            } else if (state.action === 'watch') {
              return await handleWatch(chatId, text);
            } else if (state.wallets) {
              return await handleRemoveWallet(chatId, text);
            } else {
              return await handleAddWallet(chatId, text);
            }
          case StateType.WAITING_FOR_NAME:
            return await handleAddWallet(chatId, text);
          case StateType.WAITING_FOR_AMOUNT:
            return await handleAlert(chatId, text);
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

