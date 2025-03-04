import { handleTelegramUpdate } from '../../src/utils/telegram.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: '只允许 POST 请求' });
  }

  try {
    const update = req.body;
    await handleTelegramUpdate(update);
    res.status(200).json({ message: '成功' });
  } catch (error) {
    console.error('Telegram webhook 错误:', error);
    res.status(500).json({ message: '处理更新时发生错误' });
  }
} 