import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import * as path from 'path';

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

interface NetworkMetric {
  report_date: string;
  node_type: string;
  metric_category: string;
  metric_name: string;
  location: string | null;
  carrier: string | null;
  current_value: number;
  yoy_change: number;
  mom_change: number;
  historical_peak: number;
  historical_peak_date: string;
  unit: string;
  threshold_warning: number;
  threshold_critical: number;
  health_status: 'healthy' | 'warning' | 'critical';
  insight: string;
}

interface ExcelMetricData {
  node_type: string;
  metric_category: string;
  metric_name: string;
  unit: string;
}

function extractLocationAndCarrier(metricName: string): { location: string | null; carrier: string | null } {
  const locationPatterns = [
    { pattern: /^威新/, location: '威新机房' },
    { pattern: /^南方(?!快交)/, location: '南方机房' },
    { pattern: /^上海(?!快交|灾备)/, location: '上海机房' },
    { pattern: /^北京/, location: '北京机房' },
    { pattern: /^南方快交/, location: '南方快交' },
    { pattern: /^上海快交/, location: '上海快交' },
    { pattern: /^东莞/, location: '东莞' },
  ];

  const carrierPatterns = [
    { pattern: /电信/, carrier: '电信' },
    { pattern: /联通/, carrier: '联通' },
    { pattern: /移动/, carrier: '移动' },
  ];

  let location: string | null = null;
  let carrier: string | null = null;

  for (const { pattern, location: loc } of locationPatterns) {
    if (pattern.test(metricName)) {
      location = loc;
      break;
    }
  }

  for (const { pattern, carrier: car } of carrierPatterns) {
    if (pattern.test(metricName)) {
      carrier = car;
      break;
    }
  }

  return { location, carrier };
}

function determineUnit(metricName: string, excelUnit: string): string {
  if (excelUnit.includes('%')) return '%';
  if (excelUnit.includes('万p/s')) return '万p/s';
  if (excelUnit.includes('Gb')) return 'Gb';
  if (excelUnit.includes('万')) return '万';
  return excelUnit || '%';
}

function determineThresholds(metricName: string, unit: string): { warning: number; critical: number } {
  if (metricName.includes('CPU') || metricName.includes('cpu')) {
    return { warning: 70, critical: 85 };
  }
  if (metricName.includes('内存')) {
    return { warning: 80, critical: 90 };
  }
  if (metricName.includes('带宽使用率') || metricName.includes('线路利用率') || metricName.includes('利用率')) {
    return { warning: 70, critical: 85 };
  }
  if (unit === '万p/s') {
    return { warning: 500, critical: 800 };
  }
  if (unit === 'Gb') {
    return { warning: 100, critical: 150 };
  }
  if (unit === '万') {
    if (metricName.includes('会话数')) {
      return { warning: 100, critical: 150 };
    }
    if (metricName.includes('新建会话数')) {
      return { warning: 50, critical: 80 };
    }
    return { warning: 100, critical: 150 };
  }
  return { warning: 70, critical: 85 };
}

function generateRandomValue(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function determineHealthStatus(value: number, warning: number, critical: number): 'healthy' | 'warning' | 'critical' {
  if (value >= critical) return 'critical';
  if (value >= warning) return 'warning';
  return 'healthy';
}

function generateInsight(
  nodeType: string,
  metricName: string,
  value: number,
  healthStatus: string,
  momChange: number
): string {
  const trend = momChange > 5 ? '上升' : momChange < -5 ? '下降' : '平稳';
  const status = healthStatus === 'healthy' ? '正常' : healthStatus === 'warning' ? '需关注' : '告警';
  
  const insights = [
    `${nodeType}的${metricName}当前值为${value}，${trend}趋势，状态${status}。`,
    `${metricName}指标${status}，环比${momChange > 0 ? '上升' : '下降'}${Math.abs(momChange).toFixed(2)}%。`,
    healthStatus === 'critical' 
      ? `【严重告警】${nodeType}的${metricName}已超过严重阈值，请立即处理。`
      : healthStatus === 'warning'
      ? `【警告】${nodeType}的${metricName}已接近告警阈值，建议关注。`
      : `${nodeType}的${metricName}运行正常，无需特别关注。`,
  ];
  
  return insights[Math.floor(Math.random() * insights.length)];
}

function generateValueForMetric(metricName: string, unit: string): number {
  if (metricName.includes('CPU') || metricName.includes('cpu')) {
    return generateRandomValue(20, 75);
  }
  if (metricName.includes('内存')) {
    return generateRandomValue(30, 80);
  }
  if (metricName.includes('带宽使用率') || metricName.includes('线路利用率') || metricName.includes('利用率')) {
    return generateRandomValue(15, 75);
  }
  if (unit === '万p/s') {
    return generateRandomValue(100, 600);
  }
  if (unit === 'Gb') {
    return generateRandomValue(20, 120);
  }
  if (unit === '万') {
    return generateRandomValue(10, 100);
  }
  return generateRandomValue(20, 70);
}

async function readExcelData(): Promise<ExcelMetricData[]> {
  const filePath = path.join(__dirname, '../../网络团队-每日性能分析自动化表格数据源.xlsx');
  
  console.log('读取 Excel 文件:', filePath);
  
  const workbook = XLSX.readFile(filePath);
  const sheetName = '网络';
  const worksheet = workbook.Sheets[sheetName];
  
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  
  const metrics: ExcelMetricData[] = [];
  
  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.length < 3) continue;
    
    const nodeType = row[0]?.toString().trim();
    const metricCategory = row[1]?.toString().trim();
    const metricName = row[2]?.toString().trim();
    const unitCell = row[3]?.toString().trim() || '%';
    
    if (nodeType && metricCategory && metricName) {
      metrics.push({
        node_type: nodeType,
        metric_category: metricCategory,
        metric_name: metricName,
        unit: determineUnit(metricName, unitCell)
      });
    }
  }
  
  console.log(`从 Excel 读取了 ${metrics.length} 条指标数据\n`);
  
  return metrics;
}

async function generateNetworkMetrics(excelMetrics: ExcelMetricData[], date: string): Promise<NetworkMetric[]> {
  const metrics: NetworkMetric[] = [];
  
  for (const excelMetric of excelMetrics) {
    const { node_type, metric_category, metric_name, unit } = excelMetric;
    
    const { location, carrier } = extractLocationAndCarrier(metric_name);
    const { warning, critical } = determineThresholds(metric_name, unit);
    
    const value = generateValueForMetric(metric_name, unit);
    const healthStatus = determineHealthStatus(value, warning, critical);
    const momChange = generateRandomValue(-15, 15);
    const yoyChange = generateRandomValue(-20, 20);
    const peak = generateRandomValue(value, critical);
    
    const peakDate = new Date();
    peakDate.setDate(peakDate.getDate() - Math.floor(Math.random() * 90));
    const peakDateStr = peakDate.toISOString().split('T')[0];
    
    metrics.push({
      report_date: date,
      node_type: node_type,
      metric_category: metric_category,
      metric_name: metric_name,
      location: location,
      carrier: carrier,
      current_value: value,
      yoy_change: yoyChange,
      mom_change: momChange,
      historical_peak: peak,
      historical_peak_date: peakDateStr,
      unit: unit,
      threshold_warning: warning,
      threshold_critical: critical,
      health_status: healthStatus,
      insight: generateInsight(node_type, metric_name, value, healthStatus, momChange)
    });
  }
  
  return metrics;
}

async function insertNetworkMetrics(metrics: NetworkMetric[]): Promise<void> {
  const batchSize = 50;
  
  for (let i = 0; i < metrics.length; i += batchSize) {
    const batch = metrics.slice(i, i + batchSize);
    const { error } = await supabase
      .from('network_metrics')
      .upsert(batch, { onConflict: 'report_date,node_type,metric_name' });
    
    if (error) {
      console.error(`插入数据失败 (批次 ${Math.floor(i / batchSize) + 1}):`, error);
    } else {
      console.log(`成功插入批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(metrics.length / batchSize)}`);
    }
  }
}

async function main() {
  console.log('开始从 Excel 生成网络指标模拟数据...\n');
  
  const excelMetrics = await readExcelData();
  
  if (excelMetrics.length === 0) {
    console.error('没有从 Excel 读取到任何指标数据');
    process.exit(1);
  }
  
  const today = new Date();
  const date = today.toISOString().split('T')[0];
  
  console.log(`正在生成 ${date} 的数据...`);
  const metrics = await generateNetworkMetrics(excelMetrics, date);
  console.log(`生成了 ${metrics.length} 条指标数据\n`);
  
  await insertNetworkMetrics(metrics);
  console.log('\n数据插入完成\n');
  
  const { count, error } = await supabase
    .from('network_metrics')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error('查询数据总数失败:', error);
  } else {
    console.log(`数据生成完成！总记录数: ${count}`);
  }
}

main().catch(console.error);
