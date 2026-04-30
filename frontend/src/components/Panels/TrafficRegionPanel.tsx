import React, { useState, useMemo } from 'react';
import { Card, Button, Progress, Spin, Empty, Table } from 'antd';
import { RegionStats, CloudRegion, GrafanaPanelDatasource } from '@/types';
import { usePanelData, PANEL_DATASOURCES, PanelDatasource } from '@/hooks/usePanelData';
import styles from './TrafficRegionPanel.module.scss';

interface Props {
  date: string;
  systemId: string;
  datasource?: GrafanaPanelDatasource;
}

interface RegionTrafficData {
  regionStats: RegionStats;
  topRegions: CloudRegion[];
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

const TrafficRegionPanel: React.FC<Props> = ({ date, systemId, datasource }) => {
  const isNetworkMetricsDatasource = datasource?.endpoint?.includes('/api/network-metrics');

  const effectiveDatasource: PanelDatasource | null = useMemo(() => {
    if (datasource) {
      return {
        type: datasource.type || 'api',
        endpoint: datasource.endpoint || '/api/panel/region-traffic',
        method: datasource.method || 'GET',
        params: { date, ...datasource.params },
      };
    }
    return PANEL_DATASOURCES.regionTraffic;
  }, [
    datasource?.type,
    datasource?.endpoint,
    datasource?.method,
    datasource?.params,
    date,
  ]);

  const { data, loading, error } = usePanelData<any>(
    effectiveDatasource,
    isNetworkMetricsDatasource ? { date } : { date, systemId }
  );

  const regionTrafficData = useMemo(() => {
    if (isNetworkMetricsDatasource || !data) return null;
    return data as RegionTrafficData;
  }, [isNetworkMetricsDatasource, data]);

  const networkMetrics = useMemo(() => {
    if (!isNetworkMetricsDatasource || !Array.isArray(data)) return null;
    return data as NetworkMetric[];
  }, [isNetworkMetricsDatasource, data]);

  const [activeCluster, setActiveCluster] = useState<'wx' | 'nf'>('wx');

  const regionStats = regionTrafficData?.regionStats;
  const topRegions = regionTrafficData?.topRegions || [];
  const filteredRegions = topRegions.filter(r => r.cluster_type === activeCluster);

  const getRegionStatusClass = (region: CloudRegion) => {
    const ratio = region.current_traffic / region.peak_traffic;
    if (ratio > 0.9) {
      return styles.healthTagError;
    } else if (ratio > 0.8) {
      return styles.healthTagWarning;
    }
    return styles.healthTagSuccess;
  };

  const getRegionStatusText = (region: CloudRegion) => {
    const ratio = region.current_traffic / region.peak_traffic;
    if (ratio > 0.9) {
      return '异常';
    } else if (ratio > 0.8) {
      return '告警';
    }
    return '健康';
  };

  const networkMetricsColumns = [
    {
      title: '序号',
      key: 'index',
      width: 60,
      render: (_: unknown, __: NetworkMetric, index: number) => index + 1,
    },
    {
      title: '节点类型',
      dataIndex: 'node_type',
      key: 'node_type',
      width: 120,
    },
    {
      title: '指标类别',
      dataIndex: 'metric_category',
      key: 'metric_category',
      width: 120,
      render: (text: string) => text || '-',
    },
    {
      title: '指标名称',
      dataIndex: 'metric_name',
      key: 'metric_name',
      width: 180,
    },
    {
      title: '当前值',
      dataIndex: 'current_value',
      key: 'current_value',
      width: 100,
    },
    {
      title: '单位',
      dataIndex: 'unit',
      key: 'unit',
      width: 80,
    },
    {
      title: '同比',
      dataIndex: 'yoy_change',
      key: 'yoy_change',
      width: 100,
      render: (value: number) => {
        const v = value || 0;
        const className = v > 0 ? styles.rateUp : v < 0 ? styles.rateDown : styles.rateNeutral;
        return (
          <span className={className}>
            {v > 0 ? '▲' : v < 0 ? '▼' : ''} {Math.abs(v)}%
          </span>
        );
      },
    },
    {
      title: '环比',
      dataIndex: 'mom_change',
      key: 'mom_change',
      width: 100,
      render: (value: number) => {
        const v = value || 0;
        const className = v > 0 ? styles.rateUp : v < 0 ? styles.rateDown : styles.rateNeutral;
        return (
          <span className={className}>
            {v > 0 ? '▲' : v < 0 ? '▼' : ''} {Math.abs(v)}%
          </span>
        );
      },
    },
    {
      title: '历史峰值',
      dataIndex: 'historical_peak',
      key: 'historical_peak',
      width: 120,
      render: (value: number | string) => value || '-',
    },
  ];

  const renderNetworkMetricsTable = () => {
    if (!networkMetrics || networkMetrics.length === 0) {
      return <Empty description="暂无网络指标数据" />;
    }

    return (
      <Table
        columns={networkMetricsColumns}
        dataSource={networkMetrics}
        rowKey="id"
        pagination={false}
        scroll={{ x: 1000 }}
        className={styles.networkMetricsTable}
      />
    );
  };

  if (loading) {
    return (
      <Card className={styles.contentCard}>
        <div className={styles.loadingContainer}>
          <Spin />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={styles.contentCard}>
        <Empty description={error} />
      </Card>
    );
  }

  return (
    <Card className={styles.contentCard}>
      {isNetworkMetricsDatasource ? (
        renderNetworkMetricsTable()
      ) : (
        <>
          <div className={styles.leftPanel}>
            <div className={styles.overview}>
              <div className={styles.overviewHeader}>
                <div className={styles.overviewIcon}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="8" stroke="#155dfc" strokeWidth="2"/>
                    <path d="M10 6V10L13 13" stroke="#155dfc" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <h3>全网流量概览</h3>
              </div>

              <div className={styles.regionCount}>
                <span className={styles.label}>纳管区域总数</span>
                <div className={styles.countValue}>
                  <span className={styles.count}>{regionStats?.total_regions || 0}</span>
                  <span className={styles.unit}>/ 云区域</span>
                </div>
                <div className={styles.clusterBreakdown}>
                  <div className={styles.clusterItem}>
                    <span className={styles.clusterLabel}>南方集群</span>
                    <span className={styles.clusterCount}>{regionStats?.nf_regions || 0} 云区域</span>
                  </div>
                  <div className={styles.clusterItem}>
                    <span className={styles.clusterLabel}>威新集群</span>
                    <span className={styles.clusterCount}>{regionStats?.wx_regions || 0} 云区域</span>
                  </div>
                </div>
                <div className={styles.decorativeCircle} />
              </div>

              <div className={styles.statsRow}>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>平均流量</span>
                  <div className={styles.statValue}>
                    <span className={styles.statNumber}>{(regionStats?.avg_traffic || 0).toFixed(2)}</span>
                    <span className={styles.statUnit}>Mbps</span>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>峰值时间</span>
                  <div className={styles.statValue}>
                    <span className={styles.statTime}>
                      <span>09:31:00</span>
                      <span>CST</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>链路实时状态</span>
              <span className={`${styles.healthTag} ${styles.healthTagSuccess}`}>
                <span className={styles.healthDotWrapper}>
                  <span className={styles.healthDotInner} />
                  <span className={styles.healthDotOuter} />
                </span>
                监控中
              </span>
            </div>
          </div>

          <div className={styles.rightPanel}>
            <div className={styles.panelHeader}>
              <div className={styles.titleGroup}>
                <h4>区域流量 TOP 5</h4>
                <span>Regional Traffic Distribution</span>
                <div className={styles.clusterTabs}>
                  <Button
                    type={activeCluster === 'wx' ? 'primary' : 'text'}
                    className={activeCluster === 'wx' ? styles.activeClusterTab : styles.clusterTab}
                    onClick={() => setActiveCluster('wx')}
                  >
                    威新中心
                  </Button>
                  <Button
                    type="text"
                    className={activeCluster === 'nf' ? styles.activeClusterTab : styles.clusterTab}
                    onClick={() => setActiveCluster('nf')}
                  >
                    南方中心
                  </Button>
                </div>
              </div>
              <Button type="link" className={styles.viewAllBtn}>
                查看完整列表 →
              </Button>
            </div>

            <div className={styles.regionList}>
              {filteredRegions.slice(0, 5).map((region, index) => (
                <div key={region.id} className={styles.regionItem}>
                  <div className={styles.rankBadge}>
                    <span className={styles.rankLabel}>Rank</span>
                    <span className={styles.rankNumber}>{index + 1}</span>
                  </div>
                  <div className={styles.regionInfo}>
                    <div className={styles.regionHeader}>
                      <span className={styles.regionName}>
                        {region.name} <span className={styles.nodeCount}>({region.node_count} 节点)</span>
                      </span>
                      <div className={styles.trafficValue}>
                        <span className={styles.currentTraffic}>{region.current_traffic}</span>
                        <span className={styles.trafficSeparator}>/</span>
                        <span className={styles.maxTraffic}>{region.peak_traffic} Gbps</span>
                      </div>
                    </div>
                    <Progress
                      percent={(region.current_traffic / region.peak_traffic) * 100}
                      showInfo={false}
                      strokeColor="#4361ee"
                      trailColor="#f1f5f9"
                      className={styles.progress}
                    />
                  </div>
                  <div className={styles.regionStatus}>
                    <span className={`${styles.healthTag} ${getRegionStatusClass(region)}`}>
                      <span className={styles.healthDotWrapper}>
                        <span className={styles.healthDotInner} />
                        <span className={styles.healthDotOuter} />
                      </span>
                      {getRegionStatusText(region)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Card>
  );
};

export default TrafficRegionPanel;
