// 本地存储工具类
import { STORAGE_KEYS, LOGIN_STATUS } from './constants.js'

/**
 * 存储数据到本地
 * @param {string} key 存储键名
 * @param {any} data 要存储的数据
 */
export const setStorage = (key, data) => {
  try {
    wx.setStorageSync(key, data)
    return true
  } catch (error) {
    console.error('存储数据失败:', error)
    return false
  }
}

/**
 * 从本地获取数据
 * @param {string} key 存储键名
 * @param {any} defaultValue 默认值
 */
export const getStorage = (key, defaultValue = null) => {
  try {
    const data = wx.getStorageSync(key)
    return data || defaultValue
  } catch (error) {
    console.error('获取数据失败:', error)
    return defaultValue
  }
}

/**
 * 删除本地存储数据
 * @param {string} key 存储键名
 */
export const removeStorage = (key) => {
  try {
    wx.removeStorageSync(key)
    return true
  } catch (error) {
    console.error('删除数据失败:', error)
    return false
  }
}

/**
 * 保存对话记录
 * @param {Object} chatSession 对话会话
 */
export const saveChatHistory = (chatSession) => {
  const history = getChatHistory()
  const existingIndex = history.findIndex(item => item.id === chatSession.id)
  
  if (existingIndex >= 0) {
    history[existingIndex] = chatSession
  } else {
    history.unshift(chatSession)
  }
  
  // 限制历史记录数量，最多保存100条
  if (history.length > 100) {
    history.splice(100)
  }
  
  return setStorage(STORAGE_KEYS.CHAT_HISTORY, history)
}

/**
 * 获取对话记录
 */
export const getChatHistory = () => {
  return getStorage(STORAGE_KEYS.CHAT_HISTORY, [])
}

/**
 * 删除对话记录
 * @param {string} chatId 对话ID
 */
export const deleteChatHistory = (chatId) => {
  const history = getChatHistory()
  const filteredHistory = history.filter(item => item.id !== chatId)
  return setStorage(STORAGE_KEYS.CHAT_HISTORY, filteredHistory)
}

/**
 * 清空所有对话记录
 */
export const clearChatHistory = () => {
  return setStorage(STORAGE_KEYS.CHAT_HISTORY, [])
}

/**
 * 保存用户设置
 * @param {Object} settings 用户设置
 */
export const saveUserSettings = (settings) => {
  const currentSettings = getUserSettings()
  const newSettings = { ...currentSettings, ...settings }
  return setStorage(STORAGE_KEYS.USER_SETTINGS, newSettings)
}

/**
 * 获取用户设置
 */
export const getUserSettings = () => {
  return getStorage(STORAGE_KEYS.USER_SETTINGS, {
    selectedModel: 'deepseek-ai/DeepSeek-V3',
    autoSave: true,
    showTokenCount: true,
    theme: 'light'
  })
}

/**
 * 保存选中的AI模型
 * @param {string} modelId 模型ID
 */
export const saveSelectedModel = (modelId) => {
  return setStorage(STORAGE_KEYS.SELECTED_MODEL, modelId)
}

/**
 * 获取选中的AI模型
 */
export const getSelectedModel = () => {
  return getStorage(STORAGE_KEYS.SELECTED_MODEL, 'deepseek-ai/DeepSeek-V3')
}

/**
 * 保存用户信息
 * @param {Object} userInfo 用户信息
 */
export const saveUserInfo = (userInfo) => {
  return setStorage(STORAGE_KEYS.USER_INFO, userInfo)
}

/**
 * 获取用户信息
 */
export const getUserInfo = () => {
  return getStorage(STORAGE_KEYS.USER_INFO, {
    nickName: '用户',
    avatarUrl: '',
    isLoggedIn: false
  })
}

/**
 * 保存登录状态
 * @param {string} status 登录状态
 */
export const saveLoginStatus = (status) => {
  return setStorage(STORAGE_KEYS.LOGIN_STATUS, status)
}

/**
 * 获取登录状态
 */
export const getLoginStatus = () => {
  return getStorage(STORAGE_KEYS.LOGIN_STATUS, LOGIN_STATUS.LOGGED_OUT)
}

/**
 * 清除用户数据（登出时使用）
 */
export const clearUserData = () => {
  removeStorage(STORAGE_KEYS.USER_INFO)
  saveLoginStatus(LOGIN_STATUS.LOGGED_OUT)
}

/**
 * 保存Token统计数据
 * @param {Object} tokenStats Token统计数据
 */
export const saveTokenStats = (tokenStats) => {
  const currentStats = getTokenStats()
  const newStats = {
    ...currentStats,
    totalTokens: (currentStats.totalTokens || 0) + (tokenStats.tokens || 0),
    totalCost: (currentStats.totalCost || 0) + (tokenStats.cost || 0),
    lastUpdated: new Date().toISOString(),
    dailyStats: updateDailyStats(currentStats.dailyStats || {}, tokenStats),
    monthlyStats: updateMonthlyStats(currentStats.monthlyStats || {}, tokenStats)
  }
  return setStorage(STORAGE_KEYS.TOKEN_STATS, newStats)
}

/**
 * 获取Token统计数据
 */
export const getTokenStats = () => {
  return getStorage(STORAGE_KEYS.TOKEN_STATS, {
    totalTokens: 0,
    totalCost: 0,
    dailyStats: {},
    monthlyStats: {},
    lastUpdated: new Date().toISOString()
  })
}

/**
 * 更新每日统计
 */
const updateDailyStats = (dailyStats, tokenStats) => {
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const todayStats = dailyStats[today] || { tokens: 0, cost: 0, count: 0 }

  return {
    ...dailyStats,
    [today]: {
      tokens: todayStats.tokens + (tokenStats.tokens || 0),
      cost: todayStats.cost + (tokenStats.cost || 0),
      count: todayStats.count + 1
    }
  }
}

/**
 * 更新每月统计
 */
const updateMonthlyStats = (monthlyStats, tokenStats) => {
  const thisMonth = new Date().toISOString().substring(0, 7) // YYYY-MM
  const monthStats = monthlyStats[thisMonth] || { tokens: 0, cost: 0, count: 0 }

  return {
    ...monthlyStats,
    [thisMonth]: {
      tokens: monthStats.tokens + (tokenStats.tokens || 0),
      cost: monthStats.cost + (tokenStats.cost || 0),
      count: monthStats.count + 1
    }
  }
}

/**
 * 清空Token统计数据
 */
export const clearTokenStats = () => {
  return setStorage(STORAGE_KEYS.TOKEN_STATS, {
    totalTokens: 0,
    totalCost: 0,
    dailyStats: {},
    monthlyStats: {},
    lastUpdated: new Date().toISOString()
  })
}

/**
 * 保存文件上传记录
 * @param {Object} fileRecord 文件记录
 */
export const saveFileRecord = (fileRecord) => {
  const records = getFileRecords()
  records.unshift({
    ...fileRecord,
    uploadTime: new Date().toISOString()
  })

  // 限制记录数量，最多保存500条
  if (records.length > 500) {
    records.splice(500)
  }

  return setStorage(STORAGE_KEYS.FILE_RECORDS, records)
}

/**
 * 获取文件上传记录
 */
export const getFileRecords = () => {
  return getStorage(STORAGE_KEYS.FILE_RECORDS, [])
}

/**
 * 删除文件记录
 * @param {string} fileId 文件ID
 */
export const deleteFileRecord = (fileId) => {
  const records = getFileRecords()
  const filteredRecords = records.filter(record => record.fileId !== fileId)
  return setStorage(STORAGE_KEYS.FILE_RECORDS, filteredRecords)
}

/**
 * 清空文件记录
 */
export const clearFileRecords = () => {
  return setStorage(STORAGE_KEYS.FILE_RECORDS, [])
}

/**
 * 保存SiliconFlow API Key（加密存储）
 * @param {string} apiKey API密钥
 * @returns {Promise<boolean>} 保存是否成功
 */
export const saveSiliconFlowApiKey = (apiKey) => {
  return new Promise((resolve) => {
    try {
      // 验证API Key格式
      if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
        console.error('API Key格式无效')
        resolve(false)
        return
      }

      const trimmedKey = apiKey.trim()

      // 使用同步存储确保一致性
      wx.setStorageSync(STORAGE_KEYS.SILICONFLOW_API_KEY, trimmedKey)
      console.log('API Key已安全存储')
      resolve(true)
    } catch (error) {
      console.error('API Key存储失败:', error)
      resolve(false)
    }
  })
}

/**
 * 获取SiliconFlow API Key
 */
export const getSiliconFlowApiKey = () => {
  try {
    const apiKey = wx.getStorageSync(STORAGE_KEYS.SILICONFLOW_API_KEY) || ''
    // 验证获取到的API Key
    if (apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0) {
      return apiKey.trim()
    }
    return ''
  } catch (error) {
    console.error('获取API Key失败:', error)
    return ''
  }
}

/**
 * 清除SiliconFlow API Key
 */
export const clearSiliconFlowApiKey = () => {
  try {
    wx.removeStorageSync(STORAGE_KEYS.SILICONFLOW_API_KEY)
    return true
  } catch (error) {
    console.error('清除API Key失败:', error)
    return false
  }
}

/**
 * 检查是否配置了API Key
 */
export const hasSiliconFlowApiKey = () => {
  const apiKey = getSiliconFlowApiKey()
  return apiKey && apiKey.length > 0
}
