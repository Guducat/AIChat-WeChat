// 常量定义
export const API_BASE_URL = 'https://your-api-domain.com/api'
export const USE_MOCK_DATA = true // 是否使用模拟数据

// SiliconFlow API配置
export const SILICONFLOW_API_BASE = 'https://api.siliconflow.cn/v1'

// 引入统一的AI模型信息
import { SILICONFLOW_MODELS, AI_MODELS_CONFIG } from './aiInfo.js'

// 导出AI模型相关配置（保持向后兼容）
export { SILICONFLOW_MODELS }
export const DEFAULT_AI_MODELS = AI_MODELS_CONFIG

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
