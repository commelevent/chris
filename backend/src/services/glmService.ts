import axios from 'axios';
import { getSupabase } from '../database/supabase';

const GLM_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const GLM_API_KEY = process.env.GLM_API_KEY || '';

console.log('[GLM Service] API Key configured:', GLM_API_KEY ? `Yes (${GLM_API_KEY.substring(0, 8)}...)` : 'No - using simulation');

export interface GLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GLMRequest {
  model: string;
  messages: GLMMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface GLMResponse {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface PanelModification {
  panelId: string;
  field: string;
  oldValue: any;
  newValue: any;
  description: string;
}

export interface PanelDatasource {
  type: string;
  endpoint?: string;
  method?: string;
  params?: Record<string, any>;
  endpoints?: {
    assessment?: {
      type: string;
      endpoint: string;
      method: string;
      params?: Record<string, any>;
    };
    actionPlan?: {
      type: string;
      endpoint: string;
      method: string;
      params?: Record<string, any>;
    };
  };
}

export interface SelectedPanelInfo {
  id: string;
  title: string;
  type: string;
  datasource?: PanelDatasource;
  styles?: Record<string, any>;
}

export interface AIResponse {
  success: boolean;
  message: string;
  modifications?: PanelModification[];
  code?: string;
}

export interface NetworkMetric {
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

export interface NetworkMetricsStats {
  total_metrics: number;
  node_types: string[];
}

async function fetchNetworkMetrics(params: {
  date?: string;
  nodeType?: string;
  metricCategory?: string;
} = {}): Promise<NetworkMetric[]> {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      console.log('[GLM Service] Supabase client not available');
      return [];
    }

    let query = supabase.from('network_metrics').select('*').eq('report_date', '2026-04-24');

    if (params.date) {
      query = query.eq('report_date', params.date);
    }
    if (params.nodeType) {
      query = query.eq('node_type', params.nodeType);
    }
    if (params.metricCategory) {
      query = query.eq('metric_category', params.metricCategory);
    }

    const { data, error } = await query.order('report_date', { ascending: false }).order('node_type', { ascending: true });

    if (error) {
      console.error('[GLM Service] Query error:', error);
      return [];
    }

    console.log('[GLM Service] Fetched network metrics:', data?.length || 0, 'records');
    return (data as NetworkMetric[]) || [];
  } catch (error) {
    console.error('[GLM Service] Failed to fetch network metrics:', error);
    return [];
  }
}

async function fetchNetworkMetricsStats(date?: string): Promise<NetworkMetricsStats | null> {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      console.log('[GLM Service] Supabase client not available');
      return null;
    }

    const reportDate = '2026-04-24';

    const { count: total_metrics } = await supabase
      .from('network_metrics')
      .select('*', { count: 'exact', head: true })
      .eq('report_date', reportDate);

    const { data: nodeTypesData } = await supabase
      .from('network_metrics')
      .select('node_type')
      .eq('report_date', reportDate);

    const node_types = Array.from(new Set(nodeTypesData?.map((item: any) => item.node_type) || []));

    console.log('[GLM Service] Fetched network metrics stats:', { total_metrics });

    return {
      total_metrics: total_metrics || 0,
      node_types,
    };
  } catch (error) {
    console.error('[GLM Service] Failed to fetch network metrics stats:', error);
    return null;
  }
}

function formatNetworkMetricsForAI(metrics: NetworkMetric[]): string {
  if (metrics.length === 0) {
    return '暂无网络指标数据。';
  }
  
  let result = `共找到 ${metrics.length} 条网络指标数据：\n\n`;
  result += '| 序号 | 节点类型 | 指标类别 | 指标名称 | 当前值 | 单位 | 同比 | 环比 | 历史峰值 |\n';
  result += '|------|----------|----------|----------|--------|------|------|------|----------|\n';
  
  metrics.forEach((m, index) => {
    result += `| ${index + 1} | ${m.node_type} | ${m.metric_category || '-'} | ${m.metric_name} | ${m.current_value} | ${m.unit} | ${m.yoy_change || 0}% | ${m.mom_change || 0}% | ${m.historical_peak || '-'} |\n`;
  });
  
  return result;
}

function formatStatsForAI(stats: NetworkMetricsStats): string {
  return `📊 **网络指标统计概览**

- 总指标数: ${stats.total_metrics}
- 节点类型: ${stats.node_types.join(', ') || '无'}`;
}

const SYSTEM_PROMPT = `你是一个专业的报表模板配置助手，帮助用户通过自然语言修改报表模板。

## 核心能力
1. 理解用户的自然语言修改需求
2. 将需求转换为具体的配置修改操作
3. 保持配置格式一致，遵循最佳实践
4. 提供数据源信息和样式调整建议
5. 查询和展示网络指标数据

## 支持的修改类型

### 1. 标题修改
用户输入: "将标题改为 XXX" / "修改标题为 XXX"
返回格式: 在回复中明确说明 "已将标题修改为「XXX」"

### 2. 描述修改
用户输入: "修改描述为 XXX" / "添加描述 XXX"
返回格式: 在回复中明确说明 "已将描述修改为「XXX」"

### 3. 数据源相关操作
用户输入: "查看数据源" / "数据源是什么" / "这个面板的数据从哪来"
**重要**：必须使用消息中提供的实际数据源配置，不要虚构数据源信息！
返回格式：直接展示消息中的数据源配置信息，包括：
- 完整 API 地址（包含查询参数）
- API 端点
- 请求方法
- 请求参数

用户输入: "修改数据源地址为 /api/xxx?param1=value1&param2=value2"
**重要**：必须返回完整的 URL（包含查询参数）！
返回格式: "已将数据源地址修改为 /api/xxx?param1=value1&param2=value2"

用户输入: "添加参数 date" / "修改参数 systemId"
返回格式: 在回复中明确说明修改的参数

### 4. 样式修改
用户输入: "修改背景色为蓝色" / "调整宽度" / "改变样式"
返回格式: 在回复中明确说明样式修改，包括：
- 修改的样式属性
- 新的样式值
- 预期效果说明

支持的样式属性：
- 背景色 (backgroundColor)
- 文字颜色 (color)
- 字体大小 (fontSize)
- 边框 (border)
- 圆角 (borderRadius)
- 内边距 (padding)
- 外边距 (margin)
- 宽度 (width)
- 高度 (height)

### 5. 删除面板
用户输入: "删除此面板" / "移除这个模块"
返回格式: 在回复中明确说明 "已删除面板「XXX」"

### 6. 添加面板
用户输入: "添加图表模块" / "新增指标卡" / "添加数据表"
返回格式: 在回复中明确说明添加的面板类型和位置

### 7. 网络指标查询
用户输入: "查询网络指标" / "网络指标数据" / "查看网络状态" / "网络监控数据"
**重要**：当用户询问网络指标相关问题时，必须使用消息中提供的实际网络指标数据！
返回格式：以表格形式展示网络指标数据，包含以下字段：
- 序号、节点类型、指标类别、指标名称、当前值、单位、同比、环比、历史峰值

支持的查询条件：
- 按节点类型：路由器、交换机、防火墙、服务器、负载均衡器等
- 按指标类别：资源使用率、请求量

示例查询：
- "查看所有路由器的指标"
- "查询网络指标数据"
- "网络指标统计概览"

### 8. 网络指标数据源配置
用户输入: "数据源改为网络指标数据" / "修改数据源为网络指标"
**重要**：网络指标数据源只需要 date 参数，不需要 systemId 参数！
正确格式: /api/network-metrics?date=2026-04-28
错误格式: /api/network-metrics?date=2026-04-28&systemId=xxx（不要包含systemId）

返回格式: "已将数据源地址修改为 /api/network-metrics?date=报表日期"

## 回复规则
- 用简洁的中文回复
- 明确说明修改了什么
- 如果用户询问数据源，提供详细的数据源信息
- 如果用户询问网络指标，使用消息中提供的实际数据
- 如果用户要求修改样式，提供具体的样式修改建议
- 如果无法理解需求，询问用户具体要修改什么
- 如果需要更多信息，引导用户提供
- 对于样式修改，建议使用 Tailwind CSS 类名或标准 CSS 属性`;

export async function callGLM5(
  userMessage: string,
  selectedPanel?: SelectedPanelInfo,
  conversationHistory: GLMMessage[] = []
): Promise<AIResponse> {
  if (!GLM_API_KEY) {
    return simulateAIResponse(userMessage, selectedPanel);
  }

  try {
    const messages: GLMMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory,
    ];

    let networkMetricsContext = '';
    const msg = userMessage.toLowerCase();
    const isNetworkMetricsQuery = 
      msg.includes('网络指标') || 
      msg.includes('网络状态') || 
      msg.includes('网络监控') ||
      msg.includes('网络数据') ||
      msg.includes('指标数据') ||
      msg.includes('路由器') ||
      msg.includes('交换机') ||
      msg.includes('防火墙') ||
      msg.includes('服务器') ||
      msg.includes('负载均衡') ||
      msg.includes('可用性') ||
      msg.includes('性能指标') ||
      msg.includes('network_metrics') ||
      msg.includes('network metrics') ||
      msg.includes('supabase') ||
      msg.includes('查找数据') ||
      msg.includes('查询数据') ||
      msg.includes('数据库');

    if (isNetworkMetricsQuery) {
      console.log('[GLM Service] Detected network metrics query, fetching data...');
      
      const queryParams: {
        nodeType?: string;
        metricCategory?: string;
      } = {};
      
      if (msg.includes('路由器')) queryParams.nodeType = 'router';
      else if (msg.includes('交换机')) queryParams.nodeType = 'switch';
      else if (msg.includes('防火墙')) queryParams.nodeType = 'firewall';
      else if (msg.includes('服务器')) queryParams.nodeType = 'server';
      else if (msg.includes('负载均衡')) queryParams.nodeType = 'load_balancer';
      
      if (msg.includes('可用性')) queryParams.metricCategory = 'availability';
      else if (msg.includes('性能')) queryParams.metricCategory = 'performance';
      
      if (msg.includes('统计') || msg.includes('概览') || msg.includes('总览')) {
        const stats = await fetchNetworkMetricsStats();
        if (stats) {
          networkMetricsContext = `\n\n**网络指标统计数据**：\n${formatStatsForAI(stats)}`;
        }
      } else {
        const metrics = await fetchNetworkMetrics(queryParams);
        networkMetricsContext = `\n\n**网络指标数据**：\n${formatNetworkMetricsForAI(metrics)}`;
      }
    }

    if (selectedPanel) {
      let panelInfo = `用户选中了「${selectedPanel.title}」面板（类型：${selectedPanel.type}，ID：${selectedPanel.id}）`;
      
      if (selectedPanel.datasource) {
        panelInfo += `\n\n**当前数据源配置**：`;
        const ds = selectedPanel.datasource;
        
        if (ds.endpoint) {
          let fullUrl = ds.endpoint;
          if (ds.params && Object.keys(ds.params).length > 0) {
            const queryString = Object.entries(ds.params)
              .map(([key, value]) => `${key}=${value}`)
              .join('&');
            fullUrl += `?${queryString}`;
          }
          panelInfo += `\n- 完整 API 地址：${fullUrl}`;
          panelInfo += `\n- API 端点：${ds.endpoint}`;
          panelInfo += `\n- 请求方法：${ds.method || 'GET'}`;
          
          if (ds.params && Object.keys(ds.params).length > 0) {
            panelInfo += `\n- 请求参数：`;
            Object.entries(ds.params).forEach(([key, value]) => {
              panelInfo += `\n  - ${key}: ${value}`;
            });
          }
        }
        
        if (ds.endpoints) {
          panelInfo += `\n- 多数据源配置：`;
          if (ds.endpoints.assessment) {
            let assessmentUrl = ds.endpoints.assessment.endpoint;
            if (ds.endpoints.assessment.params && Object.keys(ds.endpoints.assessment.params).length > 0) {
              const queryString = Object.entries(ds.endpoints.assessment.params)
                .map(([key, value]) => `${key}=${value}`)
                .join('&');
              assessmentUrl += `?${queryString}`;
            }
            panelInfo += `\n  - 评估数据：${assessmentUrl}`;
          }
          if (ds.endpoints.actionPlan) {
            let actionPlanUrl = ds.endpoints.actionPlan.endpoint;
            if (ds.endpoints.actionPlan.params && Object.keys(ds.endpoints.actionPlan.params).length > 0) {
              const queryString = Object.entries(ds.endpoints.actionPlan.params)
                .map(([key, value]) => `${key}=${value}`)
                .join('&');
              actionPlanUrl += `?${queryString}`;
            }
            panelInfo += `\n  - 行动计划：${actionPlanUrl}`;
          }
        }
      }
      
      panelInfo += networkMetricsContext;
      panelInfo += `\n\n用户需求：${userMessage}`;
      panelInfo += `\n\n请根据用户需求修改选中的面板，用简洁的中文说明修改内容。`;
      
      messages.push({
        role: 'user',
        content: panelInfo,
      });
    } else {
      let userContent = userMessage;
      if (networkMetricsContext) {
        userContent = `${networkMetricsContext}\n\n用户问题：${userMessage}`;
      }
      messages.push({
        role: 'user',
        content: userContent,
      });
    }

    const request: GLMRequest = {
      model: 'GLM-5',
      messages,
      temperature: 0.7,
      max_tokens: 8192,
      stream: false,
    };

    console.log('[GLM Service] Sending request to GLM-5...');
    
    const response = await axios.post<GLMResponse>(GLM_API_URL, request, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GLM_API_KEY}`,
      },
    });

    const content = response.data.choices[0]?.message?.content || '';
    console.log('[GLM Service] Response:', content);

    const modifications = parseModifications(content, selectedPanel?.id, selectedPanel?.title);
    
    console.log('[GLM Service] Parsed modifications:', modifications);
    
    return {
      success: true,
      message: content,
      modifications,
    };
  } catch (error: any) {
    console.error('GLM API error:', error.response?.data || error.message);
    return simulateAIResponse(userMessage, selectedPanel);
  }
}

function parseModifications(content: string, panelId?: string, panelTitle?: string): PanelModification[] {
  const modifications: PanelModification[] = [];
  
  console.log('[parseModifications] 原始内容:', JSON.stringify(content));
  
  if (!panelId) return modifications;

  const titleMatch = content.match(/标题[改为修改成设置]+[「"']?([^「"'"」\n]+)[」"']?/);
  if (titleMatch) {
    modifications.push({
      panelId,
      field: 'title',
      oldValue: panelTitle,
      newValue: titleMatch[1].trim(),
      description: `标题修改为「${titleMatch[1].trim()}」`,
    });
  }

  const descMatch = content.match(/描述[改为修改成设置]+[「"']?([^「"'"」\n]+)[」"']?/);
  if (descMatch) {
    modifications.push({
      panelId,
      field: 'description',
      oldValue: null,
      newValue: descMatch[1].trim(),
      description: `描述修改为「${descMatch[1].trim()}」`,
    });
  }

  let fullEndpointMatch = content.match(/完整\s*API\s*地址[：:`\s]*[`「"']?(\/[^\s\n`「"」]*)/);
  console.log('[parseModifications] fullEndpointMatch (完整 API 地址):', fullEndpointMatch);
  
  if (!fullEndpointMatch) {
    fullEndpointMatch = content.match(/数据源地址修改为\s*[：:`\s]*[`「"']?(\/[^\s\n`「"」]*)/);
    console.log('[parseModifications] fullEndpointMatch (数据源地址修改为):', fullEndpointMatch);
  }
  
  if (!fullEndpointMatch) {
    fullEndpointMatch = content.match(/数据源修改为\s*[：:`\s]*[`「"']?(\/[^\s\n`「"」]*)/);
    console.log('[parseModifications] fullEndpointMatch (数据源修改为):', fullEndpointMatch);
  }
  
  let endpointMatch: RegExpMatchArray | null = null;
  
  const cleanUrl = (url: string): string => {
    let cleaned = url.replace(/[`「」"']/g, '').trim();
    if (cleaned.includes('/api/network-metrics')) {
      try {
        const urlObj = new URL(cleaned, 'http://localhost');
        urlObj.searchParams.delete('systemId');
        cleaned = urlObj.pathname + (urlObj.search ? urlObj.search : '');
      } catch {
        const [path, query] = cleaned.split('?');
        if (query) {
          const params = query.split('&').filter(p => !p.startsWith('systemId='));
          cleaned = params.length > 0 ? `${path}?${params.join('&')}` : path;
        }
      }
    }
    console.log('[cleanUrl] Input:', url, '-> Output:', cleaned);
    return cleaned;
  };
  
  if (fullEndpointMatch) {
    const url = cleanUrl(fullEndpointMatch[1]);
    console.log('[parseModifications] 匹配到完整 URL:', url);
    modifications.push({
      panelId,
      field: 'endpoint',
      oldValue: null,
      newValue: url,
      description: `数据源地址修改为「${url}」`,
    });
  } else {
    endpointMatch = content.match(/(?:数据源|API|端点|接口)[地址]*[改为修改成设置]+[：「"'`\s]*(\/[^\s\n`「"」]*)/);
    console.log('[parseModifications] endpointMatch:', endpointMatch);
    if (endpointMatch) {
      const url = cleanUrl(endpointMatch[1]);
      console.log('[parseModifications] 匹配到简单格式:', url);
      modifications.push({
        panelId,
        field: 'endpoint',
        oldValue: null,
        newValue: url,
        description: `数据源地址修改为「${url}」`,
      });
    }
  }
  
  const tableEndpointMatch = content.match(/\*\*API 端点\*\*\s*\|\s*[^|]+\s*\|\s*([^|\s]+)/);
  if (tableEndpointMatch && !endpointMatch && !fullEndpointMatch) {
    modifications.push({
      panelId,
      field: 'endpoint',
      oldValue: null,
      newValue: tableEndpointMatch[1].trim(),
      description: `数据源地址修改为「${tableEndpointMatch[1].trim()}」`,
    });
  }
  
  const fullUrlMatch = content.match(/\*\*完整地址\*\*\s*\|\s*([^|\s?]+[^|\s]*)/);
  if (fullUrlMatch && !endpointMatch && !fullEndpointMatch) {
    const fullUrl = fullUrlMatch[1].trim();
    if (!modifications.find(m => m.field === 'endpoint')) {
      modifications.push({
        panelId,
        field: 'endpoint',
        oldValue: null,
        newValue: fullUrl,
        description: `数据源地址修改为「${fullUrl}」`,
      });
    }
  }

  const deleteMatch = content.match(/已[删除移除]面板/);
  if (deleteMatch) {
    modifications.push({
      panelId,
      field: 'remove',
      oldValue: null,
      newValue: null,
      description: `删除面板「${panelTitle || panelId}」`,
    });
  }

  return modifications;
}

async function simulateAIResponse(
  userMessage: string,
  selectedPanel?: SelectedPanelInfo
): Promise<AIResponse> {
  const msg = userMessage.toLowerCase();

  const isNetworkMetricsQuery = 
    msg.includes('网络指标') || 
    msg.includes('网络状态') || 
    msg.includes('网络监控') ||
    msg.includes('网络数据') ||
    msg.includes('指标数据') ||
    msg.includes('路由器') ||
    msg.includes('交换机') ||
    msg.includes('防火墙') ||
    msg.includes('服务器') ||
    msg.includes('负载均衡') ||
    msg.includes('可用性') ||
    msg.includes('性能指标') ||
    msg.includes('network_metrics') ||
    msg.includes('network metrics') ||
    msg.includes('supabase') ||
    msg.includes('查找数据') ||
    msg.includes('查询数据') ||
    msg.includes('数据库');

  if (isNetworkMetricsQuery) {
    console.log('[GLM Service] Simulate: Detected network metrics query, fetching data...');
    
    const queryParams: {
      nodeType?: string;
      metricCategory?: string;
    } = {};
    
    if (msg.includes('路由器')) queryParams.nodeType = 'router';
    else if (msg.includes('交换机')) queryParams.nodeType = 'switch';
    else if (msg.includes('防火墙')) queryParams.nodeType = 'firewall';
    else if (msg.includes('服务器')) queryParams.nodeType = 'server';
    else if (msg.includes('负载均衡')) queryParams.nodeType = 'load_balancer';
    
    if (msg.includes('可用性')) queryParams.metricCategory = 'availability';
    else if (msg.includes('性能')) queryParams.metricCategory = 'performance';
    
    if (msg.includes('统计') || msg.includes('概览') || msg.includes('总览')) {
      const stats = await fetchNetworkMetricsStats();
      if (stats) {
        return {
          success: true,
          message: `📊 **网络指标统计概览**\n\n${formatStatsForAI(stats)}\n\n💡 您可以进一步查询具体类型的指标，例如："查看所有路由器的指标"`,
        };
      }
    } else {
      const metrics = await fetchNetworkMetrics(queryParams);
      if (metrics.length > 0) {
        return {
          success: true,
          message: `📡 **网络指标查询结果**\n\n${formatNetworkMetricsForAI(metrics)}\n\n💡 您可以进一步筛选，例如："查看路由器的指标"`,
        };
      } else {
        return {
          success: true,
          message: `暂无符合条件的网络指标数据。\n\n您可以尝试其他查询条件：\n- 查看所有网络指标\n- 按节点类型查询：路由器、交换机、防火墙、服务器、负载均衡器`,
        };
      }
    }
  }

  if (msg.includes('标题') && selectedPanel) {
    const titleMatch = userMessage.match(/(?:改为|改成|修改为|设为|设置为|叫做)[「"']?([^「"'"」\n]+)/);
    const newTitle = titleMatch?.[1]?.trim();

    if (newTitle) {
      return {
        success: true,
        message: `已将「${selectedPanel.title}」的标题修改为「${newTitle}」，预览已实时更新。`,
        modifications: [
          {
            panelId: selectedPanel.id,
            field: 'title',
            oldValue: selectedPanel.title,
            newValue: newTitle,
            description: `标题 → ${newTitle}`,
          },
        ],
      };
    }

    return {
      success: true,
      message: `请告诉我您想将「${selectedPanel.title}」的标题修改为什么？例如："将标题改为 系统运行概览"`,
    };
  }

  if (msg.includes('描述') && selectedPanel) {
    const descMatch = userMessage.match(/(?:改为|改成|修改为|设为|设置为)[「"']?([^「"'"」\n]+)/);
    const newDesc = descMatch?.[1]?.trim();

    if (newDesc) {
      return {
        success: true,
        message: `已将「${selectedPanel.title}」的描述修改为「${newDesc}」。`,
        modifications: [
          {
            panelId: selectedPanel.id,
            field: 'description',
            oldValue: null,
            newValue: newDesc,
            description: `描述 → ${newDesc}`,
          },
        ],
      };
    }

    return {
      success: true,
      message: `请告诉我您想将「${selectedPanel.title}」的描述修改为什么？`,
    };
  }

  if (msg.includes('删除') || msg.includes('移除')) {
    if (selectedPanel) {
      return {
        success: true,
        message: `已将「${selectedPanel.title}」从报表中移除。如需恢复，可点击顶部的撤销按钮。`,
        modifications: [
          {
            panelId: selectedPanel.id,
            field: 'remove',
            oldValue: null,
            newValue: null,
            description: `移除面板「${selectedPanel.title}」`,
          },
        ],
      };
    }
    return {
      success: true,
      message: '请先选中要删除的面板，然后告诉我删除。',
    };
  }

  if (msg.includes('添加') || msg.includes('新增')) {
    let panelType = '自定义模块';
    if (msg.includes('图表')) panelType = '图表模块';
    else if (msg.includes('指标')) panelType = '指标卡模块';
    else if (msg.includes('表格')) panelType = '数据表模块';

    return {
      success: true,
      message: `已添加新的「${panelType}」。您可以在预览中拖拽调整位置，或选中后继续对话修改内容。`,
      modifications: [
        {
          panelId: `new-${Date.now()}`,
          field: 'add',
          oldValue: null,
          newValue: { type: panelType },
          description: `新增${panelType}`,
        },
      ],
    };
  }

  if (msg.includes('数据源') || msg.includes('api') || msg.includes('接口') || msg.includes('数据')) {
    if (selectedPanel) {
      if (msg.includes('查看') || msg.includes('是什么') || msg.includes('从哪来') || msg.includes('信息')) {
        const datasource = selectedPanel.datasource;
        let datasourceInfo = `📊 **「${selectedPanel.title}」数据源信息**\n\n`;
        
        if (datasource) {
          datasourceInfo += `**类型**: ${datasource.type || 'API'}\n`;
          
          if (datasource.endpoint) {
            let fullUrl = datasource.endpoint;
            if (datasource.params && Object.keys(datasource.params).length > 0) {
              const queryString = Object.entries(datasource.params)
                .map(([key, value]) => `${key}=${value}`)
                .join('&');
              fullUrl += `?${queryString}`;
            }
            datasourceInfo += `**完整 API 地址**: ${fullUrl}\n`;
            datasourceInfo += `**API 端点**: ${datasource.endpoint}\n`;
            datasourceInfo += `**请求方法**: ${datasource.method || 'GET'}\n`;
            
            if (datasource.params) {
              datasourceInfo += `\n**请求参数**:\n`;
              Object.entries(datasource.params).forEach(([key, value]) => {
                datasourceInfo += `- ${key}: ${value}\n`;
              });
            }
          }
          
          if (datasource.endpoints) {
            datasourceInfo += `\n**多数据源配置**:\n`;
            if (datasource.endpoints.assessment) {
              let assessmentUrl = datasource.endpoints.assessment.endpoint;
              if (datasource.endpoints.assessment.params && Object.keys(datasource.endpoints.assessment.params).length > 0) {
                const queryString = Object.entries(datasource.endpoints.assessment.params)
                  .map(([key, value]) => `${key}=${value}`)
                  .join('&');
                assessmentUrl += `?${queryString}`;
              }
              datasourceInfo += `- 评估数据: ${assessmentUrl}\n`;
            }
            if (datasource.endpoints.actionPlan) {
              let actionPlanUrl = datasource.endpoints.actionPlan.endpoint;
              if (datasource.endpoints.actionPlan.params && Object.keys(datasource.endpoints.actionPlan.params).length > 0) {
                const queryString = Object.entries(datasource.endpoints.actionPlan.params)
                  .map(([key, value]) => `${key}=${value}`)
                  .join('&');
                actionPlanUrl += `?${queryString}`;
              }
              datasourceInfo += `- 行动计划: ${actionPlanUrl}\n`;
            }
          }
          
          datasourceInfo += `\n💡 您可以修改数据源地址，例如："修改数据源为 /api/custom-data"`;
        } else {
          datasourceInfo += `暂无数据源配置信息。\n\n您可以设置数据源，例如："设置数据源为 /api/panel/data"`;
        }
        
        return {
          success: true,
          message: datasourceInfo,
        };
      }
      
      const endpointMatch = userMessage.match(/(?:改为|改成|修改为|设为|设置为)[「"']?([^「"'"」\s\n]+)/);
      const newEndpoint = endpointMatch?.[1]?.trim();

      if (msg.includes('网络指标') || msg.includes('网络数据')) {
        const networkEndpoint = '/api/network-metrics';
        return {
          success: true,
          message: `已将「${selectedPanel.title}」的数据源地址修改为「${networkEndpoint}」。`,
          modifications: [
            {
              panelId: selectedPanel.id,
              field: 'endpoint',
              oldValue: selectedPanel.datasource?.endpoint,
              newValue: networkEndpoint,
              description: `数据源 → ${networkEndpoint}`,
            },
          ],
        };
      }

      if (newEndpoint && newEndpoint.startsWith('/')) {
        return {
          success: true,
          message: `已将「${selectedPanel.title}」的数据源地址修改为「${newEndpoint}」。`,
          modifications: [
            {
              panelId: selectedPanel.id,
              field: 'endpoint',
              oldValue: selectedPanel.datasource?.endpoint,
              newValue: newEndpoint,
              description: `数据源 → ${newEndpoint}`,
            },
          ],
        };
      }

      return {
        success: true,
        message: `当前面板「${selectedPanel.title}」的数据源信息：
- 类型：${selectedPanel.datasource?.type || 'API'}
- 端点：${selectedPanel.datasource?.endpoint || `/api/panel/${selectedPanel.type.replace('_', '-')}`}
- 参数：${selectedPanel.datasource?.params ? Object.entries(selectedPanel.datasource.params).map(([k, v]) => `${k}=${v}`).join(', ') : 'date, systemId'}

您可以告诉我新的数据源地址，例如："修改数据源为 /api/custom-data"`,
      };
    }
    return {
      success: true,
      message: '请先选中要查看或修改数据源的面板。',
    };
  }

  if (msg.includes('样式') || msg.includes('颜色') || msg.includes('背景') || msg.includes('字体') || msg.includes('大小') || msg.includes('宽度') || msg.includes('高度') || msg.includes('边框') || msg.includes('对齐')) {
    if (selectedPanel) {
      const styleMatch = userMessage.match(/(?:改为|改成|修改为|设为|设置为|调整|改变)[「"']?([^「"'"」\n]+)/);
      const styleValue = styleMatch?.[1]?.trim();
      
      let styleField = '';
      let styleDescription = '';
      
      if (msg.includes('背景色') || msg.includes('背景颜色')) {
        styleField = 'backgroundColor';
        styleDescription = '背景色';
      } else if (msg.includes('颜色') || msg.includes('文字颜色')) {
        styleField = 'color';
        styleDescription = '文字颜色';
      } else if (msg.includes('字体大小') || msg.includes('字号')) {
        styleField = 'fontSize';
        styleDescription = '字体大小';
      } else if (msg.includes('宽度')) {
        styleField = 'width';
        styleDescription = '宽度';
      } else if (msg.includes('高度')) {
        styleField = 'height';
        styleDescription = '高度';
      } else if (msg.includes('边框')) {
        styleField = 'border';
        styleDescription = '边框';
      } else if (msg.includes('圆角')) {
        styleField = 'borderRadius';
        styleDescription = '圆角';
      } else if (msg.includes('内边距') || msg.includes('padding')) {
        styleField = 'padding';
        styleDescription = '内边距';
      } else if (msg.includes('外边距') || msg.includes('margin')) {
        styleField = 'margin';
        styleDescription = '外边距';
      } else if (msg.includes('对齐') || msg.includes('左对齐') || msg.includes('右对齐') || msg.includes('居中')) {
        styleField = 'textAlign';
        styleDescription = '文本对齐';
        if (msg.includes('左对齐') || msg.includes('左')) {
          styleValue = 'left';
        } else if (msg.includes('右对齐') || msg.includes('右')) {
          styleValue = 'right';
        } else if (msg.includes('居中') || msg.includes('中心')) {
          styleValue = 'center';
        }
      }
      
      if (styleField && styleValue) {
        return {
          success: true,
          message: `已将「${selectedPanel.title}」的${styleDescription}修改为「${styleValue}」。`,
          modifications: [
            {
              panelId: selectedPanel.id,
              field: 'style',
              oldValue: selectedPanel.styles?.[styleField],
              newValue: { [styleField]: styleValue },
              description: `${styleDescription} → ${styleValue}`,
            },
          ],
        };
      }
      
      return {
        success: true,
        message: `🎨 **样式修改助手**

您可以为「${selectedPanel.title}」面板调整以下样式：

**颜色相关**:
- 背景色：例如 "将背景色改为蓝色"
- 文字颜色：例如 "修改文字颜色为白色"

**尺寸相关**:
- 宽度：例如 "调整宽度为 100%"
- 高度：例如 "修改高度为 500px"
- 字体大小：例如 "将字体大小改为 16px"

**边框相关**:
- 边框：例如 "添加 1px 实线边框"
- 圆角：例如 "设置圆角为 8px"

**间距相关**:
- 内边距：例如 "设置内边距为 20px"
- 外边距：例如 "调整外边距为 10px"

请告诉我您想修改哪个样式属性。`,
      };
    }
    return {
      success: true,
      message: '请先选中要修改样式的面板。',
    };
  }

  if (selectedPanel) {
    return {
      success: true,
      message: `您选中了「${selectedPanel.title}」面板。我可以帮您进行以下调整：

1. **修改标题** — 例如 "将标题改为 XXX"
2. **修改描述** — 例如 "修改描述为 XXX"
3. **查看/修改数据源** — 例如 "查看数据源" 或 "修改数据源为 /api/xxx"
4. **修改样式** — 例如 "修改背景色为蓝色" 或 "调整宽度"
5. **删除面板** — 例如 "删除这个面板"
6. **查询网络指标** — 例如 "查看网络指标" 或 "网络指标统计概览"

请描述您的修改需求，预览将实时更新。`,
    };
  }

  return {
    success: true,
    message: `您好！我是 GLM-5 报表助手，可以帮您实时调整报表模板：

1. **选中面板** — 在左侧预览中点击任意可编辑面板
2. **描述修改** — 告诉我您想调整的内容
3. **实时预览** — 修改会立即反映在左侧预览中

您也可以直接说：
- "添加一个图表模块"
- "添加一个指标卡"
- "添加一个数据表"
- "查看网络指标数据"
- "网络指标统计概览"

注意：「核心结论与风险」和「评估与计划」为固定模块，不可修改。`,
  };
}

export default {
  callGLM5,
};
