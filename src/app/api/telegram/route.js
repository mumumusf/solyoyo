import { handleTelegramUpdate } from '../../../utils/telegram.js';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const update = await request.json();
    await handleTelegramUpdate(update);
    return NextResponse.json({ message: '成功' });
  } catch (error) {
    console.error('Telegram webhook 错误:', error);
    return NextResponse.json({ message: '处理更新时发生错误' }, { status: 500 });
  }
} 