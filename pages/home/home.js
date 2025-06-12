// pages/home/home.js
import { DEFAULT_AI_MODELS, DEFAULT_CHAT_SCENARIO, UPLOAD_LIMITS } from '../../utils/constants.js'
import { getSelectedModel, saveSelectedModel, getUserSettings } from '../../utils/storage.js'
import { getAIModels } from '../../utils/api.js'
import { getMultimodalModels } from '../../utils/multimodal-test.js'
import { convertWxFileToBase64, validateBase64Image, compressImage } from '../../utils/image-processor.js'

Page({
  data: {
    aiModels: [],
    selectedModel: 'gpt-3.5-turbo',
    userSettings: {},
    showModelSelector: false,
    inputText: '',
    uploadedFiles: [],
    isLoading: false,
    loadingModels: true,
    currentModelName: '加载中...',
    currentModelIcon: '🚀',
    uploadButtonText: '上传图片',
    sendButtonText: '开始对话',
    isMultimodalModel: false,
    showUploadTip: false
  },

  onLoad() {
    this.loadUserData()
    this.loadAIModels()
  },

  onShow() {
    this.loadUserData()
    // 确保页面状态正确，特别是从对话页面返回时
    this.updateDisplayTexts()
  },

  /**
   * 加载用户数据
   */
  loadUserData() {
    const selectedModel = getSelectedModel()
    const userSettings = getUserSettings()

    this.setData({
      selectedModel,
      userSettings
    })

    this.updateDisplayTexts()
  },

  /**
   * 加载AI模型列表
   */
  async loadAIModels() {
    try {
      this.setData({ loadingModels: true })

      const response = await getAIModels()
      const models = response.data?.models || DEFAULT_AI_MODELS

      this.setData({
        aiModels: models,
        loadingModels: false
      })
    } catch (error) {
      console.error('加载模型列表失败:', error)
      // 使用默认模型作为fallback
      this.setData({
        aiModels: DEFAULT_AI_MODELS,
        loadingModels: false
      })

      wx.showToast({
        title: '加载模型失败，使用默认配置',
        icon: 'none'
      })
    }

    this.updateDisplayTexts()
  },

  /**
   * 更新显示文本
   */
  updateDisplayTexts() {
    const { aiModels, selectedModel, uploadedFiles, isLoading, loadingModels } = this.data

    // 更新模型显示
    if (loadingModels) {
      this.setData({
        currentModelName: '加载中...',
        currentModelIcon: '🚀',
        isMultimodalModel: false
      })
    } else {
      const currentModel = aiModels.find(m => m.id === selectedModel) || aiModels[0]
      if (currentModel) {
        // 检查是否为多模态模型
        const isMultimodal = this.checkIsMultimodalModel(currentModel.id)

        this.setData({
          currentModelName: currentModel.name,
          currentModelIcon: currentModel.icon,
          isMultimodalModel: isMultimodal
        })
      }
    }

    // 更新按钮文本
    const { isMultimodalModel } = this.data
    let uploadButtonText = ''

    if (!isMultimodalModel) {
      uploadButtonText = '当前模型不支持图片'
    } else if (uploadedFiles.length > 0) {
      uploadButtonText = `图片(${uploadedFiles.length}/9)`
    } else {
      uploadButtonText = '上传图片'
    }

    const sendButtonText = isLoading ? '处理中...' : '开始对话'

    this.setData({
      uploadButtonText,
      sendButtonText,
      showUploadTip: !isMultimodalModel && uploadedFiles.length === 0
    })
  },

  /**
   * 检查是否为多模态模型
   */
  checkIsMultimodalModel(modelId) {
    const multimodalModels = getMultimodalModels()
    return multimodalModels.some(model => model.id === modelId)
  },

  /**
   * 发送消息
   */
  onSendMessage() {
    const { inputText, uploadedFiles, isMultimodalModel } = this.data

    if (!inputText.trim() && uploadedFiles.length === 0) {
      wx.showToast({
        title: '请输入消息或上传文件',
        icon: 'none'
      })
      return
    }

    // 检查非多模态模型是否包含图片
    if (uploadedFiles.length > 0 && !isMultimodalModel) {
      wx.showModal({
        title: '模型不支持图片',
        content: '当前模型不支持图片输入，是否移除图片并继续发送文字消息？',
        confirmText: '移除图片',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            // 移除图片并发送
            this.setData({
              uploadedFiles: []
            })
            this.updateDisplayTexts()
            this.sendMessageWithoutImages()
          }
        }
      })
      return
    }

    this.sendMessage()
  },

  /**
   * 发送消息（不包含图片）
   */
  sendMessageWithoutImages() {
    const { inputText, selectedModel } = this.data

    // 生成对话ID
    const chatId = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // 构建初始消息数据
    const initialMessage = {
      text: inputText.trim(),
      files: []
    }

    // 跳转到对话页面
    wx.navigateTo({
      url: `/pages/chat/chat?chatId=${chatId}&scenario=${DEFAULT_CHAT_SCENARIO.id}&model=${selectedModel}&initialMessage=${encodeURIComponent(JSON.stringify(initialMessage))}`,
      success: () => {
        // 跳转成功后清理home页面状态
        this.clearHomePageState()
      }
    })
  },

  /**
   * 发送消息（通用）
   */
  sendMessage() {
    const { inputText, uploadedFiles, selectedModel } = this.data

    // 生成对话ID
    const chatId = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // 构建初始消息数据
    const initialMessage = {
      text: inputText.trim(),
      files: uploadedFiles
    }

    // 跳转到对话页面
    wx.navigateTo({
      url: `/pages/chat/chat?chatId=${chatId}&scenario=${DEFAULT_CHAT_SCENARIO.id}&model=${selectedModel}&initialMessage=${encodeURIComponent(JSON.stringify(initialMessage))}`,
      success: () => {
        // 跳转成功后清理home页面状态
        this.clearHomePageState()
      }
    })
  },

  /**
   * 清理home页面状态
   */
  clearHomePageState() {
    console.log('清理home页面状态...')

    // 清空输入框内容
    this.setData({
      inputText: ''
    })

    // 清空已上传的文件/图片
    this.setData({
      uploadedFiles: []
    })

    // 重置加载状态
    this.setData({
      isLoading: false
    })

    // 更新显示文本
    this.updateDisplayTexts()

    console.log('home页面状态已清理')
  },

  /**
   * 选择文件上传
   */
  onChooseFile() {
    // 检查当前模型是否支持多模态
    if (!this.data.isMultimodalModel) {
      wx.showModal({
        title: '模型不支持图片',
        content: '当前选择的模型不支持图片输入，请选择支持多模态的模型（如Qwen2.5-VL-72B-Instruct）后再上传图片。',
        confirmText: '选择多模态模型',
        cancelText: '知道了',
        success: (res) => {
          if (res.confirm) {
            this.onSelectModel()
          }
        }
      })
      return
    }

    // 检查上传数量限制
    if (this.data.uploadedFiles.length >= UPLOAD_LIMITS.MAX_IMAGE_COUNT) {
      wx.showToast({
        title: `最多只能上传${UPLOAD_LIMITS.MAX_IMAGE_COUNT}张图片`,
        icon: 'none'
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
        that.uploadFiles(res.tempFiles)
      },
      fail: (error) => {
        console.error('选择文件失败:', error)
        wx.showToast({
          title: '选择文件失败',
          icon: 'error'
        })
      }
    })
  },

  /**
   * 处理文件（转换为base64）
   */
  async uploadFiles(files) {
    if (files.length === 0) return

    this.setData({ isLoading: true })

    try {
      console.log('开始处理图片，数量:', files.length)

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

          // 先压缩图片
          console.log(`开始压缩图片 ${i + 1}:`, file.tempFilePath)
          const compressedPath = await compressImage(file.tempFilePath, {
            quality: 0.8,
            width: 1024,
            height: 1024
          })

          // 转换为base64
          console.log(`开始转换图片 ${i + 1} 为Base64:`, compressedPath)
          const base64Url = await convertWxFileToBase64(compressedPath)

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
            fileSize: Math.ceil(base64Url.length * 0.75),
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
            tempFilePath: file.tempFilePath
          })

          wx.showToast({
            title: `图片 ${i + 1} 处理失败`,
            icon: 'none',
            duration: 2000
          })
        }
      }

      if (processedFiles.length === 0) {
        throw new Error('没有成功处理的图片')
      }

      this.setData({
        uploadedFiles: [...this.data.uploadedFiles, ...processedFiles],
        isLoading: false
      })

      this.updateDisplayTexts()

      wx.showToast({
        title: `成功处理 ${processedFiles.length} 张图片`,
        icon: 'success'
      })

    } catch (error) {
      console.error('图片处理失败:', error)
      this.setData({ isLoading: false })

      wx.showToast({
        title: error.message || '图片处理失败',
        icon: 'error'
      })
    }
  },

  /**
   * 删除上传的文件
   */
  onDeleteFile(event) {
    const { index } = event.currentTarget.dataset
    const uploadedFiles = this.data.uploadedFiles
    uploadedFiles.splice(index, 1)

    this.setData({
      uploadedFiles
    })

    this.updateDisplayTexts()
  },

  /**
   * 选择AI模型
   */
  onSelectModel() {
    this.setData({
      showModelSelector: true
    })
  },

  /**
   * 确认选择模型
   */
  onConfirmModel(event) {
    const { value } = event.currentTarget.dataset
    const selectedModel = this.data.aiModels[value]

    if (selectedModel) {
      saveSelectedModel(selectedModel.id)
      this.setData({
        selectedModel: selectedModel.id,
        showModelSelector: false
      })

      this.updateDisplayTexts()

      wx.showToast({
        title: `已选择 ${selectedModel.name}`,
        icon: 'success'
      })
    } else {
      console.error('选择的模型不存在:', value, this.data.aiModels)
      wx.showToast({
        title: '选择模型失败',
        icon: 'error'
      })
    }
  },

  /**
   * 取消选择模型
   */
  onCancelModel() {
    this.setData({
      showModelSelector: false
    })
  },

  /**
   * 获取当前选中的模型信息
   */
  getCurrentModel() {
    return this.data.aiModels.find(model => model.id === this.data.selectedModel) || this.data.aiModels[0] || DEFAULT_AI_MODELS[0]
  }
})
