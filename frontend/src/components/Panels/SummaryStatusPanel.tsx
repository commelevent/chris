import React, { useMemo } from 'react';
import { Card, Button, Spin, Empty, Table } from 'antd';
import { BulbOutlined, EyeOutlined, CheckCircleOutlined, ExclamationCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { DailyReport, Cluster, GrafanaPanelDatasource } from '@/types';
import { usePanelData, PANEL_DATASOURCES, PanelDatasource } from '@/hooks/usePanelData';
import styles from './SummaryStatusPanel.module.scss';

interface Props {
  date: string;
  systemId: string;
  datasource?: GrafanaPanelDatasource;
  onStatusChange?: (status: 'normal' | 'warning' | 'critical' | null) => void;
}

interface SummaryData {
  report: DailyReport | null;
  wxCluster: Cluster | null;
  nfCluster: Cluster | null;
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

const SummaryStatusPanel: React.FC<Props> = ({ date, systemId, datasource, onStatusChange }) => {
  const isNetworkMetricsDatasource = datasource?.endpoint?.includes('/api/network-metrics');

  const effectiveDatasource: PanelDatasource | null = useMemo(() => {
    if (datasource) {
      return {
        type: datasource.type || 'api',
        endpoint: datasource.endpoint || '/api/panel/summary',
        method: datasource.method || 'GET',
        params: { date, ...datasource.params },
      };
    }
    return PANEL_DATASOURCES.summary;
  }, [
    datasource?.type,
    datasource?.endpoint,
    datasource?.method,
    datasource?.params,
    date,
  ]);

  const { data: rawData, loading, error } = usePanelData<any>(
    effectiveDatasource,
    isNetworkMetricsDatasource ? { date } : { date, systemId }
  );

  const summaryData = useMemo(() => {
    if (isNetworkMetricsDatasource || !rawData) return null;
    return rawData as SummaryData;
  }, [isNetworkMetricsDatasource, rawData]);

  const networkMetrics = useMemo(() => {
    if (!isNetworkMetricsDatasource || !Array.isArray(rawData)) return null;
    return rawData as NetworkMetric[];
  }, [isNetworkMetricsDatasource, rawData]);

  const report = summaryData?.report;
  const wxCluster = summaryData?.wxCluster;
  const nfCluster = summaryData?.nfCluster;
  const systemStatus = report?.system_status || 'normal';

  React.useEffect(() => {
    onStatusChange?.(report?.system_status || null);
  }, [report?.system_status, onStatusChange]);

  const getStatusStyles = () => {
    switch (systemStatus) {
      case 'warning':
        return {
          cardClass: `${styles.statusCard} ${styles.statusWarning}`,
          iconClass: `${styles.statusIcon} ${styles.statusIconWarning}`,
          Icon: ExclamationCircleOutlined,
        };
      case 'critical':
        return {
          cardClass: `${styles.statusCard} ${styles.statusCritical}`,
          iconClass: `${styles.statusIcon} ${styles.statusIconCritical}`,
          Icon: CloseCircleOutlined,
        };
      default:
        return {
          cardClass: styles.statusCard,
          iconClass: styles.statusIcon,
          Icon: CheckCircleOutlined,
        };
    }
  };

  const statusStyles = getStatusStyles();
  const StatusIcon = statusStyles.Icon;

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
      <Card className={styles.summaryCard}>
        <Table
          columns={networkMetricsColumns}
          dataSource={networkMetrics}
          rowKey="id"
          pagination={false}
          scroll={{ x: 1000 }}
          className={styles.networkMetricsTable}
        />
      </Card>
    );
  };

  if (loading) {
    return (
      <div className={styles.content}>
        <Card className={styles.summaryCard}>
          <div className={styles.loadingContainer}>
            <Spin />
          </div>
        </Card>
        <Card className={styles.statusCard}>
          <div className={styles.loadingContainer}>
            <Spin />
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.content}>
        <Card className={styles.summaryCard}>
          <Empty description={error} />
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.content}>
      {isNetworkMetricsDatasource ? (
        renderNetworkMetricsTable()
      ) : (
        <>
          <Card className={styles.summaryCard}>
            <div className={styles.cardHeader}>
              <div className={styles.iconWrapper}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2L2 7L10 12L18 7L10 2Z" stroke="#155dfc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 13L10 18L18 13" stroke="#155dfc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3>运行综述</h3>
            </div>

            {report ? (
              <>
                <div className={styles.clusterInfo}>
                  <div className={styles.cluster}>
                    <div className={styles.clusterLabel}>
                      {wxCluster?.name || '威新集群'} / {wxCluster?.name_en || 'WX CLUSTER'}
                    </div>
                    <div className={styles.epsValue}>
                      <span className={styles.value}>{report.wx_cluster_eps_peak}w</span>
                      <span className={styles.rate}>
                        EPS峰值 ({report.wx_cluster_eps_rate}%, {report.wx_cluster_eps_peak_date})
                      </span>
                    </div>
                    <p className={styles.description}>{report.wx_cluster_description || '集群运行正常。'}</p>
                  </div>

                  <div className={styles.divider} />

                  <div className={styles.cluster}>
                    <div className={styles.clusterLabel}>
                      {nfCluster?.name || '南方集群'} / {nfCluster?.name_en || 'NF CLUSTER'}
                    </div>
                    <div className={styles.epsValue}>
                      <span className={styles.value}>{report.nf_cluster_eps_peak}w</span>
                      <span className={styles.rate}>
                        EPS峰值 ({report.nf_cluster_eps_rate}%, {report.nf_cluster_eps_peak_date})
                      </span>
                    </div>
                    <p className={styles.description}>{report.nf_cluster_description || '集群运行正常。'}</p>
                  </div>
                </div>

                <div className={styles.insightBox}>
                  <div className={styles.insightHeader}>
                    <div className={styles.insightIcon}>
                      <BulbOutlined />
                    </div>
                    <span>智能洞察</span>
                  </div>
                  <p className={styles.insightText}>{report.wx_cluster_insight}</p>
                  <Button type="link" className={styles.viewBtn} icon={<EyeOutlined />}>
                    查看推理过程
                  </Button>
                </div>
              </>
            ) : (
              <p className={styles.noData}>暂无该日期的报告数据</p>
            )}
          </Card>

          <Card className={statusStyles.cardClass}>
            {report ? (
              <>
                <div className={styles.statusHeader}>
                  <StatusIcon className={statusStyles.iconClass} />
                  <h3>{report.system_status_text || '系统运行正常'}</h3>
                </div>
                <p className={styles.statusText}>
                  {systemStatus === 'warning' ? '存在潜在风险，建议关注相关指标。' : systemStatus === 'critical' ? '系统存在严重问题，请立即处理。' : '所有指标运行平稳，无风险提示。'}
                </p>

                <div className={styles.insightBox}>
                  <div className={styles.insightHeader}>
                    <div className={styles.insightIcon}>
                      <BulbOutlined />
                    </div>
                    <span>智能洞察</span>
                  </div>
                  <p className={styles.insightText}>
                    {report.system_insight || '系统运行平稳，无异常告警。'}
                  </p>
                  <Button type="link" className={styles.viewBtn} icon={<EyeOutlined />}>
                    查看推理过程
                  </Button>
                </div>
              </>
            ) : (
              <p className={styles.noData}>暂无该日期的报告数据</p>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default SummaryStatusPanel;
