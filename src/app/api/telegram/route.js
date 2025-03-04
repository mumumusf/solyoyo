import { handleTelegramUpdate } from '../../../utils/telegram.js';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // 确保请求体是有效的
    if (!request.body) {
      return NextResponse.json({ message: '无效的请求体' }, { status: 400 });
    }

    let update;
    try {
      const text = await request.text();
      update = JSON.parse(text);
    } catch (error) {
      console.error('解析请求体失败:', error);
      return NextResponse.json({ message: '无效的 JSON 格式' }, { status: 400 });
    }
    
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