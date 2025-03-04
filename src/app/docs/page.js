'use client';

import styles from './page.module.css';

export default function DocsPage() {
  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>使用文档</h1>
        
        <div className={styles.content}>
          <section className={styles.section}>
            <h2>快速开始</h2>
            <p>Solana 钱包监控是一个实时监控 Solana 钱包活动和交易的工具。通过 Telegram 机器人，您可以方便地管理和监控多个钱包地址。</p>
          </section>

          <section className={styles.section}>
            <h2>基础命令</h2>
            <ul className={styles.commandList}>
              <li>
                <code>/help</code> - 显示帮助信息
              </li>
              <li>
                <code>/start</code> - 开始使用机器人
              </li>
              <li>
                <code>/add_wallet &lt;钱包地址&gt; &lt;备注名&gt;</code> - 添加新的钱包监控
              </li>
              <li>
                <code>/remove_wallet &lt;钱包地址&gt;</code> - 删除监控的钱包
              </li>
              <li>
                <code>/list_wallets [页码]</code> - 列出所有监控的钱包
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>高级功能</h2>
            <ul className={styles.commandList}>
              <li>
                <code>/set_alert &lt;钱包地址&gt; &lt;金额&gt;</code> - 设置大额交易提醒
              </li>
              <li>
                <code>/watchlist</code> - 查看特别关注的钱包
              </li>
              <li>
                <code>/stats</code> - 显示监控统计信息
              </li>
              <li>
                <code>/top_wallets</code> - 显示交易最活跃的钱包
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>使用示例</h2>
            <div className={styles.example}>
              <p>1. 添加钱包监控：</p>
              <code>/add_wallet 7NsAJ6DYM7qRzxVXWCGwqZpBEQUVCwS6gQUAi5kXCzVj 大户A</code>
            </div>
            <div className={styles.example}>
              <p>2. 设置大额提醒：</p>
              <code>/set_alert 7NsAJ6DYM7qRzxVXWCGwqZpBEQUVCwS6gQUAi5kXCzVj 10000</code>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
} 