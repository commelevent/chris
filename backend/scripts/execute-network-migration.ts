import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('请设置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY 环境变量');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeMigration() {
  console.log('开始执行网络指标表迁移...\n');
  
  const sqlFilePath = join(__dirname, '../supabase/migrations/014_add_network_metrics.sql');
  const sqlContent = readFileSync(sqlFilePath, 'utf-8');
  
  console.log('SQL 文件内容:');
  console.log(sqlContent);
  console.log('\n');
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql: sqlContent 
    });
    
    if (error) {
      console.error('执行迁移失败:', error);
      console.log('\n请手动在 Supabase SQL Editor 中执行迁移文件:');
      console.log('文件路径: backend/supabase/migrations/014_add_network_metrics.sql');
    } else {
      console.log('迁移执行成功:', data);
    }
  } catch (err: any) {
    console.error('执行迁移时发生错误:', err.message);
    console.log('\n请手动在 Supabase SQL Editor 中执行迁移文件:');
    console.log('文件路径: backend/supabase/migrations/014_add_network_metrics.sql');
  }
  
  console.log('\n检查表是否存在...');
  const { data: tableCheck, error: tableError } = await supabase
    .from('network_metrics')
    .select('count', { count: 'exact', head: true });
  
  if (tableError) {
    console.log('表不存在或无法访问:', tableError.message);
  } else {
    console.log('表已存在，当前记录数:', tableCheck);
  }
}

executeMigration().catch(console.error);
