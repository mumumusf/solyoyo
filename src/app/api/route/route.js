import { createClient } from '@supabase/supabase-js';
import { processSwapData } from '../../../utils/swapProcessor';
import { solParser } from '../../../utils/txParser';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // Check authorization
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.HELIUS_API_KEY}`) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Get transaction data
    const txData = await request.json();
    const data = Array.isArray(txData) ? txData[0] : txData;
    if (!data) {
      console.error('Empty transaction data received');
      return NextResponse.json({ skipped: true, message: 'Empty data' });
    }

    // Process transaction data
    let processedData = null;
    
    if (data.events?.swap) {
      processedData = processSwapData(data);
    } else if (data.signature) {
      processedData = await solParser(data.signature);
      if (!processedData) {
        console.error('Failed to parse tx:', data.signature);
        return NextResponse.json({ 
          skipped: true, 
          message: 'Parse failed', 
          signature: data.signature 
        });
      }
    } else {
      return NextResponse.json({ skipped: true, message: 'No swap data' });
    }

    // 检查必要的环境变量
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json({ 
        error: 'Database configuration error' 
      }, { status: 500 });
    }

    // 初始化 Supabase 客户端
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

    // 确保处理后的数据是可序列化的
    const safeProcessedData = {
      ...processedData,
      signature: data.signature,
      timestamp: new Date().toISOString()
    };

    // Store to database
    const { error } = await supabase.from('txs').insert([safeProcessedData]);
    
    if (error) {
      console.error('Error inserting into Supabase:', error.message);
      return NextResponse.json({ 
        error: 'Database operation failed',
        message: error.message 
      }, { status: 500 });
    }

    console.log('Successfully processed and stored with parser:', data.events?.swap ? 'helius' : 'shyft');
    return NextResponse.json({ 
      success: true,
      signature: data.signature,
      timestamp: safeProcessedData.timestamp
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 