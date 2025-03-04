'use client';

import styles from './page.module.css';

export default function MonitorPage() {
  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>开始监控</h1>
        
        <div className={styles.content}>
          <section className={styles.section}>
            <h2>使用步骤</h2>
            <div className={styles.steps}>
              <div className={styles.step}>
                <div className={styles.stepNumber}>1</div>
                <div className={styles.stepContent}>
                  <h3>添加机器人</h3>
                  <p>在 Telegram 中搜索 <code>@yoyomyoyoabot</code></p>
                </div>
              </div>
              
              <div className={styles.step}>
                <div className={styles.stepNumber}>2</div>
                <div className={styles.stepContent}>
                  <h3>开始对话</h3>
                  <p>发送 <code>/start</code> 命令开始使用</p>
                </div>
              </div>
              
              <div className={styles.step}>
                <div className={styles.stepNumber}>3</div>
                <div className={styles.stepContent}>
                  <h3>添加钱包</h3>
                  <p>使用 <code>/add_wallet</code> 命令添加要监控的钱包</p>
                </div>
              </div>
              
              <div className={styles.step}>
                <div className={styles.stepNumber}>4</div>
                <div className={styles.stepContent}>
                  <h3>设置提醒</h3>
                  <p>使用 <code>/set_alert</code> 命令设置提醒阈值</p>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h2>功能特点</h2>
            <ul className={styles.featureList}>
              <li>实时钱包活动监控</li>
              <li>大额交易提醒</li>
              <li>交易历史记录</li>
              <li>多钱包管理</li>
              <li>自定义提醒阈值</li>
              <li>交易统计分析</li>
            </ul>
          </section>

          <section className={styles.startBox}>
            <p>立即开始使用 Solana 钱包监控机器人</p>
            <a
              href="https://t.me/yoyomyoyoabot"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.button}
            >
              添加机器人
            </a>
          </section>
        </div>
      </main>
    </div>
  );
} 