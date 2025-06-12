// AI模型信息统一管理
// 集中管理所有AI模型相关的配置、定价、测试用例等信息

// SiliconFlow支持的模型列表（精简版）
export const SILICONFLOW_MODELS = {
  // 文本模型
  TEXT_MODELS: [
    'deepseek-ai/DeepSeek-V3',
    'deepseek-ai/DeepSeek-R1'
  ],
  // 多模态模型（支持图像输入）
  MULTIMODAL_MODELS: [
    'Qwen/Qwen2.5-VL-72B-Instruct'
  ]
}

// AI模型详细配置信息（精简版，定价格式：每百万tokens）
export const AI_MODELS_CONFIG = [
  {
    id: 'deepseek-ai/DeepSeek-V3',
    name: 'DeepSeek-V3',
    description: '上下文64K，单次回复最多8K tokens',
    contextLength: 65536,
    maxOutputTokens: 8192,
    pricePerInputToken: 2,    // ¥2/百万tokens
    pricePerOutputToken: 8,   // ¥8/百万tokens
    icon: '🧠',
    supportMultimodal: false,
    provider: 'siliconflow',
    category: 'text',
    isThinkingModel: false
  },
  {
    id: 'Qwen/Qwen2.5-VL-72B-Instruct',
    name: 'Qwen2.5-VL-72B',
    description: '上下文128K，支持视觉理解，单次回复最多8K tokens',
    contextLength: 131072,
    maxOutputTokens: 8192,
    pricePerInputToken: 4.13,  // ¥4.13/百万tokens
    pricePerOutputToken: 4.13, // ¥4.13/百万tokens
    icon: '👁️',
    supportMultimodal: true,
    provider: 'siliconflow',
    category: 'multimodal',
    isThinkingModel: false
  },
  {
    id: 'deepseek-ai/DeepSeek-R1',
    name: 'DeepSeek-R1',
    description: '上下文96K，单次回复最多8K tokens，推理能力强',
    contextLength: 98304,
    maxOutputTokens: 8192,
    pricePerInputToken: 4,    // ¥4/百万tokens
    pricePerOutputToken: 16,  // ¥16/百万tokens
    icon: '🔬',
    supportMultimodal: false,
    provider: 'siliconflow',
    category: 'text',
    isThinkingModel: true
  }
]

// 模型定价信息（用于费用计算，格式：每百万tokens价格）
export const MODEL_PRICING = {
  'deepseek-ai/DeepSeek-V3': {
    inputPrice: 2,      // ¥2/百万tokens
    outputPrice: 8      // ¥8/百万tokens
  },
  'Qwen/Qwen2.5-VL-72B-Instruct': {
    inputPrice: 4.13,   // ¥4.13/百万tokens
    outputPrice: 4.13   // ¥4.13/百万tokens
  },
  'deepseek-ai/DeepSeek-R1': {
    inputPrice: 4,      // ¥4/百万tokens
    outputPrice: 16     // ¥16/百万tokens
  }
}

// 测试用例数据
export const AI_MODEL_TEST_CASES = {
  // 错误消息识别测试用例
  ERROR_MESSAGE_TESTS: [
    {
      id: 'test_1',
      type: 'assistant',
      content: '正常回答',
      isError: false,
      isStreaming: false,
      expected: false,
      description: '正常消息'
    },
    {
      id: 'test_2',
      type: 'assistant',
      content: '抱歉，发生了错误，请稍后重试。',
      isError: true,
      isStreaming: false,
      expected: true,
      description: '明确标记的错误消息'
    },
    {
      id: 'test_3',
      type: 'assistant',
      content: '',
      isError: false,
      isStreaming: false,
      contentNodes: null,
      reasoningContent: '',
      expected: true,
      description: '空内容的AI消息'
    },
    {
      id: 'test_4',
      type: 'assistant',
      content: 'API调用失败，请稍后重试',
      isError: false,
      isStreaming: false,
      expected: true,
      description: '包含错误关键词的消息'
    },
    {
      id: 'test_5',
      type: 'assistant',
      content: '',
      isError: false,
      isStreaming: true,
      expected: false,
      description: '正在流式传输的空消息（不应显示重试）'
    }
  ],

  // 费用计算测试用例（基于新的百万tokens定价格式）
  COST_CALCULATION_TESTS: [
    {
      model: 'deepseek-ai/DeepSeek-V3',
      promptTokens: 11129,
      completionTokens: 126,
      expectedInputCost: 0.022258,    // (11129 / 1000000) * 2 = 0.022258
      expectedOutputCost: 0.001008,   // (126 / 1000000) * 8 = 0.001008
      expectedTotalCost: 0.023266,    // 0.022258 + 0.001008 = 0.023266
      description: 'DeepSeek-V3费用计算'
    },
    {
      model: 'Qwen/Qwen2.5-VL-72B-Instruct',
      promptTokens: 11129,
      completionTokens: 126,
      expectedInputCost: 0.045963,    // (11129 / 1000000) * 4.13 = 0.045963
      expectedOutputCost: 0.000520,   // (126 / 1000000) * 4.13 = 0.000520
      expectedTotalCost: 0.046483,    // 0.045963 + 0.000520 = 0.046483
      description: 'Qwen2.5-VL-72B费用计算'
    },
    {
      model: 'deepseek-ai/DeepSeek-R1',
      promptTokens: 11129,
      completionTokens: 126,
      expectedInputCost: 0.044516,    // (11129 / 1000000) * 4 = 0.044516
      expectedOutputCost: 0.002016,   // (126 / 1000000) * 16 = 0.002016
      expectedTotalCost: 0.046532,    // 0.044516 + 0.002016 = 0.046532
      description: 'DeepSeek-R1费用计算'
    }
  ],

  // Token格式化测试用例
  TOKEN_FORMAT_TESTS: [
    { tokens: 126, expected: '126 tokens' },
    { tokens: 1500, expected: '1.5K tokens' },
    { tokens: 11255, expected: '11.3K tokens' },
    { tokens: 1500000, expected: '1.5M tokens' }
  ],

  // 费用格式化测试用例
  COST_FORMAT_TESTS: [
    { cost: 0.000001, expected: '¥0.000001' },
    { cost: 0.001234, expected: '¥0.0012' },
    { cost: 0.123456, expected: '¥0.1235' },
    { cost: 1.23, expected: '¥1.23' }
  ]
}

// 工具函数

/**
 * 根据模型ID获取模型配置
 * @param {string} modelId 模型ID
 * @returns {object|null} 模型配置对象
 */
export function getModelConfig(modelId) {
  return AI_MODELS_CONFIG.find(model => model.id === modelId) || null
}

/**
 * 根据模型ID获取定价信息
 * @param {string} modelId 模型ID
 * @returns {object|null} 定价信息对象
 */
export function getModelPricing(modelId) {
  return MODEL_PRICING[modelId] || null
}

/**
 * 检查模型是否支持多模态
 * @param {string} modelId 模型ID
 * @returns {boolean} 是否支持多模态
 */
export function isMultimodalModel(modelId) {
  return SILICONFLOW_MODELS.MULTIMODAL_MODELS.includes(modelId)
}

/**
 * 检查模型是否为思考模型（如DeepSeek-R1）
 * @param {string} modelId 模型ID
 * @returns {boolean} 是否为思考模型
 */
export function isThinkingModel(modelId) {
  const config = getModelConfig(modelId)
  return config ? config.isThinkingModel : false
}

/**
 * 格式化模型价格显示（每百万tokens）
 * @param {number} pricePerMillionTokens 每百万tokens价格
 * @returns {string} 格式化的价格显示
 */
export function formatModelPrice(pricePerMillionTokens) {
  if (!pricePerMillionTokens || pricePerMillionTokens === 0) return ''

  return `¥${pricePerMillionTokens.toFixed(2)}/百万tokens`
}

/**
 * 计算精确费用（基于每百万tokens定价）
 * @param {string} modelId 模型ID
 * @param {number} promptTokens 输入token数
 * @param {number} completionTokens 输出token数
 * @returns {object} 费用计算结果
 */
export function calculateModelCost(modelId, promptTokens, completionTokens) {
  const pricing = getModelPricing(modelId)
  if (!pricing) {
    return {
      inputCost: 0,
      outputCost: 0,
      totalCost: 0,
      error: '未找到模型定价信息'
    }
  }

  // 新的计算逻辑：(token数 / 1000000) * 每百万tokens价格
  const inputCost = (promptTokens / 1000000) * pricing.inputPrice
  const outputCost = (completionTokens / 1000000) * pricing.outputPrice
  const totalCost = inputCost + outputCost

  return {
    inputCost: parseFloat(inputCost.toFixed(6)),
    outputCost: parseFloat(outputCost.toFixed(6)),
    totalCost: parseFloat(totalCost.toFixed(6)),
    pricing: pricing
  }
}

// 默认导出
export default {
  SILICONFLOW_MODELS,
  AI_MODELS_CONFIG,
  MODEL_PRICING,
  AI_MODEL_TEST_CASES,
  getModelConfig,
  getModelPricing,
  isMultimodalModel,
  isThinkingModel,
  formatModelPrice,
  calculateModelCost
}
