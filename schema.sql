-- 创建钱包表
CREATE TABLE IF NOT EXISTS wallets (
  id SERIAL PRIMARY KEY,
  address TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_watching BOOLEAN DEFAULT false,
  alert_threshold DECIMAL(20,2),
  added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 创建交易表
CREATE TABLE IF NOT EXISTS txs (
  id SERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES wallets(address),
  type TEXT NOT NULL,
  token_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  amount DECIMAL(20,8) NOT NULL,
  amount_usd DECIMAL(20,2),
  price_usd DECIMAL(20,8),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  tx_hash TEXT NOT NULL UNIQUE,
  block_number BIGINT
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address);
CREATE INDEX IF NOT EXISTS idx_wallets_is_watching ON wallets(is_watching);
CREATE INDEX IF NOT EXISTS idx_txs_wallet_address ON txs(wallet_address);
CREATE INDEX IF NOT EXISTS idx_txs_timestamp ON txs(timestamp);
CREATE INDEX IF NOT EXISTS idx_txs_token_address ON txs(token_address);

-- 启用 TimescaleDB（如果可用）
-- 这将帮助我们更好地处理时间序列数据
-- DO $$ 
-- BEGIN 
--   CREATE EXTENSION IF NOT EXISTS timescaledb;
--   SELECT create_hypertable('txs', 'timestamp', if_not_exists => TRUE);
-- EXCEPTION
--   WHEN undefined_file THEN
--     RAISE NOTICE 'TimescaleDB extension is not available';
-- END $$;