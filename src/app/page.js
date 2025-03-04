import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>Solana 钱包监控</h1>
        <p>实时监控 Solana 钱包活动和交易</p>
        
        <div className={styles.ctas}>
          <a
            className={styles.primary}
            href="/docs"
          >
            查看文档
          </a>
          <a
            href="/monitor"
            className={styles.secondary}
          >
            开始监控
          </a>
        </div>
      </main>
      
      <footer className={styles.footer}>
        <div>
          <p>© 2024 Solana 钱包监控. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
