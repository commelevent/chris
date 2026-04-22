import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { message, Button } from 'antd';
import { SaveOutlined, ArrowLeftOutlined, AimOutlined } from '@ant-design/icons';
import AIChatPanel, { ChatMessage } from '@/components/AIChatPanel';
import { DraggableSection } from '@/components/Panel';
import styles from './CustomTemplateConfig.module.scss';

interface PanelConfig {
  id: string;
  type: string;
  title: string;
  description: string;
  datasource: {
    type: string;
    endpoint: string;
    method: string;
    params: Record<string, any>;
  };
  fixed?: boolean;
}

interface CreateReportData {
  systemId: string;
  systemName: string;
  description: string;
  templateType: 'default' | 'custom';
}

const DEFAULT_PANELS_CONFIG: PanelConfig[] = [
  {
    id: 'panel-summary-status',
    type: 'summary_status',
    title: '核心结论与风险',
    description: 'Overview',
    fixed: true,
    datasource: {
      type: 'api',
      endpoint: '/api/panel/summary',
      method: 'GET',
      params: { date: '${date}', systemId: '${systemId}' }
    }
  },
  {
    id: 'panel-sla-metrics',
    type: 'sla_metrics',
    title: 'SLA 核心指标',
    description: 'SLA Core Metrics',
    fixed: false,
    datasource: {
      type: 'api',
      endpoint: '/api/panel/sla-metrics',
      method: 'GET',
      params: { date: '${date}', systemId: '${systemId}' }
    }
  },
  {
    id: 'panel-cluster-metrics',
    type: 'cluster_metrics',
    title: '集群核心指标明细',
    description: 'Cluster Core Metrics Detail',
    fixed: false,
    datasource: {
      type: 'api',
      endpoint: '/api/panel/cluster-metrics',
      method: 'GET',
      params: { date: '${date}', systemId: '${systemId}' }
    }
  },
  {
    id: 'panel-region-traffic',
    type: 'region_traffic',
    title: '云区域流量态势',
    description: 'Cloud Region Traffic Situational Awareness',
    fixed: false,
    datasource: {
      type: 'api',
      endpoint: '/api/panel/region-traffic',
      method: 'GET',
      params: { date: '${date}', systemId: '${systemId}' }
    }
  },
  {
    id: 'panel-assessment-action',
    type: 'assessment_action',
    title: '评估与计划',
    description: 'Assessment & Planning',
    fixed: true,
    datasource: {
      type: 'api',
      endpoint: '/api/panel/assessment',
      method: 'GET',
      params: { reportId: '${reportId}' }
    }
  }
];

const FIXED_PANELS: PanelConfig[] = [
  {
    id: 'panel-summary-status',
    type: 'summary_status',
    title: '核心结论与风险',
    description: 'Overview',
    fixed: true,
    datasource: {
      type: 'api',
      endpoint: '/api/panel/summary',
      method: 'GET',
      params: { date: '${date}', systemId: '${systemId}' }
    }
  },
  {
    id: 'panel-assessment-action',
    type: 'assessment_action',
    title: '评估与计划',
    description: 'Assessment & Planning',
    fixed: true,
    datasource: {
      type: 'api',
      endpoint: '/api/panel/assessment',
      method: 'GET',
      params: { reportId: '${reportId}' }
    }
  }
];

const PANEL_TEMPLATES: Record<string, Partial<PanelConfig>> = {
  'sla_metrics': {
    type: 'sla_metrics',
    title: 'SLA 核心指标',
    description: 'SLA Core Metrics',
    datasource: {
      type: 'api',
      endpoint: '/api/panel/sla-metrics',
      method: 'GET',
      params: { date: '${date}', systemId: '${systemId}' }
    }
  },
  'cluster_metrics': {
    type: 'cluster_metrics',
    title: '集群核心指标明细',
    description: 'Cluster Core Metrics Detail',
    datasource: {
      type: 'api',
      endpoint: '/api/panel/cluster-metrics',
      method: 'GET',
      params: { date: '${date}', systemId: '${systemId}' }
    }
  },
  'region_traffic': {
    type: 'region_traffic',
    title: '云区域流量态势',
    description: 'Cloud Region Traffic Situational Awareness',
    datasource: {
      type: 'api',
      endpoint: '/api/panel/region-traffic',
      method: 'GET',
      params: { date: '${date}', systemId: '${systemId}' }
    }
  }
};

const CustomTemplateConfig: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as CreateReportData | undefined;
  
  const systemId = locationState?.systemId || '';
  const systemName = locationState?.systemName || '未命名系统';
  const description = locationState?.description || '';
  const templateType = locationState?.templateType || 'default';
  
  const [loading, setLoading] = useState(false);
  const [customPanels, setCustomPanels] = useState<PanelConfig[]>(() => {
    if (templateType === 'default') {
      return DEFAULT_PANELS_CONFIG.filter(p => !p.fixed);
    }
    return [];
  });
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isAiTyping, setIsAiTyping] = useState(false);

  const fixedPanels = useMemo(() => {
    return FIXED_PANELS;
  }, []);

  const allPanels = useMemo(() => {
    return [...fixedPanels, ...customPanels];
  }, [customPanels, fixedPanels]);

  useEffect(() => {
    const welcomeMessage = templateType === 'default' 
      ? `您好！我是 GLM-5 报表配置助手。

您正在为「${systemName}」创建报表模板，当前使用**默认模板**。

**当前面板配置：**
• 核心结论与风险（固定）
• SLA 核心指标
• 集群核心指标明细
• 云区域流量态势
• 评估与计划（固定）

**我可以帮您：**
• 添加新的数据面板
• 修改面板标题和描述
• 删除不需要的面板（固定面板除外）
• 调整面板顺序

请告诉我您想要如何调整？`
      : `您好！我是 GLM-5 报表配置助手。

您正在为「${systemName}」创建自定义报表模板。

**固定面板（不可修改）：**
• 核心结论与风险
• 评估与计划

**我可以帮您：**
• 添加新的数据面板（如 SLA 指标、集群指标、流量分析等）
• 修改面板标题和描述
• 调整面板顺序
• 删除不需要的面板

请告诉我您想要添加哪些面板？`;

    setChatMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: welcomeMessage,
        timestamp: new Date(),
      },
    ]);
  }, [systemName, templateType]);

  const handleAddPanel = useCallback((panelType: string, customTitle?: string) => {
    const template = PANEL_TEMPLATES[panelType];
    if (!template) {
      message.error('未知的面板类型');
      return;
    }

    const newPanel: PanelConfig = {
      id: `panel-${panelType}-${Date.now()}`,
      ...template,
      title: customTitle || template.title || '',
      datasource: template.datasource || {
        type: 'api',
        endpoint: '/api/panel/data',
        method: 'GET',
        params: {}
      }
    } as PanelConfig;

    setCustomPanels(prev => [...prev, newPanel]);
    message.success(`已添加面板：${newPanel.title}`);
  }, []);

  const handleDeletePanel = useCallback((panelId: string) => {
    const panel = customPanels.find(p => p.id === panelId);
    if (panel?.fixed) {
      message.warning('固定面板不可删除');
      return;
    }
    setCustomPanels(prev => prev.filter(p => p.id !== panelId));
    if (selectedPanelId === panelId) {
      setSelectedPanelId(null);
    }
    message.success('面板已删除');
  }, [customPanels, selectedPanelId]);

  const handleUpdatePanelTitle = useCallback((panelId: string, newTitle: string) => {
    setCustomPanels(prev => prev.map(p => 
      p.id === panelId ? { ...p, title: newTitle } : p
    ));
    message.success(`标题已更新为「${newTitle}」`);
  }, []);

  const handleSendMessage = useCallback(async (content: string) => {
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      selectedElement: selectedPanelId ? {
        id: selectedPanelId,
        title: allPanels.find(p => p.id === selectedPanelId)?.title || '',
      } : undefined,
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    setIsAiTyping(true);

    try {
      const selectedPanelData = selectedPanelId ? allPanels.find(p => p.id === selectedPanelId) : null;
      
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          selectedPanel: selectedPanelData ? {
            id: selectedPanelData.id,
            title: selectedPanelData.title,
            type: selectedPanelData.type,
            datasource: selectedPanelData.datasource,
          } : undefined,
          context: {
            mode: 'template_config',
            systemName,
            description,
            templateType,
            existingPanels: allPanels.map(p => ({ id: p.id, type: p.type, title: p.title })),
          },
          conversationHistory: chatMessages
            .filter(m => m.id !== 'welcome')
            .map(m => ({
              role: m.role,
              content: m.content,
            })),
        }),
      });

      const result = await response.json();

      if (result.success) {
        const aiMessage: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: result.data.message,
          timestamp: new Date(),
          changes: result.data.modifications?.map((m: any) => ({
            field: m.field,
            description: m.description,
          })),
        };

        setChatMessages(prev => [...prev, aiMessage]);

        if (result.data.modifications) {
          result.data.modifications.forEach((mod: any) => {
            if (mod.field === 'add_panel') {
              handleAddPanel(mod.panelType, mod.title);
            } else if (mod.field === 'remove') {
              handleDeletePanel(mod.panelId);
            } else if (mod.field === 'title') {
              handleUpdatePanelTitle(mod.panelId, mod.newValue);
            }
          });
        }
      } else {
        const errorMessage: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: result.error || '抱歉，处理您的请求时出现错误，请稍后重试。',
          timestamp: new Date(),
        };
        setChatMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('AI chat error:', error);
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: '抱歉，AI 服务暂时不可用，请稍后重试。',
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsAiTyping(false);
    }
  }, [selectedPanelId, allPanels, systemName, description, templateType, chatMessages, handleAddPanel, handleDeletePanel, handleUpdatePanelTitle]);

  const handlePanelSelect = useCallback((panelId: string, isFixed: boolean) => {
    if (isFixed) {
      message.info('固定面板不可选择修改');
      return;
    }
    setSelectedPanelId(panelId === selectedPanelId ? null : panelId);
  }, [selectedPanelId]);

  const handleSave = async () => {
    try {
      setLoading(true);

      const panels = allPanels.map((panel, index) => ({
        id: panel.id,
        type: panel.type,
        title: panel.title,
        description: panel.description,
        datasource: panel.datasource,
        gridPos: { x: 0, y: index * 8, w: 24, h: 8 }
      }));

      const dashboardData = {
        __meta: {
          exported_at: new Date().toISOString(),
          exporter_version: '1.0.0',
          schema_version: 1,
          type: 'dashboard' as const,
        },
        dashboard: {
          uid: systemId,
          title: systemName,
          description: description,
          overwrite: true,
          tags: ['运维报表', templateType === 'default' ? '默认模板' : '自定义模板'],
          style: 'dark',
          timezone: 'browser',
          editable: true,
          panels,
          clusters: {
            wx_cluster: { name: '主集群', name_en: 'Primary Cluster', type: 'wx' },
            nf_cluster: { name: '备集群', name_en: 'Backup Cluster', type: 'nf' }
          }
        }
      };

      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dashboardData)
      });

      const result = await response.json();

      if (result.success) {
        message.success(`报表创建成功：${result.data.details.business_system.name}`);
        navigate('/systems');
      } else {
        message.error(result.error || '创建失败');
      }
    } catch (error) {
      console.error('Save template error:', error);
      message.error('保存模板失败');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/systems');
  };

  const chineseNumerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

  const pageTitle = templateType === 'default' ? '默认模板配置' : '自定义模板配置';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
            返回
          </Button>
          <div className={styles.titleInfo}>
            <h1 className={styles.title}>{systemName}</h1>
            <p className={styles.subtitle}>{description || pageTitle}</p>
          </div>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.panelCount}>
            共 {allPanels.length} 个面板
          </span>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={loading}
          >
            保存模板
          </Button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.previewArea}>
          <div className={styles.configHint}>
            <AimOutlined /> 点击选中可编辑面板 · 右侧对话添加/修改面板
          </div>
          
          <div className={styles.panelsContainer}>
            {allPanels.map((panel, index) => {
              const isFixed = !!panel.fixed;
              const numeral = chineseNumerals[index] || String(index + 1);
              
              return (
                <DraggableSection
                  key={panel.id}
                  id={panel.id}
                  title={`${numeral}、${panel.title}`}
                  subtitle={panel.description}
                  isConfigMode={true}
                  isFixed={isFixed}
                  isSelected={selectedPanelId === panel.id}
                  onSelect={handlePanelSelect}
                  onDelete={isFixed ? undefined : handleDeletePanel}
                >
                  <div className={styles.panelPlaceholder}>
                    <div className={styles.placeholderIcon}>
                      {panel.type === 'summary_status' && '📊'}
                      {panel.type === 'sla_metrics' && '📈'}
                      {panel.type === 'cluster_metrics' && '🖥️'}
                      {panel.type === 'region_traffic' && '🌐'}
                      {panel.type === 'assessment_action' && '📋'}
                    </div>
                    <div className={styles.placeholderText}>
                      {panel.title}
                      {isFixed && <span className={styles.fixedBadge}>固定</span>}
                    </div>
                  </div>
                </DraggableSection>
              );
            })}
          </div>
        </div>

        <div className={styles.chatPanel}>
          <AIChatPanel
            messages={chatMessages}
            selectedElement={selectedPanelId ? {
              id: selectedPanelId,
              title: allPanels.find(p => p.id === selectedPanelId)?.title || '',
            } : null}
            isTyping={isAiTyping}
            onSendMessage={handleSendMessage}
            onClearSelection={() => setSelectedPanelId(null)}
            isGLM5Enabled={true}
          />
        </div>
      </div>
    </div>
  );
};

export default CustomTemplateConfig;
