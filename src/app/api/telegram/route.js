import { handleTelegramUpdate } from '../../../utils/telegram.js';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const update = await request.json();
    
    // 确保更新包含必要的字段
    if (!update?.message?.chat?.id) {
      console.error('无效的 Telegram 更新:', update);
      return NextResponse.json({ message: '无效的请求' }, { status: 400 });
    }

    await handleTelegramUpdate(update);
    return NextResponse.json({ message: '成功' });
  } catch (error) {
    console.error('Telegram webhook 错误:', error);
    return NextResponse.json({ message: '处理更新时发生错误' }, { status: 500 });
  }
} 