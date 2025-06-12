// SiliconFlow API 集成示例
// 注意：这是一个示例文件，展示如何与SiliconFlow API集成
// 实际使用时需要配置正确的API Key和后端代理

import { SILICONFLOW_API_BASE } from './constants.js'

// SiliconFlow API Key (生产环境应该从后端获取，不要直接暴露在前端)
const SILICONFLOW_API_KEY = 'your-siliconflow-api-key-here'

/**
 * SiliconFlow API请求封装
 * @param {string} endpoint API端点
 * @param {Object} options 请求选项
 */
const siliconFlowRequest = (endpoint, options = {}) => {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${SILICONFLOW_API_BASE}${endpoint}`,
      method: options.method || 'POST',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SILICONFLOW_API_KEY}`,
        ...options.header
      },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data)
        } else {
          reject(new Error(`SiliconFlow API请求失败: ${res.statusCode}`))
        }
      },
      fail: (error) => {
        reject(error)
      }
    })
  })
}

/**
 * 发送聊天消息到SiliconFlow API
 * @param {Object} params 聊天参数
 */
export const sendChatToSiliconFlow = async (params) => {
  try {
    // 构建请求数据
    const requestData = {
      model: params.model,
      messages: params.messages,
      stream: false, // 微信小程序不支持SSE，使用非流式
      max_tokens: params.max_tokens || 2048,
      temperature: params.temperature || 0.7
    }

    // 如果是多模态模型，添加额外参数
    if (isMultimodalModel(params.model)) {
      requestData.enable_thinking = true
      requestData.thinking_budget = 4096
      requestData.min_p = 0.05
      requestData.top_p = 0.7
      requestData.top_k = 50
      requestData.frequency_penalty = 0.5
      requestData.n = 1
      requestData.stop = []
    }

    console.log('SiliconFlow API请求数据:', {
      model: requestData.model,
      messageCount: requestData.messages.length,
      isMultimodal: isMultimodalModel(params.model),
      hasMultimodalContent: requestData.messages.some(msg =>
        Array.isArray(msg.content) && msg.content.some(c => c.type === 'image_url')
      )
    })

    const response = await siliconFlowRequest('/chat/completions', {
      method: 'POST',
      data: requestData
    })

    return {
      success: true,
      data: response
    }
  } catch (error) {
    console.error('SiliconFlow API调用失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 上传文件到SiliconFlow
 * @param {string} filePath 文件路径
 * @param {string} purpose 用途 (batch)
 */
export const uploadFileToSiliconFlow = (filePath, purpose = 'batch') => {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${SILICONFLOW_API_BASE}/files`,
      filePath: filePath,
      name: 'file',
      formData: {
        purpose: purpose
      },
      header: {
        'Authorization': `Bearer ${SILICONFLOW_API_KEY}`
      },
      success: (res) => {
        try {
          const data = JSON.parse(res.data)
          if (data.id) {
            resolve({
              success: true,
              data: data
            })
          } else {
            reject(new Error(data.message || '上传失败'))
          }
        } catch (error) {
          reject(new Error('响应数据格式错误'))
        }
      },
      fail: (error) => {
        reject(error)
      }
    })
  })
}

/**
 * 获取SiliconFlow模型列表
 */
export const getSiliconFlowModels = async () => {
  try {
    const response = await siliconFlowRequest('/models', {
      method: 'GET'
    })
    
    return {
      success: true,
      data: response.data || []
    }
  } catch (error) {
    console.error('获取模型列表失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 获取用户账户信息
 */
export const getSiliconFlowUserInfo = async () => {
  try {
    const response = await siliconFlowRequest('/user', {
      method: 'GET'
    })
    
    return {
      success: true,
      data: response
    }
  } catch (error) {
    console.error('获取用户信息失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 检查是否为多模态模型
 * @param {string} model 模型ID
 * @returns {boolean} 是否为多模态模型
 */
export const isMultimodalModel = (model) => {
  const multimodalModels = [
    'Qwen/Qwen2.5-VL-72B-Instruct',
    'Qwen/Qwen2.5-VL-32B-Instruct',
    'deepseek-ai/deepseek-vl2',
    'Qwen/QVQ-72B-Preview',
    'Qwen/Qwen2-VL-72B-Instruct'
  ]
  return multimodalModels.includes(model)
}

/**
 * 处理图文对话（使用base64编码）
 * @param {string} text 文本内容
 * @param {Array} images 图片文件列表（包含base64数据）
 * @param {string} model 模型ID
 */
export const sendMultimodalMessage = async (text, images = [], model = 'Qwen/Qwen2.5-VL-72B-Instruct') => {
  try {
    // 检查是否为多模态模型
    if (!isMultimodalModel(model)) {
      console.warn(`模型 ${model} 不支持多模态输入`)
      return {
        success: false,
        error: `模型 ${model} 不支持多模态输入`
      }
    }

    // 构建消息内容数组
    const content = []

    // 添加文本内容
    if (text && text.trim()) {
      content.push({
        type: 'text',
        text: text.trim()
      })
    }

    // 添加图片内容（使用base64格式）
    for (const image of images) {
      if (image.fileUrl) {
        // 验证是否为有效的base64或HTTP URL
        if (image.fileUrl.startsWith('data:image/') || image.fileUrl.startsWith('http')) {
          content.push({
            type: 'image_url',
            image_url: {
              url: image.fileUrl,
              detail: 'auto'
            }
          })
          console.log('添加图片到消息:', {
            type: image.fileUrl.startsWith('data:') ? 'base64' : 'url',
            size: image.fileUrl.length
          })
        } else {
          console.warn('无效的图片URL格式:', image.fileUrl.substring(0, 50))
        }
      }
    }

    // 确保至少有一个内容部分
    if (content.length === 0) {
      return {
        success: false,
        error: '消息内容不能为空'
      }
    }

    const messages = [
      {
        role: 'user',
        content: content
      }
    ]

    console.log('发送多模态消息:', {
      model: model,
      contentParts: content.length,
      hasText: content.some(c => c.type === 'text'),
      hasImages: content.some(c => c.type === 'image_url')
    })

    const response = await sendChatToSiliconFlow({
      model: model,
      messages: messages
    })

    return response
  } catch (error) {
    console.error('多模态消息发送失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 计算Token消耗（估算）
 * @param {string} text 文本内容
 * @param {number} imageCount 图片数量
 */
export const estimateTokenUsage = (text = '', imageCount = 0) => {
  // 简单的Token估算：
  // - 中文字符按1.5个token计算
  // - 英文单词按1个token计算
  // - 图片按固定token计算（根据模型不同）
  
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
  const otherChars = text.length - chineseChars - englishWords
  
  const textTokens = Math.ceil(chineseChars * 1.5 + englishWords + otherChars * 0.5)
  const imageTokens = imageCount * 1000 // 每张图片约1000个token
  
  return {
    textTokens,
    imageTokens,
    totalTokens: textTokens + imageTokens
  }
}

/**
 * 错误处理
 */
export const handleSiliconFlowError = (error) => {
  console.error('SiliconFlow API错误:', error)
  
  let message = '网络请求失败'
  
  if (error.message) {
    if (error.message.includes('401')) {
      message = 'API密钥无效，请检查配置'
    } else if (error.message.includes('429')) {
      message = '请求过于频繁，请稍后重试'
    } else if (error.message.includes('500')) {
      message = '服务器内部错误'
    } else {
      message = error.message
    }
  }
  
  wx.showToast({
    title: message,
    icon: 'none',
    duration: 3000
  })
  
  return message
}

// 使用说明：
// 1. 将 SILICONFLOW_API_KEY 替换为您的真实API密钥
// 2. 在生产环境中，建议通过后端代理API调用，避免密钥泄露
// 3. 根据实际需求调整模型参数和错误处理逻辑
// 4. 注意微信小程序的网络请求限制和域名白名单配置
