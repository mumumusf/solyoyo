-- 创建钱包表
CREATE TABLE IF NOT EXISTS wallets (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  address TEXT NOT NULL,
  name TEXT NOT NULL,
  chat_id BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  alert_amount NUMERIC,
  is_watched BOOLEAN DEFAULT FALSE,
  UNIQUE(address, chat_id)
);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 创建交易记录表
CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  wallet_id BIGINT REFERENCES wallets(id) ON DELETE CASCADE,
  signature TEXT NOT NULL,
  type TEXT NOT NULL,
  amount NUMERIC,
  token_address TEXT,
  token_name TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(signature)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS wallets_chat_id_idx ON wallets(chat_id);
CREATE INDEX IF NOT EXISTS wallets_created_at_idx ON wallets(created_at);
CREATE INDEX IF NOT EXISTS wallets_is_watched_idx ON wallets(is_watched);
CREATE INDEX IF NOT EXISTS transactions_wallet_id_idx ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS transactions_created_at_idx ON transactions(created_at);

-- 创建警报设置表
CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,
  wallet_id BIGINT REFERENCES wallets(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  threshold DECIMAL(24, 9) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TRIGGER update_alerts_updated_at
  BEFORE UPDATE ON alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();