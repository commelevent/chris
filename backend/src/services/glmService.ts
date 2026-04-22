import axios from 'axios';

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

const SYSTEM_PROMPT = `你是一个专业的报表模板配置助手，帮助用户通过自然语言修改报表模板。

## 核心能力
1. 理解用户的自然语言修改需求
2. 将需求转换为具体的配置修改操作
3. 保持配置格式一致，遵循最佳实践
4. 提供数据源信息和样式调整建议

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

## 回复规则
- 用简洁的中文回复
- 明确说明修改了什么
- 如果用户询问数据源，提供详细的数据源信息
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
      
      panelInfo += `\n\n用户需求：${userMessage}`;
      panelInfo += `\n\n请根据用户需求修改选中的面板，用简洁的中文说明修改内容。`;
      
      messages.push({
        role: 'user',
        content: panelInfo,
      });
    } else {
      messages.push({
        role: 'user',
        content: userMessage,
      });
    }

    const request: GLMRequest = {
      model: 'GLM-5',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
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
    return url.replace(/^[`「"']+|[`」"']+$/g, '').trim();
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

  const deleteMatch = content.match(/已[删除移除]/);
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

function simulateAIResponse(
  userMessage: string,
  selectedPanel?: SelectedPanelInfo
): AIResponse {
  const msg = userMessage.toLowerCase();

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

      if (newEndpoint) {
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

  if (msg.includes('样式') || msg.includes('颜色') || msg.includes('背景') || msg.includes('字体') || msg.includes('大小') || msg.includes('宽度') || msg.includes('高度') || msg.includes('边框')) {
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

注意：「核心结论与风险」和「评估与计划」为固定模块，不可修改。`,
  };
}

export default {
  callGLM5,
};
