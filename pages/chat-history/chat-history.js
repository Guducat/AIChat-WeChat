// pages/chat-history/chat-history.js
import { getChatHistory, deleteChatHistory, clearChatHistory, saveChatHistory } from '../../utils/storage.js'
import { DEFAULT_AI_MODELS } from '../../utils/constants.js'
import { hasImages, formatMultimodalMessage } from '../../utils/multimodal-test.js'
import { formatHistoryTime, formatChatTime, getFriendlyTime } from '../../utils/time-formatter.js'

Page({
  data: {
    chatHistory: [],
    loading: false,
    isEmpty: false,
    searchKeyword: '',
    filteredHistory: [],
    showSearch: false,
    // 新增的UI状态
    showMoreActions: false,
    showDeleteConfirm: false,
    showSharePopup: false,
    currentChatId: '',
    currentChatTitle: '',
    deleteConfirmMessage: '',
    moreActionsList: [
      { name: 'edit', text: '重命名', icon: 'edit' },
      { name: 'export', text: '导出对话', icon: 'down' },
      { name: 'duplicate', text: '复制对话', icon: 'add-o' },
      { name: 'delete', text: '删除对话', icon: 'delete-o', color: '#ee0a24' }
    ]
  },

  onLoad() {
    this.loadChatHistory()
  },

  onShow() {
    this.loadChatHistory()
  },

  onPullDownRefresh() {
    this.loadChatHistory()
    wx.stopPullDownRefresh()
  },



  /**
   * 加载对话记录
   */
  loadChatHistory() {
    console.log('开始加载对话记录...')

    this.setData({
      loading: true
    })

    try {
      const history = getChatHistory()
      console.log('获取到的对话记录:', history)
      console.log('原始数据类型:', typeof history, '是否为数组:', Array.isArray(history))

      // 处理对话记录，添加多模态标识和数据验证
      const processedHistory = history.map((chat, index) => {
        try {
          // 验证对话数据完整性
          if (!chat || typeof chat !== 'object') {
            console.warn(`对话记录 ${index} 不是有效对象:`, chat)
            return null
          }

          if (!chat.id) {
            console.warn(`对话记录 ${index} 缺少ID:`, chat)
            return null
          }

          if (!chat.messages || !Array.isArray(chat.messages)) {
            console.warn(`对话记录 ${index} 消息数据无效:`, chat)
            // 如果消息为空，创建一个空数组而不是丢弃整个记录
            chat.messages = []
          }

          // 安全地检查是否包含图片
          let chatHasImages = false
          try {
            chatHasImages = chat.messages.some(msg => {
              try {
                return hasImages(msg)
              } catch (error) {
                console.warn('检查单个消息图片时出错:', error, msg)
                return false
              }
            })
          } catch (error) {
            console.warn('检查对话图片时出错:', error)
            chatHasImages = false
          }

          // 安全地计算token数量和费用
          let calculatedTokens = 0
          let calculatedCost = 0

          // 安全地获取已保存的数据
          try {
            // 更安全的数值转换
            const rawTokens = chat.totalTokens
            const rawCost = chat.totalCost

            calculatedTokens = (rawTokens !== null && rawTokens !== undefined && !isNaN(parseFloat(rawTokens)))
              ? parseFloat(rawTokens) : 0
            calculatedCost = (rawCost !== null && rawCost !== undefined && !isNaN(parseFloat(rawCost)))
              ? parseFloat(rawCost) : 0

            console.log(`记录 ${index} 原始数据:`, { rawTokens, rawCost, calculatedTokens, calculatedCost })
          } catch (error) {
            console.warn('解析已保存的token/cost数据失败:', error)
            calculatedTokens = 0
            calculatedCost = 0
          }

          // 如果没有保存的token数据，尝试从消息中计算
          if (calculatedTokens === 0 && chat.messages && Array.isArray(chat.messages) && chat.messages.length > 0) {
            try {
              calculatedTokens = chat.messages.reduce((total, msg) => {
                const msgTokens = parseFloat(msg.tokens) || 0
                return total + msgTokens
              }, 0)
            } catch (error) {
              console.warn('从消息计算token失败:', error)
              calculatedTokens = 0
            }
          }

          // 如果还是0，使用估算值
          if (calculatedTokens === 0 && chat.messages && Array.isArray(chat.messages) && chat.messages.length > 0) {
            // 简单估算：每条消息平均50个token
            calculatedTokens = chat.messages.length * 50
          }

          // 计算费用（如果没有保存的话）
          if (calculatedCost === 0 && calculatedTokens > 0) {
            try {
              // 使用默认价格：0.00028 RMB per token
              calculatedCost = calculatedTokens * 0.00028
            } catch (error) {
              console.warn('计算费用失败:', error)
              calculatedCost = 0
            }
          }

          // 确保数值类型正确
          calculatedTokens = Math.max(0, Math.floor(calculatedTokens))
          calculatedCost = Math.max(0, parseFloat(calculatedCost) || 0)

          // 安全地格式化费用
          let formattedCost = 0
          try {
            // 更严格的类型转换和验证
            const costValue = parseFloat(calculatedCost)
            if (!isNaN(costValue) && isFinite(costValue)) {
              formattedCost = parseFloat(costValue.toFixed(6))
            } else {
              console.warn(`记录 ${index} 费用数据无效，使用默认值0:`, calculatedCost, typeof calculatedCost)
              formattedCost = 0
            }
          } catch (error) {
            console.warn('格式化费用失败，使用默认值0:', error, 'calculatedCost:', calculatedCost, 'type:', typeof calculatedCost)
            formattedCost = 0
          }

          // 确保必要字段存在
          const processedChat = {
            id: chat.id,
            title: chat.title || '未命名对话',
            messages: chat.messages || [],
            model: chat.model || 'unknown',
            modelName: chat.modelName || '未知模型',
            scenario: chat.scenario || 'general',
            scenarioName: chat.scenarioName || '通用对话',
            createdAt: chat.createdAt || Date.now(),
            updatedAt: chat.updatedAt || Date.now(),
            totalTokens: calculatedTokens,
            totalCost: formattedCost,
            hasImages: chatHasImages,
            slideX: 0, // 初始化滑动位置
            formattedTime: formatHistoryTime(chat.updatedAt || Date.now()) // 添加格式化时间
          }

          return processedChat
        } catch (error) {
          console.error(`处理对话记录 ${index} 时出错:`, error)
          console.error('错误的对话数据:', chat)

          // 尝试创建一个最小可用的对话记录，而不是完全丢弃
          try {
            const fallbackChat = {
              id: chat?.id || `fallback_${index}_${Date.now()}`,
              title: chat?.title || '损坏的对话记录',
              messages: [],
              model: 'unknown',
              modelName: '未知模型',
              scenario: 'general',
              scenarioName: '通用对话',
              createdAt: chat?.createdAt || Date.now(),
              updatedAt: chat?.updatedAt || Date.now(),
              totalTokens: 0,
              totalCost: 0,
              hasImages: false,
              slideX: 0,
              formattedTime: formatHistoryTime(chat?.updatedAt || Date.now())
            }
            console.log(`为损坏的记录 ${index} 创建了fallback版本`)
            return fallbackChat
          } catch (fallbackError) {
            console.error(`创建fallback记录失败:`, fallbackError)
            return null
          }
        }
      }).filter(chat => chat !== null) // 过滤掉无效的对话记录

      console.log('处理后的对话记录:', processedHistory)

      this.setData({
        chatHistory: processedHistory,
        filteredHistory: processedHistory,
        isEmpty: processedHistory.length === 0,
        loading: false
      })

      if (processedHistory.length === 0) {
        console.log('没有有效的对话记录')
      } else {
        console.log(`成功加载 ${processedHistory.length} 条对话记录`)
      }

    } catch (error) {
      console.error('加载对话记录失败:', error)

      // 设置空状态，但不自动清理数据
      this.setData({
        chatHistory: [],
        filteredHistory: [],
        isEmpty: true,
        loading: false
      })

      // 只在用户确认时才清理数据
      wx.showModal({
        title: '数据加载异常',
        content: '对话记录加载时遇到问题，部分数据可能损坏。是否尝试清理并重新开始？',
        confirmText: '清理重新开始',
        cancelText: '稍后重试',
        success: (res) => {
          if (res.confirm) {
            try {
              wx.removeStorageSync('chat_history')
              console.log('用户确认后已清理对话记录数据')
              wx.showToast({
                title: '数据已清理',
                icon: 'success'
              })
            } catch (cleanError) {
              console.error('清理数据时出错:', cleanError)
              wx.showToast({
                title: '清理失败',
                icon: 'error'
              })
            }
          } else {
            // 用户选择稍后重试，可以尝试重新加载
            setTimeout(() => {
              this.loadChatHistory()
            }, 1000)
          }
        }
      })
    }
  },

  /**
   * 继续对话
   */
  onContinueChat(event) {
    console.log('🔍 继续对话事件触发:', {
      type: event.type,
      target: event.target,
      currentTarget: event.currentTarget,
      detail: event.detail
    })

    // 检查是否点击的是删除按钮或其子元素
    const target = event.target
    const currentTarget = event.currentTarget

    // 如果点击的是删除按钮区域，不执行继续对话
    if (target.classList && (
      target.classList.contains('delete-btn') ||
      target.classList.contains('action-btn') ||
      target.closest('.item-actions')
    )) {
      console.log('🚫 点击了删除按钮区域，阻止继续对话')
      return
    }

    const { chatId } = currentTarget.dataset
    const chat = this.data.chatHistory.find(item => item.id === chatId)

    if (chat) {
      console.log('✅ 继续对话:', { chatId, chat })
      wx.navigateTo({
        url: `/pages/chat/chat?chatId=${chatId}&scenario=${chat.scenario}&model=${chat.model}`
      })
    } else {
      console.warn('⚠️ 未找到对话记录:', chatId)
    }
  },

  /**
   * 删除对话（新的确认弹窗方式）
   */
  onDeleteChat(event) {
    console.log('🗑️ 删除对话事件触发:', {
      type: event.type,
      target: event.target,
      currentTarget: event.currentTarget,
      dataset: event.currentTarget.dataset
    })

    // 阻止事件冒泡到父容器
    if (event.stopPropagation) {
      event.stopPropagation()
    }

    const { chatId, title, index } = event.currentTarget.dataset

    if (!chatId) {
      console.error('❌ 删除对话失败：chatId为空')
      wx.showToast({
        title: '删除失败：数据错误',
        icon: 'error'
      })
      return
    }

    console.log('✅ 准备删除对话:', { chatId, title, index })

    // 重置滑动位置
    if (typeof index !== 'undefined') {
      this.resetSlidePosition(index)
    }

    this.setData({
      currentChatId: chatId,
      currentChatTitle: title || '未命名对话',
      deleteConfirmMessage: `确定要删除对话"${title || '未命名对话'}"吗？此操作不可恢复。`,
      showDeleteConfirm: true
    })
  },

  /**
   * 确认删除对话
   */
  onConfirmDelete() {
    const { currentChatId } = this.data

    const success = deleteChatHistory(currentChatId)
    if (success) {
      wx.showToast({
        title: '删除成功',
        icon: 'success'
      })
      this.loadChatHistory()
    } else {
      wx.showToast({
        title: '删除失败',
        icon: 'error'
      })
    }

    this.setData({
      showDeleteConfirm: false,
      currentChatId: '',
      currentChatTitle: ''
    })
  },

  /**
   * 取消删除
   */
  onCancelDelete() {
    this.setData({
      showDeleteConfirm: false,
      currentChatId: '',
      currentChatTitle: ''
    })
  },

  /**
   * 清空所有对话记录
   */
  onClearAll() {
    if (this.data.isEmpty) {
      return
    }

    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有对话记录吗？此操作不可恢复。',
      success: (res) => {
        if (res.confirm) {
          const success = clearChatHistory()
          if (success) {
            wx.showToast({
              title: '清空成功',
              icon: 'success'
            })
            this.loadChatHistory()
          } else {
            wx.showToast({
              title: '清空失败',
              icon: 'error'
            })
          }
        }
      }
    })
  },

  /**
   * 显示/隐藏搜索
   */
  onToggleSearch() {
    this.setData({
      showSearch: !this.data.showSearch,
      searchKeyword: '',
      filteredHistory: this.data.chatHistory
    })
  },

  /**
   * 搜索对话
   */
  onSearchInput(event) {
    const keyword = event.detail.value.toLowerCase()
    this.setData({
      searchKeyword: keyword
    })

    if (!keyword) {
      this.setData({
        filteredHistory: this.data.chatHistory
      })
      return
    }

    const filtered = this.data.chatHistory.filter(chat => {
      return chat.title.toLowerCase().includes(keyword) ||
             chat.scenarioName.toLowerCase().includes(keyword) ||
             chat.modelName.toLowerCase().includes(keyword)
    })

    this.setData({
      filteredHistory: filtered
    })
  },

  /**
   * 格式化时间（使用新的时间格式化工具）
   */
  formatTime(timestamp) {
    return formatHistoryTime(timestamp)
  },

  /**
   * 获取对话预览
   */
  getChatPreview(messages) {
    const userMessages = messages.filter(msg => msg.type === 'user')
    if (userMessages.length > 0) {
      const preview = userMessages[0].content
      return preview.length > 50 ? preview.substring(0, 50) + '...' : preview
    }
    return '暂无消息'
  },

  /**
   * 开始新对话
   */
  onStartNewChat() {
    wx.switchTab({
      url: '/pages/home/home'
    })
  },

  /**
   * 滑动变化事件
   */
  onSlideChange(event) {
    const { index } = event.currentTarget.dataset
    const { x } = event.detail

    // 限制滑动范围
    const maxSlide = -80
    const slideX = Math.max(maxSlide, Math.min(0, x))

    const key = `filteredHistory[${index}].slideX`
    this.setData({
      [key]: slideX
    })
  },

  /**
   * 滑动结束事件
   */
  onSlideEnd(event) {
    const { index } = event.currentTarget.dataset
    const { x } = event.detail

    // 判断是否显示删除按钮
    const threshold = -40
    const slideX = x < threshold ? -80 : 0

    const key = `filteredHistory[${index}].slideX`
    this.setData({
      [key]: slideX
    })
  },

  /**
   * 重置滑动位置
   */
  resetSlidePosition(index) {
    const key = `filteredHistory[${index}].slideX`
    this.setData({
      [key]: 0
    })
  },

  /**
   * 显示更多操作
   */
  onShowMoreActions(event) {
    const { chatId, title } = event.currentTarget.dataset

    this.setData({
      currentChatId: chatId,
      currentChatTitle: title,
      showMoreActions: true
    })
  },

  /**
   * 关闭更多操作
   */
  onCloseMoreActions() {
    this.setData({
      showMoreActions: false,
      currentChatId: '',
      currentChatTitle: ''
    })
  },

  /**
   * 选择更多操作
   */
  onSelectMoreAction(event) {
    const { name } = event.detail
    const { currentChatId, currentChatTitle } = this.data

    this.setData({
      showMoreActions: false
    })

    switch (name) {
      case 'edit':
        this.onRenameChat(currentChatId, currentChatTitle)
        break
      case 'export':
        this.onExportChat(currentChatId)
        break
      case 'duplicate':
        this.onDuplicateChat(currentChatId)
        break
      case 'delete':
        this.onDeleteChat({
          currentTarget: {
            dataset: {
              chatId: currentChatId,
              title: currentChatTitle
            }
          }
        })
        break
    }
  },

  /**
   * 分享对话
   */
  onShareChat(event) {
    const { chatId } = event.currentTarget.dataset

    this.setData({
      currentChatId: chatId,
      showSharePopup: true
    })
  },

  /**
   * 关闭分享弹窗
   */
  onCloseSharePopup() {
    this.setData({
      showSharePopup: false,
      currentChatId: ''
    })
  },

  /**
   * 导出文本
   */
  onExportText() {
    const { currentChatId } = this.data
    const chat = this.data.chatHistory.find(item => item.id === currentChatId)

    if (chat) {
      let exportText = `对话记录：${chat.title}\n`
      exportText += `时间：${new Date(chat.updatedAt).toLocaleString()}\n`
      exportText += `模型：${chat.modelName}\n\n`

      chat.messages.forEach((msg, index) => {
        const role = msg.type === 'user' ? '用户' : 'AI'
        const content = typeof msg.content === 'string'
          ? msg.content
          : formatMultimodalMessage(msg)
        exportText += `${role}：${content}\n\n`
      })

      wx.setClipboardData({
        data: exportText,
        success: () => {
          wx.showToast({
            title: '已复制到剪贴板',
            icon: 'success'
          })
          this.onCloseSharePopup()
        }
      })
    }
  },

  /**
   * 复制链接
   */
  onCopyLink() {
    const { currentChatId } = this.data
    const link = `aichat://chat/${currentChatId}`

    wx.setClipboardData({
      data: link,
      success: () => {
        wx.showToast({
          title: '链接已复制',
          icon: 'success'
        })
        this.onCloseSharePopup()
      }
    })
  },

  /**
   * 保存图片
   */
  onSaveImage() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
    this.onCloseSharePopup()
  },

  /**
   * 重命名对话
   */
  onRenameChat(chatId, currentTitle) {
    wx.showModal({
      title: '重命名对话',
      content: '请输入新的对话标题',
      editable: true,
      placeholderText: currentTitle,
      success: (res) => {
        if (res.confirm && res.content.trim()) {
          // 这里需要实现重命名功能
          wx.showToast({
            title: '重命名成功',
            icon: 'success'
          })
          this.loadChatHistory()
        }
      }
    })
  },

  /**
   * 导出对话
   */
  onExportChat(chatId) {
    this.setData({
      currentChatId: chatId,
      showSharePopup: true
    })
  },

  /**
   * 复制对话
   */
  onDuplicateChat(chatId) {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  }
})
