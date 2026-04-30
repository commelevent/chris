import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

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
  location: string;
  carrier?: string;
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

const locations = ['威新机房', '南方机房', '上海机房', '北京机房', '南方快交', '上海快交'];
const carriers = ['电信', '联通', '移动'];

const nodeTypes = [
  {
    type: '交易互联网线路',
    category: '资源使用率',
    metrics: [
      { name: '带宽使用率', unit: '%', warning: 70, critical: 85 },
    ]
  },
  {
    type: '报盘线路',
    category: '资源使用率',
    metrics: [
      { name: '线路利用率', unit: '%', warning: 70, critical: 85 },
    ]
  },
  {
    type: '行情线路',
    category: '资源使用率',
    metrics: [
      { name: '线路利用率', unit: '%', warning: 70, critical: 85 },
    ]
  },
  {
    type: '机房互联线路',
    category: '资源使用率',
    metrics: [
      { name: '互联线路利用率', unit: '%', warning: 70, critical: 85 },
    ]
  },
  {
    type: '快速交易机房互联网线路',
    category: '资源使用率',
    metrics: [
      { name: '互联网线路', unit: '%', warning: 70, critical: 85 },
    ]
  },
  {
    type: 'DCI线路',
    category: '资源使用率',
    metrics: [
      { name: '裸纤使用率', unit: '%', warning: 70, critical: 85 },
    ]
  },
  {
    type: '互联网负载均衡',
    category: '资源使用率',
    metrics: [
      { name: 'CPU利用率', unit: '%', warning: 70, critical: 85 },
      { name: '内存利用率', unit: '%', warning: 80, critical: 90 },
    ]
  },
  {
    type: '互联网负载均衡',
    category: '请求量',
    metrics: [
      { name: '会话数', unit: '万', warning: 100, critical: 150 },
      { name: '新建会话数', unit: '万', warning: 50, critical: 80 },
      { name: '吞吐量', unit: 'Gb', warning: 100, critical: 150 },
    ]
  },
  {
    type: '互联网防火墙',
    category: '资源使用率',
    metrics: [
      { name: 'CPU利用率', unit: '%', warning: 70, critical: 85 },
      { name: '内存利用率', unit: '%', warning: 80, critical: 90 },
    ]
  },
  {
    type: '互联网防火墙',
    category: '请求量',
    metrics: [
      { name: '会话数', unit: '万', warning: 100, critical: 150 },
      { name: '新建会话数', unit: '万', warning: 50, critical: 80 },
      { name: '吞吐量', unit: 'Gb', warning: 100, critical: 150 },
    ]
  },
  {
    type: 'DMZ防火墙',
    category: '资源使用率',
    metrics: [
      { name: 'CPU利用率', unit: '%', warning: 70, critical: 85 },
      { name: '内存利用率', unit: '%', warning: 80, critical: 90 },
    ]
  },
  {
    type: 'DMZ防火墙',
    category: '请求量',
    metrics: [
      { name: '会话数', unit: '万', warning: 80, critical: 120 },
      { name: '新建会话数', unit: '万', warning: 40, critical: 60 },
      { name: '吞吐量', unit: 'Gb', warning: 80, critical: 120 },
    ]
  },
  {
    type: '交易内网防火墙',
    category: '资源使用率',
    metrics: [
      { name: 'CPU利用率', unit: '%', warning: 70, critical: 85 },
      { name: '内存利用率', unit: '%', warning: 80, critical: 90 },
    ]
  },
  {
    type: '交易内网防火墙',
    category: '请求量',
    metrics: [
      { name: '会话数', unit: '万', warning: 60, critical: 100 },
      { name: '新建会话数', unit: '万', warning: 30, critical: 50 },
      { name: '吞吐量', unit: 'Gb', warning: 60, critical: 100 },
    ]
  },
  {
    type: '交易内网汇聚交换机',
    category: '资源使用率',
    metrics: [
      { name: 'CPU利用率', unit: '%', warning: 70, critical: 85 },
      { name: '内存利用率', unit: '%', warning: 80, critical: 90 },
    ]
  },
  {
    type: '交易内网汇聚交换机',
    category: '请求量',
    metrics: [
      { name: '包转发率', unit: '万p/s', warning: 500, critical: 800 },
      { name: '吞吐量', unit: 'Gb', warning: 80, critical: 120 },
    ]
  },
  {
    type: 'DMZ汇聚交换机',
    category: '资源使用率',
    metrics: [
      { name: 'CPU利用率', unit: '%', warning: 70, critical: 85 },
      { name: '内存利用率', unit: '%', warning: 80, critical: 90 },
    ]
  },
  {
    type: 'DMZ汇聚交换机',
    category: '请求量',
    metrics: [
      { name: '包转发率', unit: '万p/s', warning: 400, critical: 600 },
      { name: '吞吐量', unit: 'Gb', warning: 60, critical: 100 },
    ]
  },
  {
    type: '数据中心核心交换机',
    category: '资源使用率',
    metrics: [
      { name: 'CPU利用率', unit: '%', warning: 70, critical: 85 },
      { name: '内存利用率', unit: '%', warning: 80, critical: 90 },
    ]
  },
  {
    type: '数据中心核心交换机',
    category: '请求量',
    metrics: [
      { name: '包转发率', unit: '万p/s', warning: 600, critical: 1000 },
      { name: '吞吐量', unit: 'Gb', warning: 100, critical: 150 },
    ]
  },
];

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

async function generateNetworkMetrics(date: string): Promise<NetworkMetric[]> {
  const metrics: NetworkMetric[] = [];
  
  for (const nodeTypeConfig of nodeTypes) {
    const { type, category, metrics: metricConfigs } = nodeTypeConfig;
    
    for (const metricConfig of metricConfigs) {
      const { name, unit, warning, critical } = metricConfig;
      
      if (type === '交易互联网线路' && name === '带宽使用率') {
        for (const location of ['威新机房', '南方机房', '上海机房', '北京机房']) {
          for (const carrier of carriers) {
            const value = generateRandomValue(20, 75);
            const healthStatus = determineHealthStatus(value, warning, critical);
            const momChange = generateRandomValue(-15, 15);
            const yoyChange = generateRandomValue(-20, 20);
            const peak = generateRandomValue(value, 85);
            
            metrics.push({
              report_date: date,
              node_type: type,
              metric_category: category,
              metric_name: `${location}-带宽使用率（${carrier}）`,
              location: location,
              carrier: carrier,
              current_value: value,
              yoy_change: yoyChange,
              mom_change: momChange,
              historical_peak: peak,
              historical_peak_date: '2025-03-15',
              unit: unit,
              threshold_warning: warning,
              threshold_critical: critical,
              health_status: healthStatus,
              insight: generateInsight(type, `${location}-带宽使用率（${carrier}）`, value, healthStatus, momChange)
            });
          }
        }
      } else if (type === '报盘线路' || type === '行情线路') {
        for (const location of ['威新']) {
          for (const exchange of ['上交所', '深交所']) {
            for (const carrier of ['电信', '联通']) {
              const value = generateRandomValue(15, 65);
              const healthStatus = determineHealthStatus(value, warning, critical);
              const momChange = generateRandomValue(-10, 10);
              const yoyChange = generateRandomValue(-15, 15);
              const peak = generateRandomValue(value, 75);
              
              const lineType = type === '报盘线路' ? '报盘线路' : '报盘行情';
              
              metrics.push({
                report_date: date,
                node_type: type,
                metric_category: category,
                metric_name: `${location}-${exchange}${carrier}${lineType}利用率`,
                location: location,
                carrier: carrier,
                current_value: value,
                yoy_change: yoyChange,
                mom_change: momChange,
                historical_peak: peak,
                historical_peak_date: '2025-03-15',
                unit: unit,
                threshold_warning: warning,
                threshold_critical: critical,
                health_status: healthStatus,
                insight: generateInsight(type, `${location}-${exchange}${carrier}${lineType}利用率`, value, healthStatus, momChange)
              });
            }
          }
        }
      } else if (type === '机房互联线路') {
        const interConnections = [
          { from: '威新', to: '北京机房', carrier: '电信' },
          { from: '威新', to: '上海灾备', carrier: '联通' },
          { from: '东莞', to: '北京机房', carrier: '联通' },
          { from: '东莞', to: '上海灾备', carrier: '电信' },
        ];
        
        for (const conn of interConnections) {
          const value = generateRandomValue(20, 60);
          const healthStatus = determineHealthStatus(value, warning, critical);
          const momChange = generateRandomValue(-12, 12);
          const yoyChange = generateRandomValue(-18, 18);
          const peak = generateRandomValue(value, 70);
          
          metrics.push({
            report_date: date,
            node_type: type,
            metric_category: category,
            metric_name: `${conn.from}-${conn.to}${conn.carrier}互联线路利用率`,
            location: conn.from,
            carrier: conn.carrier,
            current_value: value,
            yoy_change: yoyChange,
            mom_change: momChange,
            historical_peak: peak,
            historical_peak_date: '2025-03-15',
            unit: unit,
            threshold_warning: warning,
            threshold_critical: critical,
            health_status: healthStatus,
            insight: generateInsight(type, `${conn.from}-${conn.to}${conn.carrier}互联线路利用率`, value, healthStatus, momChange)
          });
        }
      } else if (type === '快速交易机房互联网线路') {
        for (const location of ['南方快交', '上海快交']) {
          for (const carrier of ['电信', '联通']) {
            const value = generateRandomValue(25, 70);
            const healthStatus = determineHealthStatus(value, warning, critical);
            const momChange = generateRandomValue(-10, 10);
            const yoyChange = generateRandomValue(-15, 15);
            const peak = generateRandomValue(value, 80);
            
            metrics.push({
              report_date: date,
              node_type: type,
              metric_category: category,
              metric_name: `${location}${carrier}互联网线路`,
              location: location,
              carrier: carrier,
              current_value: value,
              yoy_change: yoyChange,
              mom_change: momChange,
              historical_peak: peak,
              historical_peak_date: '2025-03-15',
              unit: unit,
              threshold_warning: warning,
              threshold_critical: critical,
              health_status: healthStatus,
              insight: generateInsight(type, `${location}${carrier}互联网线路`, value, healthStatus, momChange)
            });
          }
        }
      } else if (type === 'DCI线路') {
        const dciLines = [
          { name: '南方-威新主53口联通裸纤40G', location: '南方' },
          { name: '南方-威新主54口联通裸纤40G', location: '南方' },
          { name: '南方-威新备54口管线裸纤40G', location: '南方' },
        ];
        
        for (const line of dciLines) {
          const value = generateRandomValue(30, 65);
          const healthStatus = determineHealthStatus(value, warning, critical);
          const momChange = generateRandomValue(-8, 8);
          const yoyChange = generateRandomValue(-12, 12);
          const peak = generateRandomValue(value, 75);
          
          metrics.push({
            report_date: date,
            node_type: type,
            metric_category: category,
            metric_name: line.name,
            location: line.location,
            current_value: value,
            yoy_change: yoyChange,
            mom_change: momChange,
            historical_peak: peak,
            historical_peak_date: '2025-03-15',
            unit: unit,
            threshold_warning: warning,
            threshold_critical: critical,
            health_status: healthStatus,
            insight: generateInsight(type, line.name, value, healthStatus, momChange)
          });
        }
      } else {
        const relevantLocations = type.includes('快交') 
          ? ['南方快交', '上海快交']
          : type.includes('数据中心') || type.includes('DMZ')
          ? ['威新机房', '南方机房', '上海机房']
          : locations;
        
        for (const location of relevantLocations) {
          let value: number;
          if (name.includes('CPU')) {
            value = generateRandomValue(20, 65);
          } else if (name.includes('内存')) {
            value = generateRandomValue(30, 70);
          } else if (name.includes('会话数')) {
            value = generateRandomValue(20, 80);
          } else if (name.includes('吞吐量')) {
            value = generateRandomValue(30, 90);
          } else if (name.includes('包转发率')) {
            value = generateRandomValue(100, 500);
          } else {
            value = generateRandomValue(20, 70);
          }
          
          const healthStatus = determineHealthStatus(value, warning, critical);
          const momChange = generateRandomValue(-15, 15);
          const yoyChange = generateRandomValue(-20, 20);
          const peak = generateRandomValue(value, critical);
          
          metrics.push({
            report_date: date,
            node_type: type,
            metric_category: category,
            metric_name: `${location}-${name}`,
            location: location,
            current_value: value,
            yoy_change: yoyChange,
            mom_change: momChange,
            historical_peak: peak,
            historical_peak_date: '2025-03-15',
            unit: unit,
            threshold_warning: warning,
            threshold_critical: critical,
            health_status: healthStatus,
            insight: generateInsight(type, `${location}-${name}`, value, healthStatus, momChange)
          });
        }
      }
    }
  }
  
  return metrics;
}

async function insertNetworkMetrics(metrics: NetworkMetric[]): Promise<void> {
  const batchSize = 100;
  
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
  console.log('开始生成网络指标模拟数据...\n');
  
  const today = new Date();
  const dates: string[] = [];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }
  
  console.log('生成数据的日期范围:', dates.join(', '), '\n');
  
  for (const date of dates) {
    console.log(`正在生成 ${date} 的数据...`);
    const metrics = await generateNetworkMetrics(date);
    console.log(`生成了 ${metrics.length} 条指标数据`);
    
    await insertNetworkMetrics(metrics);
    console.log(`${date} 的数据插入完成\n`);
  }
  
  const { count, error } = await supabase
    .from('network_metrics')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error('查询数据总数失败:', error);
  } else {
    console.log(`\n数据生成完成！总记录数: ${count}`);
  }
}

main().catch(console.error);
