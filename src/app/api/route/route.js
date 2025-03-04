import { createClient } from '@supabase/supabase-js';
import { processSwapData } from '../../../utils/swapProcessor';
import { solParser } from '../../../utils/txParser';
import { NextResponse } from 'next/server';

export async function POST(request) {
  // Check authorization
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.HELIUS_API_KEY}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  // Get transaction data
  const txData = await request.json();
  const data = Array.isArray(txData) ? txData[0] : txData;
  if (!data) {
    console.error('Empty transaction data received', data);
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
      return NextResponse.json({ skipped: true, message: 'Parse failed', signature: data.signature });
    }
  } else {
    return NextResponse.json({ skipped: true, message: 'No swap data' });
  }

  // 检查必要的环境变量
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error('Missing Supabase environment variables');
    return NextResponse.json({ error: 'Database configuration error' }, { status: 500 });
  }

  // 初始化 Supabase 客户端
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

  // Store to database
  const { error } = await supabase.from('txs').insert([{
    ...processedData,
    signature: data.signature
  }]);
  if (error) {
    console.error('Error inserting into Supabase:', error);
    return NextResponse.json({ error: error }, { status: 500 });
  }
  console.log('Successfully processed and stored with parser:', data.events?.swap ? 'helius' : 'shyft');
  return NextResponse.json({ success: true });
} 