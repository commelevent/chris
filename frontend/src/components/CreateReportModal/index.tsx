import React, { useState, useEffect } from 'react';
import { Modal, Steps, Input, Select, Button, Card, message, Spin } from 'antd';
import { FileTextOutlined, RobotOutlined } from '@ant-design/icons';
import { fetchBusinessSystems } from '@/api';
import { BusinessSystem } from '@/types';
import styles from './CreateReportModal.module.scss';

interface CreateReportModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (result: string | CreateReportData) => void;
}

type TemplateType = 'default' | 'custom';

interface CreateReportData {
  systemId: string;
  systemName: string;
  description: string;
  templateType: TemplateType;
}

interface FormData {
  systemId: string;
  systemName: string;
  description: string;
  templateType: TemplateType;
}

const DEFAULT_PANELS = [
  { id: 'panel-summary-status', name: '核心结论与风险', description: 'Overview', fixed: true },
  { id: 'panel-sla-metrics', name: 'SLA 核心指标', description: 'SLA Core Metrics', fixed: false },
  { id: 'panel-cluster-metrics', name: '集群核心指标明细', description: 'Cluster Core Metrics Detail', fixed: false },
  { id: 'panel-region-traffic', name: '云区域流量态势', description: 'Cloud Region Traffic Situational Awareness', fixed: false },
  { id: 'panel-assessment-action', name: '评估与计划', description: 'Assessment & Planning', fixed: true },
];

const CreateReportModal: React.FC<CreateReportModalProps> = ({ visible, onClose, onSuccess }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [systems, setSystems] = useState<BusinessSystem[]>([]);
  const [formData, setFormData] = useState<FormData>({
    systemId: '',
    systemName: '',
    description: '',
    templateType: 'default',
  });

  useEffect(() => {
    if (visible) {
      loadSystems();
    }
  }, [visible]);

  const loadSystems = async () => {
    try {
      setLoading(true);
      const data = await fetchBusinessSystems();
      setSystems(data);
    } catch (error) {
      console.error('Failed to load systems:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSystemSelect = (value: string) => {
    const selected = systems.find(s => s.id === value);
    setFormData(prev => ({
      ...prev,
      systemId: value,
      systemName: selected?.name || '',
      description: selected?.description || '',
    }));
  };

  const handleNext = () => {
    if (currentStep === 0) {
      if (!formData.systemId) {
        message.error('请选择业务系统');
        return;
      }
    }
    setCurrentStep(prev => prev + 1);
  };

  const handlePrev = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    const createData: CreateReportData = {
      systemId: formData.systemId,
      systemName: formData.systemName,
      description: formData.description,
      templateType: formData.templateType,
    };
    handleClose();
    onSuccess(createData);
  };

  const handleClose = () => {
    setCurrentStep(0);
    setFormData({
      systemId: '',
      systemName: '',
      description: '',
      templateType: 'default',
    });
    onClose();
  };

  const renderStep0 = () => (
    <div className={styles.stepContent}>
      <div className={styles.formItem}>
        <label className={styles.label}>选择业务系统 <span className={styles.required}>*</span></label>
        <Select
          placeholder="请选择业务系统"
          value={formData.systemId || undefined}
          onChange={handleSystemSelect}
          className={styles.select}
          showSearch
          filterOption={(input, option) =>
            (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
          }
          options={systems.map(s => ({ value: s.id, label: s.name }))}
        />
      </div>

      <div className={styles.formItem}>
        <label className={styles.label}>业务系统描述</label>
        <Input.TextArea
          placeholder="请输入业务系统描述"
          value={formData.description}
          onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
          className={styles.textarea}
          rows={3}
        />
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className={styles.stepContent}>
      <div className={styles.templateInfo}>
        <div className={styles.systemInfo}>
          <span className={styles.systemLabel}>业务系统：</span>
          <span className={styles.systemValue}>{formData.systemName}</span>
        </div>
      </div>

      <div className={styles.templateOptions}>
        <Card
          className={`${styles.templateCard} ${formData.templateType === 'default' ? styles.selected : ''}`}
          onClick={() => setFormData(prev => ({ ...prev, templateType: 'default' }))}
        >
          <div className={styles.cardHeader}>
            <FileTextOutlined className={styles.cardIcon} />
            <span className={styles.cardTitle}>默认模板</span>
          </div>
          <div className={styles.cardDesc}>
            包含完整的5个面板，适合标准运维报表场景
          </div>
          <div className={styles.panelList}>
            {DEFAULT_PANELS.map(panel => (
              <div key={panel.id} className={styles.panelItem}>
                <span className={styles.panelDot}>•</span>
                <span>{panel.name}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card
          className={`${styles.templateCard} ${formData.templateType === 'custom' ? styles.selected : ''}`}
          onClick={() => setFormData(prev => ({ ...prev, templateType: 'custom' }))}
        >
          <div className={styles.cardHeader}>
            <RobotOutlined className={styles.cardIcon} />
            <span className={styles.cardTitle}>自定义模板</span>
          </div>
          <div className={styles.cardDesc}>
            包含2个固定面板，其他面板通过 GLM-5 智能助手配置
          </div>
          <div className={styles.panelList}>
            <div className={styles.panelItem}>
              <span className={styles.panelDot}>•</span>
              <span>核心结论与风险 <span className={styles.fixedTag}>固定</span></span>
            </div>
            <div className={styles.panelItem}>
              <span className={styles.panelDot}>•</span>
              <span>评估与计划 <span className={styles.fixedTag}>固定</span></span>
            </div>
            <div className={styles.panelItem}>
              <span className={styles.panelDot}>+</span>
              <span className={styles.customHint}>通过 AI 助手添加其他面板</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );

  const steps = [
    { title: '选择业务系统', description: '选择业务系统' },
    { title: '选择模板', description: '默认或自定义模板' },
  ];

  return (
    <Modal
      title="新增报表"
      open={visible}
      onCancel={handleClose}
      width={720}
      footer={null}
      className={styles.modal}
      destroyOnClose
    >
      <Steps current={currentStep} items={steps} className={styles.steps} />

      <Spin spinning={loading}>
        {currentStep === 0 && renderStep0()}
        {currentStep === 1 && renderStep1()}
      </Spin>

      <div className={styles.footer}>
        {currentStep > 0 && (
          <Button onClick={handlePrev}>上一步</Button>
        )}
        {currentStep < steps.length - 1 ? (
          <Button type="primary" onClick={handleNext}>
            下一步
          </Button>
        ) : (
          <Button type="primary" onClick={handleSubmit} loading={loading}>
            开始配置
          </Button>
        )}
      </div>
    </Modal>
  );
};

export default CreateReportModal;
