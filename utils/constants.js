// 常量定义
export const API_BASE_URL = 'https://your-api-domain.com/api'
export const USE_MOCK_DATA = true // 是否使用模拟数据

// SiliconFlow API配置
export const SILICONFLOW_API_BASE = 'https://api.siliconflow.cn/v1'

// SiliconFlow支持的模型列表（基于官方文档）
export const SILICONFLOW_MODELS = {
  // 文本模型
  TEXT_MODELS: [
    'deepseek-ai/DeepSeek-V3',
    'deepseek-ai/DeepSeek-R1',
    'Qwen/Qwen2.5-72B-Instruct',
    'Qwen/Qwen2.5-32B-Instruct',
    'Qwen/Qwen2.5-14B-Instruct',
    'Qwen/Qwen2.5-7B-Instruct',
    'Qwen/QwQ-32B',
    'THUDM/glm-4-9b-chat'
  ],
  // 多模态模型（支持图像输入）
  MULTIMODAL_MODELS: [
    'Qwen/Qwen2.5-VL-72B-Instruct',
    'Qwen/Qwen2.5-VL-32B-Instruct',
    'deepseek-ai/deepseek-vl2',
    'Qwen/QVQ-72B-Preview'
  ]
}

// 默认AI模型配置（基于SiliconFlow API）
export const DEFAULT_AI_MODELS = [
  {
    id: 'deepseek-ai/DeepSeek-V3',
    name: 'DeepSeek-V3',
    description: '上下文64K，单次回复最多8K tokens',
    contextLength: 65536,
    maxOutputTokens: 8192,
    pricePerInputToken: 0.00014,  // ¥0.00014/token
    pricePerOutputToken: 0.00028, // ¥0.00028/token
    icon: '🧠',
    supportMultimodal: false,
    provider: 'siliconflow'
  },
  {
    id: 'Qwen/Qwen2.5-VL-72B-Instruct',
    name: 'Qwen2.5-VL-72B',
    description: '上下文128K，支持视觉理解，单次回复最多8K tokens',
    contextLength: 131072,
    maxOutputTokens: 8192,
    pricePerInputToken: 0.00053,  // ¥0.00053/token
    pricePerOutputToken: 0.00053, // ¥0.00053/token
    icon: '👁️',
    supportMultimodal: true,
    provider: 'siliconflow'
  },
  {
    id: 'deepseek-ai/DeepSeek-R1',
    name: 'DeepSeek-R1',
    description: '上下文96K，单次回复最多8K tokens，推理能力强',
    contextLength: 98304,
    maxOutputTokens: 8192,
    pricePerInputToken: 0.00055,  // ¥0.00055/token
    pricePerOutputToken: 0.0022,  // ¥0.0022/token
    icon: '🔬',
    supportMultimodal: false,
    provider: 'siliconflow'
  }
]

// 默认对话场景配置（简化为通用对话）
export const DEFAULT_CHAT_SCENARIO = {
  id: 'general',
  name: '通用对话',
  description: '智能AI助手，可以回答各种问题',
  icon: '🤖',
  systemPrompt: '你是一个友善且专业的AI助手。请用简洁明了的方式回答用户的问题，提供有用的信息和建议。如果用户上传了图片，请仔细分析图片内容并给出相关回复。'
}

// 存储键名
export const STORAGE_KEYS = {
  CHAT_HISTORY: 'chat_history',
  USER_SETTINGS: 'user_settings',
  SELECTED_MODEL: 'selected_model',
  USER_INFO: 'user_info',
  LOGIN_STATUS: 'login_status',
  TOKEN_STATS: 'token_stats',
  FILE_RECORDS: 'file_records',
  SILICONFLOW_API_KEY: 'siliconflow_api_key'
}

// 消息类型
export const MESSAGE_TYPES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system'
}

// 文件类型
export const FILE_TYPES = {
  IMAGE: 'image',
  DOCUMENT: 'document',
  AUDIO: 'audio',
  VIDEO: 'video'
}

// 支持的图片格式
export const SUPPORTED_IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'gif', 'webp']

// 文件上传限制
export const UPLOAD_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_IMAGE_COUNT: 9, // 最多9张图片
  SUPPORTED_FORMATS: SUPPORTED_IMAGE_TYPES
}

// 对话状态
export const CHAT_STATUS = {
  IDLE: 'idle',
  SENDING: 'sending',
  RECEIVING: 'receiving',
  ERROR: 'error'
}

// 登录状态
export const LOGIN_STATUS = {
  LOGGED_OUT: 'logged_out',
  LOGGED_IN: 'logged_in'
}

// 货币单位
export const CURRENCY = {
  SYMBOL: '¥',
  NAME: '人民币',
  CODE: 'CNY'
}
