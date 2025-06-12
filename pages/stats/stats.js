// pages/stats/stats.js
import { getTokenStats, getFileRecords, clearTokenStats, clearFileRecords } from '../../utils/storage.js'
import { CURRENCY } from '../../utils/constants.js'

Page({
  data: {
    tokenStats: {},
    fileRecords: [],
    dailyStats: [],
    monthlyStats: [],
    showClearDialog: false,
    clearType: '' // 'tokens' or 'files'
  },

  onLoad() {
    this.loadStats()
  },

  onShow() {
    this.loadStats()
  },

  /**
   * 加载统计数据
   */
  loadStats() {
    const tokenStats = getTokenStats()
    const fileRecords = getFileRecords()

    // 增强统计数据，计算总费用
    const enhancedTokenStats = this.enhanceTokenStats(tokenStats)

    // 处理每日统计数据
    const dailyStats = this.processDailyStats(enhancedTokenStats.dailyStats || {})

    // 处理每月统计数据
    const monthlyStats = this.processMonthlyStats(enhancedTokenStats.monthlyStats || {})

    // 处理文件记录，格式化文件大小和时间
    const processedFileRecords = this.processFileRecords(fileRecords.slice(0, 50))

    // 格式化最后更新时间和费用显示
    const formattedTokenStats = {
      ...enhancedTokenStats,
      lastUpdated: this.formatLastUpdated(enhancedTokenStats.lastUpdated),
      totalCost: enhancedTokenStats.totalCost || 0,
      // 添加格式化后的费用显示值
      totalCostDisplay: this.formatCost(enhancedTokenStats.totalCost || 0)
    }

    this.setData({
      tokenStats: formattedTokenStats,
      fileRecords: processedFileRecords,
      dailyStats,
      monthlyStats
    })
  },

  /**
   * 增强token统计数据，计算总费用
   */
  enhanceTokenStats(tokenStats) {
    // 如果没有totalCost或为0，从每日统计中重新计算
    let calculatedTotalCost = tokenStats.totalCost || 0
    let calculatedTotalTokens = tokenStats.totalTokens || 0

    // 如果总费用为0但有每日统计数据，重新计算
    if (calculatedTotalCost === 0 && tokenStats.dailyStats) {
      Object.values(tokenStats.dailyStats).forEach(dayStats => {
        calculatedTotalCost += dayStats.cost || 0
        calculatedTotalTokens += dayStats.tokens || 0
      })
    }

    // 如果还是没有数据，从月度统计中计算
    if (calculatedTotalCost === 0 && tokenStats.monthlyStats) {
      Object.values(tokenStats.monthlyStats).forEach(monthStats => {
        calculatedTotalCost += monthStats.cost || 0
        calculatedTotalTokens += monthStats.tokens || 0
      })
    }



    return {
      ...tokenStats,
      totalCost: calculatedTotalCost,
      totalTokens: calculatedTotalTokens
    }
  },

  /**
   * 格式化最后更新时间
   */
  formatLastUpdated(timestamp) {
    if (!timestamp) {
      return '2025-06-12T08:11:11.003Z'
    }

    try {
      const date = new Date(timestamp)
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    } catch (error) {
      console.error('时间格式化失败:', error)
      return '2025-06-12 08:11:11'
    }
  },

  /**
   * 格式化费用显示（保留1位小数）
   */
  formatCost(cost) {
    if (!cost || cost === 0) {
      return '0.0'
    }

    try {
      const numCost = parseFloat(cost)
      return numCost.toFixed(1)
    } catch (error) {
      console.error('费用格式化失败:', error)
      return '0.0'
    }
  },

  /**
   * 处理文件记录，格式化显示数据
   */
  processFileRecords(fileRecords) {
    return fileRecords.map(record => {
      return {
        ...record,
        formattedFileSize: this.formatFileSize(record.fileSize),
        formattedUploadTime: this.formatUploadTime(record.uploadTime)
      }
    })
  },

  /**
   * 格式化文件大小
   */
  formatFileSize(fileSize) {
    if (!fileSize || fileSize === 0) {
      return '未知大小'
    }

    if (fileSize < 1024) {
      return fileSize + 'B'
    } else if (fileSize < 1024 * 1024) {
      return (fileSize / 1024).toFixed(1) + 'KB'
    } else {
      return (fileSize / (1024 * 1024)).toFixed(1) + 'MB'
    }
  },

  /**
   * 格式化上传时间
   */
  formatUploadTime(uploadTime) {
    if (!uploadTime) {
      return '未知时间'
    }

    const date = new Date(uploadTime)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return '今天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays === 1) {
      return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays < 7) {
      return diffDays + '天前'
    } else {
      return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
    }
  },

  /**
   * 处理每日统计数据
   */
  processDailyStats(dailyStats) {
    const stats = []
    const sortedDates = Object.keys(dailyStats).sort().reverse()

    sortedDates.slice(0, 7).forEach(date => {
      const stat = dailyStats[date]
      stats.push({
        date: this.formatDate(date),
        tokens: `${stat.tokens} tokens`,
        cost: `¥${this.formatCost(stat.cost)}`,
        count: `${stat.count}次对话`
      })
    })

    return stats
  },

  /**
   * 处理每月统计数据
   */
  processMonthlyStats(monthlyStats) {
    const stats = []
    const sortedMonths = Object.keys(monthlyStats).sort().reverse()

    sortedMonths.slice(0, 6).forEach(month => {
      const stat = monthlyStats[month]
      stats.push({
        month: this.formatMonth(month),
        tokens: `${stat.tokens} tokens`,
        cost: `¥${this.formatCost(stat.cost)}`,
        count: `${stat.count}次对话`
      })
    })

    return stats
  },

  /**
   * 格式化日期
   */
  formatDate(dateStr) {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
    
    if (dateStr === today.toISOString().split('T')[0]) {
      return '今天'
    } else if (dateStr === yesterday.toISOString().split('T')[0]) {
      return '昨天'
    } else {
      return `${date.getMonth() + 1}月${date.getDate()}日`
    }
  },

  /**
   * 格式化月份
   */
  formatMonth(monthStr) {
    const [year, month] = monthStr.split('-')
    const currentYear = new Date().getFullYear()
    
    if (parseInt(year) === currentYear) {
      return `${parseInt(month)}月`
    } else {
      return `${year}年${parseInt(month)}月`
    }
  },

  /**
   * 显示清空确认对话框
   */
  onShowClearDialog(event) {
    const { type } = event.currentTarget.dataset
    this.setData({
      showClearDialog: true,
      clearType: type
    })
  },

  /**
   * 确认清空数据
   */
  onConfirmClear() {
    const { clearType } = this.data
    
    if (clearType === 'tokens') {
      clearTokenStats()
      wx.showToast({
        title: 'Token统计已清空',
        icon: 'success'
      })
    } else if (clearType === 'files') {
      clearFileRecords()
      wx.showToast({
        title: '文件记录已清空',
        icon: 'success'
      })
    }
    
    this.setData({
      showClearDialog: false,
      clearType: ''
    })
    
    this.loadStats()
  },

  /**
   * 取消清空
   */
  onCancelClear() {
    this.setData({
      showClearDialog: false,
      clearType: ''
    })
  },

  /**
   * 预览文件
   */
  onPreviewFile(event) {
    const { url, type } = event.currentTarget.dataset
    
    if (type === 'image') {
      wx.previewImage({
        current: url,
        urls: [url]
      })
    } else {
      wx.showToast({
        title: '暂不支持预览此类型文件',
        icon: 'none'
      })
    }
  },

  /**
   * 分享统计信息
   */
  onShareStats() {
    const { tokenStats } = this.data
    const shareText = `我的AI对话统计：
总Token数：${tokenStats.totalTokens}
总费用：${CURRENCY.SYMBOL}${tokenStats.totalCost.toFixed(6)}
最后更新：${new Date(tokenStats.lastUpdated).toLocaleString()}`
    
    wx.setClipboardData({
      data: shareText,
      success: () => {
        wx.showToast({
          title: '统计信息已复制',
          icon: 'success'
        })
      }
    })
  }
})
