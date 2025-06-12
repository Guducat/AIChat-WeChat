// pages/chat/chat.js
import { DEFAULT_AI_MODELS, DEFAULT_CHAT_SCENARIO, MESSAGE_TYPES, CHAT_STATUS, UPLOAD_LIMITS } from '../../utils/constants.js'
import { sendChatMessage, handleApiError, getAIModels } from '../../utils/api.js'
import { saveChatHistory, getChatHistory, saveTokenStats, getTokenStats, getUserSettings, getUserInfo } from '../../utils/storage.js'
import { convertWxFileToBase64, validateBase64Image, compressImage } from '../../utils/image-processor.js'
import { isMultimodalModel } from '../../utils/siliconflow-api.js'
import { formatChatTime } from '../../utils/time-formatter.js'
import {
  AI_MODEL_TEST_CASES,
  calculateModelCost
} from '../../utils/aiInfo.js'

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
    uploadDisabledReason: '',
    // ScrollViewContext相关状态
    scrollViewContextAvailable: false,
    scrollTop: 0
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

    // 检查ScrollViewContext支持情况
    setTimeout(() => {
      this.initScrollViewContext()
    }, 300)
  },

  /**
   * 初始化ScrollViewContext检查
   */
  initScrollViewContext() {
    console.log('🔧 初始化ScrollViewContext检查...')

    const isSupported = this.checkScrollViewContextSupport()

    // 测试ScrollViewContext是否可用
    if (isSupported) {
      wx.createSelectorQuery()
        .select('#chat-scroll-view')
        .context((res) => {
          const hasContext = !!(res && res.context)
          console.log('🎯 ScrollViewContext初始化检查结果:', {
            isSupported: isSupported,
            hasContext: hasContext,
            contextType: res && res.context ? typeof res.context : 'undefined'
          })

          this.setData({
            scrollViewContextAvailable: hasContext
          })

          if (!hasContext) {
            console.warn('⚠️ ScrollViewContext不可用，将使用备用滚动方案')
          }
        })
        .exec()
    } else {
      this.setData({
        scrollViewContextAvailable: false
      })
    }
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
    const existingChat = history.find(chat => chat.id === chatId)

    if (existingChat && existingChat.messages) {
      // 处理历史消息，确保DeepSeek-R1消息的思考过程默认折叠
      existingChat.messages = existingChat.messages.map(msg => {
        if (msg.type === MESSAGE_TYPES.ASSISTANT && msg.reasoningContent) {
          return {
            ...msg,
            isRealTimeMessage: false, // 标记为历史消息
            reasoningExpanded: false, // 历史记录中的思考过程默认折叠
            isThinkingModel: msg.isThinkingModel || this.isDeepSeekR1Model(existingChat.model),
            showRetryButton: this.isErrorMessage(msg) // 设置重试按钮显示状态
          }
        }
        return {
          ...msg,
          isRealTimeMessage: false, // 标记为历史消息
          showRetryButton: msg.type === MESSAGE_TYPES.ASSISTANT ? this.isErrorMessage(msg) : false
        }
      })

      console.log('📚 加载历史对话，DeepSeek-R1思考过程已设置为折叠状态:', {
        chatId: chatId,
        messagesCount: existingChat.messages.length,
        reasoningMessages: existingChat.messages.filter(msg => msg.reasoningContent).length
      })
    }

    return existingChat
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
      // 在setData回调中执行滚动，确保消息已添加到页面
      this.updateDisplayStatus()
      setTimeout(() => {
        this.scrollToStatusIndicator()
      }, 100)
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
    }, () => {
      // 在setData回调中执行滚动，确保消息已添加到页面并且状态已更新
      this.updateDisplayStatus()
      // 延迟一小段时间确保DOM更新完成，然后滚动到状态提示区域
      setTimeout(() => {
        this.scrollToStatusIndicator()
      }, 100)
    })

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

    // 检查是否为DeepSeek-R1模型
    const isDeepSeekR1 = this.isDeepSeekR1Model(currentModel.id)

    console.log('🧠 创建AI消息:', {
      modelId: currentModel.id,
      modelName: currentModel.name,
      isDeepSeekR1: isDeepSeekR1,
      reasoningExpandedDefault: isDeepSeekR1,
      specialBehavior: isDeepSeekR1 ? 'DeepSeek-R1思考过程默认展开' : '普通模型思考过程默认折叠'
    })

    const aiMessage = {
      id: aiMessageId,
      type: MESSAGE_TYPES.ASSISTANT,
      content: '',
      contentNodes: null, // 用于towxml渲染AI最终回答
      reasoningContent: '', // 思考过程内容（纯文本）
      reasoningExpanded: isDeepSeekR1, // DeepSeek-R1实时对话时默认展开，历史记录时默认折叠
      timestamp: new Date().toISOString(),
      tokens: 0,
      isStreaming: true,
      isRealTimeMessage: true, // 标识为实时消息，用于区分历史记录
      // 确保DeepSeek-R1等思考模型的状态正确初始化
      isThinkingModel: isDeepSeekR1
    }

    this.setData({
      messages: [...this.data.messages, aiMessage],
      chatStatus: CHAT_STATUS.RECEIVING
    }, () => {
      // AI开始回复时，滚动到状态提示区域显示"AI思考中..."
      setTimeout(() => {
        this.scrollToStatusIndicator()
      }, 100)
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
        this.updateAIMessage(aiMessageId, '抱歉，发生了错误，请稍后重试。', true, 0, false, null, true) // 最后一个参数标记为错误消息
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

      // 调试信息
      // console.log(`${contentType}: 开始towxml转换，内容长度:`, content.length)
      // console.log(`${contentType}: 内容预览:`, content.substring(0, 100) + '...')

      // 使用towxml解析markdown内容
      const result = app.towxml(content, 'markdown', {
        theme: 'light',
        events: {
          tap: (e) => {
            console.log('towxml tap event:', e)
          }
        }
      })

      // 调试信息
      // console.log(`${contentType}: towxml转换成功，节点类型:`, typeof result)
      return result
    } catch (error) {
      console.error(`${contentType}: towxml解析失败:`, error)
      return null
    }
  },

  /**
   * 更新AI消息内容（支持精确token数据）
   */
  updateAIMessage(messageId, newContent, isComplete, tokens = 0, isReasoning = false, tokenDetails = null, isError = false) {
    const messages = this.data.messages.map(msg => {
      if (msg.id === messageId) {
        const baseUpdate = {
          isStreaming: !isComplete,
          tokens: tokens || msg.tokens,
          isError: isError, // 标记是否为错误消息
          isRetrying: false // 重置重试状态
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

          // 检查是否为DeepSeek-R1模型
          const isDeepSeekR1 = this.isDeepSeekR1Model()

          const updatedMsg = {
            ...msg,
            ...baseUpdate,
            reasoningContent: updatedReasoningContent
          }

          // 设置思考过程的展开状态
          if (!updatedMsg.hasOwnProperty('reasoningExpanded')) {
            // DeepSeek-R1模型默认展开，其他模型默认折叠
            updatedMsg.reasoningExpanded = isDeepSeekR1
            console.log(`🧠 初始化思考过程展开状态: ${isDeepSeekR1 ? '展开' : '折叠'} (${this.data.currentModel?.name})`)
          } else if (isDeepSeekR1 && !updatedMsg.reasoningExpanded && updatedReasoningContent.length > 0) {
            // 如果是DeepSeek-R1模型且当前是折叠状态，在开始接收思考内容时自动展开
            updatedMsg.reasoningExpanded = true
            console.log('🧠 DeepSeek-R1思考过程自动展开 - 检测到思考内容开始输出')
          }

          // 确保在思考过程更新时不影响最终回答的显示
          if (!updatedMsg.hasOwnProperty('content')) {
            updatedMsg.content = ''
          }
          if (!updatedMsg.hasOwnProperty('contentNodes')) {
            updatedMsg.contentNodes = null
          }

          console.log('💭 更新思考过程:', {
            messageId: messageId,
            modelName: this.data.currentModel?.name,
            isDeepSeekR1: isDeepSeekR1,
            reasoningExpanded: updatedMsg.reasoningExpanded,
            reasoningLength: updatedReasoningContent.length,
            newContentLength: newContent.length,
            isFirstReasoningContent: (msg.reasoningContent || '').length === 0 && newContent.length > 0
          })

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

    // 为所有消息设置showRetryButton属性
    const messagesWithRetryButton = messages.map(msg => {
      if (msg.type === MESSAGE_TYPES.ASSISTANT) {
        return {
          ...msg,
          showRetryButton: this.isErrorMessage(msg)
        }
      }
      return msg
    })

    this.setData({
      messages: messagesWithRetryButton
    }, () => {
      // 只在消息完成或内容较长时滚动，避免频繁滚动影响用户体验
      if (isComplete || (newContent && newContent.length > 50)) {
        // 延迟滚动确保DOM更新完成
        setTimeout(() => {
          if (isComplete) {
            // 消息完成时滚动到消息底部
            this.scrollToBottom()
          } else {
            // 流式更新时滚动到状态提示区域
            this.scrollToStatusIndicator()
          }
        }, 50)
      }
    })
  },

  /**
   * 检查是否为DeepSeek-R1模型
   */
  isDeepSeekR1Model(modelId = null) {
    const currentModelId = modelId || (this.data.currentModel && this.data.currentModel.id)
    if (!currentModelId) return false

    return currentModelId.includes('DeepSeek-R1') || currentModelId.includes('R1')
  },

  /**
   * 检查消息是否为错误消息（支持原始文本和towxml渲染内容）
   */
  isErrorMessage(message) {
    if (!message) return false
    console.log('检查消息是否为错误消息:', message)

    console.log('🔍 检查错误消息:', {
      messageId: message.id,
      type: message.type,
      hasContent: !!message.content,
      contentLength: message.content ? message.content.length : 0,
      hasContentNodes: !!message.contentNodes,
      isError: message.isError,
      isStreaming: message.isStreaming,
      timestamp: message.timestamp
    })

    // 1. 检查明确的错误标记
    if (message.isError === true) {
      console.log('✅ 通过isError标记识别为错误消息')
      return true
    }

    // 2. 检查消息状态：如果是AI消息且内容为空且不在流式传输中，可能是错误
    // 修复：增加对流式传输已结束但内容为空的情况的检测
    if (message.type === MESSAGE_TYPES.ASSISTANT &&
        !message.isStreaming &&
        (!message.content || message.content.trim() === '') &&
        !message.contentNodes &&
        (!message.reasoningContent || message.reasoningContent.trim() === '')) {
      console.log('⚠️ 检测到空内容的AI消息，可能是错误消息')
      return true
    }

    // 2.1 新增：检查流式传输异常结束的情况
    // 如果消息标记为流式传输但实际已经结束且内容为空，也视为错误
    if (message.type === MESSAGE_TYPES.ASSISTANT &&
        message.isStreaming === true &&
        (!message.content || message.content.trim() === '') &&
        !message.contentNodes &&
        (!message.reasoningContent || message.reasoningContent.trim() === '') &&
        message.timestamp) {
      // 检查消息创建时间，如果超过30秒仍无内容，视为错误
      const messageTime = new Date(message.timestamp).getTime()
      const currentTime = new Date().getTime()
      const timeDiff = currentTime - messageTime

      if (timeDiff > 30000) { // 30秒超时
        console.log('⚠️ 检测到流式传输超时的空消息，视为错误消息')
        return true
      }
    }

    // 3. 定义错误消息关键词
    const errorKeywords = [
      '抱歉，发生了错误',
      '请稍后重试',
      '重试失败',
      '网络错误',
      '服务器错误',
      'API调用失败',
      '请求失败',
      '连接超时',
      '服务不可用',
      '系统错误'
    ]

    // 4. 检查原始文本内容
    if (message.content && message.content.trim()) {
      const hasErrorInContent = errorKeywords.some(keyword =>
        message.content.includes(keyword)
      )
      if (hasErrorInContent) {
        console.log('✅ 通过内容关键词识别为错误消息:', message.content)
        return true
      }
    }

    // 5. 检查推理内容中的错误信息
    if (message.reasoningContent && message.reasoningContent.trim()) {
      const hasErrorInReasoning = errorKeywords.some(keyword =>
        message.reasoningContent.includes(keyword)
      )
      if (hasErrorInReasoning) {
        console.log('✅ 通过推理内容关键词识别为错误消息:', message.reasoningContent)
        return true
      }
    }

    // 6. 检查towxml渲染内容（通过contentNodes判断）
    if (message.contentNodes && message.content) {
      // 如果有towxml节点，说明内容经过了markdown渲染
      // 此时错误信息应该在原始content中可以检测到
      const hasErrorInRenderedContent = errorKeywords.some(keyword =>
        message.content.includes(keyword)
      )
      if (hasErrorInRenderedContent) {
        console.log('✅ 通过towxml渲染内容识别为错误消息')
        return true
      }
    }

    console.log('❌ 未识别为错误消息')
    return false
  },

  /**
   * 重试失败的AI消息
   */
  onRetryMessage(event) {
    const messageId = event.currentTarget.dataset.messageId
    console.log('🔄 重试AI消息:', messageId)

    // 找到错误消息
    const errorMessage = this.data.messages.find(msg => msg.id === messageId)
    if (!errorMessage) {
      console.error('未找到要重试的消息:', messageId)
      return
    }

    // 找到最后一条用户消息
    const messages = this.data.messages
    let lastUserMessage = null
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type === MESSAGE_TYPES.USER) {
        lastUserMessage = messages[i]
        break
      }
    }

    if (!lastUserMessage) {
      console.error('未找到用户消息进行重试')
      wx.showToast({
        title: '无法重试：未找到原始消息',
        icon: 'error'
      })
      return
    }

    // 设置重试状态
    const updatedMessages = this.data.messages.map(msg => {
      if (msg.id === messageId) {
        return {
          ...msg,
          isRetrying: true,
          isError: false
        }
      }
      return msg
    })

    this.setData({
      messages: updatedMessages,
      chatStatus: CHAT_STATUS.RECEIVING
    })

    this.updateDisplayStatus()

    console.log('🔄 开始重试，重新发送用户消息:', {
      userMessageId: lastUserMessage.id,
      userContent: lastUserMessage.content,
      files: lastUserMessage.files || []
    })

    // 重新发送到AI
    this.retryToAI(lastUserMessage, messageId)
  },

  /**
   * 重试发送消息到AI
   */
  retryToAI(userMessage, retryMessageId) {
    const { currentModel, currentScenario, messages } = this.data

    // 构建对话上下文（排除错误消息）
    const conversationHistory = messages
      .filter(msg => msg.id !== retryMessageId) // 排除要重试的错误消息
      .map(msg => {
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
          msg.files.forEach((file) => {
            if (file.fileType === 'image' && file.fileUrl) {
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
      files: userMessage.files || []
    }

    // 发送重试请求
    const socketTask = sendChatMessage(
      params,
      (content, isReasoning = false) => {
        // 接收流式内容
        this.updateRetryMessage(retryMessageId, content, false, 0, isReasoning)
      },
      (data) => {
        // 完成回复
        console.log('🔄 重试完成:', data)

        this.updateRetryMessage(retryMessageId, '', true, data.completionTokens || data.tokens, false, {
          promptTokens: data.promptTokens,
          completionTokens: data.completionTokens,
          cost: data.cost,
          usage: data.usage
        })

        this.setData({
          chatStatus: CHAT_STATUS.IDLE
        })
        this.updateDisplayStatus()

        // 更新token统计
        this.updateTokenStats(data.tokens, data.cost, {
          promptTokens: data.promptTokens,
          completionTokens: data.completionTokens,
          usage: data.usage
        })

        // 保存对话记录
        this.saveChatSession()
      },
      (error) => {
        // 重试失败
        console.error('🔄 重试失败:', error)
        this.updateRetryMessage(retryMessageId, '重试失败，请稍后再试。', true, 0, false, null, true)

        this.setData({
          chatStatus: CHAT_STATUS.IDLE
        })
        this.updateDisplayStatus()

        handleApiError(error)
      }
    )

    this.setData({
      socketTask
    })
  },

  /**
   * 更新重试消息内容
   */
  updateRetryMessage(messageId, newContent, isComplete, tokens = 0, isReasoning = false, tokenDetails = null, isError = false) {
    const messages = this.data.messages.map(msg => {
      if (msg.id === messageId) {
        const baseUpdate = {
          isStreaming: !isComplete,
          tokens: tokens || msg.tokens,
          isError: isError,
          isRetrying: !isComplete && !isError // 完成或出错时停止重试状态
        }

        // 如果有精确的token数据，添加到消息中
        if (tokenDetails && isComplete) {
          baseUpdate.promptTokens = tokenDetails.promptTokens
          baseUpdate.completionTokens = tokenDetails.completionTokens
          baseUpdate.cost = tokenDetails.cost
          baseUpdate.usage = tokenDetails.usage
        }

        if (isReasoning) {
          // 推理内容更新
          const updatedReasoningContent = (msg.reasoningContent || '') + newContent
          const isDeepSeekR1 = this.isDeepSeekR1Model()

          const updatedMsg = {
            ...msg,
            ...baseUpdate,
            reasoningContent: updatedReasoningContent
          }

          // 设置思考过程的展开状态
          if (!updatedMsg.hasOwnProperty('reasoningExpanded')) {
            updatedMsg.reasoningExpanded = isDeepSeekR1
          } else if (isDeepSeekR1 && !updatedMsg.reasoningExpanded && updatedReasoningContent.length > 0) {
            updatedMsg.reasoningExpanded = true
          }

          return updatedMsg
        } else {
          // 最终回答内容更新
          const updatedContent = isComplete ? newContent : (msg.content || '') + newContent
          const updatedMsg = {
            ...msg,
            ...baseUpdate,
            content: updatedContent
          }

          // 生成towxml节点
          if (isComplete || updatedContent.length > 100) {
            if (updatedContent.trim()) {
              try {
                updatedMsg.contentNodes = this.convertToTowxmlNodes(updatedContent, 'AI重试回答')
              } catch (error) {
                console.error('towxml节点生成失败:', error)
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
  },

  /**
   * 测试费用计算精度（开发调试用）
   */
  testCostCalculation() {
    console.log('🧪 测试费用计算精度')

    // 验证模型配置中的价格格式
    console.log('\n📋 当前模型配置验证:')
    const { currentModel } = this.data
    if (currentModel) {
      console.log('当前模型:', {
        id: currentModel.id,
        name: currentModel.name,
        pricePerInputToken: currentModel.pricePerInputToken,
        pricePerOutputToken: currentModel.pricePerOutputToken,
        pricePerToken: currentModel.pricePerToken
      })

      // 判断价格格式
      const inputPrice = currentModel.pricePerInputToken || currentModel.pricePerToken || 0.00014
      const outputPrice = currentModel.pricePerOutputToken || currentModel.pricePerToken || 0.00028

      if (inputPrice < 0.1 && outputPrice < 0.1) {
        console.log('✅ 检测到每token价格格式')
        console.log(`转换后: 输入¥${(inputPrice * 1000000).toFixed(2)}/百万tokens, 输出¥${(outputPrice * 1000000).toFixed(2)}/百万tokens`)
      } else {
        console.log('✅ 检测到每百万tokens价格格式')
        console.log(`价格: 输入¥${inputPrice.toFixed(2)}/百万tokens, 输出¥${outputPrice.toFixed(2)}/百万tokens`)
      }
    }

    // 使用统一的测试用例
    console.log('\n🧪 使用统一的费用计算测试用例:')
    AI_MODEL_TEST_CASES.COST_CALCULATION_TESTS.forEach((testCase, index) => {
      console.log(`\n🧪 测试用例 ${index + 1} (${testCase.description}):`)
      console.log(`模型: ${testCase.model}`)
      console.log(`输入tokens: ${testCase.promptTokens}, 输出tokens: ${testCase.completionTokens}`)

      // 使用统一的费用计算函数
      const costResult = calculateModelCost(testCase.model, testCase.promptTokens, testCase.completionTokens)

      console.log(`计算结果:`)
      console.log(`  输入费用: ¥${costResult.inputCost.toFixed(6)} (期望: ¥${testCase.expectedInputCost.toFixed(6)})`)
      console.log(`  输出费用: ¥${costResult.outputCost.toFixed(6)} (期望: ¥${testCase.expectedOutputCost.toFixed(6)})`)
      console.log(`  总费用: ¥${costResult.totalCost.toFixed(6)} (期望: ¥${testCase.expectedTotalCost.toFixed(6)})`)

      // 验证计算精度
      const inputMatch = Math.abs(costResult.inputCost - testCase.expectedInputCost) < 0.000001
      const outputMatch = Math.abs(costResult.outputCost - testCase.expectedOutputCost) < 0.000001
      const totalMatch = Math.abs(costResult.totalCost - testCase.expectedTotalCost) < 0.000001

      console.log(`验证结果:`)
      console.log(`  输入费用: ${inputMatch ? '✅ 通过' : '❌ 失败'}`)
      console.log(`  输出费用: ${outputMatch ? '✅ 通过' : '❌ 失败'}`)
      console.log(`  总费用: ${totalMatch ? '✅ 通过' : '❌ 失败'}`)

      // 验证小额费用的精度
      if (costResult.totalCost < 0.01) {
        console.log(`⚠️ 小额费用测试: ${costResult.totalCost.toFixed(6)} < 0.01元，显示精度为¥${costResult.totalCost.toFixed(2)}`)
      }
    })
  },

  /**
   * 测试DeepSeek-R1思考过程展开功能（开发调试用）
   */
  testDeepSeekR1ReasoningExpansion() {
    console.log('🧪 测试DeepSeek-R1思考过程展开功能')

    const testResults = {
      currentModel: this.data.currentModel?.id,
      isDeepSeekR1: this.isDeepSeekR1Model(),
      messagesWithReasoning: this.data.messages.filter(msg => msg.reasoningContent && msg.reasoningContent.length > 0),
      expectedBehavior: this.isDeepSeekR1Model() ? '思考过程应该默认展开' : '思考过程应该默认折叠'
    }

    console.log('🧪 测试结果:', testResults)

    // 检查每个有思考内容的消息的展开状态
    testResults.messagesWithReasoning.forEach(msg => {
      console.log(`🧪 消息 ${msg.id}:`, {
        reasoningExpanded: msg.reasoningExpanded,
        isThinkingModel: msg.isThinkingModel,
        reasoningLength: msg.reasoningContent.length,
        isCorrectState: this.isDeepSeekR1Model() ? msg.reasoningExpanded : true // 允许用户手动控制
      })
    })

    return testResults
  },

  /**
   * 测试重试按钮显示逻辑（开发调试用）
   */
  testRetryButtonLogic() {
    console.log('🧪 测试重试按钮显示逻辑')

    // 使用统一的测试用例
    const testMessages = AI_MODEL_TEST_CASES.ERROR_MESSAGE_TESTS.map(testCase => ({
      id: testCase.id,
      type: testCase.type,
      content: testCase.content,
      isError: testCase.isError,
      isStreaming: testCase.isStreaming,
      contentNodes: testCase.contentNodes || null,
      reasoningContent: testCase.reasoningContent || ''
    }))

    testMessages.forEach((msg, index) => {
      const shouldShowRetry = this.isErrorMessage(msg)
      const testCase = AI_MODEL_TEST_CASES.ERROR_MESSAGE_TESTS[index]
      const isCorrect = shouldShowRetry === testCase.expected

      console.log(`🧪 测试消息 ${index + 1} (${testCase.description}):`, {
        id: msg.id,
        content: msg.content || '(空内容)',
        isError: msg.isError,
        isStreaming: msg.isStreaming,
        shouldShowRetry: shouldShowRetry,
        expected: testCase.expected,
        result: isCorrect ? '✅ 测试通过' : '❌ 测试失败',
        status: shouldShowRetry ? '显示重试按钮' : '不显示重试按钮'
      })
    })

    // 测试实际消息列表中的错误消息
    console.log('\n🧪 检查当前消息列表中的错误消息:')
    const currentMessages = this.data.messages || []
    const errorMessages = currentMessages.filter(msg => this.isErrorMessage(msg))
    console.log(`发现 ${errorMessages.length} 条错误消息:`, errorMessages.map(msg => ({
      id: msg.id,
      content: msg.content || '(空内容)',
      isError: msg.isError,
      showRetryButton: msg.showRetryButton
    })))
  },

  /**
   * 处理思考过程折叠面板切换
   */
  onReasoningToggle(event) {
    const messageId = event.currentTarget.dataset.messageId
    const expandedItems = event.detail || []
    const isExpanded = expandedItems.includes('reasoning')

    console.log('💭 思考过程折叠状态切换:', {
      messageId,
      expandedItems,
      isExpanded,
      isDeepSeekR1: this.isDeepSeekR1Model(),
      modelId: this.data.currentModel?.id
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
   * 滚动到底部（使用ScrollViewContext.scrollIntoView）
   */
  scrollToBottom() {
    // 如果有状态提示显示，滚动到状态提示区域；否则滚动到最后一条消息
    if (this.data.chatStatus !== 'idle') {
      this.scrollToStatusIndicator()
    } else {
      this.scrollToLastMessage()
    }
  },

  /**
   * 滚动到最后一条消息
   */
  scrollToLastMessage() {
    const { messages } = this.data
    if (messages && messages.length > 0) {
      const lastMessageId = messages[messages.length - 1].id
      this.scrollToMessage(lastMessageId)
    }
  },

  /**
   * 滚动到指定消息
   */
  scrollToMessage(messageId) {
    if (!messageId) return

    wx.createSelectorQuery()
      .select('#chat-scroll-view')
      .context((res) => {
        if (res && res.context) {
          const scrollViewContext = res.context

          try {
            scrollViewContext.scrollIntoView(`#msg-${messageId}`, {
              offset: 10,
              withinExtent: false,
              alignment: 'end',
              animated: true
            })
            console.log(`滚动到消息 ${messageId} 成功`)
          } catch (error) {
            console.warn('滚动到消息失败，使用备用方案:', error)
            this.fallbackScrollToBottom()
          }
        } else {
          this.fallbackScrollToBottom()
        }
      })
      .exec()
  },

  /**
   * 检查基础库版本和ScrollViewContext支持
   */
  checkScrollViewContextSupport() {
    const systemInfo = wx.getSystemInfoSync()
    const SDKVersion = systemInfo.SDKVersion || '0.0.0'

    console.log('📱 系统信息检查:', {
      SDKVersion: SDKVersion,
      platform: systemInfo.platform,
      version: systemInfo.version,
      system: systemInfo.system
    })

    // 检查基础库版本是否支持ScrollViewContext.scrollIntoView (需要2.14.4+)
    const compareVersion = (v1, v2) => {
      const v1parts = v1.split('.').map(Number)
      const v2parts = v2.split('.').map(Number)

      for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
        const v1part = v1parts[i] || 0
        const v2part = v2parts[i] || 0

        if (v1part > v2part) return 1
        if (v1part < v2part) return -1
      }
      return 0
    }

    const isSupported = compareVersion(SDKVersion, '2.14.4') >= 0
    console.log('🔍 ScrollViewContext支持检查:', {
      currentVersion: SDKVersion,
      requiredVersion: '2.14.4',
      isSupported: isSupported
    })

    return isSupported
  },

  /**
   * 滚动到状态提示区域（使用官方ScrollViewContext API）
   */
  scrollToStatusIndicator() {
    console.log('🔍 开始滚动到状态提示区域...')

    // 检查ScrollViewContext是否可用
    if (this.data.scrollViewContextAvailable) {
      console.log('✅ 使用ScrollViewContext.scrollIntoView方案')
      this.performScrollViewContextQuery()
    } else {
      console.log('🔄 ScrollViewContext不可用，使用备用滚动方案')
      this.fallbackScrollToBottom()
    }
  },

  /**
   * 执行ScrollViewContext查询
   */
  performScrollViewContextQuery() {
    // 首先检查scroll-view元素是否存在
    wx.createSelectorQuery()
      .select('#chat-scroll-view')
      .boundingClientRect((rect) => {
        console.log('📏 scroll-view元素查询结果:', {
          found: !!rect,
          rect: rect,
          id: '#chat-scroll-view'
        })

        if (!rect) {
          console.error('❌ scroll-view元素未找到，检查WXML中的id是否正确')
          this.fallbackScrollToBottom()
          return
        }

        // 检查状态提示元素是否存在
        wx.createSelectorQuery()
          .select('#chat-status-indicator')
          .boundingClientRect((statusRect) => {
            console.log('📍 状态提示元素查询结果:', {
              found: !!statusRect,
              rect: statusRect,
              id: '#chat-status-indicator',
              chatStatus: this.data.chatStatus
            })

            // 如果状态提示元素不存在，直接使用备用方案
            if (!statusRect) {
              console.warn('⚠️ 状态提示元素不存在，使用备用滚动方案')
              this.fallbackScrollToBottom()
              return
            }

            // 获取scroll-view的context
            wx.createSelectorQuery()
              .select('#chat-scroll-view')
              .context((res) => {
                console.log('🎯 ScrollViewContext查询结果:', {
                  hasResult: !!res,
                  hasContext: !!(res && res.context),
                  contextType: res && res.context ? typeof res.context : 'undefined',
                  contextMethods: res && res.context ? Object.getOwnPropertyNames(res.context) : [],
                  fullResult: res
                })

                if (res && res.context) {
                  const scrollViewContext = res.context

                  // 检查scrollIntoView方法是否存在
                  const hasScrollIntoView = typeof scrollViewContext.scrollIntoView === 'function'
                  console.log('🔧 ScrollViewContext方法检查:', {
                    hasScrollIntoView: hasScrollIntoView,
                    availableMethods: Object.getOwnPropertyNames(scrollViewContext),
                    contextPrototype: Object.getPrototypeOf(scrollViewContext)
                  })

                  if (!hasScrollIntoView) {
                    console.warn('⚠️ scrollIntoView方法不存在，可能是基础库版本过低')
                    this.fallbackScrollToBottom()
                    return
                  }

                  // 使用scrollIntoView滚动到状态提示区域
                  try {
                    console.log('🚀 开始调用scrollIntoView...')
                    scrollViewContext.scrollIntoView('#chat-status-indicator', {
                      offset: 20,        // 额外偏移20px，确保状态提示完全可见
                      withinExtent: false, // 不限制在cacheExtent内
                      alignment: 'end',   // 将目标元素对齐到视口底部
                      animated: true      // 启用平滑滚动动画
                    })
                    console.log('✅ ScrollViewContext.scrollIntoView 调用成功')
                  } catch (error) {
                    console.error('❌ ScrollViewContext.scrollIntoView 调用失败:', {
                      error: error,
                      message: error.message,
                      stack: error.stack
                    })
                    this.fallbackScrollToBottom()
                  }
                } else {
                  console.error('❌ 无法获取ScrollViewContext，详细信息:', {
                    selectorQueryResult: res,
                    possibleReasons: [
                      '1. scroll-view元素不存在或id错误',
                      '2. 基础库版本过低（需要2.14.4+）',
                      '3. 页面渲染未完成',
                      '4. scroll-view组件配置问题（缺少enhanced属性）',
                      '5. 微信开发者工具版本问题'
                    ]
                  })
                  this.fallbackScrollToBottom()
                }
              })
              .exec()
          })
          .exec()
      })
      .exec()
  },

  /**
   * 备用滚动方案（兼容性处理）
   */
  fallbackScrollToBottom() {
    console.log('🔄 使用备用滚动方案...')

    // 方案1：尝试使用scroll-view的scroll-top属性
    this.tryScrollTopMethod()

    // 方案2：备用的页面滚动方案
    setTimeout(() => {
      this.tryPageScrollMethod()
    }, 200)
  },

  /**
   * 尝试使用scroll-top属性滚动
   */
  tryScrollTopMethod() {
    wx.createSelectorQuery()
      .select('#chat-scroll-view')
      .scrollOffset((res) => {
        console.log('📊 scroll-view滚动信息:', res)

        if (res) {
          // 计算需要滚动的距离
          wx.createSelectorQuery()
            .select('#chat-scroll-view')
            .boundingClientRect((rect) => {
              if (rect) {
                const scrollTop = res.scrollHeight - rect.height + 50 // 额外50px确保完全可见
                console.log('🎯 计算滚动距离:', {
                  scrollHeight: res.scrollHeight,
                  viewHeight: rect.height,
                  targetScrollTop: scrollTop
                })

                this.setData({
                  scrollTop: scrollTop
                }, () => {
                  console.log('✅ scroll-top方法执行完成')
                })
              }
            })
            .exec()
        }
      })
      .exec()
  },

  /**
   * 尝试页面滚动方法
   */
  tryPageScrollMethod() {
    wx.createSelectorQuery()
      .select('#chat-container')
      .boundingClientRect((rect) => {
        console.log('📏 chat-container信息:', rect)

        if (rect) {
          wx.pageScrollTo({
            scrollTop: rect.height,
            duration: 300,
            success: () => {
              console.log('✅ 页面滚动成功')
            },
            fail: (error) => {
              console.error('❌ 页面滚动失败:', error)
            }
          })
        } else {
          console.warn('⚠️ 无法获取chat-container信息')
        }
      })
      .exec()
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
          // 使用新的百万tokens价格格式估算费用（假设大部分是输出token）
          const pricePerMillionTokens = currentModel.pricePerOutputToken || currentModel.pricePerToken || 8
          totalCost += (msg.tokens / 1000000) * pricePerMillionTokens
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
        // 使用新的百万tokens价格格式估算（假设大部分是输出）
        const pricePerMillionTokens = currentModel.pricePerOutputToken || currentModel.pricePerToken || 8
        totalCost += (msg.tokens / 1000000) * pricePerMillionTokens
      }
    })

    this.setData({
      totalTokens,
      totalPromptTokens,
      totalCompletionTokens,
      totalCost: totalCost.toFixed(2) // 人民币精确到2位小数（分）
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