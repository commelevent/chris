import express from 'express';
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { getSupabase, isDatabaseConnected, setConnectionFailed, testConnection, resetConnection, isUseSupabaseEnabled, setUseSupabaseEnabled, getDataSourceStatus } from '../database/supabase';
import {
  getMockBusinessSystems,
  getMockBusinessSystemById,
  getMockClustersByBusinessSystem,
  getMockDailyReportByDateAndSystem,
  getMockLogMetricsByReport,
  getMockCloudRegionsByReport,
  getMockAssessmentsByReport,
  getMockActionPlansByReport,
  getMockAvailableDates,
  mockData
} from '../database/mockData';

const router = Router();

const WX_CLUSTER_ID = '11111111-1111-1111-1111-111111111111';
const NF_CLUSTER_ID = '22222222-2222-2222-2222-222222222222';
const DEFAULT_BUSINESS_SYSTEM_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const DB_ERROR_RESPONSE = { success: false, error: '数据库连接失败，请检查数据库配置', code: 'DATABASE_ERROR' };

let useMockData = false;

function shouldUseMockData(): boolean {
  if (!isUseSupabaseEnabled()) {
    return true;
  }
  return useMockData || !isDatabaseConnected();
}

async function ensureConnection(): Promise<boolean> {
  if (!isUseSupabaseEnabled()) {
    return false;
  }
  
  if (useMockData) {
    return false;
  }
  
  if (isDatabaseConnected()) {
    return true;
  }
  
  console.log('Attempting to reconnect to database...');
  resetConnection();
  const connected = await testConnection();
  if (!connected) {
    console.log('Database unavailable, switching to mock data mode');
    useMockData = true;
  }
  return connected;
}

router.get('/data-source', async (req: express.Request, res: express.Response) => {
  try {
    const status = getDataSourceStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('Failed to get data source status:', error);
    res.json({ success: true, data: { enabled: false, source: 'mock', connected: false } });
  }
});

router.post('/data-source/toggle', async (req: express.Request, res: express.Response) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'Invalid enabled value, must be boolean' });
    }
    
    setUseSupabaseEnabled(enabled);
    
    if (!enabled) {
      useMockData = true;
    } else {
      useMockData = false;
      resetConnection();
    }
    
    const status = getDataSourceStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('Failed to toggle data source:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle data source' });
  }
});

router.get('/business-systems', async (req: express.Request, res: express.Response) => {
  try {
    if (shouldUseMockData()) {
      const data = getMockBusinessSystems();
      return res.json({ success: true, data });
    }
    
    if (!await ensureConnection()) {
      const data = getMockBusinessSystems();
      return res.json({ success: true, data });
    }
    
    const supabase = getSupabase();
    const { data, error } = await supabase!.from('business_systems').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    
    // 去重：按名称去重，只保留最早创建的记录
    const uniqueData = (data || []).reduce((acc: any[], current: any) => {
      const existing = acc.find(item => item.name === current.name);
      if (!existing) {
        acc.push(current);
      }
      return acc;
    }, []);
    
    res.json({ success: true, data: uniqueData });
  } catch (error) {
    console.error('Failed to fetch business systems:', error);
    setConnectionFailed();
    useMockData = true;
    const data = getMockBusinessSystems();
    res.json({ success: true, data });
  }
});

router.get('/business-systems/overview', async (req: express.Request, res: express.Response) => {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const reportDateStr = yesterday.toISOString().split('T')[0];
    const reportDateTime = `${reportDateStr} 08:00:00`;
    
    if (shouldUseMockData()) {
      const systems = getMockBusinessSystems();
      const overviewData = systems.map(system => {
        const report = getMockDailyReportByDateAndSystem(reportDateStr, system.id);
        const clusters = getMockClustersByBusinessSystem(system.id);
        const wxCluster = clusters.find((c: any) => c.type === 'wx');
        const nfCluster = clusters.find((c: any) => c.type === 'nf');
        
        const systemStatus = report?.system_status || 'normal';
        
        return {
          id: system.id,
          name: system.name,
          code: system.code,
          description: system.description || '',
          status: system.status,
          system_status: systemStatus,
          metrics: [
            {
              label: '主集群 EPS',
              value: report ? `${report.wx_cluster_eps_rate}w` : '-',
              change: '-5.51%',
              trend: 'down'
            },
            {
              label: '备集群 EPS',
              value: report ? `${report.nf_cluster_eps_rate}w` : '-',
              change: '+2.3%',
              trend: 'up'
            }
          ],
          report_date: reportDateTime
        };
      });
      return res.json({ success: true, data: overviewData });
    }
    
    if (!await ensureConnection()) {
      const systems = getMockBusinessSystems();
      const overviewData = systems.map(system => {
        const report = getMockDailyReportByDateAndSystem(reportDateStr, system.id);
        
        const systemStatus = report?.system_status || 'normal';
        
        return {
          id: system.id,
          name: system.name,
          code: system.code,
          description: system.description || '',
          status: system.status,
          system_status: systemStatus,
          metrics: [
            {
              label: '主集群 EPS',
              value: report ? `${report.wx_cluster_eps_rate}w` : '-',
              change: '-5.51%',
              trend: 'down'
            },
            {
              label: '备集群 EPS',
              value: report ? `${report.nf_cluster_eps_rate}w` : '-',
              change: '+2.3%',
              trend: 'up'
            }
          ],
          report_date: reportDateTime
        };
      });
      return res.json({ success: true, data: overviewData });
    }
    
    const supabase = getSupabase();
    
    const { data: systems, error: systemsError } = await supabase!
      .from('business_systems')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (systemsError) throw systemsError;
    
    const { data: reports } = await supabase!
      .from('daily_reports')
      .select('*')
      .eq('report_date', reportDateStr);
    
    const overviewData = (systems || []).map(system => {
      const report = (reports || []).find(r => r.business_system_id === system.id);
      const systemStatus = report?.system_status || 'normal';
      
      return {
        id: system.id,
        name: system.name,
        code: system.code,
        description: system.description || '',
        status: system.status,
        system_status: systemStatus,
        metrics: [
          {
            label: '主集群 EPS',
            value: report?.wx_cluster_eps_rate ? `${report.wx_cluster_eps_rate}w` : '-',
            change: '-5.51%',
            trend: 'down'
          },
          {
            label: '备集群 EPS',
            value: report?.nf_cluster_eps_rate ? `${report.nf_cluster_eps_rate}w` : '-',
            change: '+2.3%',
            trend: 'up'
          }
        ],
        report_date: reportDateTime
      };
    });
    
    res.json({ success: true, data: overviewData });
  } catch (error) {
    console.error('Failed to fetch business systems overview:', error);
    setConnectionFailed();
    useMockData = true;
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const reportDate = yesterday.toISOString().split('T')[0];
    const reportDateTime = `${reportDate} 08:00:00`;
    
    const systems = getMockBusinessSystems();
    const overviewData = systems.map(system => {
      const report = getMockDailyReportByDateAndSystem(reportDate, system.id);
      const systemStatus = report?.system_status || 'normal';
      
      return {
        id: system.id,
        name: system.name,
        code: system.code,
        description: system.description || '',
        status: system.status,
        system_status: systemStatus,
        metrics: [
          {
            label: '主集群 EPS',
            value: report ? `${report.wx_cluster_eps_rate}w` : '-',
            change: '-5.51%',
            trend: 'down'
          },
          {
            label: '备集群 EPS',
            value: report ? `${report.nf_cluster_eps_rate}w` : '-',
            change: '+2.3%',
            trend: 'up'
          }
        ],
        report_date: reportDateTime
      };
    });
    res.json({ success: true, data: overviewData });
  }
});

router.get('/business-systems/:id', async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    
    if (shouldUseMockData()) {
      const data = getMockBusinessSystemById(id);
      if (!data) {
        return res.status(404).json({ success: false, error: 'Business system not found' });
      }
      return res.json({ success: true, data });
    }
    
    if (!await ensureConnection()) {
      const data = getMockBusinessSystemById(id);
      if (!data) {
        return res.status(404).json({ success: false, error: 'Business system not found' });
      }
      return res.json({ success: true, data });
    }
    
    const supabase = getSupabase();
    const { data, error } = await supabase!.from('business_systems').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) {
      return res.status(404).json({ success: false, error: 'Business system not found' });
    }
    res.json({ success: true, data });
  } catch (error) {
    console.error('Failed to fetch business system:', error);
    setConnectionFailed();
    useMockData = true;
    const data = getMockBusinessSystemById(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, error: 'Business system not found' });
    }
    res.json({ success: true, data });
  }
});

router.delete('/business-systems/:id', async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    
    if (shouldUseMockData()) {
      const index = mockData.businessSystems.findIndex((s: any) => s.id === id);
      if (index === -1) {
        return res.status(404).json({ success: false, error: '报表不存在' });
      }
      mockData.businessSystems.splice(index, 1);
      return res.json({ success: true, message: '删除成功' });
    }
    
    if (!await ensureConnection()) {
      const index = mockData.businessSystems.findIndex((s: any) => s.id === id);
      if (index === -1) {
        return res.status(404).json({ success: false, error: '报表不存在' });
      }
      mockData.businessSystems.splice(index, 1);
      return res.json({ success: true, message: '删除成功' });
    }
    
    const supabase = getSupabase();
    
    const { error: deleteClustersError } = await supabase!
      .from('clusters')
      .delete()
      .eq('business_system_id', id);
    if (deleteClustersError) {
      console.error('Failed to delete clusters:', deleteClustersError);
    }
    
    const { error: deleteReportsError } = await supabase!
      .from('daily_reports')
      .delete()
      .eq('business_system_id', id);
    if (deleteReportsError) {
      console.error('Failed to delete reports:', deleteReportsError);
    }
    
    const { error, count } = await supabase!
      .from('business_systems')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('Failed to delete business system:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '删除失败' 
    });
  }
});

router.get('/clusters', async (req: express.Request, res: express.Response) => {
  try {
    const { businessSystemId } = req.query;
    
    if (shouldUseMockData()) {
      const data = businessSystemId 
        ? getMockClustersByBusinessSystem(businessSystemId as string)
        : mockData.clusters;
      return res.json({ success: true, data });
    }
    
    if (!await ensureConnection()) {
      const data = businessSystemId 
        ? getMockClustersByBusinessSystem(businessSystemId as string)
        : mockData.clusters;
      return res.json({ success: true, data });
    }
    
    const supabase = getSupabase();
    let query = supabase!.from('clusters').select('*');
    if (businessSystemId && typeof businessSystemId === 'string') {
      query = query.eq('business_system_id', businessSystemId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Failed to fetch clusters:', error);
    setConnectionFailed();
    useMockData = true;
    const data = req.query.businessSystemId 
      ? getMockClustersByBusinessSystem(req.query.businessSystemId as string)
      : mockData.clusters;
    res.json({ success: true, data });
  }
});

router.get('/metrics/:clusterId', async (req: express.Request, res: express.Response) => {
  try {
    const { clusterId } = req.params;
    const { date } = req.query;
    const reportDate = typeof date === 'string' ? date : new Date().toISOString().split('T')[0];
    
    if (shouldUseMockData() || !await ensureConnection()) {
      const cluster = mockData.clusters.find(c => c.id === clusterId);
      if (!cluster) {
        return res.json({ success: true, data: [] });
      }
      const report = getMockDailyReportByDateAndSystem(reportDate, cluster.business_system_id);
      if (!report) {
        return res.json({ success: true, data: [] });
      }
      const data = getMockLogMetricsByReport(report.id);
      return res.json({ success: true, data });
    }
    
    const supabase = getSupabase();
    const { data, error } = await supabase!.from('log_metrics').select('*').eq('cluster_id', clusterId).eq('report_date', reportDate);
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Failed to fetch metrics:', error);
    setConnectionFailed();
    res.json({ success: true, data: [] });
  }
});

router.get('/regions', async (req: express.Request, res: express.Response) => {
  try {
    const { date, businessSystemId } = req.query;
    const reportDate = typeof date === 'string' ? date : new Date().toISOString().split('T')[0];
    
    if (shouldUseMockData() || !await ensureConnection()) {
      return res.json({ success: true, data: [] });
    }
    
    const supabase = getSupabase();
    let query = supabase!.from('cloud_regions').select('*, clusters!inner(*)').eq('report_date', reportDate);
    if (businessSystemId && typeof businessSystemId === 'string') {
      query = query.eq('clusters.business_system_id', businessSystemId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Failed to fetch regions:', error);
    setConnectionFailed();
    res.json({ success: true, data: [] });
  }
});

router.get('/dashboard/summary', async (req: express.Request, res: express.Response) => {
  try {
    const { date, businessSystemId } = req.query;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const reportDate = typeof date === 'string' ? date : yesterday.toISOString().split('T')[0];
    const bsId = businessSystemId && typeof businessSystemId === 'string' ? businessSystemId : DEFAULT_BUSINESS_SYSTEM_ID;
    
    if (shouldUseMockData() || !await ensureConnection()) {
      const report = getMockDailyReportByDateAndSystem(reportDate, bsId);
      const clusters = getMockClustersByBusinessSystem(bsId);
      const wxCluster = clusters.find((c: any) => c.type === 'wx') || clusters[0];
      const nfCluster = clusters.find((c: any) => c.type === 'nf') || clusters[1];
      
      const reportId = report?.id || `mock-${bsId}-${reportDate}`;
      const allMetrics = getMockLogMetricsByReport(reportId);
      const wxClusterId = wxCluster?.id;
      const nfClusterId = nfCluster?.id;
      const wxMetrics = allMetrics.filter((m: any) => m.cluster_id === wxClusterId);
      const nfMetrics = allMetrics.filter((m: any) => m.cluster_id === nfClusterId);
      
      const allRegions = getMockCloudRegionsByReport(reportId);
      const topRegions = allRegions.slice(0, 5).map((r: any) => ({
        ...r,
        cluster_name: r.cluster_id === wxClusterId ? wxCluster?.name : nfCluster?.name,
        cluster_type: r.cluster_id === wxClusterId ? 'wx' : 'nf'
      }));
      
      const assessments = getMockAssessmentsByReport(reportId);
      const actionPlans = getMockActionPlansByReport(reportId);
      
      const slaMetrics = allMetrics.filter((m: any) => 
        ['平均搜索耗时', 'CPU使用率', '日志入库耗时', '监控延迟'].includes(m.metric_name)
      ).map((m: any) => ({ ...m, cluster_name: m.cluster_id === wxClusterId ? wxCluster?.name : nfCluster?.name }));
      
      return res.json({
        success: true,
        data: {
          report,
          wxCluster,
          nfCluster,
          wxMetrics,
          nfMetrics,
          slaMetrics,
          topRegions,
          regionStats: { 
            total_regions: allRegions.length, 
            nf_regions: allRegions.filter((r: any) => r.cluster_id === nfClusterId).length, 
            wx_regions: allRegions.filter((r: any) => r.cluster_id === wxClusterId).length, 
            avg_traffic: allRegions.length > 0 ? allRegions.reduce((sum: number, r: any) => sum + (r.current_traffic || 0), 0) / allRegions.length : 0
          },
          assessments,
          actionPlans,
        },
      });
    }
    
    const supabase = getSupabase();

    const { data: report } = await supabase!.from('daily_reports').select('*').eq('report_date', reportDate).eq('business_system_id', bsId).maybeSingle();
    const { data: clusters } = await supabase!.from('clusters').select('*').eq('business_system_id', bsId);
    
    const wxCluster = clusters?.find((c: any) => c.type === 'wx') || { id: WX_CLUSTER_ID, name: '威新集群', name_en: 'WX CLUSTER', type: 'wx' };
    const nfCluster = clusters?.find((c: any) => c.type === 'nf') || { id: NF_CLUSTER_ID, name: '南方集群', name_en: 'NF CLUSTER', type: 'nf' };
    const wxClusterId = wxCluster?.id || WX_CLUSTER_ID;
    const nfClusterId = nfCluster?.id || NF_CLUSTER_ID;
    const reportId = report?.id;
    
    const { data: wxMetrics } = await supabase!.from('log_metrics').select('*').eq('cluster_id', wxClusterId).eq('report_date', reportDate);
    const { data: nfMetrics } = await supabase!.from('log_metrics').select('*').eq('cluster_id', nfClusterId).eq('report_date', reportDate);
    
    const clusterIds = clusters?.map((c: any) => c.id) || [];
    const { data: slaMetricsRaw } = await supabase!.from('log_metrics').select('*, clusters(name)').in('metric_name', ['平均搜索耗时', 'CPU使用率', '日志入库耗时', '监控延迟']).eq('report_date', reportDate).in('cluster_id', clusterIds.length > 0 ? clusterIds : [WX_CLUSTER_ID, NF_CLUSTER_ID]).order('metric_name', { ascending: true });
    
    const { data: topRegionsRaw } = await supabase!.from('cloud_regions').select('*, clusters(name, type)').eq('report_date', reportDate).in('cluster_id', clusterIds.length > 0 ? clusterIds : [WX_CLUSTER_ID, NF_CLUSTER_ID]).order('current_traffic', { ascending: false }).limit(5);
    const { data: avgData } = await supabase!.from('cloud_regions').select('current_traffic').eq('report_date', reportDate).in('cluster_id', clusterIds.length > 0 ? clusterIds : [WX_CLUSTER_ID, NF_CLUSTER_ID]);
    const { count: total_regions } = await supabase!.from('cloud_regions').select('*', { count: 'exact', head: true }).eq('report_date', reportDate).in('cluster_id', clusterIds.length > 0 ? clusterIds : [WX_CLUSTER_ID, NF_CLUSTER_ID]);
    const { count: nf_regions } = await supabase!.from('cloud_regions').select('*', { count: 'exact', head: true }).eq('cluster_id', nfClusterId).eq('report_date', reportDate);
    const { count: wx_regions } = await supabase!.from('cloud_regions').select('*', { count: 'exact', head: true }).eq('cluster_id', wxClusterId).eq('report_date', reportDate);
    
    let assessments: any[] = [];
    let actionPlans: any[] = [];
    if (reportId) {
      const { data: assessmentsData } = await supabase!.from('assessments').select('*').eq('report_id', reportId);
      const { data: actionPlansRaw } = await supabase!.from('action_plans').select('*').eq('report_id', reportId);
      assessments = assessmentsData || [];
      actionPlans = actionPlansRaw?.map((p: any) => ({ ...p, items: typeof p.items === 'string' ? JSON.parse(p.items) : p.items })) || [];
    }

    const slaMetrics = slaMetricsRaw?.map((m: any) => ({ ...m, cluster_name: m.clusters?.name })) || [];
    const topRegions = topRegionsRaw?.map((r: any) => ({ ...r, cluster_name: r.clusters?.name, cluster_type: r.clusters?.type })) || [];
    const avg_traffic = avgData && avgData.length > 0 ? avgData.reduce((sum: number, r: any) => sum + (r.current_traffic || 0), 0) / avgData.length : 0;

    res.json({
      success: true,
      data: {
        report,
        wxCluster,
        nfCluster,
        wxMetrics: wxMetrics || [],
        nfMetrics: nfMetrics || [],
        slaMetrics,
        topRegions,
        regionStats: { total_regions: total_regions || 0, nf_regions: nf_regions || 0, wx_regions: wx_regions || 0, avg_traffic },
        assessments,
        actionPlans,
      },
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    setConnectionFailed();
    useMockData = true;
    
    const { date, businessSystemId } = req.query;
    const reportDate = typeof date === 'string' ? date : new Date().toISOString().split('T')[0];
    const bsId = businessSystemId && typeof businessSystemId === 'string' ? businessSystemId : DEFAULT_BUSINESS_SYSTEM_ID;
    
    const report = getMockDailyReportByDateAndSystem(reportDate, bsId);
    const clusters = getMockClustersByBusinessSystem(bsId);
    const wxCluster = clusters[0];
    const nfCluster = clusters[1];
    const reportId = report?.id || `${bsId}-${reportDate}`;
    
    res.json({
      success: true,
      data: {
        report,
        wxCluster,
        nfCluster,
        wxMetrics: getMockLogMetricsByReport(reportId),
        nfMetrics: getMockLogMetricsByReport(reportId),
        slaMetrics: [],
        topRegions: [],
        regionStats: { total_regions: 0, nf_regions: 0, wx_regions: 0, avg_traffic: 0 },
        assessments: getMockAssessmentsByReport(reportId),
        actionPlans: getMockActionPlansByReport(reportId),
      },
    });
  }
});

router.get('/available-dates', async (req: express.Request, res: express.Response) => {
  try {
    const { businessSystemId } = req.query;
    
    if (shouldUseMockData() || !await ensureConnection()) {
      const dates = getMockAvailableDates(businessSystemId as string || DEFAULT_BUSINESS_SYSTEM_ID);
      const data = dates.map(date => ({ report_date: date, system_status: 'normal' }));
      return res.json({ success: true, data });
    }
    
    const supabase = getSupabase();
    let query = supabase!.from('daily_reports').select('report_date, system_status').order('report_date', { ascending: false });
    if (businessSystemId && typeof businessSystemId === 'string') {
      query = query.eq('business_system_id', businessSystemId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Failed to fetch available dates:', error);
    setConnectionFailed();
    useMockData = true;
    const dates = getMockAvailableDates(req.query.businessSystemId as string || DEFAULT_BUSINESS_SYSTEM_ID);
    const data = dates.map(date => ({ report_date: date, system_status: 'normal' }));
    res.json({ success: true, data });
  }
});

router.get('/report-detail/:systemId', async (req: express.Request, res: express.Response) => {
  try {
    const { systemId } = req.params;
    const { date } = req.query;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const reportDate = typeof date === 'string' ? date : yesterday.toISOString().split('T')[0];
    
    if (shouldUseMockData() || !await ensureConnection()) {
      const system = getMockBusinessSystemById(systemId);
      if (!system) {
        return res.status(404).json({ success: false, error: 'System not found' });
      }
      return res.json({ success: true, data: { system, metrics: [], clusters: [] } });
    }
    
    const supabase = getSupabase();
    
    const { data: system, error: systemError } = await supabase!.from('business_systems').select('*').eq('id', systemId).maybeSingle();
    if (systemError) throw systemError;
    if (!system) {
      return res.status(404).json({ success: false, error: 'System not found' });
    }
    
    const { data: clusters } = await supabase!.from('clusters').select('*').eq('business_system_id', systemId);
    const clusterIds = clusters?.map(c => c.id) || [];
    
    const { data: logMetrics } = await supabase!.from('log_metrics')
      .select('*')
      .in('cluster_id', clusterIds.length > 0 ? clusterIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('report_date', reportDate);
    
    const { data: dailyReport } = await supabase!.from('daily_reports')
      .select('*')
      .eq('business_system_id', systemId)
      .eq('report_date', reportDate)
      .maybeSingle();
    
    const aggregatedMetrics: { [key: string]: { values: number[], changeRates: number[] } } = {};
    
    (logMetrics || []).forEach(m => {
      if (!aggregatedMetrics[m.metric_name]) {
        aggregatedMetrics[m.metric_name] = { values: [], changeRates: [] };
      }
      aggregatedMetrics[m.metric_name].values.push(m.today_avg || 0);
      aggregatedMetrics[m.metric_name].changeRates.push(m.change_rate || 0);
    });
    
    const metrics: any[] = [];
    
    const primaryMetricMap: { [key: string]: string } = {
      'unified-log': '请求量',
      'payment-center': '交易量',
      'order-system': '订单量',
    };
    const primaryMetricName = primaryMetricMap[system.code] || '请求量';
    
    if (aggregatedMetrics[primaryMetricName]) {
      const data = aggregatedMetrics[primaryMetricName];
      const avgValue = data.values.reduce((a, b) => a + b, 0);
      const avgChange = data.changeRates.reduce((a, b) => a + b, 0) / data.changeRates.length;
      metrics.push({
        label: primaryMetricName,
        value: Math.round(avgValue).toLocaleString(),
        change: `${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(1)}%`,
        trend: avgChange >= 0 ? 'up' : 'down',
      });
    }
    
    ['响应时间', 'CPU使用率', '内存使用率'].forEach(metricName => {
      if (aggregatedMetrics[metricName]) {
        const data = aggregatedMetrics[metricName];
        const avgValue = data.values.reduce((a, b) => a + b, 0) / data.values.length;
        const avgChange = data.changeRates.reduce((a, b) => a + b, 0) / data.changeRates.length;
        metrics.push({
          label: metricName,
          value: metricName === '响应时间' ? `${avgValue.toFixed(1)}ms` : `${avgValue.toFixed(1)}%`,
          change: `${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(1)}%`,
          trend: avgChange >= 0 ? 'up' : 'down',
        });
      }
    });
    
    const reportTimeMap: Record<string, string> = {
      'unified-log': '08:00:00',
      'payment-center': '08:10:00',
      'order-system': '08:30:00',
    };
    const reportTime = reportTimeMap[system.code] || '08:00:00';
    
    res.json({
      success: true,
      data: {
        system,
        metrics,
        clusters: clusters || [],
        dailyReport,
        reportDate: reportDate + ' ' + reportTime,
      },
    });
  } catch (error) {
    console.error('Failed to fetch report detail:', error);
    setConnectionFailed();
    useMockData = true;
    const system = getMockBusinessSystemById(req.params.systemId);
    if (!system) {
      return res.status(404).json({ success: false, error: 'System not found' });
    }
    res.json({ success: true, data: { system, metrics: [], clusters: [] } });
  }
});

router.get('/business-systems-overview', async (req: express.Request, res: express.Response) => {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const reportDate = yesterday.toISOString().split('T')[0];
    
    if (shouldUseMockData() || !await ensureConnection()) {
      const systems = getMockBusinessSystems();
      const overviewData = systems.map(system => {
        const report = getMockDailyReportByDateAndSystem(reportDate, system.id);
        const reportId = report?.id || `mock-${system.id}-${reportDate}`;
        const allMetrics = getMockLogMetricsByReport(reportId);
        
        const primaryMetricMap: Record<string, string> = {
          'unified-log': '请求量',
          'payment-center': '交易量',
          'order-system': '订单量',
        };
        const primaryMetricName = primaryMetricMap[system.code] || '请求量';
        
        const metrics: any[] = [];
        
        const primaryMetrics = allMetrics.filter(m => m.metric_name === primaryMetricName);
        if (primaryMetrics.length > 0) {
          const totalAvg = primaryMetrics.reduce((sum, m) => sum + (m.today_avg || 0), 0);
          const avgChangeRate = primaryMetrics.reduce((sum, m) => sum + (m.change_rate || 0), 0) / primaryMetrics.length;
          metrics.push({
            label: primaryMetricName,
            value: Math.round(totalAvg).toLocaleString(),
            change: `${avgChangeRate >= 0 ? '+' : ''}${avgChangeRate.toFixed(1)}%`,
            trend: avgChangeRate >= 0 ? 'up' : 'down',
          });
        }
        
        ['响应时间', 'CPU使用率', '内存使用率'].forEach(metricName => {
          const vals = allMetrics.filter(m => m.metric_name === metricName);
          if (vals.length > 0) {
            const avgValue = vals.reduce((sum, m) => sum + (m.today_avg || 0), 0) / vals.length;
            const avgChangeRate = vals.reduce((sum, m) => sum + (m.change_rate || 0), 0) / vals.length;
            metrics.push({
              label: metricName,
              value: metricName === '响应时间' ? `${avgValue.toFixed(1)}ms` : `${avgValue.toFixed(1)}%`,
              change: `${avgChangeRate >= 0 ? '+' : ''}${avgChangeRate.toFixed(1)}%`,
              trend: avgChangeRate >= 0 ? 'up' : 'down',
            });
          }
        });
        
        if (metrics.length === 0) {
          metrics.push(
            { label: '请求量', value: '0', change: '+0.0%', trend: 'neutral' },
            { label: '响应时间', value: '0ms', change: '+0.0%', trend: 'neutral' },
            { label: 'CPU使用率', value: '0%', change: '+0.0%', trend: 'neutral' },
            { label: '内存使用率', value: '0%', change: '+0.0%', trend: 'neutral' },
          );
        }
        
        const reportTimeMap: Record<string, string> = {
          'unified-log': '08:00:00',
          'payment-center': '08:10:00',
          'order-system': '08:30:00',
        };
        
        return {
          id: system.id,
          name: system.name,
          code: system.code,
          description: system.description,
          status: system.status,
          metrics,
          report_date: reportDate + ' ' + (reportTimeMap[system.code] || '08:00:00'),
        };
      });
      return res.json({ success: true, data: overviewData });
    }
    
    const supabase = getSupabase();
    
    const { data: systems } = await supabase!.from('business_systems').select('*').order('created_at', { ascending: true });
    
    const overviewData = await Promise.all((systems || []).map(async (system) => {
      const { data: clusters } = await supabase!.from('clusters').select('id').eq('business_system_id', system.id);
      const clusterIds = clusters?.map(c => c.id) || [];
      
      let metrics: any[] = [];
      if (clusterIds.length > 0) {
        const { data: logMetrics } = await supabase!.from('log_metrics')
          .select('*')
          .in('cluster_id', clusterIds)
          .eq('report_date', reportDate)
          .in('metric_name', ['请求量', '交易量', '订单量', '响应时间', 'CPU使用率', '内存使用率']);
        
        if (logMetrics && logMetrics.length > 0) {
          const metricMap = new Map<string, any[]>();
          logMetrics.forEach(m => {
            if (!metricMap.has(m.metric_name)) {
              metricMap.set(m.metric_name, []);
            }
            metricMap.get(m.metric_name)!.push(m);
          });
          
          const getMetricLabel = (code: string, metricName: string) => {
            if (metricName === '交易量') return '交易量';
            if (metricName === '订单量') return '订单量';
            if (metricName === '请求量') return '请求量';
            return metricName;
          };
          
          const primaryMetrics = ['请求量', '交易量', '订单量'];
          const primaryMetric = primaryMetrics.find(name => metricMap.has(name));
          
          if (primaryMetric && metricMap.has(primaryMetric)) {
            const vals = metricMap.get(primaryMetric)!;
            const totalAvg = vals.reduce((sum, m) => sum + (m.today_avg || 0), 0);
            const avgChangeRate = vals.reduce((sum, m) => sum + (m.change_rate || 0), 0) / vals.length;
            metrics.push({
              label: getMetricLabel(system.code, primaryMetric),
              value: Math.round(totalAvg).toLocaleString(),
              change: `${avgChangeRate >= 0 ? '+' : ''}${avgChangeRate.toFixed(1)}%`,
              trend: avgChangeRate >= 0 ? 'up' : 'down',
            });
          }
          
          ['响应时间', 'CPU使用率', '内存使用率'].forEach(metricName => {
            if (metricMap.has(metricName)) {
              const vals = metricMap.get(metricName)!;
              const avgValue = vals.reduce((sum, m) => sum + (m.today_avg || 0), 0) / vals.length;
              const avgChangeRate = vals.reduce((sum, m) => sum + (m.change_rate || 0), 0) / vals.length;
              metrics.push({
                label: metricName,
                value: metricName === '响应时间' ? `${avgValue.toFixed(1)}ms` : `${avgValue.toFixed(1)}%`,
                change: `${avgChangeRate >= 0 ? '+' : ''}${avgChangeRate.toFixed(1)}%`,
                trend: avgChangeRate >= 0 ? 'up' : 'down',
              });
            }
          });
        }
      }
      
      if (metrics.length === 0) {
        metrics = [
          { label: '请求量', value: '0', change: '+0.0%', trend: 'neutral' },
          { label: '响应时间', value: '0ms', change: '+0.0%', trend: 'neutral' },
          { label: 'CPU使用率', value: '0%', change: '+0.0%', trend: 'neutral' },
          { label: '内存使用率', value: '0%', change: '+0.0%', trend: 'neutral' },
        ];
      }
      
      const reportTimeMap: Record<string, string> = {
        'unified-log': '08:00:00',
        'payment-center': '08:10:00',
        'order-system': '08:30:00',
      };
      const reportTime = reportTimeMap[system.code] || '08:00:00';
      
      return {
        id: system.id,
        name: system.name,
        code: system.code,
        description: system.description,
        status: system.status,
        metrics,
        report_date: reportDate + ' ' + reportTime,
      };
    }));
    
    res.json({ success: true, data: overviewData });
  } catch (error) {
    console.error('Failed to fetch business systems overview:', error);
    setConnectionFailed();
    useMockData = true;
    const systems = getMockBusinessSystems();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const reportDate = yesterday.toISOString().split('T')[0];
    const reportTimeMap: Record<string, string> = {
      'unified-log': '08:00:00',
      'payment-center': '08:10:00',
      'order-system': '08:30:00',
    };
    const overviewData = systems.map(system => ({
      id: system.id,
      name: system.name,
      code: system.code,
      description: system.description,
      status: system.status,
      metrics: [
        { label: '请求量', value: '0', change: '+0.0%', trend: 'neutral' },
        { label: '响应时间', value: '0ms', change: '+0.0%', trend: 'neutral' },
        { label: 'CPU使用率', value: '0%', change: '+0.0%', trend: 'neutral' },
        { label: '内存使用率', value: '0%', change: '+0.0%', trend: 'neutral' },
      ],
      report_date: reportDate + ' ' + (reportTimeMap[system.code] || '08:00:00'),
    }));
    res.json({ success: true, data: overviewData });
  }
});

router.get('/assessments', async (req, res) => {
  try {
    const { reportId } = req.query;
    
    if (shouldUseMockData()) {
      const assessments = reportId 
        ? getMockAssessmentsByReport(reportId as string)
        : mockData.assessments;
      return res.json({ success: true, data: assessments });
    }
    
    if (!await ensureConnection()) {
      const assessments = reportId 
        ? getMockAssessmentsByReport(reportId as string)
        : mockData.assessments;
      return res.json({ success: true, data: assessments });
    }
    
    const supabaseClient = getSupabase();
    let query = supabaseClient!.from('assessments').select('*');
    if (reportId) {
      query = query.eq('report_id', reportId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Supabase error:', error);
      setConnectionFailed();
      useMockData = true;
      const assessments = reportId 
        ? getMockAssessmentsByReport(reportId as string)
        : mockData.assessments;
      return res.json({ success: true, data: assessments });
    }
    
    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Failed to fetch assessments:', error);
    setConnectionFailed();
    useMockData = true;
    const assessments = req.query.reportId 
      ? getMockAssessmentsByReport(req.query.reportId as string)
      : mockData.assessments;
    res.json({ success: true, data: assessments });
  }
});

router.get('/action-plans', async (req, res) => {
  try {
    const { reportId } = req.query;
    
    if (shouldUseMockData()) {
      const actionPlans = reportId 
        ? getMockActionPlansByReport(reportId as string)
        : mockData.actionPlans;
      return res.json({ success: true, data: actionPlans });
    }
    
    if (!await ensureConnection()) {
      const actionPlans = reportId 
        ? getMockActionPlansByReport(reportId as string)
        : mockData.actionPlans;
      return res.json({ success: true, data: actionPlans });
    }
    
    const supabaseClient = getSupabase();
    let query = supabaseClient!.from('action_plans').select('*');
    if (reportId) {
      query = query.eq('report_id', reportId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Supabase error:', error);
      setConnectionFailed();
      useMockData = true;
      const actionPlans = reportId 
        ? getMockActionPlansByReport(reportId as string)
        : mockData.actionPlans;
      return res.json({ success: true, data: actionPlans });
    }
    
    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Failed to fetch action plans:', error);
    setConnectionFailed();
    useMockData = true;
    const actionPlans = req.query.reportId 
      ? getMockActionPlansByReport(req.query.reportId as string)
      : mockData.actionPlans;
    res.json({ success: true, data: actionPlans });
  }
});

router.get('/export/:systemId', async (req: express.Request, res: express.Response) => {
  try {
    const { systemId } = req.params;
    
    const DEFAULT_PANELS = [
      {
        id: 'panel-summary-status',
        type: 'summary_status',
        title: '核心结论与风险',
        description: 'Overview',
        datasource: {
          type: 'api',
          uid: 'panel-api',
          endpoint: '/api/panel/summary',
          method: 'GET',
          params: { date: '${date}', systemId: '${systemId}' }
        },
        gridPos: { x: 0, y: 0, w: 24, h: 6 },
        fieldConfig: {
          defaults: {
            unit: 'none',
            thresholds: {
              mode: 'absolute',
              steps: [
                { color: 'green', value: null },
                { color: 'yellow', value: 0.7 },
                { color: 'red', value: 0.9 }
              ]
            }
          }
        },
        options: {
          showInsight: true,
          showClusterInfo: true
        }
      },
      {
        id: 'panel-sla-metrics',
        type: 'sla_metrics',
        title: 'SLA 核心指标',
        description: 'SLA Core Metrics',
        datasource: {
          type: 'api',
          uid: 'panel-api',
          endpoint: '/api/panel/sla-metrics',
          method: 'GET',
          params: { date: '${date}', systemId: '${systemId}' }
        },
        gridPos: { x: 0, y: 6, w: 24, h: 8 },
        fieldConfig: {
          defaults: {
            unit: 'percent',
            thresholds: {
              mode: 'absolute',
              steps: [
                { color: 'green', value: null },
                { color: 'yellow', value: 80 },
                { color: 'red', value: 95 }
              ]
            }
          }
        },
        options: {
          showHealthStatus: true,
          showThreshold: true
        }
      },
      {
        id: 'panel-cluster-metrics',
        type: 'cluster_metrics',
        title: '集群核心指标明细',
        description: 'Cluster Core Metrics Detail',
        datasource: {
          type: 'api',
          uid: 'panel-api',
          endpoint: '/api/panel/cluster-metrics',
          method: 'GET',
          params: { date: '${date}', systemId: '${systemId}' }
        },
        gridPos: { x: 0, y: 14, w: 24, h: 10 },
        fieldConfig: {
          defaults: {
            unit: 'short',
            custom: {
              align: 'left'
            }
          }
        },
        options: {
          showTrend: true,
          clusterTabs: ['wx', 'nf']
        }
      },
      {
        id: 'panel-region-traffic',
        type: 'region_traffic',
        title: '云区域流量态势',
        description: 'Cloud Region Traffic Situational Awareness',
        datasource: {
          type: 'api',
          uid: 'panel-api',
          endpoint: '/api/panel/region-traffic',
          method: 'GET',
          params: { date: '${date}', systemId: '${systemId}' }
        },
        gridPos: { x: 0, y: 24, w: 24, h: 8 },
        fieldConfig: {
          defaults: {
            unit: 'short'
          }
        },
        options: {
          showTopRegions: 5,
          clusterTabs: ['wx', 'nf']
        }
      },
      {
        id: 'panel-assessment-action',
        type: 'assessment_action',
        title: '评估与计划',
        description: 'Assessment & Planning',
        datasource: {
          type: 'api',
          uid: 'panel-api',
          endpoints: {
            assessment: {
              type: 'api',
              endpoint: '/api/panel/assessment',
              method: 'GET',
              params: { reportId: '${reportId}' }
            },
            actionPlan: {
              type: 'api',
              endpoint: '/api/panel/action-plan',
              method: 'GET',
              params: { reportId: '${reportId}' }
            }
          }
        },
        gridPos: { x: 0, y: 32, w: 24, h: 10 },
        options: {
          showInsight: true,
          showPriority: true
        }
      }
    ];
    
    const buildExportData = (system: any, clusters: any[], savedPanels?: any[]) => {
      const wxCluster = clusters.find((c: any) => c.type === 'wx') || null;
      const nfCluster = clusters.find((c: any) => c.type === 'nf') || null;
      
      const panels = savedPanels && savedPanels.length > 0 ? savedPanels : DEFAULT_PANELS;
      
      const originalUid = system?.datasource_reference?.original_uid || system.id;
      
      return {
        uid: originalUid,
        datasource: {
          type: 'supabase',
          uid: originalUid,
        },
        title: system.name,
        description: system.description || '',
        tags: ['运维报表', '日志分析', system.code],
        style: 'dark',
        timezone: 'browser',
        editable: true,
        graphTooltip: 1,
        refresh: '1d',
        time: {
          from: 'now-24h',
          to: 'now'
        },
        timepicker: {
          refresh_intervals: ['5m', '15m', '30m', '1h', '2h', '1d'],
          nowDelay: '1m'
        },
        templating: {
          list: [
            {
              name: 'date',
              type: 'custom',
              label: '报表日期',
              current: {
                value: new Date().toISOString().split('T')[0],
                text: new Date().toISOString().split('T')[0]
              },
              options: []
            },
            {
              name: 'systemId',
              type: 'custom',
              label: '系统ID',
              current: {
                value: originalUid,
                text: system.name
              },
              options: []
            },
            {
              name: 'reportId',
              type: 'custom',
              label: '报表ID',
              current: {
                value: '${systemId}-${date}',
                text: '动态生成'
              },
              options: []
            }
          ]
        },
        annotations: {
          list: []
        },
        links: [],
        panels: panels,
        clusters: {
          wx_cluster: wxCluster ? { 
            name: wxCluster.name, 
            name_en: wxCluster.name_en, 
            type: wxCluster.type,
            description: '主要生产集群'
          } : null,
          nf_cluster: nfCluster ? { 
            name: nfCluster.name, 
            name_en: nfCluster.name_en, 
            type: nfCluster.type,
            description: '备用生产集群'
          } : null
        },
        version: 1,
        schemaVersion: 36
      };
    };
    
    if (shouldUseMockData() || !await ensureConnection()) {
      const system = getMockBusinessSystemById(systemId);
      if (!system) {
        return res.status(404).json({ success: false, error: 'Business system not found' });
      }
      
      const clusters = getMockClustersByBusinessSystem(systemId);
      const savedPanels = system?.datasource_reference?.panels;
      const exportData = buildExportData(system, clusters, savedPanels);
      
      return res.json({ success: true, data: exportData });
    }
    
    const supabase = getSupabase();
    
    const { data: system, error: systemError } = await supabase!.from('business_systems').select('*').eq('id', systemId).maybeSingle();
    if (systemError) throw systemError;
    if (!system) {
      return res.status(404).json({ success: false, error: 'Business system not found' });
    }
    
    const { data: clusters } = await supabase!.from('clusters').select('*').eq('business_system_id', systemId);
    
    const savedPanels = system?.datasource_reference?.panels;
    const exportData = buildExportData(system, clusters || [], savedPanels);
    
    res.json({ success: true, data: exportData });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, error: '导出失败' });
  }
});

router.post('/import', async (req: express.Request, res: express.Response) => {
  try {
    console.log('Import request received');
    console.log('isUseSupabaseEnabled:', isUseSupabaseEnabled());
    console.log('isDatabaseConnected:', isDatabaseConnected());
    console.log('getSupabase:', !!getSupabase());
    
    const useMockMode = shouldUseMockData() || !isDatabaseConnected();
    console.log('useMockMode:', useMockMode);

    const importData = req.body;

    if (!importData || typeof importData !== 'object') {
      return res.status(400).json({ 
        success: false, 
        error: '无效的请求数据',
        code: 'INVALID_REQUEST_BODY' 
      });
    }

    const dashboard = importData.dashboard || importData;
    const reportData = dashboard.report || importData.report || importData.business_system || {};
    const reportTitle = dashboard.title || reportData.title || reportData.name;
    const reportDescription = dashboard.description || reportData.description || '';
    
    if (!reportTitle) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必需字段：dashboard.title 或 report.title',
        code: 'MISSING_REPORT_TITLE' 
      });
    }

    const clusters = dashboard.clusters || importData.clusters || {};
    const uid = dashboard.uid || importData.uid;
    const overwrite = importData.overwrite === true || dashboard.overwrite === true;
    const panels = dashboard.panels || importData.panels || [];

    if (useMockMode) {
      console.log('Creating report in mock mode...');
      
      const newId = uid || randomUUID();
      
      const existingIndex = mockData.businessSystems.findIndex((s: any) => s.id === newId);
      
      if (existingIndex !== -1) {
        if (!overwrite) {
          return res.status(409).json({ 
            success: false, 
            error: `已存在相同 ID 的业务系统：${mockData.businessSystems[existingIndex].name}。如需覆盖，请选择"覆盖"模式。`,
            code: 'UID_EXISTS',
            existing_system: {
              id: mockData.businessSystems[existingIndex].id,
              name: mockData.businessSystems[existingIndex].name,
              code: mockData.businessSystems[existingIndex].code
            }
          });
        }
        
        mockData.businessSystems[existingIndex] = {
          ...mockData.businessSystems[existingIndex],
          name: reportTitle,
          description: reportDescription,
          updated_at: new Date().toISOString()
        };
        
        return res.json({
          success: true,
          data: {
            message: '业务系统更新成功（Mock 模式）',
            mode: 'updated',
            imported: {
              business_system: 1,
              clusters: 0,
              panels: panels.length
            },
            details: {
              business_system: mockData.businessSystems[existingIndex],
              clusters: [],
              datasource_reference: {
                original_uid: uid,
                new_uid: newId,
                panels_count: panels.length,
                note: 'Mock 模式 - 数据仅存在于内存中'
              }
            }
          }
        });
      }
      
      const code = reportData.code || reportTitle.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
      let finalCode = code;
      const existingByCode = mockData.businessSystems.find((s: any) => s.code === code);
      if (existingByCode) {
        const timestamp = Date.now().toString(36);
        finalCode = `${code}-${timestamp}`;
      }
      
      const newSystem = {
        id: newId,
        name: reportTitle,
        code: finalCode,
        description: reportDescription,
        status: reportData.status || 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        datasource_reference: uid ? {
          original_uid: uid,
          datasource_type: dashboard.datasource?.type || importData.datasource?.type || 'api',
          panels: panels,
          imported_at: new Date().toISOString()
        } : null
      };
      
      mockData.businessSystems.push(newSystem);
      
      if (clusters.wx_cluster) {
        mockData.clusters.push({
          id: randomUUID(),
          name: clusters.wx_cluster.name,
          name_en: clusters.wx_cluster.name_en || clusters.wx_cluster.name,
          type: 'wx',
          business_system_id: newId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
      
      if (clusters.nf_cluster) {
        mockData.clusters.push({
          id: randomUUID(),
          name: clusters.nf_cluster.name,
          name_en: clusters.nf_cluster.name_en || clusters.nf_cluster.name,
          type: 'nf',
          business_system_id: newId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
      
      return res.json({
        success: true,
        data: {
          message: '业务系统创建成功（Mock 模式）',
          mode: 'created',
          imported: {
            business_system: 1,
            clusters: (clusters.wx_cluster ? 1 : 0) + (clusters.nf_cluster ? 1 : 0),
            panels: panels.length
          },
          details: {
            business_system: newSystem,
            clusters: mockData.clusters.filter((c: any) => c.business_system_id === newId),
            datasource_reference: {
              original_uid: uid,
              new_uid: newId,
              panels_count: panels.length,
              note: 'Mock 模式 - 数据仅存在于内存中'
            }
          }
        }
      });
    }

    const supabaseClient = getSupabase();
    if (!supabaseClient) {
      console.log('Import failed: DATABASE_NOT_INITIALIZED');
      return res.status(503).json({ 
        success: false, 
        error: '数据库客户端未初始化',
        code: 'DATABASE_NOT_INITIALIZED' 
      });
    }

    console.log('All checks passed, processing import with database...');

    if (uid) {
      const { data: existingByUid } = await supabaseClient!
        .from('business_systems')
        .select('*')
        .eq('id', uid)
        .maybeSingle();

      if (existingByUid) {
        if (!overwrite) {
          return res.status(409).json({ 
            success: false, 
            error: `已存在相同 UID 的业务系统：${existingByUid.name}。如需覆盖，请在导入时选择"覆盖"模式或删除 UID 字段以创建新副本。`,
            code: 'UID_EXISTS',
            existing_system: {
              id: existingByUid.id,
              name: existingByUid.name,
              code: existingByUid.code
            }
          });
        }

        const { data: updatedSystem, error: updateError } = await supabaseClient!
          .from('business_systems')
          .update({
            name: reportTitle,
            description: reportDescription || existingByUid.description,
            status: reportData.status || existingByUid.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', uid)
          .select()
          .single();

        if (updateError) {
          console.error('Failed to update business system:', updateError);
          return res.status(500).json({ 
            success: false, 
            error: `业务系统更新失败: ${updateError.message}`,
            code: 'BUSINESS_SYSTEM_UPDATE_ERROR' 
          });
        }

        const { data: existingClusters } = await supabaseClient!
          .from('clusters')
          .select('*')
          .eq('business_system_id', uid);

        const clustersToUpdate: any[] = [];
        const clustersToInsert: any[] = [];

        if (clusters.wx_cluster) {
          const existingWx = existingClusters?.find((c: any) => c.type === 'wx');
          if (existingWx) {
            clustersToUpdate.push({
              id: existingWx.id,
              name: clusters.wx_cluster.name,
              name_en: clusters.wx_cluster.name_en || clusters.wx_cluster.name,
              updated_at: new Date().toISOString()
            });
          } else {
            clustersToInsert.push({
              name: clusters.wx_cluster.name,
              name_en: clusters.wx_cluster.name_en || clusters.wx_cluster.name,
              type: 'wx',
              business_system_id: uid,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
        }

        if (clusters.nf_cluster) {
          const existingNf = existingClusters?.find((c: any) => c.type === 'nf');
          if (existingNf) {
            clustersToUpdate.push({
              id: existingNf.id,
              name: clusters.nf_cluster.name,
              name_en: clusters.nf_cluster.name_en || clusters.nf_cluster.name,
              updated_at: new Date().toISOString()
            });
          } else {
            clustersToInsert.push({
              name: clusters.nf_cluster.name,
              name_en: clusters.nf_cluster.name_en || clusters.nf_cluster.name,
              type: 'nf',
              business_system_id: uid,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
        }

        for (const cluster of clustersToUpdate) {
          await supabaseClient!
            .from('clusters')
            .update({
              name: cluster.name,
              name_en: cluster.name_en,
              updated_at: cluster.updated_at
            })
            .eq('id', cluster.id);
        }

        let insertedClusters: any[] = [];
        if (clustersToInsert.length > 0) {
          const { data } = await supabaseClient!
            .from('clusters')
            .insert(clustersToInsert)
            .select();
          insertedClusters = data || [];
        }

        const { data: allClusters } = await supabaseClient!
          .from('clusters')
          .select('*')
          .eq('business_system_id', uid);

        return res.json({
          success: true,
          data: {
            message: '业务系统更新成功',
            mode: 'updated',
            imported: {
              business_system: 1,
              clusters: clustersToUpdate.length + insertedClusters.length
            },
            details: {
              business_system: updatedSystem,
              clusters: allClusters || []
            }
          }
        });
      }
    }

    const code = reportData.code || reportTitle.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

    const { data: existingByCode } = await supabaseClient!
      .from('business_systems')
      .select('id, code')
      .eq('code', code)
      .maybeSingle();

    let finalCode = code;
    if (existingByCode) {
      const timestamp = Date.now().toString(36);
      finalCode = `${code}-${timestamp}`;
    }

    const businessSystemData = {
      name: reportTitle,
      code: finalCode,
      description: reportDescription,
      status: reportData.status || 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: businessSystem, error: bsError } = await supabaseClient!
      .from('business_systems')
      .insert(businessSystemData)
      .select()
      .single();

    if (bsError) {
      console.error('Failed to create business system:', bsError);
      return res.status(500).json({ 
        success: false, 
        error: `业务系统创建失败: ${bsError.message}`,
        code: 'BUSINESS_SYSTEM_ERROR' 
      });
    }

    const clustersToInsert: any[] = [];
    
    if (clusters.wx_cluster) {
      clustersToInsert.push({
        name: clusters.wx_cluster.name,
        name_en: clusters.wx_cluster.name_en || clusters.wx_cluster.name,
        type: 'wx',
        business_system_id: businessSystem.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    
    if (clusters.nf_cluster) {
      clustersToInsert.push({
        name: clusters.nf_cluster.name,
        name_en: clusters.nf_cluster.name_en || clusters.nf_cluster.name,
        type: 'nf',
        business_system_id: businessSystem.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    let insertedClusters: any[] = [];
    if (clustersToInsert.length > 0) {
      const { data, error: clusterError } = await supabaseClient!
        .from('clusters')
        .insert(clustersToInsert)
        .select();

      if (clusterError) {
        console.error('Failed to create clusters:', clusterError);
      } else {
        insertedClusters = data || [];
      }
    }

    let originalDatasourceUid = dashboard.datasource?.uid || importData.datasource?.uid || null;
    let resolvedPanels = panels;

    if (!originalDatasourceUid) {
      originalDatasourceUid = dashboard.uid || importData.uid || null;
      if (originalDatasourceUid) {
        console.log(`[Import] Using dashboard uid as original_uid: ${originalDatasourceUid}`);
      }
    }

    /**
     * 替换面板配置中的模板变量为固定值
     * 
     * 将 ${systemId} 替换为原始报表ID，确保导入后的报表数据源参数是固定的
     * 这样即使原始报表被删除，新报表仍能正常获取数据
     */
    const resolvePanelParams = (panelsToResolve: any[], originalUid: string): any[] => {
      return panelsToResolve.map(panel => {
        const resolvedPanel = { ...panel };
        
        if (resolvedPanel.datasource) {
          if (resolvedPanel.datasource.params) {
            const resolvedParams: Record<string, any> = {};
            for (const [key, value] of Object.entries(resolvedPanel.datasource.params)) {
              if (typeof value === 'string') {
                resolvedParams[key] = value
                  .replace(/\$\{systemId\}/g, originalUid)
                  .replace(/\$\{reportId\}/g, `${originalUid}-\${date}`);
              } else {
                resolvedParams[key] = value;
              }
            }
            resolvedPanel.datasource = {
              ...resolvedPanel.datasource,
              params: resolvedParams
            };
          }
          
          if (resolvedPanel.datasource.endpoints) {
            const resolvedEndpoints: any = {};
            for (const [endpointKey, endpoint] of Object.entries(resolvedPanel.datasource.endpoints)) {
              if ((endpoint as any)?.params) {
                const resolvedParams: Record<string, any> = {};
                for (const [key, value] of Object.entries((endpoint as any).params)) {
                  if (typeof value === 'string') {
                    resolvedParams[key] = value
                      .replace(/\$\{systemId\}/g, originalUid)
                      .replace(/\$\{reportId\}/g, `${originalUid}-\${date}`);
                  } else {
                    resolvedParams[key] = value;
                  }
                }
                resolvedEndpoints[endpointKey] = {
                  ...(endpoint as any),
                  params: resolvedParams
                };
              } else {
                resolvedEndpoints[endpointKey] = endpoint;
              }
            }
            resolvedPanel.datasource = {
              ...resolvedPanel.datasource,
              endpoints: resolvedEndpoints
            };
          }
        }
        
        return resolvedPanel;
      });
    };

    if (originalDatasourceUid) {
      resolvedPanels = resolvePanelParams(panels, originalDatasourceUid);
      
      const { error: updateError } = await supabaseClient!
        .from('business_systems')
        .update({
          datasource_reference: {
            original_uid: originalDatasourceUid,
            datasource_type: dashboard.datasource?.type || importData.datasource?.type || 'api',
            panels: resolvedPanels,
            imported_at: new Date().toISOString()
          }
        })
        .eq('id', businessSystem.id);

      if (updateError) {
        console.error('Failed to update datasource reference:', updateError);
      }
    }

    res.json({
      success: true,
      data: {
        message: '业务系统创建成功',
        mode: 'created',
        imported: {
          business_system: 1,
          clusters: insertedClusters.length,
          panels: resolvedPanels.length
        },
        details: {
          business_system: businessSystem,
          clusters: insertedClusters,
          datasource_reference: {
            original_uid: originalDatasourceUid,
            new_uid: businessSystem.id,
            panels_count: resolvedPanels.length,
            note: originalDatasourceUid 
              ? `新报表将通过数据源引用从原始数据源 (UID: ${originalDatasourceUid}) 获取数据`
              : '无数据源引用'
          }
        }
      }
    });

  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ 
      success: false, 
      error: '数据导入失败',
      code: 'IMPORT_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Panel 数据 API 端点 - 遵循 Grafana 配置与数据分离原则
// 每个 Panel 从独立的 API 端点获取数据，而非存储数据快照

/**
 * 解析数据源 UID
 * 
 * 当导入 JSON 创建新报表时，新报表有自己的 ID，但数据源引用的是原始 UID。
 * 此函数检查传入的 systemId 是否有 datasource_reference.original_uid，
 * 如果有则返回原始 UID，否则返回传入的 systemId。
 */
async function resolveDatasourceUid(supabase: any, systemId: string): Promise<string> {
  try {
    const { data: businessSystem } = await supabase
      .from('business_systems')
      .select('id, datasource_reference')
      .eq('id', systemId)
      .maybeSingle();
    
    if (businessSystem?.datasource_reference?.original_uid) {
      console.log(`[resolveDatasourceUid] Using original_uid: ${businessSystem.datasource_reference.original_uid} for systemId: ${systemId}`);
      return businessSystem.datasource_reference.original_uid;
    }
    
    return systemId;
  } catch (error) {
    console.error('[resolveDatasourceUid] Error:', error);
    return systemId;
  }
}

router.get('/panel/sla-metrics', async (req: express.Request, res: express.Response) => {
  try {
    const { date, systemId } = req.query;
    const reportDate = typeof date === 'string' ? date : new Date().toISOString().split('T')[0];
    let bsId = systemId && typeof systemId === 'string' ? systemId : DEFAULT_BUSINESS_SYSTEM_ID;

    if (shouldUseMockData() || !await ensureConnection()) {
      const report = getMockDailyReportByDateAndSystem(reportDate, bsId);
      const reportId = report?.id || `mock-${bsId}-${reportDate}`;
      const allMetrics = getMockLogMetricsByReport(reportId);
      const slaMetrics = allMetrics.filter((m: any) =>
        ['平均搜索耗时', 'CPU使用率', '日志入库耗时', '监控延迟'].includes(m.metric_name)
      );
      return res.json({ success: true, data: slaMetrics });
    }

    const supabase = getSupabase();
    
    // 解析数据源 UID
    bsId = await resolveDatasourceUid(supabase!, bsId);
    
    const { data: clusters } = await supabase!.from('clusters').select('id').eq('business_system_id', bsId);
    const clusterIds = clusters?.map(c => c.id) || [];

    const { data: slaMetrics } = await supabase!.from('log_metrics')
      .select('*, clusters(name)')
      .in('metric_name', ['平均搜索耗时', 'CPU使用率', '日志入库耗时', '监控延迟'])
      .eq('report_date', reportDate)
      .in('cluster_id', clusterIds.length > 0 ? clusterIds : [WX_CLUSTER_ID, NF_CLUSTER_ID])
      .order('metric_name', { ascending: true });

    const result = slaMetrics?.map((m: any) => ({ ...m, cluster_name: m.clusters?.name })) || [];
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Failed to fetch SLA metrics:', error);
    res.json({ success: true, data: [] });
  }
});

router.get('/panel/cluster-metrics', async (req: express.Request, res: express.Response) => {
  try {
    const { date, systemId } = req.query;
    const reportDate = typeof date === 'string' ? date : new Date().toISOString().split('T')[0];
    let bsId = systemId && typeof systemId === 'string' ? systemId : DEFAULT_BUSINESS_SYSTEM_ID;

    if (shouldUseMockData() || !await ensureConnection()) {
      const clusters = getMockClustersByBusinessSystem(bsId);
      const wxCluster = clusters.find((c: any) => c.type === 'wx') || clusters[0];
      const nfCluster = clusters.find((c: any) => c.type === 'nf') || clusters[1];
      const report = getMockDailyReportByDateAndSystem(reportDate, bsId);
      const reportId = report?.id || `mock-${bsId}-${reportDate}`;
      const allMetrics = getMockLogMetricsByReport(reportId);

      const wxMetrics = allMetrics.filter((m: any) => m.cluster_id === wxCluster?.id);
      const nfMetrics = allMetrics.filter((m: any) => m.cluster_id === nfCluster?.id);

      return res.json({
        success: true,
        data: {
          wxCluster,
          nfCluster,
          wxMetrics,
          nfMetrics
        }
      });
    }

    const supabase = getSupabase();
    
    // 解析数据源 UID
    bsId = await resolveDatasourceUid(supabase!, bsId);
    
    const { data: clusters } = await supabase!.from('clusters').select('*').eq('business_system_id', bsId);
    const wxCluster = clusters?.find((c: any) => c.type === 'wx') || { id: WX_CLUSTER_ID, name: '威新集群', name_en: 'WX CLUSTER', type: 'wx' };
    const nfCluster = clusters?.find((c: any) => c.type === 'nf') || { id: NF_CLUSTER_ID, name: '南方集群', name_en: 'NF CLUSTER', type: 'nf' };

    const { data: wxMetrics } = await supabase!.from('log_metrics').select('*').eq('cluster_id', wxCluster.id).eq('report_date', reportDate);
    const { data: nfMetrics } = await supabase!.from('log_metrics').select('*').eq('cluster_id', nfCluster.id).eq('report_date', reportDate);

    res.json({
      success: true,
      data: {
        wxCluster,
        nfCluster,
        wxMetrics: wxMetrics || [],
        nfMetrics: nfMetrics || []
      }
    });
  } catch (error) {
    console.error('Failed to fetch cluster metrics:', error);
    res.json({ success: true, data: { wxCluster: null, nfCluster: null, wxMetrics: [], nfMetrics: [] } });
  }
});

router.get('/panel/region-traffic', async (req: express.Request, res: express.Response) => {
  try {
    const { date, systemId } = req.query;
    const reportDate = typeof date === 'string' ? date : new Date().toISOString().split('T')[0];
    let bsId = systemId && typeof systemId === 'string' ? systemId : DEFAULT_BUSINESS_SYSTEM_ID;

    if (shouldUseMockData() || !await ensureConnection()) {
      const clusters = getMockClustersByBusinessSystem(bsId);
      const wxCluster = clusters.find((c: any) => c.type === 'wx') || clusters[0];
      const nfCluster = clusters.find((c: any) => c.type === 'nf') || clusters[1];
      const report = getMockDailyReportByDateAndSystem(reportDate, bsId);
      const reportId = report?.id || `mock-${bsId}-${reportDate}`;
      const allRegions = getMockCloudRegionsByReport(reportId);

      const topRegions = allRegions.slice(0, 5).map((r: any) => ({
        ...r,
        cluster_name: r.cluster_id === wxCluster?.id ? wxCluster?.name : nfCluster?.name,
        cluster_type: r.cluster_id === wxCluster?.id ? 'wx' : 'nf'
      }));

      return res.json({
        success: true,
        data: {
          regionStats: {
            total_regions: allRegions.length,
            nf_regions: allRegions.filter((r: any) => r.cluster_id === nfCluster?.id).length,
            wx_regions: allRegions.filter((r: any) => r.cluster_id === wxCluster?.id).length,
            avg_traffic: allRegions.length > 0 ? allRegions.reduce((sum: number, r: any) => sum + (r.current_traffic || 0), 0) / allRegions.length : 0
          },
          topRegions
        }
      });
    }

    const supabase = getSupabase();
    
    // 解析数据源 UID
    bsId = await resolveDatasourceUid(supabase!, bsId);
    
    const { data: clusters } = await supabase!.from('clusters').select('id').eq('business_system_id', bsId);
    const clusterIds = clusters?.map(c => c.id) || [];

    const { data: topRegionsRaw } = await supabase!.from('cloud_regions')
      .select('*, clusters(name, type)')
      .eq('report_date', reportDate)
      .in('cluster_id', clusterIds.length > 0 ? clusterIds : [WX_CLUSTER_ID, NF_CLUSTER_ID])
      .order('current_traffic', { ascending: false })
      .limit(5);

    const { data: avgData } = await supabase!.from('cloud_regions')
      .select('current_traffic')
      .eq('report_date', reportDate)
      .in('cluster_id', clusterIds.length > 0 ? clusterIds : [WX_CLUSTER_ID, NF_CLUSTER_ID]);

    const { count: total_regions } = await supabase!.from('cloud_regions')
      .select('*', { count: 'exact', head: true })
      .eq('report_date', reportDate)
      .in('cluster_id', clusterIds.length > 0 ? clusterIds : [WX_CLUSTER_ID, NF_CLUSTER_ID]);

    const topRegions = topRegionsRaw?.map((r: any) => ({
      ...r,
      cluster_name: r.clusters?.name,
      cluster_type: r.clusters?.type
    })) || [];

    const avg_traffic = avgData && avgData.length > 0
      ? avgData.reduce((sum: number, r: any) => sum + (r.current_traffic || 0), 0) / avgData.length
      : 0;

    res.json({
      success: true,
      data: {
        regionStats: {
          total_regions: total_regions || 0,
          nf_regions: 0,
          wx_regions: 0,
          avg_traffic
        },
        topRegions
      }
    });
  } catch (error) {
    console.error('Failed to fetch region traffic:', error);
    res.json({ success: true, data: { regionStats: { total_regions: 0, nf_regions: 0, wx_regions: 0, avg_traffic: 0 }, topRegions: [] } });
  }
});

router.get('/panel/summary', async (req: express.Request, res: express.Response) => {
  try {
    const { date, systemId } = req.query;
    const reportDate = typeof date === 'string' ? date : new Date().toISOString().split('T')[0];
    let bsId = systemId && typeof systemId === 'string' ? systemId : DEFAULT_BUSINESS_SYSTEM_ID;

    if (shouldUseMockData() || !await ensureConnection()) {
      const report = getMockDailyReportByDateAndSystem(reportDate, bsId);
      const clusters = getMockClustersByBusinessSystem(bsId);
      const wxCluster = clusters.find((c: any) => c.type === 'wx') || clusters[0];
      const nfCluster = clusters.find((c: any) => c.type === 'nf') || clusters[1];

      return res.json({
        success: true,
        data: {
          report,
          wxCluster,
          nfCluster
        }
      });
    }

    const supabase = getSupabase();
    
    // 解析数据源 UID
    bsId = await resolveDatasourceUid(supabase!, bsId);
    
    const { data: report } = await supabase!.from('daily_reports')
      .select('*')
      .eq('report_date', reportDate)
      .eq('business_system_id', bsId)
      .maybeSingle();

    const { data: clusters } = await supabase!.from('clusters').select('*').eq('business_system_id', bsId);
    const wxCluster = clusters?.find((c: any) => c.type === 'wx') || { id: WX_CLUSTER_ID, name: '威新集群', name_en: 'WX CLUSTER', type: 'wx' };
    const nfCluster = clusters?.find((c: any) => c.type === 'nf') || { id: NF_CLUSTER_ID, name: '南方集群', name_en: 'NF CLUSTER', type: 'nf' };

    res.json({
      success: true,
      data: {
        report,
        wxCluster,
        nfCluster
      }
    });
  } catch (error) {
    console.error('Failed to fetch summary:', error);
    res.json({ success: true, data: { report: null, wxCluster: null, nfCluster: null } });
  }
});

router.get('/panel/assessment', async (req: express.Request, res: express.Response) => {
  try {
    const { reportId } = req.query;

    if (shouldUseMockData() || !await ensureConnection()) {
      const assessments = reportId ? getMockAssessmentsByReport(reportId as string) : mockData.assessments;
      return res.json({ success: true, data: assessments });
    }

    const supabase = getSupabase();
    
    // reportId 格式为 ${systemId}-${date}，需要解析并查询对应的 daily_report
    if (reportId && typeof reportId === 'string') {
      const parts = reportId.split('-');
      if (parts.length >= 6) {
        // systemId 是 UUID 格式 (8-4-4-4-12)，date 是最后部分
        const systemId = parts.slice(0, 5).join('-');
        const dateStr = parts.slice(5).join('-');
        
        // 解析数据源 UID
        const resolvedSystemId = await resolveDatasourceUid(supabase!, systemId);
        
        // 查询对应的 daily_report
        const { data: dailyReport } = await supabase!
          .from('daily_reports')
          .select('id')
          .eq('business_system_id', resolvedSystemId)
          .eq('report_date', dateStr)
          .maybeSingle();
        
        if (dailyReport) {
          const { data } = await supabase!.from('assessments').select('*').eq('report_id', dailyReport.id);
          return res.json({ success: true, data: data || [] });
        }
        
        // 没有找到对应的 daily_report，返回空数组
        return res.json({ success: true, data: [] });
      }
      
      // reportId 格式不正确，返回空数组
      return res.json({ success: true, data: [] });
    }
    
    // 没有 reportId，返回空数组
    res.json({ success: true, data: [] });
  } catch (error) {
    console.error('Failed to fetch assessments:', error);
    res.json({ success: true, data: [] });
  }
});

router.get('/panel/action-plan', async (req: express.Request, res: express.Response) => {
  try {
    const { reportId } = req.query;

    if (shouldUseMockData() || !await ensureConnection()) {
      const actionPlans = reportId ? getMockActionPlansByReport(reportId as string) : mockData.actionPlans;
      return res.json({ success: true, data: actionPlans });
    }

    const supabase = getSupabase();
    
    if (reportId && typeof reportId === 'string') {
      const parts = reportId.split('-');
      if (parts.length >= 6) {
        const systemId = parts.slice(0, 5).join('-');
        const dateStr = parts.slice(5).join('-');
        
        const resolvedSystemId = await resolveDatasourceUid(supabase!, systemId);
        
        const { data: dailyReport } = await supabase!
          .from('daily_reports')
          .select('id')
          .eq('business_system_id', resolvedSystemId)
          .eq('report_date', dateStr)
          .maybeSingle();
        
        if (dailyReport) {
          const { data } = await supabase!.from('action_plans').select('*').eq('report_id', dailyReport.id);
          const result = data?.map((p: any) => ({
            ...p,
            items: typeof p.items === 'string' ? JSON.parse(p.items) : p.items
          })) || [];
          return res.json({ success: true, data: result });
        }
        
        // 没有找到对应的 daily_report，返回空数组
        return res.json({ success: true, data: [] });
      }
      
      // reportId 格式不正确，返回空数组
      return res.json({ success: true, data: [] });
    }
    
    // 没有 reportId，返回空数组
    res.json({ success: true, data: [] });
  } catch (error) {
    console.error('Failed to fetch action plans:', error);
    res.json({ success: true, data: [] });
  }
});

router.post('/ai/chat', async (req: express.Request, res: express.Response) => {
  try {
    const { message, selectedPanel, conversationHistory } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: '消息内容不能为空',
      });
    }

    const { callGLM5 } = await import('../services/glmService');
    const result = await callGLM5(
      message,
      selectedPanel,
      conversationHistory || []
    );

    res.json({
      success: result.success,
      data: {
        message: result.message,
        modifications: result.modifications,
      },
    });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({
      success: false,
      error: 'AI 服务暂时不可用，请稍后重试',
    });
  }
});

router.post('/daily-reports', async (req: express.Request, res: express.Response) => {
  try {
    if (!isUseSupabaseEnabled() || !isDatabaseConnected()) {
      return res.status(503).json({ 
        success: false, 
        error: '数据库未启用或未连接',
        code: 'DATABASE_UNAVAILABLE' 
      });
    }

    const supabaseClient = getSupabase();
    if (!supabaseClient) {
      return res.status(503).json({ 
        success: false, 
        error: '数据库客户端未初始化',
        code: 'DATABASE_NOT_INITIALIZED' 
      });
    }

    const report = req.body;
    const { error } = await supabaseClient
      .from('daily_reports')
      .upsert(report, { onConflict: 'id' });
    
    if (error) {
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }

    res.json({ success: true, data: report });
  } catch (error: any) {
    console.error('Insert daily report error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.post('/log-metrics/batch', async (req: express.Request, res: express.Response) => {
  try {
    if (!isUseSupabaseEnabled() || !isDatabaseConnected()) {
      return res.status(503).json({ 
        success: false, 
        error: '数据库未启用或未连接',
        code: 'DATABASE_UNAVAILABLE' 
      });
    }

    const supabaseClient = getSupabase();
    if (!supabaseClient) {
      return res.status(503).json({ 
        success: false, 
        error: '数据库客户端未初始化',
        code: 'DATABASE_NOT_INITIALIZED' 
      });
    }

    const { metrics } = req.body;
    if (!metrics || !Array.isArray(metrics)) {
      return res.status(400).json({ 
        success: false, 
        error: '无效的指标数据' 
      });
    }

    const { error } = await supabaseClient
      .from('log_metrics')
      .insert(metrics);
    
    if (error) {
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }

    res.json({ success: true, data: { count: metrics.length } });
  } catch (error: any) {
    console.error('Insert log metrics error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.post('/cloud-regions/batch', async (req: express.Request, res: express.Response) => {
  try {
    if (!isUseSupabaseEnabled() || !isDatabaseConnected()) {
      return res.status(503).json({ 
        success: false, 
        error: '数据库未启用或未连接',
        code: 'DATABASE_UNAVAILABLE' 
      });
    }

    const supabaseClient = getSupabase();
    if (!supabaseClient) {
      return res.status(503).json({ 
        success: false, 
        error: '数据库客户端未初始化',
        code: 'DATABASE_NOT_INITIALIZED' 
      });
    }

    const { regions } = req.body;
    if (!regions || !Array.isArray(regions)) {
      return res.status(400).json({ 
        success: false, 
        error: '无效的云区域数据' 
      });
    }

    const { error } = await supabaseClient
      .from('cloud_regions')
      .insert(regions);
    
    if (error) {
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }

    res.json({ success: true, data: { count: regions.length } });
  } catch (error: any) {
    console.error('Insert cloud regions error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.post('/assessments/batch', async (req: express.Request, res: express.Response) => {
  try {
    if (!isUseSupabaseEnabled() || !isDatabaseConnected()) {
      return res.status(503).json({ 
        success: false, 
        error: '数据库未启用或未连接',
        code: 'DATABASE_UNAVAILABLE' 
      });
    }

    const supabaseClient = getSupabase();
    if (!supabaseClient) {
      return res.status(503).json({ 
        success: false, 
        error: '数据库客户端未初始化',
        code: 'DATABASE_NOT_INITIALIZED' 
      });
    }

    const { assessments } = req.body;
    if (!assessments || !Array.isArray(assessments)) {
      return res.status(400).json({ 
        success: false, 
        error: '无效的评估数据' 
      });
    }

    const { error } = await supabaseClient
      .from('assessments')
      .insert(assessments);
    
    if (error) {
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }

    res.json({ success: true, data: { count: assessments.length } });
  } catch (error: any) {
    console.error('Insert assessments error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.post('/action-plans/batch', async (req: express.Request, res: express.Response) => {
  try {
    if (!isUseSupabaseEnabled() || !isDatabaseConnected()) {
      return res.status(503).json({ 
        success: false, 
        error: '数据库未启用或未连接',
        code: 'DATABASE_UNAVAILABLE' 
      });
    }

    const supabaseClient = getSupabase();
    if (!supabaseClient) {
      return res.status(503).json({ 
        success: false, 
        error: '数据库客户端未初始化',
        code: 'DATABASE_NOT_INITIALIZED' 
      });
    }

    const { plans } = req.body;
    if (!plans || !Array.isArray(plans)) {
      return res.status(400).json({ 
        success: false, 
        error: '无效的行动计划数据' 
      });
    }

    const { error } = await supabaseClient
      .from('action_plans')
      .insert(plans);
    
    if (error) {
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }

    res.json({ success: true, data: { count: plans.length } });
  } catch (error: any) {
    console.error('Insert action plans error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.post('/generate-yesterday-data', async (req: express.Request, res: express.Response) => {
  try {
    if (!isUseSupabaseEnabled() || !isDatabaseConnected()) {
      return res.status(503).json({ 
        success: false, 
        error: '数据库未启用或未连接',
        code: 'DATABASE_UNAVAILABLE' 
      });
    }

    const supabaseClient = getSupabase();
    if (!supabaseClient) {
      return res.status(503).json({ 
        success: false, 
        error: '数据库客户端未初始化',
        code: 'DATABASE_NOT_INITIALIZED' 
      });
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const dayBefore = new Date();
    dayBefore.setDate(dayBefore.getDate() - 2);
    const dayBeforeStr = dayBefore.toISOString().split('T')[0];

    console.log(`生成昨日数据: ${yesterdayStr}`);

    const BUSINESS_SYSTEMS = {
      LOG_PLATFORM: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      PAYMENT_CENTER: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      ORDER_SYSTEM: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    };

    const CLUSTERS = {
      PAYMENT_PRIMARY: '33333333-3333-3333-3333-333333333333',
      PAYMENT_BACKUP: '44444444-4444-4444-4444-444444444444',
      ORDER_PRIMARY: '55555555-5555-5555-5555-555555555555',
      ORDER_BACKUP: '66666666-6666-6666-6666-666666666666',
    };

    const randomVariation = (base: number, variance: number): number => {
      return Math.round(base + (Math.random() - 0.5) * 2 * variance);
    };

    const randomStatus = (): 'normal' | 'warning' | 'critical' => {
      const rand = Math.random();
      if (rand > 0.9) return 'warning';
      if (rand > 0.95) return 'critical';
      return 'normal';
    };

    const paymentStatus = randomStatus();
    const orderStatus = randomStatus();
    const logStatus = randomStatus();

    const reports = [
      {
        report_date: yesterdayStr,
        system_status: paymentStatus,
        wx_cluster_eps_rate: randomVariation(85, 15),
        wx_cluster_eps_peak_date: yesterdayStr,
        wx_cluster_insight: paymentStatus === 'normal' 
          ? '支付主集群运行平稳，交易处理正常，响应时间稳定。'
          : paymentStatus === 'warning'
          ? '支付主集群今日交易量较高，建议关注系统资源使用情况。'
          : '支付主集群出现性能瓶颈，已启用备集群分担流量。',
        nf_cluster_eps_rate: randomVariation(65, 10),
        nf_cluster_eps_peak_date: yesterdayStr,
        nf_cluster_insight: '支付备集群运行正常，作为灾备节点随时可用。',
        business_system_id: BUSINESS_SYSTEMS.PAYMENT_CENTER,
      },
      {
        report_date: yesterdayStr,
        system_status: orderStatus,
        wx_cluster_eps_rate: randomVariation(90, 15),
        wx_cluster_eps_peak_date: yesterdayStr,
        wx_cluster_insight: orderStatus === 'normal'
          ? '订单主集群运行正常，订单处理效率稳定，无明显延迟。'
          : orderStatus === 'warning'
          ? '订单主集群今日订单量较高，数据库连接池使用率偏高。'
          : '订单主集群出现性能问题，正在排查中。',
        nf_cluster_eps_rate: randomVariation(68, 10),
        nf_cluster_eps_peak_date: yesterdayStr,
        nf_cluster_insight: '订单备集群运行正常。',
        business_system_id: BUSINESS_SYSTEMS.ORDER_SYSTEM,
      },
      {
        report_date: yesterdayStr,
        system_status: logStatus,
        wx_cluster_eps_rate: randomVariation(75, 10),
        wx_cluster_eps_peak_date: yesterdayStr,
        wx_cluster_insight: '威新集群运行正常，日志采集稳定，处理效率良好。',
        nf_cluster_eps_rate: randomVariation(55, 8),
        nf_cluster_eps_peak_date: yesterdayStr,
        nf_cluster_insight: '南方集群运行正常，备份功能正常。',
        business_system_id: BUSINESS_SYSTEMS.LOG_PLATFORM,
      },
    ];

    for (const report of reports) {
      const { error } = await supabaseClient
        .from('daily_reports')
        .upsert(report, { onConflict: 'report_date, business_system_id' });
      if (error) {
        console.log(`  ❌ 日报 ${report.report_date} 插入失败: ${error.message}`);
      } else {
        console.log(`  ✓ 日报 ${report.report_date} 插入成功`);
      }
    }

    const metrics = [
      {
        cluster_id: CLUSTERS.PAYMENT_PRIMARY,
        report_date: yesterdayStr,
        metric_name: '交易TPS',
        metric_name_en: 'Transaction TPS',
        layer: 'application',
        today_max: randomVariation(15000, 3000),
        today_avg: randomVariation(12000, 2000),
        yesterday_max: randomVariation(14500, 3000),
        yesterday_avg: randomVariation(11500, 2000),
        historical_max: 18000,
        historical_max_date: yesterdayStr,
        sla_threshold: 20000,
        unit: 'tps',
        change_rate: randomVariation(3, 2),
        health_status: 'healthy',
      },
      {
        cluster_id: CLUSTERS.PAYMENT_PRIMARY,
        report_date: yesterdayStr,
        metric_name: '响应时间',
        metric_name_en: 'Response Time',
        layer: 'application',
        today_max: randomVariation(25, 5),
        today_avg: randomVariation(18, 3),
        yesterday_max: randomVariation(28, 5),
        yesterday_avg: randomVariation(20, 3),
        historical_max: 35,
        historical_max_date: yesterdayStr,
        sla_threshold: 50,
        unit: 'ms',
        change_rate: randomVariation(-10, 5),
        health_status: 'healthy',
      },
      {
        cluster_id: CLUSTERS.ORDER_PRIMARY,
        report_date: yesterdayStr,
        metric_name: '订单TPS',
        metric_name_en: 'Order TPS',
        layer: 'application',
        today_max: randomVariation(20000, 4000),
        today_avg: randomVariation(16000, 3000),
        yesterday_max: randomVariation(19500, 4000),
        yesterday_avg: randomVariation(15500, 3000),
        historical_max: 25000,
        historical_max_date: yesterdayStr,
        sla_threshold: 30000,
        unit: 'tps',
        change_rate: randomVariation(2, 2),
        health_status: 'healthy',
      },
    ];

    const { error: metricsError } = await supabaseClient.from('log_metrics').insert(metrics);
    if (metricsError) {
      console.log(`  ❌ 日志指标插入失败: ${metricsError.message}`);
    } else {
      console.log(`  ✓ 插入 ${metrics.length} 条日志指标`);
    }

    const regions = [
      {
        cluster_id: CLUSTERS.PAYMENT_PRIMARY,
        report_date: yesterdayStr,
        name: '华东支付区',
        node_count: 150,
        current_traffic: randomVariation(28, 5),
        peak_traffic: randomVariation(38, 6),
        region_type: 'domestic',
      },
      {
        cluster_id: CLUSTERS.ORDER_PRIMARY,
        report_date: yesterdayStr,
        name: '华东订单区',
        node_count: 180,
        current_traffic: randomVariation(32, 6),
        peak_traffic: randomVariation(45, 8),
        region_type: 'domestic',
      },
    ];

    const { error: regionsError } = await supabaseClient.from('cloud_regions').insert(regions);
    if (regionsError) {
      console.log(`  ❌ 云区域数据插入失败: ${regionsError.message}`);
    } else {
      console.log(`  ✓ 插入 ${regions.length} 个云区域`);
    }

    const assessments = [
      {
        report_id: `${BUSINESS_SYSTEMS.PAYMENT_CENTER}-${yesterdayStr}`,
        category: '性能',
        item: '交易响应时间',
        status: randomStatus(),
        detail: '响应时间稳定在 18ms 左右，符合 SLA 要求',
        impact: '低',
        recommendation: '继续保持监控',
      },
      {
        report_id: `${BUSINESS_SYSTEMS.ORDER_SYSTEM}-${yesterdayStr}`,
        category: '性能',
        item: '订单处理延迟',
        status: randomStatus(),
        detail: '订单处理延迟稳定，平均 28ms',
        impact: '低',
        recommendation: '继续保持监控',
      },
    ];

    const { error: assessmentsError } = await supabaseClient.from('assessments').insert(assessments);
    if (assessmentsError) {
      console.log(`  ❌ 评估数据插入失败: ${assessmentsError.message}`);
    } else {
      console.log(`  ✓ 插入 ${assessments.length} 条评估`);
    }

    const actionPlans = [
      {
        report_id: `${BUSINESS_SYSTEMS.PAYMENT_CENTER}-${yesterdayStr}`,
        priority: '高',
        action: '优化数据库查询性能',
        owner: '数据库团队',
        due_date: yesterdayStr,
        status: '进行中',
        progress: 60,
      },
      {
        report_id: `${BUSINESS_SYSTEMS.ORDER_SYSTEM}-${yesterdayStr}`,
        priority: '高',
        action: '优化缓存策略',
        owner: '缓存团队',
        due_date: yesterdayStr,
        status: '已完成',
        progress: 100,
      },
    ];

    const { error: actionPlansError } = await supabaseClient.from('action_plans').insert(actionPlans);
    if (actionPlansError) {
      console.log(`  ❌ 行动计划插入失败: ${actionPlansError.message}`);
    } else {
      console.log(`  ✓ 插入 ${actionPlans.length} 条行动计划`);
    }

    console.log('\n✅ 昨日数据生成完成！');

    res.json({ 
      success: true, 
      data: { 
        date: yesterdayStr,
        message: '昨日数据生成完成' 
      } 
    });
  } catch (error: any) {
    console.error('Generate yesterday data error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;
