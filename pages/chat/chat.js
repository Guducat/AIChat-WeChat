// pages/chat/chat.js
import { DEFAULT_AI_MODELS, DEFAULT_CHAT_SCENARIO, MESSAGE_TYPES, CHAT_STATUS, UPLOAD_LIMITS } from '../../utils/constants.js'
import { sendChatMessage, handleApiError, getAIModels } from '../../utils/api.js'
import { saveChatHistory, getChatHistory, saveTokenStats, getTokenStats, getUserSettings, getUserInfo } from '../../utils/storage.js'
import { convertWxFileToBase64, validateBase64Image, compressImage } from '../../utils/image-processor.js'
import { isMultimodalModel } from '../../utils/siliconflow-api.js'
import { formatChatTime } from '../../utils/time-formatter.js'

Page({
  data: {
    chatId: '',
    scenario: '',
    model: '',
    messages: [],
    inputText: '', // 确保有默认空字符串值
    chatStatus: CHAT_STATUS.IDLE,
    currentModel: null,
    currentScenario: null,
    totalTokens: 0,
    totalCost: 0,
    showTokenInfo: false,
    socketTask: null,
    statusText: '',
    sendDisabled: false,
    // 用户信息
    userInfo: {
      nickName: '用户',
      avatarUrl: '',
      isLoggedIn: false
    },
    // 图片上传相关
    uploadedFiles: [],
    uploadedFileUrls: [],
    isUploading: false,
    uploadButtonText: '上传图片',
    uploadDisabled: false,
    uploadDisabledReason: ''
  },

  onLoad(options) {
    const { chatId, scenario, model, initialMessage } = options

    if (!chatId || !scenario || !model) {
      wx.showToast({
        title: '参数错误',
        icon: 'error'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }

    // 确保inputText有默认值
    this.setData({
      inputText: ''
    })

    // 解析初始消息
    let parsedInitialMessage = null
    if (initialMessage) {
      try {
        parsedInitialMessage = JSON.parse(decodeURIComponent(initialMessage))
      } catch (error) {
        console.error('解析初始消息失败:', error)
      }
    }

    // 加载用户设置
    this.loadUserSettings()

    this.initChat(chatId, scenario, model, parsedInitialMessage)
  },

  onShow() {
    // 页面显示时确保数据状态正确
    this.updateDisplayStatus()
  },

  onUnload() {
    // 页面卸载时关闭连接（如果存在且有close方法）
    const socketTask = this.data.socketTask
    if (socketTask && typeof socketTask.close === 'function') {
      try {
        socketTask.close()
        console.log('连接已关闭')
      } catch (error) {
        console.warn('关闭连接时出错:', error)
      }
    }

    // 保存对话记录
    this.saveChatSession()
  },

  /**
   * 加载用户设置
   */
  loadUserSettings() {
    const userSettings = getUserSettings()
    const tokenStats = getTokenStats()
    const userInfo = getUserInfo()

    this.setData({
      userInfo
    })

    // 可以在这里根据用户设置调整界面
    console.log('用户设置:', userSettings)
    console.log('Token统计:', tokenStats)
    console.log('用户信息:', userInfo)
  },

  /**
   * 初始化对话
   */
  async initChat(chatId, scenario, model, initialMessage) {
    // 加载AI模型列表
    let aiModels = DEFAULT_AI_MODELS
    try {
      const response = await getAIModels()
      aiModels = response.data?.models || DEFAULT_AI_MODELS
    } catch (error) {
      console.error('加载模型列表失败:', error)
    }

    const currentModel = aiModels.find(m => m.id === model) || aiModels[0]
    const currentScenario = DEFAULT_CHAT_SCENARIO

    // 检查是否有已存在的对话记录
    const existingChat = this.loadExistingChat(chatId)

    // 检查模型的多模态支持能力
    const uploadDisabled = !currentModel.supportMultimodal || !isMultimodalModel(currentModel.id)
    const uploadDisabledReason = uploadDisabled ? `${currentModel.name}不支持图文对话` : ''

    this.setData({
      chatId,
      scenario,
      model,
      currentModel,
      currentScenario,
      messages: existingChat ? existingChat.messages : [],
      uploadDisabled,
      uploadDisabledReason,
      uploadButtonText: this.getUploadButtonText(0, uploadDisabled)
    })

    // 如果是已存在的对话，计算并设置Token统计
    if (existingChat) {
      this.calculateTokenStatsFromMessages(existingChat.messages, currentModel)
    }

    // 如果是新对话且有初始消息，自动发送
    if (!existingChat && initialMessage) {
      this.sendInitialMessage(initialMessage)
    }
  },

  /**
   * 加载已存在的对话
   */
  loadExistingChat(chatId) {
    const history = getChatHistory()
    return history.find(chat => chat.id === chatId)
  },

  /**
   * 添加系统消息
   */
  addSystemMessage(content) {
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: MESSAGE_TYPES.ASSISTANT,
      content,
      timestamp: new Date().toISOString(),
      tokens: 0
    }

    this.setData({
      messages: [...this.data.messages, message]
    })

    this.updateDisplayStatus()
  },

  /**
   * 更新显示状态
   */
  updateDisplayStatus() {
    const { chatStatus, inputText, uploadedFiles, isUploading } = this.data

    // 更新状态文本
    let statusText = ''
    if (chatStatus === 'sending') {
      statusText = '发送中...'
    } else if (chatStatus === 'receiving') {
      statusText = 'AI思考中...'
    } else if (chatStatus === 'error') {
      statusText = '发生错误'
    } else if (isUploading) {
      statusText = '图片上传中...'
    }

    // 安全地处理inputText，确保不为undefined
    const safeInputText = inputText || ''
    const hasContent = safeInputText.trim() || (uploadedFiles && uploadedFiles.length > 0)
    const sendDisabled = chatStatus !== 'idle' || !hasContent || isUploading

    this.setData({
      statusText,
      sendDisabled
    })
  },

  /**
   * 发送初始消息
   */
  sendInitialMessage(initialMessage) {
    if (!initialMessage || typeof initialMessage !== 'object') {
      console.warn('初始消息格式无效:', initialMessage)
      return
    }

    const { text, files } = initialMessage
    const safeText = text || ''

    if (!safeText.trim() && (!files || files.length === 0)) {
      return
    }

    // 添加用户消息
    const userMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: MESSAGE_TYPES.USER,
      content: safeText,
      files: files || [],
      fileUrls: (files || []).map(f => f.fileUrl),
      timestamp: new Date().toISOString(),
      tokens: Math.ceil(safeText.length / 4)
    }

    this.setData({
      messages: [...this.data.messages, userMessage],
      chatStatus: CHAT_STATUS.SENDING
    }, () => {
      // 在setData回调中执行滚动,确保消息已添加到页面
      wx.createSelectorQuery()
        .select('#chat-container')
        .boundingClientRect((rect) => {
          if (rect) {
            wx.pageScrollTo({
              scrollTop: rect.height,
              duration: 300
            })
          }
        })
        .exec()
    })

    // 发送到AI
    this.sendToAI(safeText || (files && files.length > 0 ? '请分析这些图片' : ''), files)
  },

  /**
   * 发送消息
   */
  onSendMessage() {
    const { inputText, uploadedFiles } = this.data
    // 安全地处理inputText，确保不为undefined
    const safeInputText = inputText || ''
    const trimmedText = safeInputText.trim()

    if (!trimmedText && (!uploadedFiles || uploadedFiles.length === 0)) {
      wx.showToast({
        title: '请输入消息或上传图片',
        icon: 'none'
      })
      return
    }

    if (this.data.chatStatus !== CHAT_STATUS.IDLE) {
      wx.showToast({
        title: '请等待回复完成',
        icon: 'none'
      })
      return
    }

    // 添加用户消息（不估算token，等待API返回精确数据）
    const safeUploadedFiles = uploadedFiles || []
    const userMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: MESSAGE_TYPES.USER,
      content: trimmedText,
      files: safeUploadedFiles,
      fileUrls: safeUploadedFiles.map(f => f.fileUrl),
      timestamp: new Date().toISOString(),
      tokens: 0, // 不估算，等待API返回精确数据
      hasImages: safeUploadedFiles.length > 0,
      isMultimodal: safeUploadedFiles.length > 0 && isMultimodalModel(this.data.currentModel.id)
    }

    this.setData({
      messages: [...this.data.messages, userMessage],
      inputText: '',
      uploadedFiles: [],
      uploadedFileUrls: [],
      uploadButtonText: '上传图片',
      chatStatus: CHAT_STATUS.SENDING
    })

    this.updateDisplayStatus()

    // 发送到AI
    this.sendToAI(trimmedText || (safeUploadedFiles.length > 0 ? '请分析这些图片' : ''), safeUploadedFiles)
  },

  /**
   * 发送消息到AI
   */
  sendToAI(messageText, files = []) {
    const { currentModel, currentScenario, messages } = this.data

    console.log('发送到AI:', {
      messageText,
      filesCount: files.length,
      model: currentModel.id,
      isMultimodal: isMultimodalModel(currentModel.id),
      files: files.map(f => ({
        fileId: f.fileId,
        fileType: f.fileType,
        urlType: f.fileUrl ? (f.fileUrl.startsWith('data:image/') ? 'base64' : 'other') : 'empty',
        urlLength: f.fileUrl ? f.fileUrl.length : 0,
        isValid: f.isValid
      }))
    })

    // 验证多模态消息的图片格式
    if (files.length > 0 && isMultimodalModel(currentModel.id)) {
      console.log('验证多模态消息中的图片格式...')

      const invalidFiles = files.filter(file => {
        if (file.fileType === 'image') {
          const isValidBase64 = file.fileUrl && validateBase64Image(file.fileUrl)
          if (!isValidBase64) {
            console.error('发现无效的图片格式:', {
              fileId: file.fileId,
              fileUrl: file.fileUrl ? file.fileUrl.substring(0, 50) + '...' : 'empty',
              isValidBase64: isValidBase64
            })
          }
          return !isValidBase64
        }
        return false
      })

      if (invalidFiles.length > 0) {
        console.error('存在无效的图片文件，无法发送:', invalidFiles)
        wx.showToast({
          title: `${invalidFiles.length}张图片格式无效，请重新上传`,
          icon: 'error',
          duration: 3000
        })
        return
      }
    }

    // 构建对话上下文
    const conversationHistory = messages.map(msg => {
      const messageContent = {
        role: msg.type === MESSAGE_TYPES.USER ? 'user' : 'assistant'
      }

      // 检查是否为多模态消息
      if (msg.files && msg.files.length > 0 && isMultimodalModel(currentModel.id)) {
        // 使用多模态格式：content数组
        const contentParts = []

        // 添加文本内容
        if (msg.content && msg.content.trim()) {
          contentParts.push({
            type: 'text',
            text: msg.content.trim()
          })
        }

        // 添加图片内容
        msg.files.forEach((file, fileIndex) => {
          if (file.fileType === 'image' && file.fileUrl) {
            console.log(`添加图片 ${fileIndex + 1} 到消息:`, {
              fileId: file.fileId,
              urlType: file.fileUrl.startsWith('data:image/') ? 'base64' : 'other',
              urlLength: file.fileUrl.length,
              isValid: validateBase64Image(file.fileUrl)
            })

            // 验证图片URL格式
            if (!file.fileUrl.startsWith('data:image/') && !file.fileUrl.startsWith('http')) {
              console.error('图片URL格式错误:', file.fileUrl.substring(0, 50))
              return
            }

            contentParts.push({
              type: 'image_url',
              image_url: {
                url: file.fileUrl,
                detail: 'auto'
              }
            })
          }
        })

        messageContent.content = contentParts
      } else {
        // 普通文本消息
        messageContent.content = msg.content
      }

      return messageContent
    })

    // 添加系统提示
    conversationHistory.unshift({
      role: 'system',
      content: currentScenario.systemPrompt
    })

    const params = {
      model: currentModel.id,
      messages: conversationHistory,
      stream: true,
      files: files || []
    }

    // 创建AI回复消息
    const aiMessageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    const aiMessage = {
      id: aiMessageId,
      type: MESSAGE_TYPES.ASSISTANT,
      content: '',
      contentNodes: null, // 用于towxml渲染AI最终回答
      reasoningContent: '', // 思考过程内容（纯文本）
      reasoningExpanded: false, // 思考过程折叠状态，默认折叠
      timestamp: new Date().toISOString(),
      tokens: 0,
      isStreaming: true,
      // 确保DeepSeek-R1等思考模型的状态正确初始化
      isThinkingModel: currentModel.id.includes('DeepSeek-R1') || currentModel.id.includes('R1')
    }

    this.setData({
      messages: [...this.data.messages, aiMessage],
      chatStatus: CHAT_STATUS.RECEIVING
    })

    // 发送请求
    const socketTask = sendChatMessage(
      params,
      (content, isReasoning = false) => {
        // 接收流式内容
        this.updateAIMessage(aiMessageId, content, false, 0, isReasoning)
      },
      (data) => {
        // 完成回复
        console.log('API完成回调数据:', data)

        // 更新AI消息，包含精确的token信息
        this.updateAIMessage(aiMessageId, '', true, data.completionTokens || data.tokens, false, {
          promptTokens: data.promptTokens,
          completionTokens: data.completionTokens,
          cost: data.cost,
          usage: data.usage
        })

        // 更新最后一条用户消息的token信息（基于API返回的prompt_tokens）
        this.updateLastUserMessageTokens(data.promptTokens || 0)

        this.setData({
          chatStatus: CHAT_STATUS.IDLE
        })
        this.updateDisplayStatus()

        // 传递精确的token数据
        this.updateTokenStats(data.tokens, data.cost, {
          promptTokens: data.promptTokens,
          completionTokens: data.completionTokens,
          usage: data.usage
        })

        // 保存对话记录
        this.saveChatSession()
      },
      (error) => {
        // 错误处理
        console.error('发送消息失败:', error)
        this.updateAIMessage(aiMessageId, '抱歉，发生了错误，请稍后重试。', true)
        this.setData({
          chatStatus: CHAT_STATUS.ERROR
        })
        this.updateDisplayStatus()
        handleApiError(error)

        setTimeout(() => {
          this.setData({
            chatStatus: CHAT_STATUS.IDLE
          })
          this.updateDisplayStatus()
        }, 2000)
      }
    )

    this.setData({
      socketTask
    })
  },

  /**
   * 将文本内容转换为towxml节点
   */
  convertToTowxmlNodes(content, contentType = 'AI回答') {
    if (!content || typeof content !== 'string') {
      console.log(`${contentType}: 内容为空，跳过towxml转换`)
      return null
    }

    try {
      // 获取app实例中的towxml方法
      const app = getApp()
      if (!app || !app.towxml) {
        console.warn(`${contentType}: towxml未正确初始化，使用原始文本`)
        return null
      }

      console.log(`${contentType}: 开始towxml转换，内容长度:`, content.length)
      console.log(`${contentType}: 内容预览:`, content.substring(0, 100) + '...')

      // 使用towxml解析markdown内容
      const result = app.towxml(content, 'markdown', {
        theme: 'light',
        events: {
          tap: (e) => {
            console.log('towxml tap event:', e)
          }
        }
      })

      console.log(`${contentType}: towxml转换成功，节点类型:`, typeof result)
      return result
    } catch (error) {
      console.error(`${contentType}: towxml解析失败:`, error)
      return null
    }
  },

  /**
   * 更新AI消息内容（支持精确token数据）
   */
  updateAIMessage(messageId, newContent, isComplete, tokens = 0, isReasoning = false, tokenDetails = null) {
    const messages = this.data.messages.map(msg => {
      if (msg.id === messageId) {
        const baseUpdate = {
          isStreaming: !isComplete,
          tokens: tokens || msg.tokens
        }

        // 如果有精确的token数据，添加到消息中
        if (tokenDetails && isComplete) {
          baseUpdate.promptTokens = tokenDetails.promptTokens
          baseUpdate.completionTokens = tokenDetails.completionTokens
          baseUpdate.cost = tokenDetails.cost
          baseUpdate.usage = tokenDetails.usage

          console.log('更新AI消息token详情:', {
            messageId: messageId,
            tokens: tokens,
            promptTokens: tokenDetails.promptTokens,
            completionTokens: tokenDetails.completionTokens,
            cost: tokenDetails.cost
          })
        }

        if (isReasoning) {
          // 推理内容单独存储（不使用towxml，保持轻量）
          const updatedReasoningContent = (msg.reasoningContent || '') + newContent
          const updatedMsg = {
            ...msg,
            ...baseUpdate,
            reasoningContent: updatedReasoningContent
          }

          // 确保思考过程的折叠状态正确初始化
          if (!updatedMsg.hasOwnProperty('reasoningExpanded')) {
            updatedMsg.reasoningExpanded = false
          }

          // 确保在思考过程更新时不影响最终回答的显示
          if (!updatedMsg.hasOwnProperty('content')) {
            updatedMsg.content = ''
          }
          if (!updatedMsg.hasOwnProperty('contentNodes')) {
            updatedMsg.contentNodes = null
          }

          return updatedMsg
        } else {
          // AI最终回答内容（优化流式渲染）
          const updatedContent = msg.content + newContent
          const updatedMsg = {
            ...msg,
            ...baseUpdate,
            content: updatedContent
          }

          // 只在完成时或内容较长时生成towxml节点，避免频繁渲染
          if (isComplete || updatedContent.length > 100) {
            if (updatedContent.trim()) {
              try {
                updatedMsg.contentNodes = this.convertToTowxmlNodes(updatedContent, 'AI最终回答')
              } catch (error) {
                console.error('towxml节点生成失败:', error)
                // 如果towxml生成失败，确保内容仍能显示
                updatedMsg.contentNodes = null
              }
            }
          }

          return updatedMsg
        }
      }
      return msg
    })

    this.setData({
      messages
    })

    // 滚动到底部
    this.scrollToBottom()
  },

  /**
   * 处理思考过程折叠面板切换
   */
  onReasoningToggle(event) {
    const messageId = event.currentTarget.dataset.messageId
    const expandedItems = event.detail || []
    const isExpanded = expandedItems.includes('reasoning')

    console.log('思考过程折叠状态切换:', {
      messageId,
      expandedItems,
      isExpanded
    })

    const messages = this.data.messages.map(msg => {
      if (msg.id === messageId) {
        return {
          ...msg,
          reasoningExpanded: isExpanded
        }
      }
      return msg
    })

    this.setData({
      messages
    })
  },

  /**
   * 滚动到底部
   */
  scrollToBottom() {
    wx.createSelectorQuery().select('#chat-container').boundingClientRect((rect) => {
      if (rect) {
        wx.pageScrollTo({
          scrollTop: rect.height,
          duration: 300
        })
      }
    }).exec()
  },

  /**
   * 更新最后一条用户消息的token信息
   */
  updateLastUserMessageTokens(promptTokens) {
    if (!promptTokens || promptTokens <= 0) return

    const messages = this.data.messages
    // 从后往前找最后一条用户消息
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type === MESSAGE_TYPES.USER) {
        const updatedMessages = messages.map((msg, index) => {
          if (index === i) {
            console.log('更新用户消息token:', {
              messageId: msg.id,
              oldTokens: msg.tokens,
              newTokens: promptTokens
            })
            return {
              ...msg,
              tokens: promptTokens,
              promptTokens: promptTokens // 用户消息的token就是prompt_tokens
            }
          }
          return msg
        })

        this.setData({
          messages: updatedMessages
        })
        break
      }
    }
  },

  /**
   * 从消息列表计算Token统计（用于加载历史对话）
   */
  calculateTokenStatsFromMessages(messages, currentModel) {
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      this.setData({
        totalTokens: 0,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalCost: 0
      })
      return
    }

    let totalTokens = 0
    let totalPromptTokens = 0
    let totalCompletionTokens = 0
    let totalCost = 0

    messages.forEach(msg => {
      if (msg && typeof msg === 'object') {
        totalTokens += msg.tokens || 0
        totalPromptTokens += msg.promptTokens || 0
        totalCompletionTokens += msg.completionTokens || 0

        // 如果消息有精确的费用信息，使用它；否则估算
        if (msg.cost !== undefined && msg.cost !== null) {
          totalCost += parseFloat(msg.cost) || 0
        } else if (msg.tokens && currentModel) {
          // 使用模型价格估算费用
          const pricePerToken = currentModel.pricePerOutputToken || currentModel.pricePerToken || 0.00028
          totalCost += msg.tokens * pricePerToken
        }
      }
    })

    console.log('从历史消息计算Token统计:', {
      messagesCount: messages.length,
      totalTokens,
      totalPromptTokens,
      totalCompletionTokens,
      totalCost: totalCost.toFixed(6)
    })

    this.setData({
      totalTokens,
      totalPromptTokens,
      totalCompletionTokens,
      totalCost: totalCost.toFixed(6)
    })
  },

  /**
   * 更新token统计（支持精确token数据）
   */
  updateTokenStats(newTokens = 0, newCost = 0, tokenDetails = null) {
    const { messages, currentModel } = this.data

    console.log('更新Token统计:', {
      newTokens: newTokens,
      newCost: newCost,
      tokenDetails: tokenDetails,
      model: currentModel.id
    })

    // 计算总token数
    let totalTokens = 0
    let totalPromptTokens = 0
    let totalCompletionTokens = 0
    let totalCost = 0

    messages.forEach(msg => {
      totalTokens += msg.tokens || 0
      totalPromptTokens += msg.promptTokens || 0
      totalCompletionTokens += msg.completionTokens || 0

      // 如果消息有精确的费用信息，使用它；否则估算
      if (msg.cost !== undefined) {
        totalCost += parseFloat(msg.cost) || 0
      } else if (msg.tokens) {
        // 使用输出token价格估算（假设大部分是输出）
        totalCost += msg.tokens * (currentModel.pricePerOutputToken || currentModel.pricePerToken || 0.00028)
      }
    })

    this.setData({
      totalTokens,
      totalPromptTokens,
      totalCompletionTokens,
      totalCost: totalCost.toFixed(6) // 人民币精确到6位小数
    })

    // 保存Token统计到本地存储
    if (newTokens > 0 || newCost > 0) {
      const tokenStats = {
        tokens: newTokens,
        promptTokens: tokenDetails?.promptTokens || 0,
        completionTokens: tokenDetails?.completionTokens || 0,
        cost: parseFloat(newCost) || 0,
        model: currentModel.id,
        modelName: currentModel.name,
        timestamp: new Date().toISOString(),
        usage: tokenDetails?.usage || null
      }

      console.log('保存Token统计到本地存储:', {
        tokenStats: tokenStats,
        newTokens: newTokens,
        newCost: newCost,
        tokenDetails: tokenDetails
      })

      const saveResult = saveTokenStats(tokenStats)
      console.log('Token统计保存结果:', saveResult)

      // 验证保存后的数据
      const savedStats = getTokenStats()
      console.log('保存后验证数据:', savedStats)
    } else {
      console.log('跳过Token统计保存，因为没有新的token或费用数据')
    }
  },

  /**
   * 输入框内容变化
   */
  onInputChange(event) {
    console.log('输入框变化事件:', event)

    // 处理不同类型的事件对象
    let inputValue = ''

    if (event && event.detail) {
      // Vant组件的事件格式
      if (event.detail.value !== undefined) {
        inputValue = event.detail.value
      }
      // 原生组件的事件格式
      else if (event.detail !== undefined) {
        inputValue = event.detail
      }
    }

    // 确保inputValue是字符串
    inputValue = String(inputValue || '')

    console.log('设置输入值:', inputValue)

    this.setData({
      inputText: inputValue
    })

    this.updateDisplayStatus()
  },

  /**
   * 选择图片上传（使用base64编码）
   */
  onChooseImage() {
    const { uploadDisabled, uploadDisabledReason, currentModel } = this.data

    // 检查模型是否支持多模态
    if (uploadDisabled || !isMultimodalModel(currentModel.id)) {
      wx.showModal({
        title: '模型不支持图片',
        content: uploadDisabledReason || '当前选择的模型不支持图片输入，请选择支持多模态的模型（如Qwen2.5-VL-72B）后再上传图片。',
        confirmText: '知道了',
        showCancel: false
      })
      return
    }

    const that = this

    wx.chooseMedia({
      count: UPLOAD_LIMITS.MAX_IMAGE_COUNT - this.data.uploadedFiles.length,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      maxDuration: 30,
      camera: 'back',
      success: (res) => {
        that.processSelectedImages(res.tempFiles)
      },
      fail: (error) => {
        console.error('选择图片失败:', error)
        wx.showToast({
          title: '选择图片失败',
          icon: 'error'
        })
      }
    })
  },

  /**
   * 处理选中的图片（转换为base64）
   */
  async processSelectedImages(files) {
    if (files.length === 0) return

    this.setData({
      isUploading: true,
      uploadButtonText: '处理中...'
    })

    try {
      console.log('开始处理图片，数量:', files.length)
      console.log('文件详情:', files.map(f => ({
        tempFilePath: f.tempFilePath,
        size: f.size,
        type: f.type
      })))

      const processedFiles = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        console.log(`处理图片 ${i + 1}/${files.length}:`, {
          tempFilePath: file.tempFilePath,
          size: file.size,
          type: file.type
        })

        try {
          // 验证文件路径
          if (!file.tempFilePath) {
            throw new Error('文件路径为空')
          }

          // 先压缩图片（可选）
          console.log(`开始压缩图片 ${i + 1}:`, file.tempFilePath)
          const compressedPath = await compressImage(file.tempFilePath, {
            quality: 0.8,
            width: 1024,
            height: 1024
          })

          console.log(`图片 ${i + 1} 压缩完成:`, {
            original: file.tempFilePath,
            compressed: compressedPath
          })

          // 转换为base64
          console.log(`开始转换图片 ${i + 1} 为Base64:`, compressedPath)
          const base64Url = await convertWxFileToBase64(compressedPath)

          console.log(`图片 ${i + 1} Base64转换完成:`, {
            length: base64Url ? base64Url.length : 0,
            prefix: base64Url ? base64Url.substring(0, 50) : 'null'
          })

          // 验证base64数据
          if (!base64Url) {
            throw new Error('Base64转换结果为空')
          }

          if (!validateBase64Image(base64Url)) {
            throw new Error('图片格式验证失败')
          }

          const processedFile = {
            fileId: `img_${Date.now()}_${i}`,
            fileName: `image_${i + 1}.jpg`,
            fileUrl: base64Url,
            fileType: 'image',
            fileSize: Math.ceil(base64Url.length * 0.75), // 估算原始大小
            tempFilePath: file.tempFilePath,
            originalPath: file.tempFilePath,
            compressedPath: compressedPath,
            isBase64: true,
            isValid: true
          }

          processedFiles.push(processedFile)
          console.log(`图片 ${i + 1} 处理完成:`, {
            fileId: processedFile.fileId,
            base64Length: base64Url.length,
            isValid: validateBase64Image(base64Url)
          })

        } catch (error) {
          console.error(`处理图片 ${i + 1} 失败:`, {
            error: error.message,
            tempFilePath: file.tempFilePath,
            stack: error.stack
          })

          wx.showToast({
            title: `图片 ${i + 1} 处理失败: ${error.message}`,
            icon: 'none',
            duration: 3000
          })
        }
      }

      if (processedFiles.length === 0) {
        throw new Error('没有成功处理的图片')
      }

      // 更新上传文件列表
      const newUploadedFiles = [...this.data.uploadedFiles, ...processedFiles]
      const newUploadedFileUrls = newUploadedFiles.map(file => file.fileUrl)

      this.setData({
        uploadedFiles: newUploadedFiles,
        uploadedFileUrls: newUploadedFileUrls,
        isUploading: false,
        uploadButtonText: this.getUploadButtonText(newUploadedFiles.length, this.data.uploadDisabled)
      })

      this.updateDisplayStatus()

      wx.showToast({
        title: `成功处理 ${processedFiles.length} 张图片`,
        icon: 'success'
      })

    } catch (error) {
      console.error('图片处理失败:', error)
      this.setData({
        isUploading: false,
        uploadButtonText: this.getUploadButtonText(this.data.uploadedFiles.length, this.data.uploadDisabled)
      })

      wx.showToast({
        title: error.message || '图片处理失败',
        icon: 'error'
      })
    }
  },

  /**
   * 获取上传按钮文本
   */
  getUploadButtonText(fileCount, disabled = false) {
    if (disabled) {
      return '不支持图片'
    } else if (fileCount === 0) {
      return '选择图片'
    } else if (fileCount >= UPLOAD_LIMITS.MAX_IMAGE_COUNT) {
      return `图片已满(${fileCount})`
    } else {
      return `图片(${fileCount}/${UPLOAD_LIMITS.MAX_IMAGE_COUNT})`
    }
  },

  /**
   * 删除已上传的图片
   */
  onDeleteUploadedFile(event) {
    const { index } = event.currentTarget.dataset
    const uploadedFiles = [...this.data.uploadedFiles]
    uploadedFiles.splice(index, 1)

    const uploadedFileUrls = uploadedFiles.map(file => file.fileUrl)

    this.setData({
      uploadedFiles,
      uploadedFileUrls,
      uploadButtonText: this.getUploadButtonText(uploadedFiles.length, this.data.uploadDisabled)
    })

    this.updateDisplayStatus()
  },

  /**
   * 预览已上传的图片
   */
  onPreviewUploadedImage(event) {
    const { url, urls } = event.currentTarget.dataset

    wx.previewImage({
      current: url,
      urls: urls || [url]
    })
  },

  /**
   * 显示/隐藏token信息
   */
  onToggleTokenInfo() {
    this.setData({
      showTokenInfo: !this.data.showTokenInfo
    })
  },

  /**
   * 跳转到统计页面
   */
  onGoToStats() {
    wx.navigateTo({
      url: '/pages/stats/stats'
    })
  },

  /**
   * 清空对话
   */
  onClearChat() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空当前对话吗？此操作不可恢复。',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            messages: [],
            totalTokens: 0,
            totalPromptTokens: 0,
            totalCompletionTokens: 0,
            totalCost: 0
          })
          // 不再添加系统消息，保持空白状态
        }
      }
    })
  },

  /**
   * 保存对话会话
   */
  saveChatSession() {
    const { chatId, scenario, model, messages, currentModel, currentScenario, totalTokens, totalCost } = this.data

    if (messages.length === 0) return

    const chatSession = {
      id: chatId,
      title: this.generateChatTitle(),
      scenario,
      model,
      modelName: currentModel.name,
      scenarioName: currentScenario.name,
      messages,
      totalTokens,
      totalCost,
      createdAt: messages[0]?.timestamp || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    console.log('保存对话记录:', chatSession)
    saveChatHistory(chatSession)
  },

  /**
   * 生成对话标题
   */
  generateChatTitle() {
    const { messages, currentScenario } = this.data
    const firstUserMessage = messages.find(msg => msg.type === MESSAGE_TYPES.USER)

    if (firstUserMessage) {
      let title = firstUserMessage.content || '图片对话'
      if (firstUserMessage.files && firstUserMessage.files.length > 0) {
        title = `图片对话 - ${title}`.substring(0, 20)
      } else {
        title = title.substring(0, 20)
      }
      return title.length < (firstUserMessage.content || '').length ? title + '...' : title
    }

    return `${currentScenario.name} - ${new Date().toLocaleString()}`
  },

  /**
   * 预览图片
   */
  onPreviewImage(event) {
    const { url, urls } = event.currentTarget.dataset

    wx.previewImage({
      current: url,
      urls: urls || [url]
    })
  },

  /**
   * 头像加载失败处理
   */
  onAvatarError() {
    console.log('用户头像加载失败，清空头像URL以显示默认头像')
    // 清空头像URL，让WXML显示默认头像
    this.setData({
      'userInfo.avatarUrl': ''
    })
  }
})