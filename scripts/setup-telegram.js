import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

async function setupTelegramWebhook() {
  try {
    // 首先删除任何现有的 webhook
    const deleteUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteWebhook`;
    await fetch(deleteUrl);
    console.log('✅ 已清除旧的 webhook 配置');

    // 设置新的 webhook
    const setUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook`;
    const response = await fetch(setUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: `${WEBHOOK_URL}/api/telegram`,
        allowed_updates: ['message', 'callback_query'],
      }),
    });

    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Webhook 设置成功！');
      console.log(`🔗 Webhook URL: ${WEBHOOK_URL}/api/telegram`);
      
      // 获取机器人信息
      const botInfoUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getMe`;
      const botResponse = await fetch(botInfoUrl);
      const botData = await botResponse.json();
      
      if (botData.ok) {
        console.log('\n🤖 机器人信息：');
        console.log(`名称: ${botData.result.first_name}`);
        console.log(`用户名: @${botData.result.username}`);
        console.log(`ID: ${botData.result.id}`);
      }
    } else {
      console.error('❌ Webhook 设置失败：', data.description);
    }
  } catch (error) {
    console.error('❌ 设置过程中出错：', error);
  }
}

// 运行设置
setupTelegramWebhook(); 