-- 网络指标数据表
-- 用于存储网络团队每日性能分析的所有网络相关指标数据

-- 先删除已存在的表
DROP TABLE IF EXISTS network_metrics CASCADE;

-- ============================================
-- 网络指标表
-- ============================================
CREATE TABLE network_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  node_type TEXT NOT NULL,
  metric_category TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  location TEXT,
  carrier TEXT,
  current_value REAL,
  yoy_change REAL,
  mom_change REAL,
  historical_peak REAL,
  historical_peak_date TEXT,
  unit TEXT NOT NULL,
  threshold_warning REAL,
  threshold_critical REAL,
  health_status TEXT NOT NULL CHECK (health_status IN ('healthy', 'warning', 'critical')),
  insight TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(report_date, node_type, metric_name)
);

-- ============================================
-- 创建索引
-- ============================================
CREATE INDEX idx_network_metrics_report_date ON network_metrics(report_date);
CREATE INDEX idx_network_metrics_node_type ON network_metrics(node_type);
CREATE INDEX idx_network_metrics_metric_category ON network_metrics(metric_category);
CREATE INDEX idx_network_metrics_location ON network_metrics(location);
CREATE INDEX idx_network_metrics_health_status ON network_metrics(health_status);

-- ============================================
-- 添加注释
-- ============================================
COMMENT ON TABLE network_metrics IS '网络指标数据表 - 存储网络团队每日性能分析的所有网络相关指标';
COMMENT ON COLUMN network_metrics.report_date IS '报告日期';
COMMENT ON COLUMN network_metrics.node_type IS '节点类型（如：交易互联网线路、报盘线路、行情线路等）';
COMMENT ON COLUMN network_metrics.metric_category IS '指标类别（如：资源使用率、请求量）';
COMMENT ON COLUMN network_metrics.metric_name IS '指标名称（如：威新机房-带宽使用率（电信））';
COMMENT ON COLUMN network_metrics.location IS '机房位置（如：威新、南方、上海、北京）';
COMMENT ON COLUMN network_metrics.carrier IS '运营商（如：电信、联通、移动）';
COMMENT ON COLUMN network_metrics.current_value IS '当前值';
COMMENT ON COLUMN network_metrics.yoy_change IS '同比变化（百分比）';
COMMENT ON COLUMN network_metrics.mom_change IS '环比变化（百分比）';
COMMENT ON COLUMN network_metrics.historical_peak IS '历史峰值';
COMMENT ON COLUMN network_metrics.historical_peak_date IS '历史峰值日期';
COMMENT ON COLUMN network_metrics.unit IS '单位（如：%、万、Gb、万p/s）';
COMMENT ON COLUMN network_metrics.threshold_warning IS '告警阈值';
COMMENT ON COLUMN network_metrics.threshold_critical IS '严重阈值';
COMMENT ON COLUMN network_metrics.health_status IS '健康状态（healthy/warning/critical）';
COMMENT ON COLUMN network_metrics.insight IS '分析洞察';

-- ============================================
-- 启用 RLS (Row Level Security)
-- ============================================
ALTER TABLE network_metrics ENABLE ROW LEVEL SECURITY;

-- 允许所有用户读取数据
CREATE POLICY "Allow read access for all users" ON network_metrics
  FOR SELECT
  USING (true);

-- 允许服务端写入数据
CREATE POLICY "Allow write access for service role" ON network_metrics
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

SELECT 'Network metrics table created successfully!' as message;
