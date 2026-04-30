import React, { useState, useMemo } from 'react';
import { Card, Button, Spin, Empty, Tooltip } from 'antd';
import { LineChartOutlined, DeleteOutlined } from '@ant-design/icons';
import { LogMetric, Cluster, GrafanaPanelDatasource } from '@/types';
import { usePanelData, PANEL_DATASOURCES, PanelDatasource } from '@/hooks/usePanelData';
import styles from './ClusterMetricsPanel.module.scss';

interface Props {
  date: string;
  systemId: string;
  datasource?: GrafanaPanelDatasource;
  isConfigMode?: boolean;
  deletedTabs?: Set<string>;
  onDeleteTab?: (tabId: string) => void;
  isDeaggregated?: boolean;
}

interface ClusterMetricsData {
  wxCluster: Cluster | null;
  nfCluster: Cluster | null;
  wxMetrics: LogMetric[];
  nfMetrics: LogMetric[];
}

interface NetworkMetric {
  id: string;
  report_date: string;
  node_type: string;
  metric_type: string;
  metric_category: string;
  metric_name: string;
  current_value: number;
  unit: string;
  yoy_change: number;
  mom_change: number;
  historical_peak: number;
  threshold_warning: number | null;
  threshold_critical: number | null;
  carrier: string | null;
  insight: string | null;
  created_at: string;
}

const layerConfig: Record<string, { name: string; nameEn: string; color: string }> = {
  access: { name: '接入层', nameEn: 'ACCESS', color: '#4361ee' },
  buffer: { name: '缓冲层', nameEn: 'BUFFER', color: '#a061ff' },
  storage: { name: '存储层', nameEn: 'STORAGE', color: '#00b4d8' },
  application: { name: '应用层', nameEn: 'APPLICATION', color: '#ffb002' },
  资源使用率: { name: '资源使用率', nameEn: 'RESOURCE', color: '#4361ee' },
  请求量: { name: '请求量', nameEn: 'REQUEST', color: '#00b4d8' },
};

const metricOrder = [
  'Collector EPS',
  'Kafka写入流量',
  '磁盘使用率',
  '平均搜索耗时',
  'CPU使用率',
  '日志入库耗时',
  '监控延迟',
];

const TAB_CONFIG = [
  { id: 'wx', label: '威新中心' },
  { id: 'nf', label: '南方中心' },
];

const ClusterMetricsPanel: React.FC<Props> = ({ 
  date, 
  systemId, 
  datasource,
  isConfigMode = false,
  deletedTabs = new Set(),
  onDeleteTab,
  isDeaggregated = false,
}) => {
  const isNetworkMetricsDatasource = datasource?.endpoint?.includes('/api/network-metrics');
  
  const effectiveDatasource: PanelDatasource | null = useMemo(() => {
    if (datasource) {
      return {
        type: datasource.type || 'api',
        endpoint: datasource.endpoint || '/api/panel/cluster-metrics',
        method: datasource.method || 'GET',
        params: { date, ...datasource.params },
      };
    }
    return {
      ...PANEL_DATASOURCES.clusterMetrics,
      params: { date, systemId },
    };
  }, [
    datasource?.type,
    datasource?.endpoint,
    datasource?.method,
    datasource?.params,
    date,
    systemId,
  ]);

  const { data: rawData, loading, error } = usePanelData<any>(
    effectiveDatasource,
    isNetworkMetricsDatasource ? { date } : { date, systemId }
  );

  const networkMetrics = useMemo(() => {
    if (!isNetworkMetricsDatasource || !Array.isArray(rawData)) return null;
    return rawData as NetworkMetric[];
  }, [isNetworkMetricsDatasource, rawData]);

  const clusterMetricsData = useMemo(() => {
    if (isNetworkMetricsDatasource || !rawData) return null;
    return rawData as ClusterMetricsData;
  }, [isNetworkMetricsDatasource, rawData]);

  const availableTabs = useMemo(() => {
    return TAB_CONFIG.filter(tab => !deletedTabs.has(tab.id));
  }, [deletedTabs]);

  const [activeCluster, setActiveCluster] = useState<string>(() => {
    return availableTabs.length > 0 ? availableTabs[0].id : 'wx';
  });

  React.useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.find(t => t.id === activeCluster)) {
      setActiveCluster(availableTabs[0].id);
    }
  }, [availableTabs, activeCluster]);

  const showAggregatedMode = !isDeaggregated && availableTabs.length >= 1 && !isNetworkMetricsDatasource;

  const metrics = activeCluster === 'wx' ? clusterMetricsData?.wxMetrics : clusterMetricsData?.nfMetrics;

  const sortedMetrics = useMemo(() => {
    return [...(metrics || [])].sort((a, b) => {
      const indexA = metricOrder.indexOf(a.metric_name);
      const indexB = metricOrder.indexOf(b.metric_name);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });
  }, [metrics]);

  const layerGroups = useMemo(() => {
    const groups: { layer: string; metrics: LogMetric[] }[] = [];
    const layerOrder = ['access', 'buffer', 'storage', 'application'];
    
    layerOrder.forEach(layer => {
      const layerMetrics = sortedMetrics.filter(m => m.layer === layer);
      if (layerMetrics.length > 0) {
        groups.push({ layer, metrics: layerMetrics });
      }
    });
    
    return groups;
  }, [sortedMetrics]);

  const networkMetricsByCategory = useMemo(() => {
    if (!networkMetrics) return [];
    const categoryMap = new Map<string, NetworkMetric[]>();
    networkMetrics.forEach(metric => {
      const category = metric.metric_category || '其他';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(metric);
    });
    return Array.from(categoryMap.entries()).map(([category, metrics]) => ({
      category,
      metrics,
    }));
  }, [networkMetrics]);

  const formatValue = (value: number | undefined, unit: string) => {
    if (value === undefined || value === null) return '-';
    return `${value} ${unit}`;
  };

  const formatChangeRate = (rate: number) => {
    if (rate === 0) return { text: '0.0%', className: styles.rateNeutral };
    const isPositive = rate > 0;
    return {
      text: `${isPositive ? '▲' : '▼'} ${Math.abs(rate).toFixed(1)}%`,
      className: isPositive ? styles.rateUp : styles.rateDown,
    };
  };

  const handleDeleteTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (onDeleteTab) {
      onDeleteTab(tabId);
    }
  };

  const getDeleteTooltip = () => {
    if (availableTabs.length === 1) {
      return '解聚合此表格';
    }
    return '删除此表格';
  };

  if (loading) {
    return (
      <Card className={styles.tableCard}>
        <div className={styles.loadingContainer}>
          <Spin />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={styles.tableCard}>
        <Empty description={error} />
      </Card>
    );
  }

  const renderNetworkMetricsTable = () => {
    if (!networkMetrics || networkMetrics.length === 0) {
      return <Empty description="暂无网络指标数据" />;
    }

    // 计算节点类型列的合并信息
    const nodeTypeSpans: { index: number; span: number }[] = [];
    let currentSpan = 1;
    let spanStartIndex = 0;

    for (let i = 0; i < networkMetrics.length; i++) {
      const current = networkMetrics[i].node_type;
      const next = networkMetrics[i + 1]?.node_type;

      if (current === next) {
        currentSpan++;
      } else {
        nodeTypeSpans.push({ index: spanStartIndex, span: currentSpan });
        spanStartIndex = i + 1;
        currentSpan = 1;
      }
    }

    // 计算指标类别列的合并信息（在同一个节点类型组内合并）
    const categorySpans: { index: number; span: number }[] = [];
    for (const nodeSpan of nodeTypeSpans) {
      let catSpan = 1;
      let catStartIndex = nodeSpan.index;

      for (let i = nodeSpan.index; i < nodeSpan.index + nodeSpan.span; i++) {
        const current = networkMetrics[i].metric_category;
        const next = networkMetrics[i + 1]?.metric_category;
        const sameNodeType = i + 1 < nodeSpan.index + nodeSpan.span;

        if (current === next && sameNodeType) {
          catSpan++;
        } else {
          categorySpans.push({ index: catStartIndex, span: catSpan });
          catStartIndex = i + 1;
          catSpan = 1;
        }
      }
    }

    // 获取指定索引的节点类型跨度信息
    const getNodeTypeSpan = (index: number) => {
      return nodeTypeSpans.find(s => s.index === index);
    };

    // 获取指定索引的指标类别跨度信息
    const getCategorySpan = (index: number) => {
      return categorySpans.find(s => s.index === index);
    };

    return (
      <table className={styles.table}>
        <thead>
          <tr className={styles.tableHeaderRow}>
            <th className={styles.tableHeaderCell}>节点类型</th>
            <th className={styles.tableHeaderCell}>指标类别</th>
            <th className={styles.tableHeaderCell}>指标名称</th>
            <th className={styles.tableHeaderCell}>当前值</th>
            <th className={styles.tableHeaderCell}>同比</th>
            <th className={styles.tableHeaderCell}>环比</th>
            <th className={styles.tableHeaderCell}>历史峰值</th>
          </tr>
        </thead>
        <tbody>
          {networkMetrics.map((metric, index) => {
            const yoyChange = metric.yoy_change || 0;
            const momChange = metric.mom_change || 0;
            const yoyClass = yoyChange > 0 ? styles.rateUp : yoyChange < 0 ? styles.rateDown : styles.rateNeutral;
            const momClass = momChange > 0 ? styles.rateUp : momChange < 0 ? styles.rateDown : styles.rateNeutral;

            // 检查是否需要渲染节点类型单元格
            const nodeSpan = getNodeTypeSpan(index);
            const shouldRenderNodeType = nodeSpan !== undefined;

            // 检查是否需要渲染指标类别单元格
            const catSpan = getCategorySpan(index);
            const shouldRenderCategory = catSpan !== undefined;

            return (
              <tr key={metric.id || index} className={styles.tableRow}>
                {shouldRenderNodeType && (
                  <td 
                    className={styles.tableCell} 
                    rowSpan={nodeSpan.span}
                    style={{ 
                      verticalAlign: 'middle',
                      fontWeight: 600
                    }}
                  >
                    {metric.node_type}
                  </td>
                )}
                {shouldRenderCategory && (
                  <td 
                    className={styles.tableCell} 
                    rowSpan={catSpan.span}
                    style={{ 
                      verticalAlign: 'middle'
                    }}
                  >
                    {metric.metric_category || '-'}
                  </td>
                )}
                <td className={styles.colName}>
                  <span className={styles.metricName}>{metric.metric_name}</span>
                </td>
                <td className={styles.tableCell}>{metric.current_value} {metric.unit}</td>
                <td className={styles.colRate}>
                  <span className={yoyClass}>
                    {yoyChange > 0 ? '▲' : yoyChange < 0 ? '▼' : ''} {Math.abs(yoyChange)}%
                  </span>
                </td>
                <td className={styles.colRate}>
                  <span className={momClass}>
                    {momChange > 0 ? '▲' : momChange < 0 ? '▼' : ''} {Math.abs(momChange)}%
                  </span>
                </td>
                <td className={styles.tableCell}>{metric.historical_peak ? `${metric.historical_peak} ${metric.unit}` : '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  return (
    <Card className={styles.tableCard}>
      {showAggregatedMode && (
        <div className={styles.tabs}>
          {availableTabs.map((tab) => (
            <div key={tab.id} className={styles.tabWrapper}>
              <Button
                type="text"
                className={activeCluster === tab.id ? styles.activeTab : styles.tab}
                onClick={() => setActiveCluster(tab.id)}
              >
                {tab.label}
              </Button>
              {isConfigMode && (
                <Tooltip title={getDeleteTooltip()}>
                  <button
                    className={styles.deleteTabButton}
                    onClick={(e) => handleDeleteTab(tab.id, e)}
                  >
                    <DeleteOutlined />
                  </button>
                </Tooltip>
              )}
            </div>
          ))}
        </div>
      )}

      {isNetworkMetricsDatasource ? (
        renderNetworkMetricsTable()
      ) : (
        <table className={styles.table}>
          <thead>
            <tr className={styles.tableHeaderRow}>
              <th className={styles.tableHeaderCell}>链路层级</th>
              <th className={styles.tableHeaderCell}>指标名称</th>
              <th className={styles.tableHeaderCell}>当日峰值 (MAX/AVG)</th>
              <th className={styles.tableHeaderCell}>上日峰值 (MAX/AVG)</th>
              <th className={styles.tableHeaderCell}>历史峰值</th>
              <th className={styles.tableHeaderCell}>同/环比</th>
              <th className={styles.tableHeaderCell}>结论 & 趋势</th>
            </tr>
          </thead>
          <tbody>
            {layerGroups.map((group) => {
              const layer = layerConfig[group.layer] || layerConfig.application;
              const rowCount = group.metrics.length;
              
              return group.metrics.map((metric, index) => {
                const changeRate = formatChangeRate(metric.change_rate);
                
                return (
                  <tr key={metric.id || `${group.layer}-${index}`} className={styles.tableRow}>
                    {index === 0 && (
                      <td 
                        className={`${styles.colLayer} ${styles.colLayerData}`} 
                        rowSpan={rowCount}
                      >
                        <div 
                          className={styles.layerBar} 
                          style={{ backgroundColor: layer.color }} 
                        />
                        <div className={styles.layerCell}>
                          <div className={styles.layerContent}>
                            <span className={styles.layerName} style={{ color: layer.color }}>{layer.name}</span>
                            <span className={styles.layerEn}>{layer.nameEn}</span>
                          </div>
                        </div>
                      </td>
                    )}
                    <td className={styles.colName}>
                      <span className={styles.metricName}>{metric.metric_name}</span>
                    </td>
                    <td className={styles.colToday}>
                      <div className={styles.metricValue}>
                        <span className={styles.maxValue}>{formatValue(metric.today_max, metric.unit)}</span>
                        <span className={styles.avgValue}>Avg: {formatValue(metric.today_avg, metric.unit)}</span>
                      </div>
                    </td>
                    <td className={styles.colYesterday}>
                      <div className={styles.metricValue}>
                        <span className={styles.yesterdayMax}>{formatValue(metric.yesterday_max, metric.unit)}</span>
                        <span className={styles.avgValue}>Avg: {formatValue(metric.yesterday_avg, metric.unit)}</span>
                      </div>
                    </td>
                    <td className={styles.colHistory}>
                      <span className={styles.historicalMax}>{formatValue(metric.historical_max, metric.unit)}</span>
                    </td>
                    <td className={styles.colRate}>
                      <span className={changeRate.className}>{changeRate.text}</span>
                    </td>
                    <td className={styles.colConclusion}>
                      <div className={styles.conclusion}>
                        <span className={styles.healthStatus}>水位健康</span>
                        <Button className={styles.trendBtn}>
                          趋势
                          <div className={styles.trendIcon}>
                            <LineChartOutlined />
                          </div>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
};

export default ClusterMetricsPanel;
