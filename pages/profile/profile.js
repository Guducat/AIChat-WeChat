// pages/profile/profile.js
import { getUserSettings, saveUserSettings, getChatHistory, clearChatHistory, getUserInfo, getLoginStatus, clearUserData } from '../../utils/storage.js'
import { saveSiliconFlowApiKey, clearSiliconFlowApiKey } from '../../utils/storage.js'
import { LOGIN_STATUS } from '../../utils/constants.js'
import { userLogout } from '../../utils/api.js'
import { testSiliconFlowAPI, validateApiKey, getApiKeyStatus } from '../../utils/api-test.js'
import { debugSiliconFlowAPI, generateDebugReport } from '../../utils/api-debug.js'
import { quickFixApiIssues, getFixSuggestions } from '../../utils/api-fix.js'

Page({
  data: {
    userInfo: {
      avatarUrl: '',
      nickName: '用户',
      isLoggedIn: false
    },
    settings: {},
    statistics: {
      totalChats: 0,
      totalTokens: 0,
      totalCost: '0.0000'
    },
    showThemeSelector: false,
    themeOptions: [
      { label: '浅色主题', value: 'light' },
      { label: '深色主题', value: 'dark' },
      { label: '跟随系统', value: 'auto' }
    ],
    isLoggedIn: false,
    // API Key管理
    hasApiKey: false,
    showApiKeyDialog: false,
    apiKeyInput: '',
    apiKeyMasked: '',
    showApiKeyInput: false,
    apiKeyStatus: '未配置'
  },

  onLoad() {
    this.loadUserData()
    this.calculateStatistics()
    this.loadApiKeyStatus()
  },

  onShow() {
    this.loadUserData()
    this.calculateStatistics()
    this.loadApiKeyStatus()
  },

  /**
   * 加载用户数据
   */
  loadUserData() {
    const settings = getUserSettings()
    const userInfo = getUserInfo()
    const loginStatus = getLoginStatus()
    const isLoggedIn = loginStatus === LOGIN_STATUS.LOGGED_IN

    this.setData({
      settings,
      userInfo,
      isLoggedIn
    })
  },

  /**
   * 计算统计数据
   */
  calculateStatistics() {
    const chatHistory = getChatHistory()
    let totalTokens = 0
    let totalCost = 0

    chatHistory.forEach(chat => {
      totalTokens += chat.totalTokens || 0
      totalCost += parseFloat(chat.totalCost || 0)
    })

    this.setData({
      statistics: {
        totalChats: chatHistory.length,
        totalTokens,
        totalCost: totalCost.toFixed(2) // 人民币精确到6位小数
      }
    })
  },

  /**
   * 加载API Key状态
   */
  loadApiKeyStatus() {
    const status = getApiKeyStatus()

    this.setData({
      hasApiKey: status.configured,
      apiKeyMasked: status.masked,
      apiKeyStatus: status.message
    })

    // 如果有警告或错误，在控制台输出
    if (status.warnings && status.warnings.length > 0) {
      console.warn('API Key警告:', status.warnings)
    }
    if (status.errors && status.errors.length > 0) {
      console.error('API Key错误:', status.errors)
    }
  },

  /**
   * 显示API Key配置对话框
   */
  onShowApiKeyDialog() {
    this.setData({
      showApiKeyDialog: true,
      apiKeyInput: '',
      showApiKeyInput: false
    })
  },

  /**
   * 关闭API Key对话框
   */
  onCloseApiKeyDialog() {
    this.setData({
      showApiKeyDialog: false,
      apiKeyInput: '',
      showApiKeyInput: false
    })
  },

  /**
   * API Key输入变化（实时输入）
   */
  onApiKeyInput(event) {
    let value = ''
    if (typeof event.detail === 'string') {
      value = event.detail
    } else if (event.detail && typeof event.detail.value === 'string') {
      value = event.detail.value
    }
    console.log('API Key输入:', value.length > 0 ? `${value.substring(0, 8)}` : '空')
    this.setData({
      apiKeyInput: value
    })
  },

  /**
   * API Key输入完成（失去焦点）
   */
  onApiKeyChange(event) {
    let value = ''
    if (typeof event.detail === 'string') {
      value = event.detail
    } else if (event.detail && typeof event.detail.value === 'string') {
      value = event.detail.value
    }
    console.log('API Key输入完成:', value.length > 0 ? `${value.substring(0, 8)}...` : '空')
    this.setData({
      apiKeyInput: value
    })
  },

  /**
   * 打开SiliconFlow官网
   */
  onOpenSiliconFlowSite() {
    wx.showModal({
      title: '获取 API Key',
      content: '1. 访问 siliconflow.cn 官网\n2. 注册并登录账号\n3. 在控制台创建 API Key\n4. 复制密钥并粘贴到输入框',
      confirmText: '我知道了',
      showCancel: false
    })
  },

  /**
   * 切换API Key输入显示
   */
  onToggleApiKeyInput() {
    this.setData({
      showApiKeyInput: !this.data.showApiKeyInput
    })
  },

  /**
   * 保存API Key
   */
  onSaveApiKey() {
    const { apiKeyInput } = this.data

    // 添加空值检查
    if (!apiKeyInput || typeof apiKeyInput !== 'string' || !apiKeyInput.trim()) {
      wx.showToast({
        title: '请输入API Key',
        icon: 'none'
      })
      return
    }

    // 使用新的验证函数
    const validation = validateApiKey(apiKeyInput)

    if (!validation.valid) {
      wx.showModal({
        title: 'API Key格式错误',
        content: validation.errors.join('\n'),
        showCancel: false,
        confirmText: '确定'
      })
      return
    }

    // 如果有警告，询问用户是否继续
    if (validation.warnings && validation.warnings.length > 0) {
      wx.showModal({
        title: '格式提示',
        content: validation.warnings.join('\n') + '\n\n确定要保存这个密钥吗？',
        confirmText: '确定保存',
        cancelText: '重新输入',
        success: (res) => {
          if (res.confirm) {
            this.saveApiKeyToStorage(apiKeyInput.trim())
          }
        }
      })
      return
    }

    this.saveApiKeyToStorage(apiKeyInput.trim())
  },

  /**
   * 保存API Key到存储
   */
  async saveApiKeyToStorage(apiKey) {
    wx.showLoading({
      title: '保存中...'
    })

    try {
      const success = await saveSiliconFlowApiKey(apiKey)

      wx.hideLoading()

      if (success) {
        this.setData({
          showApiKeyDialog: false,
          apiKeyInput: ''
        })

        this.loadApiKeyStatus()

        wx.showToast({
          title: 'API Key已保存',
          icon: 'success',
          duration: 2000
        })
      } else {
        wx.showToast({
          title: '保存失败，请重试',
          icon: 'error',
          duration: 2000
        })
      }
    } catch (error) {
      wx.hideLoading()
      console.error('保存API Key失败:', error)
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'error',
        duration: 2000
      })
    }
  },

  /**
   * 清除API Key
   */
  onClearApiKey() {
    wx.showModal({
      title: '确认清除',
      content: '确定要清除API Key吗？清除后将使用模拟数据进行对话。',
      success: (res) => {
        if (res.confirm) {
          const success = clearSiliconFlowApiKey()

          if (success) {
            this.loadApiKeyStatus()

            wx.showToast({
              title: 'API Key已清除',
              icon: 'success'
            })
          } else {
            wx.showToast({
              title: '清除失败',
              icon: 'error'
            })
          }
        }
      }
    })
  },

  /**
   * 测试API Key
   */
  onTestApiKey() {
    if (!this.data.hasApiKey) {
      wx.showToast({
        title: '请先配置API Key',
        icon: 'none'
      })
      return
    }

    // 显示测试选项
    wx.showActionSheet({
      itemList: ['快速测试', '详细诊断', '一键修复'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.quickApiTest()
        } else if (res.tapIndex === 1) {
          this.detailedApiDiagnosis()
        } else if (res.tapIndex === 2) {
          this.quickFixApi()
        }
      }
    })
  },

  /**
   * 快速API测试
   */
  quickApiTest() {
    wx.showLoading({
      title: '测试中...'
    })

    testSiliconFlowAPI(
      (result) => {
        wx.hideLoading()

        wx.showModal({
          title: 'API Key测试成功',
          content: `${result.message}\n\n模型: ${result.data.model}\nToken使用: ${result.data.usage.total_tokens}`,
          showCancel: false,
          confirmText: '确定'
        })
      },
      (error) => {
        wx.hideLoading()

        wx.showModal({
          title: 'API Key测试失败',
          content: `${error.message}\n\n建议使用"详细诊断"功能获取更多信息`,
          confirmText: '详细诊断',
          cancelText: '确定',
          success: (res) => {
            if (res.confirm) {
              this.detailedApiDiagnosis()
            }
          }
        })
      }
    )
  },

  /**
   * 详细API诊断
   */
  detailedApiDiagnosis() {
    wx.showLoading({
      title: '诊断中... (1/5)'
    })

    debugSiliconFlowAPI(
      null, // 使用存储的API Key
      (progress) => {
        // 更新进度
        wx.showLoading({
          title: `诊断中... (${progress.current}/${progress.total})\n${progress.testName}`
        })
      },
      (results) => {
        wx.hideLoading()

        // 生成诊断报告
        const report = generateDebugReport(results)

        // 显示诊断结果
        const success = results.summary.failed === 0
        const title = success ? '诊断完成 - 一切正常' : `诊断完成 - 发现${results.summary.failed}个问题`

        wx.showModal({
          title: title,
          content: report.length > 300 ? report.substring(0, 300) + '...' : report,
          confirmText: '查看详情',
          cancelText: '确定',
          success: (res) => {
            if (res.confirm) {
              // 显示完整报告
              this.showFullDiagnosisReport(report)
            }
          }
        })
      }
    )
  },

  /**
   * 显示完整诊断报告
   */
  showFullDiagnosisReport(report) {
    // 将报告保存到页面数据中，然后跳转到一个显示页面
    // 或者使用更简单的方式显示
    console.log('完整诊断报告:', report)

    wx.showModal({
      title: '完整诊断报告',
      content: '诊断报告已输出到控制台，请在开发者工具中查看详细信息。',
      showCancel: false,
      confirmText: '确定'
    })
  },

  /**
   * 一键修复API问题
   */
  quickFixApi() {
    wx.showModal({
      title: '一键修复',
      content: '将自动检测并修复常见的API调用问题，是否继续？',
      confirmText: '开始修复',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.startQuickFix()
        }
      }
    })
  },

  /**
   * 开始快速修复
   */
  startQuickFix() {
    wx.showLoading({
      title: '修复中... (1/5)'
    })

    quickFixApiIssues(
      null, // 使用存储的API Key
      (progress) => {
        wx.showLoading({
          title: `修复中... (${progress.current}/${progress.total})\n${progress.fixName}`
        })
      },
      (result) => {
        wx.hideLoading()

        const title = result.success ? '修复完成' : '修复部分完成'
        const content = result.summary.length > 300 ?
          result.summary.substring(0, 300) + '...' :
          result.summary

        wx.showModal({
          title: title,
          content: content,
          confirmText: result.success ? '测试API' : '查看详情',
          cancelText: '确定',
          success: (res) => {
            if (res.confirm) {
              if (result.success) {
                // 修复成功，进行测试
                this.quickApiTest()
              } else {
                // 显示修复建议
                this.showFixSuggestions()
              }
            }
          }
        })
      }
    )
  },

  /**
   * 显示修复建议
   */
  showFixSuggestions() {
    const suggestions = getFixSuggestions()

    let content = '请按以下步骤手动修复:\n\n'
    content += `1. ${suggestions.domainWhitelist.title}\n`
    content += `   ${suggestions.domainWhitelist.description}\n\n`
    content += `2. ${suggestions.apiKeyFormat.title}\n`
    content += `   ${suggestions.apiKeyFormat.description}\n\n`
    content += '详细步骤请查看控制台输出。'

    console.log('修复建议详情:', suggestions)

    wx.showModal({
      title: '修复建议',
      content: content,
      showCancel: false,
      confirmText: '确定'
    })
  },

  /**
   * 登录按钮点击
   */
  onLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    })
  },

  /**
   * 登出
   */
  async onLogout() {
    wx.showModal({
      title: '确认登出',
      content: '确定要退出登录吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await userLogout()
            clearUserData()
            this.loadUserData()

            wx.showToast({
              title: '已退出登录',
              icon: 'success'
            })
          } catch (error) {
            console.error('登出失败:', error)
            wx.showToast({
              title: '登出失败',
              icon: 'error'
            })
          }
        }
      }
    })
  },

  /**
   * 切换设置项
   */
  onToggleSetting(event) {
    const { key } = event.currentTarget.dataset
    const currentValue = this.data.settings[key]
    const newSettings = {
      [key]: !currentValue
    }

    saveUserSettings(newSettings)
    this.setData({
      settings: { ...this.data.settings, ...newSettings }
    })

    wx.showToast({
      title: '设置已保存',
      icon: 'success'
    })
  },

  /**
   * 显示主题选择器
   */
  onShowThemeSelector() {
    this.setData({
      showThemeSelector: true
    })
  },

  /**
   * 选择主题
   */
  onSelectTheme(event) {
    const { value } = event.detail
    const theme = this.data.themeOptions[value].value

    saveUserSettings({ theme })
    this.setData({
      settings: { ...this.data.settings, theme },
      showThemeSelector: false
    })

    wx.showToast({
      title: '主题已切换',
      icon: 'success'
    })
  },

  /**
   * 取消主题选择
   */
  onCancelThemeSelect() {
    this.setData({
      showThemeSelector: false
    })
  },

  /**
   * 清空数据
   */
  onClearData() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有数据吗？包括对话记录和设置，此操作不可恢复。',
      success: (res) => {
        if (res.confirm) {
          // 清空对话记录
          clearChatHistory()

          // 重置设置
          const defaultSettings = {
            selectedModel: 'Deepseek-R1',
            autoSave: true,
            showTokenCount: true,
            theme: 'light'
          }
          saveUserSettings(defaultSettings)

          this.setData({
            settings: defaultSettings,
            statistics: {
              totalChats: 0,
              totalTokens: 0,
              totalCost: 0
            }
          })

          wx.showToast({
            title: '数据已清空',
            icon: 'success'
          })
        }
      }
    })
  },

  /**
   * 查看隐私政策
   */
  onViewPrivacyPolicy() {
    wx.showModal({
      title: '隐私政策',
      content: '本应用重视您的隐私保护。所有对话数据仅存储在您的设备本地，不会上传到服务器。我们不会收集、存储或分享您的个人信息。',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  /**
   * 关于我们
   */
  onAbout() {
    wx.showModal({
      title: '关于AI对话助手',
      content: 'AI对话助手 v1.0.0\n\n一个简洁易用的AI对话工具，支持多种AI模型和对话场景。\n\n开发者：孤独豹猫\n联系方式：guducat@qq.com',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  /**
   * 意见反馈
   */
  onFeedback() {
    wx.showModal({
      title: '意见反馈',
      content: '如有任何问题或建议，请通过以下方式联系我们：\n\n邮箱：guducat@qq.com',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return {
      title: 'AI对话助手 - 智能对话工具',
      path: '/pages/home/home',
      imageUrl: '/images/share-cover.png',
      promise: new Promise(resolve => {
        setTimeout(() => {
          resolve({
            title: 'AI对话助手 - 智能对话工具'
          })
        }, 2000)
      })
    }
  },
  onClickShareAppMessage() {
    wx.showModal({
      title: '温馨提示',
      content: '请点击右上角分享按钮，感谢支持！',
      showCancel: false,
      confirmText: '知道了'
    })
  }
})
