import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

async function initializeDatabase() {
  try {
    // 初始化 Supabase 客户端
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    // 读取 SQL 文件
    const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '20240304_init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // 分割 SQL 语句
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // 逐个执行 SQL 语句
    for (const statement of statements) {
      const { error } = await supabase.rpc('postgres_query', { query: statement });
      if (error) {
        console.error('执行 SQL 语句失败:', statement);
        throw error;
      }
    }

    console.log('✅ 数据库初始化成功');
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    process.exit(1);
  }
}

initializeDatabase(); 