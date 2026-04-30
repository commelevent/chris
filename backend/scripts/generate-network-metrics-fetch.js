const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim();
  }
});

const SUPABASE_URL = envVars.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

const excelMetrics = [
  { node_type: '交易互联网线路', metric_category: '资源使用率', metric_name: '威新机房-带宽使用率（电信）', unit: '%' },
  { node_type: '交易互联网线路', metric_category: '资源使用率', metric_name: '威新机房-带宽使用率（联通）', unit: '%' },
  { node_type: '交易互联网线路', metric_category: '资源使用率', metric_name: '威新机房-带宽使用率（移动）', unit: '%' },
  { node_type: '交易互联网线路', metric_category: '资源使用率', metric_name: '南方机房-带宽使用率（电信）', unit: '%' },
  { node_type: '交易互联网线路', metric_category: '资源使用率', metric_name: '南方机房-带宽使用率（联通）', unit: '%' },
  { node_type: '交易互联网线路', metric_category: '资源使用率', metric_name: '南方机房-带宽使用率（移动）', unit: '%' },
  { node_type: '交易互联网线路', metric_category: '资源使用率', metric_name: '上海机房-带宽使用率（电信）', unit: '%' },
  { node_type: '交易互联网线路', metric_category: '资源使用率', metric_name: '上海机房-带宽使用率（联通）', unit: '%' },
  { node_type: '交易互联网线路', metric_category: '资源使用率', metric_name: '上海机房-带宽使用率（移动）', unit: '%' },
  { node_type: '交易互联网线路', metric_category: '资源使用率', metric_name: '北京机房-带宽使用率（电信）', unit: '%' },
  { node_type: '交易互联网线路', metric_category: '资源使用率', metric_name: '北京机房-带宽使用率（联通）', unit: '%' },
  { node_type: '交易互联网线路', metric_category: '资源使用率', metric_name: '北京机房-带宽使用率（移动）', unit: '%' },
  { node_type: '报盘线路', metric_category: '资源使用率', metric_name: '威新-上交所电信报盘线路利用率', unit: '%' },
  { node_type: '报盘线路', metric_category: '资源使用率', metric_name: '威新-上交所联通报盘线路利用率', unit: '%' },
  { node_type: '报盘线路', metric_category: '资源使用率', metric_name: '威新-深交所电信报盘线路利用率', unit: '%' },
  { node_type: '报盘线路', metric_category: '资源使用率', metric_name: '威新-深交所联通报盘线路利用率', unit: '%' },
  { node_type: '行情线路', metric_category: '资源使用率', metric_name: '威新-上交所电信报盘行情利用率', unit: '%' },
  { node_type: '行情线路', metric_category: '资源使用率', metric_name: '威新-上交所联通报盘行情利用率', unit: '%' },
  { node_type: '行情线路', metric_category: '资源使用率', metric_name: '威新-深交所电信报盘行情利用率', unit: '%' },
  { node_type: '行情线路', metric_category: '资源使用率', metric_name: '威新-深交所联通报盘行情利用率', unit: '%' },
  { node_type: '机房互联线路', metric_category: '资源使用率', metric_name: '威新-北京机房电信互联线路利用率', unit: '%' },
  { node_type: '机房互联线路', metric_category: '资源使用率', metric_name: '威新-上海灾备联通互联线路利用率', unit: '%' },
  { node_type: '机房互联线路', metric_category: '资源使用率', metric_name: '东莞-北京机房联通互联线路利用率', unit: '%' },
  { node_type: '机房互联线路', metric_category: '资源使用率', metric_name: '东莞-上海灾备电信互联线路利用率', unit: '%' },
  { node_type: '快速交易机房互联网线路', metric_category: '资源使用率', metric_name: '南方快交电信互联网线路', unit: '%' },
  { node_type: '快速交易机房互联网线路', metric_category: '资源使用率', metric_name: '南方快交联通互联网线路', unit: '%' },
  { node_type: '快速交易机房互联网线路', metric_category: '资源使用率', metric_name: '上海快交电信互联网线路', unit: '%' },
  { node_type: '快速交易机房互联网线路', metric_category: '资源使用率', metric_name: '上海快交联通互联网线路', unit: '%' },
  { node_type: 'DCI线路', metric_category: '资源使用率', metric_name: '南方-威新主53口联通裸纤40G', unit: '%' },
  { node_type: 'DCI线路', metric_category: '资源使用率', metric_name: '南方-威新主54口联通裸纤40G', unit: '%' },
  { node_type: 'DCI线路', metric_category: '资源使用率', metric_name: '南方-威新备54口管线裸纤40G', unit: '%' },
  { node_type: '互联网负载均衡', metric_category: '资源使用率', metric_name: '威新机房-cpu利用率', unit: '%' },
  { node_type: '互联网负载均衡', metric_category: '资源使用率', metric_name: '威新机房-内存利用率', unit: '%' },
  { node_type: '互联网负载均衡', metric_category: '请求量', metric_name: '威新机房-会话数', unit: '万' },
  { node_type: '互联网负载均衡', metric_category: '请求量', metric_name: '威新机房-新建会话数', unit: '万' },
  { node_type: '互联网负载均衡', metric_category: '请求量', metric_name: '威新机房-吞吐量', unit: 'Gb' },
  { node_type: '互联网负载均衡', metric_category: '资源使用率', metric_name: '南方机房-cpu利用率', unit: '%' },
  { node_type: '互联网负载均衡', metric_category: '资源使用率', metric_name: '南方机房-内存利用率', unit: '%' },
  { node_type: '互联网负载均衡', metric_category: '请求量', metric_name: '南方机房-会话数', unit: '万' },
  { node_type: '互联网负载均衡', metric_category: '请求量', metric_name: '南方机房-新建会话数', unit: '万' },
  { node_type: '互联网负载均衡', metric_category: '请求量', metric_name: '南方机房-吞吐量', unit: 'Gb' },
  { node_type: '互联网负载均衡', metric_category: '资源使用率', metric_name: '上海机房-cpu利用率', unit: '%' },
  { node_type: '互联网负载均衡', metric_category: '资源使用率', metric_name: '上海机房-内存利用率', unit: '%' },
  { node_type: '互联网负载均衡', metric_category: '请求量', metric_name: '上海机房-会话数', unit: '万' },
  { node_type: '互联网负载均衡', metric_category: '请求量', metric_name: '上海机房-新建会话数', unit: '万' },
  { node_type: '互联网负载均衡', metric_category: '请求量', metric_name: '上海机房-吞吐量', unit: 'Gb' },
  { node_type: '互联网负载均衡', metric_category: '资源使用率', metric_name: '北京机房-cpu利用率', unit: '%' },
  { node_type: '互联网负载均衡', metric_category: '资源使用率', metric_name: '北京机房-内存利用率', unit: '%' },
  { node_type: '互联网负载均衡', metric_category: '请求量', metric_name: '北京机房-会话数', unit: '万' },
  { node_type: '互联网负载均衡', metric_category: '请求量', metric_name: '北京机房-新建会话数', unit: '万' },
  { node_type: '互联网负载均衡', metric_category: '请求量', metric_name: '北京机房-吞吐量', unit: 'Gb' },
  { node_type: '互联网防火墙', metric_category: '资源使用率', metric_name: '威新机房-cpu利用率', unit: '%' },
  { node_type: '互联网防火墙', metric_category: '资源使用率', metric_name: '威新机房-内存利用率', unit: '%' },
  { node_type: '互联网防火墙', metric_category: '请求量', metric_name: '威新机房-会话数', unit: '万' },
  { node_type: '互联网防火墙', metric_category: '请求量', metric_name: '威新机房-新建会话数', unit: '万' },
  { node_type: '互联网防火墙', metric_category: '请求量', metric_name: '威新机房-吞吐量', unit: 'Gb' },
  { node_type: '互联网防火墙', metric_category: '资源使用率', metric_name: '南方机房-cpu利用率', unit: '%' },
  { node_type: '互联网防火墙', metric_category: '资源使用率', metric_name: '南方机房-内存利用率', unit: '%' },
  { node_type: '互联网防火墙', metric_category: '请求量', metric_name: '南方机房-会话数', unit: '万' },
  { node_type: '互联网防火墙', metric_category: '请求量', metric_name: '南方机房-新建会话数', unit: '万' },
  { node_type: '互联网防火墙', metric_category: '请求量', metric_name: '南方机房-吞吐量', unit: 'Gb' },
  { node_type: '互联网防火墙', metric_category: '资源使用率', metric_name: '上海机房-cpu利用率', unit: '%' },
  { node_type: '互联网防火墙', metric_category: '资源使用率', metric_name: '上海机房-内存利用率', unit: '%' },
  { node_type: '互联网防火墙', metric_category: '请求量', metric_name: '上海机房-会话数', unit: '万' },
  { node_type: '互联网防火墙', metric_category: '请求量', metric_name: '上海机房-新建会话数', unit: '万' },
  { node_type: '互联网防火墙', metric_category: '请求量', metric_name: '上海机房-吞吐量', unit: 'Gb' },
  { node_type: '互联网防火墙', metric_category: '资源使用率', metric_name: '北京机房-cpu利用率', unit: '%' },
  { node_type: '互联网防火墙', metric_category: '资源使用率', metric_name: '北京机房-内存利用率', unit: '%' },
  { node_type: '互联网防火墙', metric_category: '请求量', metric_name: '北京机房-会话数', unit: '万' },
  { node_type: '互联网防火墙', metric_category: '请求量', metric_name: '北京机房-新建会话数', unit: '万' },
  { node_type: '互联网防火墙', metric_category: '请求量', metric_name: '北京机房-吞吐量', unit: 'Gb' },
  { node_type: '互联网防火墙', metric_category: '资源使用率', metric_name: '南方快交-cpu利用率', unit: '%' },
  { node_type: '互联网防火墙', metric_category: '资源使用率', metric_name: '南方快交-内存利用率', unit: '%' },
  { node_type: '互联网防火墙', metric_category: '请求量', metric_name: '南方快交-会话数', unit: '万' },
  { node_type: '互联网防火墙', metric_category: '请求量', metric_name: '南方快交-新建会话数', unit: '万' },
  { node_type: '互联网防火墙', metric_category: '请求量', metric_name: '南方快交-吞吐量', unit: 'Gb' },
  { node_type: '互联网防火墙', metric_category: '资源使用率', metric_name: '上海快交-cpu利用率', unit: '%' },
  { node_type: '互联网防火墙', metric_category: '资源使用率', metric_name: '上海快交-内存利用率', unit: '%' },
  { node_type: '互联网防火墙', metric_category: '请求量', metric_name: '上海快交-会话数', unit: '万' },
  { node_type: '互联网防火墙', metric_category: '请求量', metric_name: '上海快交-新建会话数', unit: '万' },
  { node_type: '互联网防火墙', metric_category: '请求量', metric_name: '上海快交-吞吐量', unit: 'Gb' },
  { node_type: 'DMZ防火墙', metric_category: '资源使用率', metric_name: '威新机房-cpu利用率', unit: '%' },
  { node_type: 'DMZ防火墙', metric_category: '资源使用率', metric_name: '威新机房-内存利用率', unit: '%' },
  { node_type: 'DMZ防火墙', metric_category: '请求量', metric_name: '威新机房-会话数', unit: '万' },
  { node_type: 'DMZ防火墙', metric_category: '请求量', metric_name: '威新机房-新建会话数', unit: '万' },
  { node_type: 'DMZ防火墙', metric_category: '请求量', metric_name: '威新机房-吞吐量', unit: 'Gb' },
  { node_type: 'DMZ防火墙', metric_category: '资源使用率', metric_name: '南方机房-cpu利用率', unit: '%' },
  { node_type: 'DMZ防火墙', metric_category: '资源使用率', metric_name: '南方机房-内存利用率', unit: '%' },
  { node_type: 'DMZ防火墙', metric_category: '请求量', metric_name: '南方机房-会话数', unit: '万' },
  { node_type: 'DMZ防火墙', metric_category: '请求量', metric_name: '南方机房-新建会话数', unit: '万' },
  { node_type: 'DMZ防火墙', metric_category: '请求量', metric_name: '南方机房-吞吐量', unit: 'Gb' },
  { node_type: 'DMZ防火墙', metric_category: '资源使用率', metric_name: '上海机房-cpu利用率', unit: '%' },
  { node_type: 'DMZ防火墙', metric_category: '资源使用率', metric_name: '上海机房-内存利用率', unit: '%' },
  { node_type: 'DMZ防火墙', metric_category: '请求量', metric_name: '上海机房-会话数', unit: '万' },
  { node_type: 'DMZ防火墙', metric_category: '请求量', metric_name: '上海机房-新建会话数', unit: '万' },
  { node_type: 'DMZ防火墙', metric_category: '请求量', metric_name: '上海机房-吞吐量', unit: 'Gb' },
  { node_type: '交易内网防火墙', metric_category: '资源使用率', metric_name: '威新机房-cpu利用率', unit: '%' },
  { node_type: '交易内网防火墙', metric_category: '资源使用率', metric_name: '威新机房-内存利用率', unit: '%' },
  { node_type: '交易内网防火墙', metric_category: '请求量', metric_name: '威新机房-会话数', unit: '万' },
  { node_type: '交易内网防火墙', metric_category: '请求量', metric_name: '威新机房-新建会话数', unit: '万' },
  { node_type: '交易内网防火墙', metric_category: '请求量', metric_name: '威新机房-吞吐量', unit: 'Gb' },
  { node_type: '交易内网防火墙', metric_category: '资源使用率', metric_name: '南方机房-cpu利用率', unit: '%' },
  { node_type: '交易内网防火墙', metric_category: '资源使用率', metric_name: '南方机房-内存利用率', unit: '%' },
  { node_type: '交易内网防火墙', metric_category: '请求量', metric_name: '南方机房-会话数', unit: '万' },
  { node_type: '交易内网防火墙', metric_category: '请求量', metric_name: '南方机房-新建会话数', unit: '万' },
  { node_type: '交易内网防火墙', metric_category: '请求量', metric_name: '南方机房-吞吐量', unit: 'Gb' },
  { node_type: '交易内网防火墙', metric_category: '资源使用率', metric_name: '上海机房-cpu利用率', unit: '%' },
  { node_type: '交易内网防火墙', metric_category: '资源使用率', metric_name: '上海机房-内存利用率', unit: '%' },
  { node_type: '交易内网防火墙', metric_category: '请求量', metric_name: '上海机房-会话数', unit: '万' },
  { node_type: '交易内网防火墙', metric_category: '请求量', metric_name: '上海机房-新建会话数', unit: '万' },
  { node_type: '交易内网防火墙', metric_category: '请求量', metric_name: '上海机房-吞吐量', unit: 'Gb' },
  { node_type: '交易内网汇聚交换机', metric_category: '资源使用率', metric_name: '威新机房-cpu利用率', unit: '%' },
  { node_type: '交易内网汇聚交换机', metric_category: '资源使用率', metric_name: '威新机房-内存利用率', unit: '%' },
  { node_type: '交易内网汇聚交换机', metric_category: '请求量', metric_name: '威新机房-包转发率', unit: '万p/s' },
  { node_type: '交易内网汇聚交换机', metric_category: '请求量', metric_name: '威新机房-吞吐量', unit: 'Gb' },
  { node_type: '交易内网汇聚交换机', metric_category: '资源使用率', metric_name: '南方机房-cpu利用率', unit: '%' },
  { node_type: '交易内网汇聚交换机', metric_category: '资源使用率', metric_name: '南方机房-内存利用率', unit: '%' },
  { node_type: '交易内网汇聚交换机', metric_category: '请求量', metric_name: '南方机房-包转发率', unit: '万p/s' },
  { node_type: '交易内网汇聚交换机', metric_category: '请求量', metric_name: '南方机房-吞吐量', unit: 'Gb' },
  { node_type: '交易内网汇聚交换机', metric_category: '资源使用率', metric_name: '上海机房-cpu利用率', unit: '%' },
  { node_type: '交易内网汇聚交换机', metric_category: '资源使用率', metric_name: '上海机房-内存利用率', unit: '%' },
  { node_type: '交易内网汇聚交换机', metric_category: '请求量', metric_name: '上海机房-包转发率', unit: '万p/s' },
  { node_type: '交易内网汇聚交换机', metric_category: '请求量', metric_name: '上海机房-吞吐量', unit: 'Gb' },
  { node_type: '交易内网汇聚交换机', metric_category: '资源使用率', metric_name: '南方快交-cpu利用率', unit: '%' },
  { node_type: '交易内网汇聚交换机', metric_category: '资源使用率', metric_name: '南方快交-内存利用率', unit: '%' },
  { node_type: '交易内网汇聚交换机', metric_category: '请求量', metric_name: '南方快交-包转发率', unit: '万p/s' },
  { node_type: '交易内网汇聚交换机', metric_category: '请求量', metric_name: '南方快交-吞吐量', unit: 'Gb' },
  { node_type: '交易内网汇聚交换机', metric_category: '资源使用率', metric_name: '上海快交-cpu利用率', unit: '%' },
  { node_type: '交易内网汇聚交换机', metric_category: '资源使用率', metric_name: '上海快交-内存利用率', unit: '%' },
  { node_type: '交易内网汇聚交换机', metric_category: '请求量', metric_name: '上海快交-包转发率', unit: '万p/s' },
  { node_type: '交易内网汇聚交换机', metric_category: '请求量', metric_name: '上海快交-吞吐量', unit: 'Gb' },
  { node_type: 'DMZ汇聚交换机', metric_category: '资源使用率', metric_name: '威新机房-cpu利用率', unit: '%' },
  { node_type: 'DMZ汇聚交换机', metric_category: '资源使用率', metric_name: '威新机房-内存利用率', unit: '%' },
  { node_type: 'DMZ汇聚交换机', metric_category: '请求量', metric_name: '威新机房-包转发率', unit: '万p/s' },
  { node_type: 'DMZ汇聚交换机', metric_category: '请求量', metric_name: '威新机房-吞吐量', unit: 'Gb' },
  { node_type: 'DMZ汇聚交换机', metric_category: '资源使用率', metric_name: '南方机房-cpu利用率', unit: '%' },
  { node_type: 'DMZ汇聚交换机', metric_category: '资源使用率', metric_name: '南方机房-内存利用率', unit: '%' },
  { node_type: 'DMZ汇聚交换机', metric_category: '请求量', metric_name: '南方机房-包转发率', unit: '万p/s' },
  { node_type: 'DMZ汇聚交换机', metric_category: '请求量', metric_name: '南方机房-吞吐量', unit: 'Gb' },
  { node_type: 'DMZ汇聚交换机', metric_category: '资源使用率', metric_name: '上海机房-cpu利用率', unit: '%' },
  { node_type: 'DMZ汇聚交换机', metric_category: '资源使用率', metric_name: '上海机房-内存利用率', unit: '%' },
  { node_type: 'DMZ汇聚交换机', metric_category: '请求量', metric_name: '上海机房-包转发率', unit: '万p/s' },
  { node_type: 'DMZ汇聚交换机', metric_category: '请求量', metric_name: '上海机房-吞吐量', unit: 'Gb' },
  { node_type: '数据中心核心交换机', metric_category: '资源使用率', metric_name: '威新机房-cpu利用率', unit: '%' },
  { node_type: '数据中心核心交换机', metric_category: '资源使用率', metric_name: '威新机房-内存利用率', unit: '%' },
  { node_type: '数据中心核心交换机', metric_category: '请求量', metric_name: '威新机房-包转发率', unit: '万p/s' },
  { node_type: '数据中心核心交换机', metric_category: '请求量', metric_name: '威新机房-吞吐量', unit: 'Gb' },
  { node_type: '数据中心核心交换机', metric_category: '资源使用率', metric_name: '南方机房-cpu利用率', unit: '%' },
  { node_type: '数据中心核心交换机', metric_category: '资源使用率', metric_name: '南方机房-内存利用率', unit: '%' },
  { node_type: '数据中心核心交换机', metric_category: '请求量', metric_name: '南方机房-包转发率', unit: '万p/s' },
  { node_type: '数据中心核心交换机', metric_category: '请求量', metric_name: '南方机房-吞吐量', unit: 'Gb' },
  { node_type: '数据中心核心交换机', metric_category: '资源使用率', metric_name: '上海机房-cpu利用率', unit: '%' },
  { node_type: '数据中心核心交换机', metric_category: '资源使用率', metric_name: '上海机房-内存利用率', unit: '%' },
  { node_type: '数据中心核心交换机', metric_category: '请求量', metric_name: '上海机房-包转发率', unit: '万p/s' },
  { node_type: '数据中心核心交换机', metric_category: '请求量', metric_name: '上海机房-吞吐量', unit: 'Gb' },
];

function extractLocationAndCarrier(metricName) {
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

  let location = null;
  let carrier = null;

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

function determineThresholds(metricName, unit) {
  if (metricName.includes('cpu') || metricName.includes('CPU')) {
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

function generateRandomValue(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function determineHealthStatus(value, warning, critical) {
  if (value >= critical) return 'critical';
  if (value >= warning) return 'warning';
  return 'healthy';
}

function generateInsight(nodeType, metricName, value, healthStatus, momChange) {
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

function generateValueForMetric(metricName, unit) {
  if (metricName.includes('cpu') || metricName.includes('CPU')) {
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

function generateNetworkMetrics(date) {
  const metrics = [];
  
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

async function insertNetworkMetrics(metrics) {
  const batchSize = 50;
  
  for (let i = 0; i < metrics.length; i += batchSize) {
    const batch = metrics.slice(i, i + batchSize);
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/network_metrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(batch)
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`插入数据失败 (批次 ${Math.floor(i / batchSize) + 1}):`, error);
    } else {
      console.log(`成功插入批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(metrics.length / batchSize)}`);
    }
  }
}

async function main() {
  console.log('开始从 Excel 数据生成网络指标模拟数据...\n');
  console.log(`共有 ${excelMetrics.length} 条指标数据\n`);
  
  const today = new Date();
  const date = today.toISOString().split('T')[0];
  
  console.log(`正在生成 ${date} 的数据...`);
  const metrics = generateNetworkMetrics(date);
  console.log(`生成了 ${metrics.length} 条指标数据\n`);
  
  await insertNetworkMetrics(metrics);
  console.log('\n数据插入完成\n');
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/network_metrics?select=count`, {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Prefer': 'count=exact'
    }
  });
  
  const count = response.headers.get('content-range');
  console.log(`数据生成完成！总记录数: ${count ? count.split('/')[1] : '未知'}`);
}

main().catch(console.error);
