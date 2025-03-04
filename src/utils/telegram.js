import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

// 帮助信息
const HELP_MESSAGE = `
🔍 <b>钱包监控机器人使用指南</b>

基础命令：
/help - 显示此帮助信息
/start - 开始使用机器人

钱包管理：
/add_wallet <钱包地址> <备注名> - 添加新的钱包监控
/remove_wallet <钱包地址> - 删除监控的钱包
/list_wallets [页码] - 列出所有监控的钱包
/search_wallet <关键词> - 搜索钱包（地址或备注）

数据统计：
/stats - 显示监控统计信息
/recent_txs [数量] - 显示最近的交易记录

高级功能：
/set_alert <钱包地址> <金额> - 设置大额交易提醒
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
export async function sendTelegramMessage(message, replyToMessageId = null) {
  const botToken = process.env.TELEGRAM_TOKEN;
  const channelId = process.env.TELEGRAM_CHAT_ID;
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: channelId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_to_message_id: replyToMessageId
      }),
    });

    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(`Telegram API 错误: ${data.description || '未知错误'}`);
    }
    
    return data;
  } catch (error) {
    console.error('发送 Telegram 消息错误:', error);
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
  try {
    if (update.message && update.message.text) {
      const command = update.message.text.split(' ')[0];
      const response = await handleBasicCommand(command);
      await sendTelegramMessage(response, update.message.message_id);
    }
  } catch (error) {
    console.error('处理 Telegram 更新错误:', error);
    await sendTelegramMessage('处理命令时发生错误，请稍后重试。', update.message?.message_id);
  }
}

