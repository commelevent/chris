import React, { useMemo } from 'react';
import { Card, Button, Spin, Empty, Table } from 'antd';
import { BulbOutlined, EyeOutlined, CheckCircleOutlined, FlagOutlined } from '@ant-design/icons';
import { Assessment, ActionPlan, GrafanaPanelDatasource } from '@/types';
import { usePanelData, PANEL_DATASOURCES, PanelDatasource } from '@/hooks/usePanelData';
import styles from './AssessmentActionPanel.module.scss';

interface Props {
  reportId: string;
  datasource?: GrafanaPanelDatasource;
  date?: string;
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

const AssessmentActionPanel: React.FC<Props> = ({ reportId, datasource, date }) => {
  const isNetworkMetricsDatasource = datasource?.endpoint?.includes('/api/network-metrics');

  const networkMetricsDatasource: PanelDatasource | null = isNetworkMetricsDatasource && datasource ? {
    type: datasource.type || 'api',
    endpoint: datasource.endpoint || '/api/network-metrics',
    method: datasource.method || 'GET',
    params: { date, ...datasource.params },
  } : null;

  const assessmentDatasource: PanelDatasource | null = datasource?.endpoints?.assessment
    ? {
        type: datasource.endpoints.assessment.type || 'api',
        endpoint: datasource.endpoints.assessment.endpoint || '/api/panel/assessment',
        method: datasource.endpoints.assessment.method || 'GET',
        params: datasource.endpoints.assessment.params,
      }
    : PANEL_DATASOURCES.assessment;

  const actionPlanDatasource: PanelDatasource | null = datasource?.endpoints?.actionPlan
    ? {
        type: datasource.endpoints.actionPlan.type || 'api',
        endpoint: datasource.endpoints.actionPlan.endpoint || '/api/panel/action-plan',
        method: datasource.endpoints.actionPlan.method || 'GET',
        params: datasource.endpoints.actionPlan.params,
      }
    : PANEL_DATASOURCES.actionPlan;

  const { data: networkMetricsData, loading: loadingNetworkMetrics, error: errorNetworkMetrics } = usePanelData<NetworkMetric[]>(
    networkMetricsDatasource,
    { date }
  );

  const { data: assessments, loading: loadingAssessments, error: errorAssessments } = usePanelData<Assessment[]>(
    assessmentDatasource,
    { reportId }
  );

  const { data: actionPlans, loading: loadingActionPlans, error: errorActionPlans } = usePanelData<ActionPlan[]>(
    actionPlanDatasource,
    { reportId }
  );

  const loading = isNetworkMetricsDatasource ? loadingNetworkMetrics : (loadingAssessments || loadingActionPlans);
  const error = isNetworkMetricsDatasource ? errorNetworkMetrics : (errorAssessments || errorActionPlans);

  const networkMetrics = useMemo(() => {
    if (!isNetworkMetricsDatasource || !Array.isArray(networkMetricsData)) return null;
    return networkMetricsData;
  }, [isNetworkMetricsDatasource, networkMetricsData]);

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'warning':
        return styles.statusWarning;
      case 'critical':
        return styles.statusCritical;
      default:
        return styles.statusNormal;
    }
  };

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case 'high':
        return styles.priorityHigh;
      case 'medium':
        return styles.priorityMedium;
      default:
        return styles.priorityLow;
    }
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
            <div className={styles.panelHeader}>
              <div className={styles.iconWrapper}>
                <CheckCircleOutlined />
              </div>
              <h3>核心评估</h3>
            </div>

            <div className={styles.assessmentList}>
              {(assessments || []).length > 0 ? (
                (assessments || []).map((assessment, index) => (
                  <div key={assessment.id || index} className={styles.assessmentItem}>
                    <div className={styles.assessmentTitle}>
                      {index + 1}. {assessment.category}:
                    </div>
                    <div className={styles.assessmentContent}>
                      <span className={styles.bullet}>•</span>
                      <p className={getStatusClass(assessment.status)}>{assessment.content}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.noData}>暂无评估数据</div>
              )}
            </div>

            <div className={styles.insightBox}>
              <div className={styles.insightHeader}>
                <div className={styles.insightIcon}>
                  <BulbOutlined />
                </div>
                <span>智能洞察</span>
              </div>
              <p className={styles.insightText}>
                各架构层级健康度良好，同比指标多数改善，系统在业务高峰期承载能力稳定。
              </p>
              <Button type="link" className={styles.viewBtn} icon={<EyeOutlined />}>
                查看推理过程
              </Button>
            </div>
          </div>

          <div className={styles.rightPanel}>
            <div className={styles.panelHeader}>
              <div className={styles.iconWrapper}>
                <FlagOutlined />
              </div>
              <h3>下一步计划</h3>
            </div>

            <div className={styles.actionPlanList}>
              {(actionPlans || []).length > 0 ? (
                (actionPlans || []).map((plan, index) => (
                  <div key={plan.id || index} className={styles.actionPlan}>
                    <div className={`${styles.priorityBadge} ${getPriorityClass(plan.priority || 'low')}`}>
                      <span>
                        {plan.priority === 'high' ? '高' : plan.priority === 'medium' ? '中' : '低'}
                      </span>
                    </div>
                    {plan.items && plan.items.length > 0 && (
                      <div className={styles.planItems}>
                        {plan.items.map((item, itemIndex) => (
                          <div key={itemIndex} className={styles.planItem}>
                            <span className={styles.bullet}>•</span>
                            <p>{item}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className={styles.noData}>暂无行动计划</div>
              )}
            </div>

            <div className={styles.insightBox}>
              <div className={styles.insightHeader}>
                <div className={styles.insightIcon}>
                  <BulbOutlined />
                </div>
                <span>智能洞察</span>
              </div>
              <p className={styles.insightText}>
                建议关注南方集群的数据同步效率，当前延迟略高于预期。
              </p>
              <Button type="link" className={styles.viewBtn} icon={<EyeOutlined />}>
                查看推理过程
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
};

export default AssessmentActionPanel;
