import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { handleBotCommand } from './telegramBot.js';

dotenv.config();

// Sends a message to Telegram chat with optional reply functionality
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
    // console.log('Telegram response:', data);
    
    if (!data.ok || data.description?.includes('Unknown error')) {
      throw new Error(`Telegram API 错误: ${data.description || '未知错误'}`);
    }
    
    return data;
  } catch (error) {
    console.error('发送 Telegram 消息错误:', error);
    throw error; 
  }
}

// 处理传入的 Telegram 更新
export async function handleTelegramUpdate(update) {
  try {
    if (update.message && update.message.text && update.message.text.startsWith('/')) {
      const response = await handleBotCommand(update.message);
      await sendTelegramMessage(response, update.message.message_id);
    }
  } catch (error) {
    console.error('处理 Telegram 更新错误:', error);
    await sendTelegramMessage('处理命令时发生错误，请稍后重试。', update.message?.message_id);
  }
}

