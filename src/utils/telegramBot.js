import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// 帮助信息
const HELP_MESSAGE = `
🔍 <b>钱包监控机器人使用指南</b>

基础命令：
/help - 显示此帮助信息
/start - 开始使用机器人

钱包管理：
/add_wallet <钱包地址> <备注名> - 添加新的钱包监控
/remove_wallet <钱包地址> - 删除监控的钱包
/list_wallets [页码] - 列出所有监控的钱包
/search_wallet <关键词> - 搜索钱包（地址或备注）
/rename_wallet <钱包地址> <新备注名> - 重命名钱包

数据统计：
/stats - 显示监控统计信息
/top_wallets - 显示交易最活跃的钱包
/recent_txs [数量] - 显示最近的交易记录

高级功能：
/set_alert <钱包地址> <金额> - 设置大额交易提醒
/watchlist - 查看特别关注的钱包
/add_watch <钱包地址> - 添加到特别关注
/remove_watch <钱包地址> - 取消特别关注

使用示例：
➊ 添加钱包监控
/add_wallet 7NsAJ6DYM7qRzxVXWCGwqZpBEQUVCwS6gQUAi5kXCzVj 大户A

➋ 设置大额提醒
/set_alert 7NsAJ6DYM7qRzxVXWCGwqZpBEQUVCwS6gQUAi5kXCzVj 10000

➌ 查看最近交易
/recent_txs 5
`;

// 验证 Solana 钱包地址格式
function isValidSolanaAddress(address) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

// 处理机器人命令
export async function handleBotCommand(message) {
  const { text, from } = message;
  const [command, ...args] = text.split(' ');

  switch (command.toLowerCase()) {
    case '/start':
      return `👋 欢迎使用钱包监控机器人！\n\n${HELP_MESSAGE}`;
      
    case '/help':
      return HELP_MESSAGE;
      
    case '/add_wallet':
      return await addWallet(args);
      
    case '/remove_wallet':
      return await removeWallet(args);
      
    case '/list_wallets':
      const page = args[0] ? parseInt(args[0]) : 1;
      return await listWallets(page);
      
    case '/search_wallet':
      return await searchWallet(args);
      
    case '/rename_wallet':
      return await renameWallet(args);
      
    case '/stats':
      return await getStats();
      
    case '/top_wallets':
      return await getTopWallets();
      
    case '/recent_txs':
      const limit = args[0] ? parseInt(args[0]) : 5;
      return await getRecentTransactions(limit);
      
    case '/set_alert':
      return await setAlert(args);
      
    case '/watchlist':
      return await getWatchlist();
      
    case '/add_watch':
      return await addToWatchlist(args);
      
    case '/remove_watch':
      return await removeFromWatchlist(args);
      
    default:
      return '未知命令。使用 /help 查看可用命令。';
  }
}

// 添加钱包
async function addWallet(args) {
  if (args.length < 2) {
    return '❌ 请提供钱包地址和备注名。\n使用格式：/add_wallet <钱包地址> <备注名>';
  }

  const [address, ...nameArr] = args;
  const name = nameArr.join(' ');

  if (!isValidSolanaAddress(address)) {
    return '❌ 无效的 Solana 钱包地址格式。';
  }

  try {
    // 检查是否已存在
    const { data: existing } = await supabase
      .from('wallets')
      .select('address')
      .eq('address', address)
      .single();

    if (existing) {
      return '❌ 该钱包已在监控列表中。';
    }

    const { data, error } = await supabase
      .from('wallets')
      .insert([{ 
        address, 
        name,
        added_at: new Date().toISOString(),
        is_watching: false
      }]);

    if (error) throw error;
    return `✅ 成功添加钱包监控！\n\n📝 备注名：${name}\n🔑 地址：${address}\n\n可使用 /set_alert 设置大额交易提醒`;
  } catch (error) {
    console.error('添加钱包错误:', error);
    return '❌ 添加钱包失败，请稍后重试。';
  }
}

// 删除钱包
async function removeWallet(args) {
  if (args.length < 1) {
    return '❌ 请提供要删除的钱包地址。\n使用格式：/remove_wallet <钱包地址>';
  }

  const address = args[0];

  if (!isValidSolanaAddress(address)) {
    return '❌ 无效的 Solana 钱包地址格式。';
  }

  try {
    const { data, error } = await supabase
      .from('wallets')
      .delete()
      .eq('address', address)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return '❌ 未找到该钱包。';
    }

    return `✅ 成功删除钱包！\n\n📝 备注名：${data[0].name}\n🔑 地址：${address}`;
  } catch (error) {
    console.error('删除钱包错误:', error);
    return '❌ 删除钱包失败，请稍后重试。';
  }
}

// 列出钱包（分页）
async function listWallets(page = 1) {
  const PAGE_SIZE = 10;
  const offset = (page - 1) * PAGE_SIZE;

  try {
    // 获取总数
    const { count } = await supabase
      .from('wallets')
      .select('*', { count: 'exact', head: true });

    // 获取当前页数据
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .order('added_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;

    if (!data || data.length === 0) {
      return '📭 当前没有监控任何钱包。';
    }

    const totalPages = Math.ceil(count / PAGE_SIZE);
    
    const walletList = data.map((w, i) => 
      `${offset + i + 1}. ${w.is_watching ? '⭐️' : '👁️'} ${w.name}\n` +
      `└─ ${w.address}`
    ).join('\n\n');

    return `📋 钱包监控列表 (第 ${page}/${totalPages} 页)\n\n${walletList}\n\n` +
           `共 ${count} 个钱包 | 使用 /list_wallets <页码> 查看更多`;
  } catch (error) {
    console.error('获取钱包列表错误:', error);
    return '❌ 获取钱包列表失败，请稍后重试。';
  }
}

// 搜索钱包
async function searchWallet(args) {
  if (args.length < 1) {
    return '❌ 请提供搜索关键词。\n使用格式：/search_wallet <关键词>';
  }

  const keyword = args.join(' ');

  try {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .or(`name.ilike.%${keyword}%,address.ilike.%${keyword}%`)
      .limit(10);

    if (error) throw error;

    if (!data || data.length === 0) {
      return '❌ 未找到匹配的钱包。';
    }

    const walletList = data.map((w, i) => 
      `${i + 1}. ${w.is_watching ? '⭐️' : '👁️'} ${w.name}\n` +
      `└─ ${w.address}`
    ).join('\n\n');

    return `🔍 搜索结果：\n\n${walletList}`;
  } catch (error) {
    console.error('搜索钱包错误:', error);
    return '❌ 搜索失败，请稍后重试。';
  }
}

// 重命名钱包
async function renameWallet(args) {
  if (args.length < 2) {
    return '❌ 请提供钱包地址和新备注名。\n使用格式：/rename_wallet <钱包地址> <新备注名>';
  }

  const [address, ...nameArr] = args;
  const newName = nameArr.join(' ');

  if (!isValidSolanaAddress(address)) {
    return '❌ 无效的 Solana 钱包地址格式。';
  }

  try {
    const { data, error } = await supabase
      .from('wallets')
      .update({ name: newName })
      .eq('address', address)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return '❌ 未找到该钱包。';
    }

    return `✅ 成功重命名钱包！\n\n🔑 地址：${address}\n📝 新备注名：${newName}`;
  } catch (error) {
    console.error('重命名钱包错误:', error);
    return '❌ 重命名失败，请稍后重试。';
  }
}

// 获取最近交易
async function getRecentTransactions(limit = 5) {
  try {
    const { data: txs, error: txsError } = await supabase
      .from('txs')
      .select(`
        *,
        wallets (name)
      `)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (txsError) throw txsError;

    if (!txs || txs.length === 0) {
      return '📭 暂无交易记录。';
    }

    const txList = txs.map((tx, i) => {
      const date = new Date(tx.timestamp).toLocaleString();
      return `${i + 1}. ${tx.wallets?.name || '未命名钱包'}\n` +
             `└─ ${tx.type} ${tx.amount} ${tx.token_symbol} @ $${tx.price_usd}\n` +
             `└─ ${date}`;
    }).join('\n\n');

    return `📊 最近 ${limit} 笔交易：\n\n${txList}`;
  } catch (error) {
    console.error('获取交易记录错误:', error);
    return '❌ 获取交易记录失败，请稍后重试。';
  }
}

// 获取活跃钱包
async function getTopWallets() {
  try {
    const { data, error } = await supabase
      .from('txs')
      .select(`
        wallet_address,
        wallets (name),
        count(*) as tx_count,
        sum(amount_usd) as total_volume
      `)
      .group('wallet_address, wallets (name)')
      .order('tx_count', { ascending: false })
      .limit(10);

    if (error) throw error;

    if (!data || data.length === 0) {
      return '📭 暂无交易数据。';
    }

    const walletList = data.map((w, i) => 
      `${i + 1}. ${w.wallets?.name || '未命名钱包'}\n` +
      `└─ ${w.tx_count} 笔交易 | 总量 $${Math.round(w.total_volume).toLocaleString()}`
    ).join('\n\n');

    return `🏆 最活跃钱包 TOP 10：\n\n${walletList}`;
  } catch (error) {
    console.error('获取活跃钱包错误:', error);
    return '❌ 获取活跃钱包数据失败，请稍后重试。';
  }
}

// 获取统计信息
async function getStats() {
  try {
    const { data: wallets, error: walletsError } = await supabase
      .from('wallets')
      .select('*');

    const { data: txs, error: txsError } = await supabase
      .from('txs')
      .select('*');

    if (walletsError || txsError) throw walletsError || txsError;

    const watchingCount = wallets?.filter(w => w.is_watching).length || 0;
    const today = new Date().toISOString().split('T')[0];
    const todayTxs = txs?.filter(tx => tx.timestamp.startsWith(today)).length || 0;

    const stats = {
      totalWallets: wallets?.length || 0,
      watchingWallets: watchingCount,
      totalTxs: txs?.length || 0,
      todayTxs,
      lastTx: txs && txs.length > 0 ? new Date(txs[txs.length - 1].timestamp).toLocaleString() : '无'
    };

    return `📊 监控统计信息\n\n` +
           `👁️ 监控钱包：${stats.totalWallets} 个\n` +
           `⭐️ 特别关注：${stats.watchingWallets} 个\n` +
           `📈 总交易数：${stats.totalTxs} 笔\n` +
           `📅 今日交易：${stats.todayTxs} 笔\n` +
           `🕒 最新交易：${stats.lastTx}`;
  } catch (error) {
    console.error('获取统计信息错误:', error);
    return '❌ 获取统计信息失败，请稍后重试。';
  }
}

// 设置大额提醒
async function setAlert(args) {
  if (args.length < 2) {
    return '❌ 请提供钱包地址和金额。\n使用格式：/set_alert <钱包地址> <金额>';
  }

  const [address, amount] = args;
  const threshold = parseFloat(amount);

  if (!isValidSolanaAddress(address)) {
    return '❌ 无效的 Solana 钱包地址格式。';
  }

  if (isNaN(threshold) || threshold <= 0) {
    return '❌ 请提供有效的金额数值。';
  }

  try {
    const { data, error } = await supabase
      .from('wallets')
      .update({ 
        alert_threshold: threshold,
        updated_at: new Date().toISOString()
      })
      .eq('address', address)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return '❌ 未找到该钱包。';
    }

    return `✅ 成功设置大额提醒！\n\n` +
           `📝 备注名：${data[0].name}\n` +
           `🔑 地址：${address}\n` +
           `💰 提醒金额：$${threshold.toLocaleString()}`;
  } catch (error) {
    console.error('设置提醒错误:', error);
    return '❌ 设置提醒失败，请稍后重试。';
  }
}

// 获取特别关注列表
async function getWatchlist() {
  try {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('is_watching', true)
      .order('added_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      return '📭 特别关注列表为空。';
    }

    const watchlist = data.map((w, i) => 
      `${i + 1}. ⭐️ ${w.name}\n` +
      `└─ ${w.address}${w.alert_threshold ? `\n└─ 提醒金额：$${w.alert_threshold.toLocaleString()}` : ''}`
    ).join('\n\n');

    return `⭐️ 特别关注列表：\n\n${watchlist}`;
  } catch (error) {
    console.error('获取特别关注列表错误:', error);
    return '❌ 获取特别关注列表失败，请稍后重试。';
  }
}

// 添加到特别关注
async function addToWatchlist(args) {
  if (args.length < 1) {
    return '❌ 请提供钱包地址。\n使用格式：/add_watch <钱包地址>';
  }

  const address = args[0];

  if (!isValidSolanaAddress(address)) {
    return '❌ 无效的 Solana 钱包地址格式。';
  }

  try {
    const { data, error } = await supabase
      .from('wallets')
      .update({ 
        is_watching: true,
        updated_at: new Date().toISOString()
      })
      .eq('address', address)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return '❌ 未找到该钱包。';
    }

    return `✅ 已添加到特别关注！\n\n📝 备注名：${data[0].name}\n🔑 地址：${address}`;
  } catch (error) {
    console.error('添加特别关注错误:', error);
    return '❌ 添加特别关注失败，请稍后重试。';
  }
}

// 取消特别关注
async function removeFromWatchlist(args) {
  if (args.length < 1) {
    return '❌ 请提供钱包地址。\n使用格式：/remove_watch <钱包地址>';
  }

  const address = args[0];

  if (!isValidSolanaAddress(address)) {
    return '❌ 无效的 Solana 钱包地址格式。';
  }

  try {
    const { data, error } = await supabase
      .from('wallets')
      .update({ 
        is_watching: false,
        updated_at: new Date().toISOString()
      })
      .eq('address', address)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return '❌ 未找到该钱包。';
    }

    return `✅ 已取消特别关注！\n\n📝 备注名：${data[0].name}\n🔑 地址：${address}`;
  } catch (error) {
    console.error('取消特别关注错误:', error);
    return '❌ 取消特别关注失败，请稍后重试。';
  }
} 