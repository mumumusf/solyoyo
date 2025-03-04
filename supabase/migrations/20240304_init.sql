-- 创建钱包表
CREATE TABLE IF NOT EXISTS wallets (
  id SERIAL PRIMARY KEY,
  address TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_watching BOOLEAN DEFAULT FALSE,
  alert_threshold DECIMAL(20, 8)
);

-- 创建交易记录表
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  wallet_id INTEGER REFERENCES wallets(id),
  tx_hash TEXT NOT NULL UNIQUE,
  amount DECIMAL(20, 8),
  type TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  details JSONB
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);

-- 添加注释
COMMENT ON TABLE wallets IS '监控的钱包列表';
COMMENT ON TABLE transactions IS '钱包交易记录'; 