import { handleTelegramUpdate } from '../../../utils/telegram.js';

export async function POST(request) {
  console.log('收到 Telegram webhook 请求');
  
  try {
    // 检查请求方法
    if (request.method !== 'POST') {
      console.error('无效的请求方法:', request.method);
      return new Response(JSON.stringify({ message: '只接受 POST 请求' }), {
        status: 405,
        headers: { 
          'Content-Type': 'application/json',
          'Allow': 'POST'
        }
      });
    }

    // 检查请求头
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('无效的 Content-Type:', contentType);
      return new Response(JSON.stringify({ message: '只接受 application/json' }), {
        status: 415,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let update;
    try {
      const text = await request.text();
      console.log('收到的请求体:', text);
      update = JSON.parse(text);
    } catch (error) {
      console.error('解析请求体失败:', error);
      return new Response(JSON.stringify({ 
        message: '无效的 JSON 格式',
        error: error.message 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 验证更新对象的结构
    if (!update) {
      console.error('更新对象为空');
      return new Response(JSON.stringify({ message: '更新对象不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!update.message) {
      console.error('缺少 message 字段:', update);
      return new Response(JSON.stringify({ message: '缺少必要的 message 字段' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!update.message.chat?.id) {
      console.error('缺少 chat.id 字段:', update.message);
      return new Response(JSON.stringify({ message: '缺少必要的 chat.id 字段' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('开始处理更新:', {
      chatId: update.message.chat.id,
      messageId: update.message.message_id,
      text: update.message.text
    });

    await handleTelegramUpdate(update);
    
    console.log('更新处理成功');
    return new Response(JSON.stringify({ message: '成功' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Telegram webhook 处理错误:', error);
    return new Response(JSON.stringify({ 
      message: '处理更新时发生错误',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 