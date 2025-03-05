import { createClient } from '@supabase/supabase-js';
import { sendTelegramMessage } from '../../../utils/telegram';

// 初始化 Supabase 客户端
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// 处理 Helius webhook
export async function POST(request) {
  try {
    const transactions = await request.json();
    
    for (const tx of transactions) {
      try {
        // 获取交易的源地址和目标地址
        const sourceAddresses = tx.sourceAddress ? [tx.sourceAddress] : [];
        const accountKeys = tx.accountData?.map(acc => acc.account) || [];
        const allAddresses = [...new Set([...sourceAddresses, ...accountKeys])];
        
        // 获取交易金额（以 SOL 为单位）
        const amount = tx.nativeTransfers?.[0]?.amount 
          ? tx.nativeTransfers[0].amount / 1e9 
          : 0;

        if (amount <= 0) continue;

        // 查找这些地址是否在监控列表中
        const { data: monitoredWallets } = await supabase
          .from('monitored_wallets')
          .select('wallet_address, label, chat_id')
          .in('wallet_address', allAddresses);

        if (!monitoredWallets || monitoredWallets.length === 0) continue;

        // 记录交易
        await supabase
          .from('transactions')
          .insert([{
            wallet_address: tx.sourceAddress,
            transaction_hash: tx.signature,
            amount: amount,
            timestamp: new Date(tx.timestamp * 1000).toISOString()
          }]);

        // 检查是否需要发送提醒
        for (const wallet of monitoredWallets) {
          const { data: alerts } = await supabase
            .from('wallet_alerts')
            .select('alert_amount')
            .eq('wallet_address', wallet.wallet_address)
            .eq('chat_id', wallet.chat_id)
            .single();

          if (alerts && amount >= alerts.alert_amount) {
            const message = `🚨 大额交易提醒\n\n钱包：${wallet.label} (${wallet.wallet_address})\n金额：${amount.toFixed(2)} SOL\n\n交易详情：https://solscan.io/tx/${tx.signature}`;
            await sendTelegramMessage(message, wallet.chat_id);
          }
        }
      } catch (error) {
        console.error('处理单个交易时出错:', error);
        continue;
      }
    }

    return new Response(JSON.stringify({ message: '成功' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('处理 Helius webhook 错误:', error);
    return new Response(JSON.stringify({ message: '处理失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 