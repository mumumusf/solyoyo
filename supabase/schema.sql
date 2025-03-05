-- 创建监控钱包表
CREATE TABLE IF NOT EXISTS monitored_wallets (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    label TEXT,
    chat_id BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(wallet_address, chat_id)
);

-- 创建钱包提醒表
CREATE TABLE IF NOT EXISTS wallet_alerts (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    chat_id BIGINT NOT NULL,
    alert_amount DECIMAL NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wallet_address, chat_id) REFERENCES monitored_wallets(wallet_address, chat_id) ON DELETE CASCADE,
    UNIQUE(wallet_address, chat_id)
);

-- 创建交易记录表
CREATE TABLE IF NOT EXISTS transactions (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    transaction_hash TEXT NOT NULL,
    amount DECIMAL NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(transaction_hash)
);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为监控钱包表添加更新时间触发器
DROP TRIGGER IF EXISTS update_monitored_wallets_updated_at ON monitored_wallets;
CREATE TRIGGER update_monitored_wallets_updated_at
    BEFORE UPDATE ON monitored_wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为钱包提醒表添加更新时间触发器
DROP TRIGGER IF EXISTS update_wallet_alerts_updated_at ON wallet_alerts;
CREATE TRIGGER update_wallet_alerts_updated_at
    BEFORE UPDATE ON wallet_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 