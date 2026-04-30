import React, { useMemo } from 'react';
import { Card, Table, Spin, Empty } from 'antd';
import { LogMetric, GrafanaPanelDatasource } from '@/types';
import { usePanelData, PANEL_DATASOURCES, PanelDatasource } from '@/hooks/usePanelData';
import styles from './SlaMetricsPanel.module.scss';

interface Props {
  date: string;
  systemId: string;
  datasource?: GrafanaPanelDatasource;
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

const SlaMetricsPanel: React.FC<Props> = ({ date, systemId, datasource }) => {
  const isNetworkMetricsDatasource = datasource?.endpoint?.includes('/api/network-metrics');

  const effectiveDatasource: PanelDatasource | null = useMemo(() => {
    if (datasource) {
      return {
        type: datasource.type || 'api',
        endpoint: datasource.endpoint || '/api/panel/sla-metrics',
        method: datasource.method || 'GET',
        params: { date, ...datasource.params },
      };
    }
    return PANEL_DATASOURCES.slaMetrics;
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

  const slaMetrics = useMemo(() => {
    if (isNetworkMetricsDatasource || !Array.isArray(rawData)) return null;
    return rawData as LogMetric[];
  }, [isNetworkMetricsDatasource, rawData]);

  const networkMetrics = useMemo(() => {
    if (!isNetworkMetricsDatasource || !Array.isArray(rawData)) return null;
    return rawData as NetworkMetric[];
  }, [isNetworkMetricsDatasource, rawData]);

  const getHealthStatusClass = (status: string) => {
    switch (status) {
      case 'warning':
        return styles.healthTagWarning;
      case 'critical':
        return styles.healthTagError;
      default:
        return styles.healthTagSuccess;
    }
  };

  const getHealthStatusText = (status: string) => {
    switch (status) {
      case 'warning':
        return '告警';
      case 'critical':
        return '异常';
      default:
        return '健康';
    }
  };

  const columns = [
    {
      title: '指标名称',
      dataIndex: 'metric_name',
      key: 'metric_name',
      width: 200,
      render: (text: string) => <span className={styles.metricName}>{text}</span>,
    },
    {
      title: '今日数据',
      key: 'today',
      width: 180,
      render: (_: unknown, record: LogMetric) => (
        <div className={styles.metricValue}>
          <span className={styles.maxValue}>{record.today_max} {record.unit}</span>
          <span className={styles.avgValue}>Avg: {record.today_avg} {record.unit}</span>
        </div>
      ),
    },
    {
      title: '前一交易日',
      key: 'yesterday',
      width: 180,
      render: (_: unknown, record: LogMetric) => (
        <div className={styles.metricValue}>
          <span className={styles.yesterdayMax}>{record.yesterday_max} {record.unit}</span>
          <span className={styles.avgValue}>Avg: {record.yesterday_avg} {record.unit}</span>
        </div>
      ),
    },
    {
      title: '历史峰值 (日期)',
      key: 'historical',
      width: 180,
      render: (_: unknown, record: LogMetric) => (
        <div className={styles.metricValue}>
          <span className={styles.historicalMax}>{record.historical_max} {record.unit}</span>
          <span className={styles.avgValue}>({record.historical_max_date})</span>
        </div>
      ),
    },
    {
      title: 'SLA 阈值',
      dataIndex: 'sla_threshold',
      key: 'sla_threshold',
      width: 150,
      render: (value: number, record: LogMetric) => (
        <span className={styles.slaThreshold}>&lt; {value.toFixed(4)} {record.unit}</span>
      ),
    },
    {
      title: '健康评估',
      key: 'health',
      width: 120,
      render: (_: unknown, record: LogMetric) => (
        <span className={`${styles.healthTag} ${getHealthStatusClass(record.health_status)}`}>
          <span className={styles.healthDotWrapper}>
            <span className={styles.healthDotInner} />
            <span className={styles.healthDotOuter} />
          </span>
          {getHealthStatusText(record.health_status)}
        </span>
      ),
    },
  ];

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
        className={styles.table}
      />
    );
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

  return (
    <Card className={styles.tableCard}>
      {isNetworkMetricsDatasource ? (
        renderNetworkMetricsTable()
      ) : (
        <Table
          columns={columns}
          dataSource={slaMetrics || []}
          rowKey="id"
          pagination={false}
          className={styles.table}
        />
      )}
    </Card>
  );
};

export default SlaMetricsPanel;
