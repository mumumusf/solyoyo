import { formatTimeAgo } from '../utils/txsAnalyzer.js';

// 格式化数字为易读的货币字符串
function formatNumber(number) {
  const num = Number(number);
  
  if (isNaN(num)) {
    return '¥0.00';
  }
  if (num >= 1_000_000) {
    return `¥${(num / 1_000_000).toFixed(1)}M`;
  } else if (num >= 1_000) {
    return `¥${Math.round(num / 1_000)}K`;
  }
  return `¥${Math.round(num)}`;
}

// 格式化智能钱包数据
function formatSmartMoney(analysis) {
  let details = '';
  for (const [address, data] of Object.entries(analysis)) {
    details += `\u{25AB}<a href="https://solscan.io/account/${address}">${data.walletName}</a> 买入金额 ${formatNumber(data.totalBuyCost)} 当时市值 ${formatNumber(data.averageMarketCap)}(${data.buyTime}), 持仓比例: ${data.holdsPercentage}\n`;
  }
  return details.trim();
}

// 创建格式化的代币信息和智能钱包分析消息
export function createMsg(tokenInfo, analysis) {
  const smartMoneyCount = Object.keys(analysis).length;
  
  return `
\u{1F436} 多钱包买入提醒: <b>$${tokenInfo.symbol}</b>
<code>${tokenInfo.address}</code>

\u{1F90D} <b>链上数据</b>
\u{1F49B} <b>市值:</b> <code>${formatNumber(tokenInfo.marketCap)}</code>
\u{1F90E} <b>24h成交:</b> <code>${formatNumber(tokenInfo.volumeH24)}</code>
\u{1F90D} <b>1h成交:</b> <code>${formatNumber(tokenInfo.volumeH1)}</code>
\u{1F49B} <b>流动性:</b> <code>${formatNumber(tokenInfo.liquidity)}</code>
\u{1F90E} <b>价格:</b> <code>¥${Number(tokenInfo.priceUSD).toFixed(6)}</code>
\u{1F90D} <b>代币年龄:</b> <code>${formatTimeAgo(tokenInfo.createdAt)}</code>
\u{1F49B} <b>6小时涨跌:</b> <code>${tokenInfo.changeH6}%</code>
\u{1F90E} <b>智能钱包动态:</b>
${smartMoneyCount} 个钱包买入了 $${tokenInfo.symbol}

${formatSmartMoney(analysis)}

<a href="https://dexscreener.com/solana/${tokenInfo.address}">查看图表</a> | <a href="https://gmgn.ai/sol/token/${tokenInfo.address}">查看分析</a>${tokenInfo.website ? ` | <a href="${tokenInfo.website}">官网</a>` : ''}${tokenInfo.twitter ? ` | <a href="${tokenInfo.twitter}">推特</a>` : ''}
`.trim();
}

