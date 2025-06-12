// API接口封装
import { API_BASE_URL, DEFAULT_AI_MODELS, SILICONFLOW_API_BASE, CURRENCY, USE_MOCK_DATA } from './constants.js'
import { getSiliconFlowApiKey, hasSiliconFlowApiKey } from './storage.js'
import { processMultimodalMessage, validateBase64Image } from './image-processor.js'

/**
 * 发起HTTP请求
 * @param {string} url 请求地址
 * @param {Object} options 请求选项
 */
const request = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE_URL}${url}`,
      method: options.method || 'GET',
      data: options.data || {},
    header: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data)
        } else {
          reject(new Error(`请求失败: ${res.statusCode}`))
        }
      },
      fail: (error) => {
        reject(error)
      }
    })
  })
}

/**
 * SiliconFlow API请求
 * @param {string} endpoint API端点
 * @param {Object} options 请求选项
 */
// 移除未使用的函数

/**
 * 发送对话消息 (支持流式输出和多模态)
 * @param {Object} params 请求参数
 * @param {Function} onMessage 接收消息回调
 * @param {Function} onComplete 完成回调
 * @param {Function} onError 错误回调
 */
export const sendChatMessage = async (params, onMessage, onComplete, onError) => {
  try {
    // 处理多模态消息中的图片
    const processedParams = await processMultimodalParams(params)

    // 检查是否配置了API Key
    if (!hasSiliconFlowApiKey()) {
      // 使用模拟数据
      return simulateStreamResponse(processedParams, onMessage, onComplete, onError)
    }

    // 使用真实SiliconFlow API
    return sendToSiliconFlowAPI(processedParams, onMessage, onComplete, onError)

  } catch (error) {
    console.error('处理消息参数失败:', error)
    onError && onError(error)
    return { close: () => {} }
  }
}

/**
 * 处理多模态参数
 * @param {Object} params 原始参数
 * @returns {Promise<Object>} 处理后的参数
 */
const processMultimodalParams = async (params) => {
  if (!params.messages || params.messages.length === 0) {
    return params
  }

  console.log('开始处理多模态参数...')

  // 处理每个消息中的图片
  const processedMessages = await Promise.all(
    params.messages.map(async (message) => {
      if (message.files && message.files.length > 0) {
        console.log('处理包含文件的消息:', message)
        return await processMultimodalMessage(message)
      }
      return message
    })
  )

  return {
    ...params,
    messages: processedMessages
  }
}

/**
 * 调用SiliconFlow API (基于官方文档实现)
 * @param {Object} params 请求参数
 * @param {Function} onMessage 接收消息回调
 * @param {Function} onComplete 完成回调
 * @param {Function} onError 错误回调
 */
const sendToSiliconFlowAPI = (params, onMessage, onComplete, onError) => {
  const apiKey = getSiliconFlowApiKey()

  if (!apiKey) {
    onError && onError(new Error('API Key未配置，请先在个人中心配置API Key'))
    return { close: () => {} }
  }

  // 验证API Key格式
  if (apiKey.length < 20) {
    onError && onError(new Error('API Key格式错误，请检查是否完整'))
    return { close: () => {} }
  }

  let isAborted = false

  // 构建符合SiliconFlow API规范的请求数据
  const model = params.model || 'deepseek-ai/DeepSeek-V3'
  const requestData = {
    model: model,
    messages: formatMessagesForSiliconFlow(params.messages, model),
    stream: false, // 微信小程序不支持SSE，使用非流式
    max_tokens: params.max_tokens || 2048,
    temperature: params.temperature || 0.7,
    top_p: params.top_p || 0.7,
    frequency_penalty: params.frequency_penalty || 0.5
  }

  // 如果是推理模型，添加推理相关参数
  if (isReasoningModel(params.model)) {
    requestData.enable_thinking = true
    requestData.thinking_budget = 4096
  }

  console.log('发送SiliconFlow API请求:', {
    url: `${SILICONFLOW_API_BASE}/chat/completions`,
    model: requestData.model,
    messageCount: requestData.messages.length,
    apiKeyPrefix: apiKey.substring(0, 8) + '...'
  })

  // 详细记录请求信息用于调试
  console.log('详细请求信息:', {
    url: `${SILICONFLOW_API_BASE}/chat/completions`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`
    },
    dataKeys: Object.keys(requestData),
    apiKeyLength: apiKey.length,
    apiKeyStartsWith: apiKey.substring(0, 3)
  })

  const requestTask = wx.request({
    url: `${SILICONFLOW_API_BASE}/chat/completions`,
    method: 'POST',
    header: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    data: requestData,
    timeout: 60000, // 60秒超时
    enableHttp2: true, // 启用HTTP2
    enableQuic: true, // 启用QUIC
    success: (res) => {
      if (isAborted) return

      console.log('SiliconFlow API响应:', {
        statusCode: res.statusCode,
        hasData: !!res.data
      })

      try {
        if (res.statusCode === 200) {
          const response = res.data

          if (response.choices && response.choices[0] && response.choices[0].message) {
            const message = response.choices[0].message
            const content = message.content || ''
            const reasoningContent = message.reasoning_content || ''

            // 如果有推理内容，先显示推理过程
            if (reasoningContent) {
              simulateTypingEffect(reasoningContent, onMessage, () => {
                // 推理完成后显示最终答案
                simulateTypingEffect(content, onMessage, () => {
                  handleApiSuccess(response, params.model, onComplete)
                })
              }, true) // 标记为推理内容
            } else {
              // 直接显示内容
              simulateTypingEffect(content, onMessage, () => {
                handleApiSuccess(response, params.model, onComplete)
              })
            }
          } else {
            onError && onError(new Error('API响应格式错误'))
          }
        } else {
          handleSiliconFlowApiError(res, onError)
        }
      } catch (error) {
        console.error('处理API响应失败:', error)
        onError && onError(error)
      }
    },
    fail: (error) => {
      if (isAborted) return

      console.error('SiliconFlow API调用失败:', error)
      handleRequestError(error, onError)
    }
  })

  // 返回可取消的任务
  return {
    close: () => {
      isAborted = true
      if (requestTask) {
        requestTask.abort()
      }
    }
  }
}

/**
 * 格式化消息以符合SiliconFlow API规范
 * @param {Array} messages 原始消息数组
 * @param {string} model 使用的模型名称
 */
const formatMessagesForSiliconFlow = (messages, model) => {
  console.log('格式化消息，模型:', model, '消息数量:', messages.length)

  return messages.map((msg, index) => {
    console.log(`处理消息 ${index}:`, msg)

    const formattedMsg = {
      role: msg.role,
      content: msg.content
    }

    // 检查是否为多模态模型且消息包含图片
    if (isMultimodalModel(model) && msg.files && msg.files.length > 0) {
      console.log('检测到多模态模型和文件，开始处理...')

      const contentParts = []
      const imageFiles = msg.files.filter(file => file.fileType === 'image')

      // 如果有图片文件，转换为多模态格式
      if (imageFiles.length > 0) {
        console.log(`找到 ${imageFiles.length} 个图片文件`)

        // 添加文本内容（如果存在）
        if (msg.content && msg.content.trim()) {
          contentParts.push({
            type: 'text',
            text: msg.content.trim()
          })
          console.log('添加文本内容:', msg.content.trim())
        }

        // 添加图片内容
        imageFiles.forEach((file, fileIndex) => {
          console.log(`处理图片文件 ${fileIndex}:`, file)

          let imageUrl = file.fileUrl

          // 处理微信小程序本地图片路径
          if (imageUrl && imageUrl.startsWith('wxfile://')) {
            console.log('检测到微信本地文件，需要转换为Base64')
            // 这里需要在实际使用时转换为Base64
            // 暂时跳过，因为需要在调用处处理
            console.warn('微信本地文件需要转换为Base64:', imageUrl)
            return
          }

          // 验证图片URL格式
          if (imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('data:image/'))) {
            const imageContent = {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: file.detail || 'auto' // 支持high, low, auto
              }
            }

            contentParts.push(imageContent)
            console.log('添加图片内容:', imageContent)
          } else {
            console.warn('无效的图片URL格式:', imageUrl)
          }
        })

        // 如果成功添加了内容部分，使用多模态格式
        if (contentParts.length > 0) {
          formattedMsg.content = contentParts
          console.log('使用多模态格式，内容部分数量:', contentParts.length)
        } else {
          console.warn('没有有效的内容部分，保持原始格式')
        }
      }
    } else if (msg.files && msg.files.length > 0 && !isMultimodalModel(model)) {
      // 非多模态模型但包含文件时的警告
      console.warn(`模型 ${model} 不支持多模态输入，图片将被忽略`)
    }

    console.log(`格式化后的消息 ${index}:`, formattedMsg)
    return formattedMsg
  })
}

/**
 * 检查是否为多模态模型
 * @param {string} model 模型名称
 */
const isMultimodalModel = (model) => {
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
 * 检查是否为推理模型
 */
const isReasoningModel = (model) => {
  const reasoningModels = ['deepseek-ai/DeepSeek-R1', 'Qwen/QwQ-32B']
  return reasoningModels.includes(model)
}

/**
 * 处理API成功响应
 */
const handleApiSuccess = (response, model, onComplete) => {
  const usage = response.usage || {}

  console.log('API响应usage信息:', {
    usage: usage,
    model: model,
    response_id: response.id
  })

  // 使用API返回的精确token数据
  const promptTokens = usage.prompt_tokens || 0
  const completionTokens = usage.completion_tokens || 0
  const totalTokens = usage.total_tokens || (promptTokens + completionTokens)

  // 计算精确费用（输入token和输出token可能有不同价格）
  const cost = calculateAccurateCost(promptTokens, completionTokens, model)

  console.log('Token统计详情:', {
    promptTokens: promptTokens,
    completionTokens: completionTokens,
    totalTokens: totalTokens,
    cost: cost,
    model: model
  })

  onComplete && onComplete({
    tokens: totalTokens,
    promptTokens: promptTokens,
    completionTokens: completionTokens,
    cost: cost,
    currency: CURRENCY.SYMBOL,
    usage: usage
  })
}

/**
 * 处理SiliconFlow API错误响应
 */
const handleSiliconFlowApiError = (res, onError) => {
  let errorMessage = `API请求失败: ${res.statusCode}`
  let errorDetails = ''

  // 详细记录错误信息用于调试
  console.error('SiliconFlow API错误详情:', {
    statusCode: res.statusCode,
    data: res.data,
    header: res.header
  })

  if (res.data) {
    if (res.data.message) {
      errorMessage = res.data.message
      errorDetails = res.data.data || ''
    } else if (typeof res.data === 'string') {
      errorMessage = res.data
    } else if (res.data.error) {
      errorMessage = res.data.error.message || res.data.error
    }
  }

  // 根据状态码提供更友好的错误信息
  switch (res.statusCode) {
    case 400:
      errorMessage = '请求参数错误: ' + errorMessage
      break
    case 401:
      errorMessage = 'API Key无效，请检查配置'
      // 401错误时提供更详细的提示
      if (errorDetails) {
        errorMessage += `\n详情: ${errorDetails}`
      }
      // 检查API Key是否存在
      const apiKey = getSiliconFlowApiKey()
      if (!apiKey) {
        errorMessage = 'API Key未配置，请先在个人中心配置API Key'
      } else if (apiKey.length < 20) {
        errorMessage = 'API Key格式错误，请检查是否完整'
      }
      break
    case 429:
      errorMessage = '请求过于频繁，请稍后重试'
      break
    case 503:
      errorMessage = '模型服务过载，请稍后重试'
      break
    case 504:
      errorMessage = '请求超时，请重试'
      break
  }

  console.error('处理后的错误信息:', errorMessage)
  onError && onError(new Error(errorMessage))
}

/**
 * 处理网络请求错误
 */
const handleRequestError = (error, onError) => {
  let errorMessage = '网络请求失败'

  if (error.errMsg) {
    if (error.errMsg.includes('timeout')) {
      errorMessage = '请求超时，请检查网络连接'
    } else if (error.errMsg.includes('fail')) {
      errorMessage = '网络连接失败，请检查网络设置'
    } else if (error.errMsg.includes('abort')) {
      errorMessage = '请求已取消'
    } else {
      errorMessage = error.errMsg
    }
  }

  onError && onError(new Error(errorMessage))
}

/**
 * 模拟打字效果
 * @param {string} content 完整内容
 * @param {Function} onMessage 消息回调
 * @param {Function} onComplete 完成回调
 * @param {boolean} isReasoning 是否为推理内容
 */
const simulateTypingEffect = (content, onMessage, onComplete, isReasoning = false) => {
  if (!content) {
    onComplete && onComplete()
    return
  }

  const words = content.split('')
  let currentIndex = 0

  // 推理内容打字速度稍快一些
  const interval = isReasoning ? 20 : 30

  const timer = setInterval(() => {
    if (currentIndex < words.length) {
      onMessage && onMessage(words[currentIndex], isReasoning)
      currentIndex++
    } else {
      clearInterval(timer)
      onComplete && onComplete()
    }
  }, interval)

  return timer
}

/**
 * 计算精确的API调用费用
 * @param {number} promptTokens 输入token数量
 * @param {number} completionTokens 输出token数量
 * @param {string} model 模型名称
 * @returns {string} 精确费用（保留6位小数）
 */
const calculateAccurateCost = (promptTokens, completionTokens, model) => {
  const modelConfig = DEFAULT_AI_MODELS.find(m => m.id === model)

  if (!modelConfig) {
    console.warn('未找到模型配置，使用默认价格:', model)
    // 使用默认价格
    const inputCost = promptTokens * 0.00014  // 默认输入价格
    const outputCost = completionTokens * 0.00028  // 默认输出价格
    return (inputCost + outputCost).toFixed(6)
  }

  // 获取模型的输入和输出价格
  const inputPrice = modelConfig.pricePerInputToken || modelConfig.pricePerToken || 0.00014
  const outputPrice = modelConfig.pricePerOutputToken || modelConfig.pricePerToken || 0.00028

  // 计算精确费用
  const inputCost = promptTokens * inputPrice
  const outputCost = completionTokens * outputPrice
  const totalCost = inputCost + outputCost

  console.log('费用计算详情:', {
    model: model,
    promptTokens: promptTokens,
    completionTokens: completionTokens,
    inputPrice: inputPrice,
    outputPrice: outputPrice,
    inputCost: inputCost.toFixed(6),
    outputCost: outputCost.toFixed(6),
    totalCost: totalCost.toFixed(6)
  })

  return totalCost.toFixed(6)
}

/**
 * 计算API调用费用（兼容旧版本）
 * @param {number} tokens Token数量
 * @param {string} model 模型名称
 */
const calculateCost = (tokens, model) => {
  const modelConfig = DEFAULT_AI_MODELS.find(m => m.id === model)
  if (modelConfig) {
    // 假设大部分是输出token
    return (tokens * (modelConfig.pricePerOutputToken || 0.00028)).toFixed(6)
  }
  return (tokens * 0.00028).toFixed(6) // 默认价格
}

/**
 * 模拟流式响应
 */
const simulateStreamResponse = (params, onMessage, onComplete, onError) => {
  const mockResponses = [
    "你好！我是AI助手，很高兴为您服务。",
    "我可以帮助您解答各种问题，包括：\n\n1. 日常生活咨询\n2. 学习和工作建议\n3. 技术问题解答\n4. 创意和写作协助",
    "如果您上传了图片，我也可以帮您分析图片内容。请告诉我您需要什么帮助！",
    "根据您的问题，我来为您详细解答...",
    "希望我的回答对您有帮助！如果还有其他问题，请随时告诉我。"
  ]

  // 根据用户消息选择合适的回复
  const userMessage = params.messages[params.messages.length - 1]?.content || ''
  let responseText = mockResponses[0]

  if (userMessage.includes('图片') || userMessage.includes('照片') || userMessage.includes('看看')) {
    responseText = "我看到您提到了图片。如果您上传了图片，我可以帮您分析图片内容，包括识别物体、文字、场景等。请上传图片，我来为您详细解读！"
  } else if (userMessage.includes('代码') || userMessage.includes('编程')) {
    responseText = "我可以帮助您解决编程相关的问题！无论是代码调试、算法解释、还是技术选型，我都能为您提供专业的建议和解决方案。"
  } else if (userMessage.includes('写作') || userMessage.includes('文章')) {
    responseText = "我很乐意帮助您进行写作！我可以协助您：\n\n• 文章结构规划\n• 内容创作和润色\n• 语法检查和优化\n• 创意灵感提供\n\n请告诉我您想写什么类型的内容？"
  } else if (userMessage.length > 0) {
    responseText = `关于"${userMessage.substring(0, 20)}${userMessage.length > 20 ? '...' : ''}"这个问题，让我来为您详细解答：\n\n${mockResponses[Math.floor(Math.random() * mockResponses.length)]}`
  }

  // 模拟流式输出
  const words = responseText.split('')
  let currentIndex = 0

  const timer = setInterval(() => {
    if (currentIndex < words.length) {
      onMessage && onMessage(words[currentIndex])
      currentIndex++
    } else {
      clearInterval(timer)
      // 模拟完成回调
      setTimeout(() => {
        // 模拟token使用情况
        const completionTokens = Math.ceil(responseText.length / 4)
        const promptTokens = Math.ceil((userMessage.length || 50) / 4)
        const totalTokens = promptTokens + completionTokens

        // 使用精确费用计算
        const cost = calculateAccurateCost(promptTokens, completionTokens, params.model || 'deepseek-ai/DeepSeek-V3')

        onComplete && onComplete({
          tokens: totalTokens,
          promptTokens: promptTokens,
          completionTokens: completionTokens,
          cost: cost,
          currency: CURRENCY.SYMBOL,
          usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: totalTokens
          }
        })
      }, 500)
    }
  }, 50) // 每50ms输出一个字符

  // 返回一个可以取消的对象
  return {
    close: () => {
      clearInterval(timer)
    }
  }
}

/**
 * 获取AI模型列表
 */
export const getAIModels = () => {
  if (USE_MOCK_DATA) {
    // 返回模拟数据
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          code: 200,
          message: 'success',
          data: {
            models: DEFAULT_AI_MODELS,
            total: DEFAULT_AI_MODELS.length
          }
        })
      }, 500) // 模拟网络延迟
    })
  }

  return request('/models')
}

/**
 * 计算消息tokens
 * @param {string} text 文本内容
 * @param {string} model 模型名称
 */
export const calculateTokens = (text, model = 'gpt-3.5-turbo') => {
  return request('/tokens/calculate', {
    method: 'POST',
    data: { text, model }
  })
}

/**
 * 获取用户余额
 */
export const getUserBalance = () => {
  return request('/user/balance')
}

/**
 * 获取对话历史
 * @param {number} page 页码
 * @param {number} limit 每页数量
 */
export const getChatHistoryFromServer = (page = 1, limit = 20) => {
  return request(`/chat/history?page=${page}&limit=${limit}`)
}

/**
 * 删除服务器端对话记录
 * @param {string} chatId 对话ID
 */
export const deleteChatFromServer = (chatId) => {
  return request(`/chat/${chatId}`, {
    method: 'DELETE'
  })
}

/**
 * 上传对话记录到服务器
 * @param {Object} chatData 对话数据
 */
export const uploadChatToServer = (chatData) => {
  return request('/chat/upload', {
    method: 'POST',
    data: chatData
  })
}

/**
 * 获取系统配置
 */
export const getSystemConfig = () => {
  return request('/config')
}

/**
 * 上传文件
 * @param {string} filePath 本地文件路径
 * @param {string} fileType 文件类型
 * @param {Function} onProgress 上传进度回调
 */
export const uploadFile = (filePath, fileType = 'image', onProgress) => {
  if (USE_MOCK_DATA) {
    // 返回模拟数据
    return new Promise((resolve) => {
      let progress = 0
      const timer = setInterval(() => {
        progress += 20
        onProgress && onProgress(progress)

        if (progress >= 100) {
          clearInterval(timer)
          resolve({
            code: 200,
            message: 'success',
            data: {
              fileId: `file_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
              fileName: filePath.split('/').pop(),
              fileUrl: filePath, // 模拟环境直接返回本地路径
              fileType: fileType,
              fileSize: Math.floor(Math.random() * 1000000), // 随机文件大小
              uploadTime: new Date().toISOString()
            }
          })
        }
      }, 200)
    })
  }

  return new Promise((resolve, reject) => {
    const uploadTask = wx.uploadFile({
      url: `${API_BASE_URL}/upload`,
      filePath: filePath,
      name: 'file',
      formData: {
        type: fileType
      },
      success: (res) => {
        try {
          const data = JSON.parse(res.data)
          if (data.code === 200) {
            resolve(data)
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

    // 监听上传进度
    uploadTask.onProgressUpdate((res) => {
      onProgress && onProgress(res.progress)
    })
  })
}

/**
 * 用户登录
 * @param {Object} loginData 登录数据
 */
export const userLogin = (loginData) => {
  if (USE_MOCK_DATA) {
    // 模拟登录
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          code: 200,
          message: 'success',
          data: {
            token: 'mock_token_' + Date.now(),
            userInfo: {
              id: 'user_' + Date.now(),
              nickName: loginData.nickName || '用户',
              avatarUrl: loginData.avatarUrl || '',
              isLoggedIn: true
            }
          }
        })
      }, 1000)
    })
  }

  return request('/auth/login', {
    method: 'POST',
    data: loginData
  })
}

/**
 * 用户登出
 */
export const userLogout = () => {
  if (USE_MOCK_DATA) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          code: 200,
          message: 'success'
        })
      }, 500)
    })
  }

  return request('/auth/logout', {
    method: 'POST'
  })
}

/**
 * 获取用户信息
 */
export const getUserProfile = () => {
  if (USE_MOCK_DATA) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          code: 200,
          message: 'success',
          data: {
            nickName: '用户',
            avatarUrl: '',
            isLoggedIn: false
          }
        })
      }, 500)
    })
  }

  return request('/user/profile')
}

// 错误处理工具
export const handleApiError = (error) => {
  console.error('API错误:', error)

  let message = '网络请求失败'

  if (error.message) {
    message = error.message
  } else if (error.errMsg) {
    message = error.errMsg
  }

  wx.showToast({
    title: message,
    icon: 'none',
    duration: 2000
  })

  return message
}
