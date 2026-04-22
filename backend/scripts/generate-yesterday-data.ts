import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

const BUSINESS_SYSTEMS = {
  LOG_PLATFORM: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  PAYMENT_CENTER: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  ORDER_SYSTEM: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
};

const CLUSTERS = {
  WX_CLUSTER: '11111111-1111-1111-1111-111111111111',
  NF_CLUSTER: '22222222-2222-2222-2222-222222222222',
  PAYMENT_PRIMARY: '33333333-3333-3333-3333-333333333333',
  PAYMENT_BACKUP: '44444444-4444-4444-4444-444444444444',
  ORDER_PRIMARY: '55555555-5555-5555-5555-555555555555',
  ORDER_BACKUP: '66666666-6666-6666-6666-666666666666',
};

function getYesterday(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

function getDayBeforeYesterday(): string {
  const dayBefore = new Date();
  dayBefore.setDate(dayBefore.getDate() - 2);
  return dayBefore.toISOString().split('T')[0];
}

function randomVariation(base: number, variance: number): number {
  return Math.round(base + (Math.random() - 0.5) * 2 * variance);
}

function randomStatus(): 'normal' | 'warning' | 'critical' {
  const rand = Math.random();
  if (rand > 0.9) return 'warning';
  if (rand > 0.95) return 'critical';
  return 'normal';
}

async function insertDailyReports(yesterday: string, dayBefore: string) {
  console.log('插入日报数据...');

  const paymentStatus = randomStatus();
  const orderStatus = randomStatus();
  const logStatus = randomStatus();

  const reports = [
    {
      report_date: yesterday,
      system_status: paymentStatus,
      wx_cluster_eps_rate: randomVariation(85, 15),
      wx_cluster_eps_peak_date: yesterday,
      wx_cluster_insight: paymentStatus === 'normal' 
        ? '支付主集群运行平稳，交易处理正常，响应时间稳定。'
        : paymentStatus === 'warning'
        ? '支付主集群今日交易量较高，建议关注系统资源使用情况。'
        : '支付主集群出现性能瓶颈，已启用备集群分担流量。',
      nf_cluster_eps_rate: randomVariation(65, 10),
      nf_cluster_eps_peak_date: yesterday,
      nf_cluster_insight: '支付备集群运行正常，作为灾备节点随时可用。',
      business_system_id: BUSINESS_SYSTEMS.PAYMENT_CENTER,
    },
    {
      report_date: yesterday,
      system_status: orderStatus,
      wx_cluster_eps_rate: randomVariation(90, 15),
      wx_cluster_eps_peak_date: yesterday,
      wx_cluster_insight: orderStatus === 'normal'
        ? '订单主集群运行正常，订单处理效率稳定，无明显延迟。'
        : orderStatus === 'warning'
        ? '订单主集群今日订单量较高，数据库连接池使用率偏高。'
        : '订单主集群出现性能问题，正在排查中。',
      nf_cluster_eps_rate: randomVariation(68, 10),
      nf_cluster_eps_peak_date: yesterday,
      nf_cluster_insight: '订单备集群运行正常。',
      business_system_id: BUSINESS_SYSTEMS.ORDER_SYSTEM,
    },
    {
      report_date: yesterday,
      system_status: logStatus,
      wx_cluster_eps_rate: randomVariation(75, 10),
      wx_cluster_eps_peak_date: yesterday,
      wx_cluster_insight: '威新集群运行正常，日志采集稳定，处理效率良好。',
      nf_cluster_eps_rate: randomVariation(55, 8),
      nf_cluster_eps_peak_date: yesterday,
      nf_cluster_insight: '南方集群运行正常，备份功能正常。',
      business_system_id: BUSINESS_SYSTEMS.LOG_PLATFORM,
    },
  ];

  for (const report of reports) {
    const { error } = await supabase
      .from('daily_reports')
      .upsert(report, { onConflict: 'report_date, business_system_id' });
    if (error) {
      console.log(`  ❌ 日报 ${report.report_date} 插入失败: ${error.message}`);
    } else {
      console.log(`  ✓ 日报 ${report.report_date} 插入成功`);
    }
  }
}

async function insertLogMetrics(yesterday: string, dayBefore: string) {
  console.log('插入日志指标数据...');

  const metrics = [
    {
      cluster_id: CLUSTERS.PAYMENT_PRIMARY,
      report_date: yesterday,
      metric_name: '交易TPS',
      metric_name_en: 'Transaction TPS',
      layer: 'application',
      today_max: randomVariation(15000, 3000),
      today_avg: randomVariation(12000, 2000),
      yesterday_max: randomVariation(14500, 3000),
      yesterday_avg: randomVariation(11500, 2000),
      historical_max: 18000,
      historical_max_date: yesterday,
      sla_threshold: 20000,
      unit: 'tps',
      change_rate: randomVariation(3, 2),
      health_status: 'healthy',
    },
    {
      cluster_id: CLUSTERS.PAYMENT_PRIMARY,
      report_date: yesterday,
      metric_name: '响应时间',
      metric_name_en: 'Response Time',
      layer: 'application',
      today_max: randomVariation(25, 5),
      today_avg: randomVariation(18, 3),
      yesterday_max: randomVariation(28, 5),
      yesterday_avg: randomVariation(20, 3),
      historical_max: 35,
      historical_max_date: yesterday,
      sla_threshold: 50,
      unit: 'ms',
      change_rate: randomVariation(-10, 5),
      health_status: 'healthy',
    },
    {
      cluster_id: CLUSTERS.PAYMENT_PRIMARY,
      report_date: yesterday,
      metric_name: '成功率',
      metric_name_en: 'Success Rate',
      layer: 'application',
      today_max: 99.9,
      today_avg: 99.8,
      yesterday_max: 99.9,
      yesterday_avg: 99.7,
      historical_max: 99.9,
      historical_max_date: yesterday,
      sla_threshold: 99.5,
      unit: '%',
      change_rate: 0.1,
      health_status: 'healthy',
    },
    {
      cluster_id: CLUSTERS.PAYMENT_PRIMARY,
      report_date: yesterday,
      metric_name: 'CPU使用率',
      metric_name_en: 'CPU Usage',
      layer: 'application',
      today_max: randomVariation(55, 10),
      today_avg: randomVariation(45, 8),
      yesterday_max: randomVariation(58, 10),
      yesterday_avg: randomVariation(48, 8),
      historical_max: 75,
      historical_max_date: yesterday,
      sla_threshold: 80,
      unit: '%',
      change_rate: randomVariation(-5, 3),
      health_status: 'healthy',
    },
    {
      cluster_id: CLUSTERS.PAYMENT_PRIMARY,
      report_date: yesterday,
      metric_name: '内存使用率',
      metric_name_en: 'Memory Usage',
      layer: 'application',
      today_max: randomVariation(68, 10),
      today_avg: randomVariation(62, 8),
      yesterday_max: randomVariation(70, 10),
      yesterday_avg: randomVariation(65, 8),
      historical_max: 80,
      historical_max_date: yesterday,
      sla_threshold: 85,
      unit: '%',
      change_rate: randomVariation(-3, 2),
      health_status: 'healthy',
    },
    {
      cluster_id: CLUSTERS.PAYMENT_PRIMARY,
      report_date: yesterday,
      metric_name: '数据库连接数',
      metric_name_en: 'DB Connections',
      layer: 'storage',
      today_max: randomVariation(450, 80),
      today_avg: randomVariation(380, 60),
      yesterday_max: randomVariation(480, 80),
      yesterday_avg: randomVariation(400, 60),
      historical_max: 600,
      historical_max_date: yesterday,
      sla_threshold: 800,
      unit: '个',
      change_rate: randomVariation(-6, 3),
      health_status: 'healthy',
    },
    {
      cluster_id: CLUSTERS.PAYMENT_PRIMARY,
      report_date: yesterday,
      metric_name: '消息队列积压',
      metric_name_en: 'MQ Backlog',
      layer: 'buffer',
      today_max: randomVariation(1200, 300),
      today_avg: randomVariation(800, 200),
      yesterday_max: randomVariation(1500, 300),
      yesterday_avg: randomVariation(1000, 200),
      historical_max: 3000,
      historical_max_date: yesterday,
      sla_threshold: 5000,
      unit: '条',
      change_rate: randomVariation(-20, 10),
      health_status: 'healthy',
    },
    {
      cluster_id: CLUSTERS.ORDER_PRIMARY,
      report_date: yesterday,
      metric_name: '订单TPS',
      metric_name_en: 'Order TPS',
      layer: 'application',
      today_max: randomVariation(20000, 4000),
      today_avg: randomVariation(16000, 3000),
      yesterday_max: randomVariation(19500, 4000),
      yesterday_avg: randomVariation(15500, 3000),
      historical_max: 25000,
      historical_max_date: yesterday,
      sla_threshold: 30000,
      unit: 'tps',
      change_rate: randomVariation(2, 2),
      health_status: 'healthy',
    },
    {
      cluster_id: CLUSTERS.ORDER_PRIMARY,
      report_date: yesterday,
      metric_name: '响应时间',
      metric_name_en: 'Response Time',
      layer: 'application',
      today_max: randomVariation(35, 7),
      today_avg: randomVariation(28, 5),
      yesterday_max: randomVariation(38, 7),
      yesterday_avg: randomVariation(30, 5),
      historical_max: 45,
      historical_max_date: yesterday,
      sla_threshold: 60,
      unit: 'ms',
      change_rate: randomVariation(-8, 4),
      health_status: 'healthy',
    },
    {
      cluster_id: CLUSTERS.ORDER_PRIMARY,
      report_date: yesterday,
      metric_name: '成功率',
      metric_name_en: 'Success Rate',
      layer: 'application',
      today_max: 99.8,
      today_avg: 99.7,
      yesterday_max: 99.8,
      yesterday_avg: 99.6,
      historical_max: 99.9,
      historical_max_date: yesterday,
      sla_threshold: 99.5,
      unit: '%',
      change_rate: 0.1,
      health_status: 'healthy',
    },
    {
      cluster_id: CLUSTERS.ORDER_PRIMARY,
      report_date: yesterday,
      metric_name: 'CPU使用率',
      metric_name_en: 'CPU Usage',
      layer: 'application',
      today_max: randomVariation(52, 10),
      today_avg: randomVariation(42, 8),
      yesterday_max: randomVariation(55, 10),
      yesterday_avg: randomVariation(45, 8),
      historical_max: 70,
      historical_max_date: yesterday,
      sla_threshold: 80,
      unit: '%',
      change_rate: randomVariation(-5, 3),
      health_status: 'healthy',
    },
    {
      cluster_id: CLUSTERS.ORDER_PRIMARY,
      report_date: yesterday,
      metric_name: '内存使用率',
      metric_name_en: 'Memory Usage',
      layer: 'application',
      today_max: randomVariation(65, 10),
      today_avg: randomVariation(58, 8),
      yesterday_max: randomVariation(68, 10),
      yesterday_avg: randomVariation(62, 8),
      historical_max: 75,
      historical_max_date: yesterday,
      sla_threshold: 85,
      unit: '%',
      change_rate: randomVariation(-4, 2),
      health_status: 'healthy',
    },
    {
      cluster_id: CLUSTERS.ORDER_PRIMARY,
      report_date: yesterday,
      metric_name: '数据库连接数',
      metric_name_en: 'DB Connections',
      layer: 'storage',
      today_max: randomVariation(550, 100),
      today_avg: randomVariation(480, 80),
      yesterday_max: randomVariation(580, 100),
      yesterday_avg: randomVariation(510, 80),
      historical_max: 700,
      historical_max_date: yesterday,
      sla_threshold: 1000,
      unit: '个',
      change_rate: randomVariation(-5, 3),
      health_status: 'healthy',
    },
    {
      cluster_id: CLUSTERS.ORDER_PRIMARY,
      report_date: yesterday,
      metric_name: '缓存命中率',
      metric_name_en: 'Cache Hit Rate',
      layer: 'buffer',
      today_max: randomVariation(95, 3),
      today_avg: randomVariation(92, 2),
      yesterday_max: randomVariation(94, 3),
      yesterday_avg: randomVariation(90, 2),
      historical_max: 98,
      historical_max_date: yesterday,
      sla_threshold: 85,
      unit: '%',
      change_rate: randomVariation(1, 1),
      health_status: 'healthy',
    },
  ];

  const { error } = await supabase.from('log_metrics').insert(metrics);
  if (error) {
    console.log(`  ❌ 日志指标插入失败: ${error.message}`);
  } else {
    console.log(`  ✓ 插入 ${metrics.length} 条日志指标`);
  }
}

async function insertCloudRegions(yesterday: string) {
  console.log('插入云区域数据...');

  const regions = [
    {
      cluster_id: CLUSTERS.PAYMENT_PRIMARY,
      report_date: yesterday,
      name: '华东支付区',
      node_count: 150,
      current_traffic: randomVariation(28, 5),
      peak_traffic: randomVariation(38, 6),
      region_type: 'domestic',
    },
    {
      cluster_id: CLUSTERS.PAYMENT_PRIMARY,
      report_date: yesterday,
      name: '华南支付区',
      node_count: 100,
      current_traffic: randomVariation(20, 4),
      peak_traffic: randomVariation(28, 5),
      region_type: 'domestic',
    },
    {
      cluster_id: CLUSTERS.PAYMENT_PRIMARY,
      report_date: yesterday,
      name: '华北支付区',
      node_count: 80,
      current_traffic: randomVariation(16, 3),
      peak_traffic: randomVariation(24, 4),
      region_type: 'domestic',
    },
    {
      cluster_id: CLUSTERS.PAYMENT_BACKUP,
      report_date: yesterday,
      name: '西南支付区',
      node_count: 60,
      current_traffic: randomVariation(12, 2),
      peak_traffic: randomVariation(18, 3),
      region_type: 'domestic',
    },
    {
      cluster_id: CLUSTERS.PAYMENT_BACKUP,
      report_date: yesterday,
      name: '海外支付区',
      node_count: 35,
      current_traffic: randomVariation(8, 2),
      peak_traffic: randomVariation(12, 2),
      region_type: 'overseas',
    },
    {
      cluster_id: CLUSTERS.ORDER_PRIMARY,
      report_date: yesterday,
      name: '华东订单区',
      node_count: 180,
      current_traffic: randomVariation(32, 6),
      peak_traffic: randomVariation(45, 8),
      region_type: 'domestic',
    },
    {
      cluster_id: CLUSTERS.ORDER_PRIMARY,
      report_date: yesterday,
      name: '华南订单区',
      node_count: 120,
      current_traffic: randomVariation(24, 5),
      peak_traffic: randomVariation(34, 6),
      region_type: 'domestic',
    },
    {
      cluster_id: CLUSTERS.ORDER_PRIMARY,
      report_date: yesterday,
      name: '华北订单区',
      node_count: 90,
      current_traffic: randomVariation(18, 3),
      peak_traffic: randomVariation(28, 5),
      region_type: 'domestic',
    },
    {
      cluster_id: CLUSTERS.ORDER_BACKUP,
      report_date: yesterday,
      name: '西南订单区',
      node_count: 70,
      current_traffic: randomVariation(14, 3),
      peak_traffic: randomVariation(22, 4),
      region_type: 'domestic',
    },
    {
      cluster_id: CLUSTERS.ORDER_BACKUP,
      report_date: yesterday,
      name: '海外订单区',
      node_count: 40,
      current_traffic: randomVariation(10, 2),
      peak_traffic: randomVariation(16, 3),
      region_type: 'overseas',
    },
  ];

  const { error } = await supabase.from('cloud_regions').insert(regions);
  if (error) {
    console.log(`  ❌ 云区域数据插入失败: ${error.message}`);
  } else {
    console.log(`  ✓ 插入 ${regions.length} 个云区域`);
  }
}

async function insertAssessments(yesterday: string) {
  console.log('插入评估数据...');

  const assessments = [
    {
      report_id: `${BUSINESS_SYSTEMS.PAYMENT_CENTER}-${yesterday}`,
      category: '性能',
      item: '交易响应时间',
      status: randomStatus(),
      detail: '响应时间稳定在 18ms 左右，符合 SLA 要求',
      impact: '低',
      recommendation: '继续保持监控',
    },
    {
      report_id: `${BUSINESS_SYSTEMS.PAYMENT_CENTER}-${yesterday}`,
      category: '容量',
      item: 'CPU 使用率',
      status: randomStatus(),
      detail: 'CPU 使用率平均 45%，峰值 55%，资源充足',
      impact: '低',
      recommendation: '当前容量满足业务需求',
    },
    {
      report_id: `${BUSINESS_SYSTEMS.ORDER_SYSTEM}-${yesterday}`,
      category: '性能',
      item: '订单处理延迟',
      status: randomStatus(),
      detail: '订单处理延迟稳定，平均 28ms',
      impact: '低',
      recommendation: '继续保持监控',
    },
    {
      report_id: `${BUSINESS_SYSTEMS.ORDER_SYSTEM}-${yesterday}`,
      category: '可靠性',
      item: '数据库连接池',
      status: randomStatus(),
      detail: '连接池使用率正常，平均 480 个连接',
      impact: '低',
      recommendation: '当前配置合理',
    },
  ];

  const { error } = await supabase.from('assessments').insert(assessments);
  if (error) {
    console.log(`  ❌ 评估数据插入失败: ${error.message}`);
  } else {
    console.log(`  ✓ 插入 ${assessments.length} 条评估`);
  }
}

async function insertActionPlans(yesterday: string) {
  console.log('插入行动计划数据...');

  const actionPlans = [
    {
      report_id: `${BUSINESS_SYSTEMS.PAYMENT_CENTER}-${yesterday}`,
      priority: '高',
      action: '优化数据库查询性能',
      owner: '数据库团队',
      due_date: yesterday,
      status: '进行中',
      progress: 60,
    },
    {
      report_id: `${BUSINESS_SYSTEMS.PAYMENT_CENTER}-${yesterday}`,
      priority: '中',
      action: '扩容消息队列',
      owner: '中间件团队',
      due_date: yesterday,
      status: '待开始',
      progress: 0,
    },
    {
      report_id: `${BUSINESS_SYSTEMS.ORDER_SYSTEM}-${yesterday}`,
      priority: '高',
      action: '优化缓存策略',
      owner: '缓存团队',
      due_date: yesterday,
      status: '已完成',
      progress: 100,
    },
  ];

  const { error } = await supabase.from('action_plans').insert(actionPlans);
  if (error) {
    console.log(`  ❌ 行动计划插入失败: ${error.message}`);
  } else {
    console.log(`  ✓ 插入 ${actionPlans.length} 条行动计划`);
  }
}

async function main() {
  const yesterday = getYesterday();
  const dayBefore = getDayBeforeYesterday();
  
  console.log(`生成昨日数据: ${yesterday}\n`);
  
  await insertDailyReports(yesterday, dayBefore);
  await insertLogMetrics(yesterday, dayBefore);
  await insertCloudRegions(yesterday);
  await insertAssessments(yesterday);
  await insertActionPlans(yesterday);
  
  console.log('\n✅ 昨日数据生成完成！');
}

main().catch(console.error);
