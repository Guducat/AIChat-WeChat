// 时间格式化工具
// 提供用户友好的中文时间显示格式

/**
 * 格式化时间戳为用户友好的中文格式
 * @param {number|string|Date} timestamp 时间戳、时间字符串或Date对象
 * @param {Object} options 格式化选项
 * @returns {string} 格式化后的时间字符串
 */
export const formatTime = (timestamp, options = {}) => {
  const {
    showRelative = true,    // 是否显示相对时间（如"刚刚"、"5分钟前"）
    showSeconds = false,    // 是否显示秒数
    use24Hour = true,       // 是否使用24小时制
    showYear = 'auto'       // 是否显示年份：'auto'、'always'、'never'
  } = options

  // 处理各种输入格式
  let date
  if (timestamp instanceof Date) {
    date = timestamp
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp)
  } else if (typeof timestamp === 'number') {
    // 处理秒级和毫秒级时间戳
    date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp)
  } else {
    return '无效时间'
  }

  // 验证日期有效性
  if (isNaN(date.getTime())) {
    return '无效时间'
  }

  const now = new Date()
  const diff = now.getTime() - date.getTime()

  // 如果启用相对时间显示
  if (showRelative) {
    // 1分钟内
    if (diff < 60000) {
      return '刚刚'
    }
    
    // 1小时内
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000)
      return `${minutes}分钟前`
    }
    
    // 今天内
    if (isToday(date, now)) {
      const hours = Math.floor(diff / 3600000)
      if (hours < 24) {
        return `${hours}小时前`
      }
    }
    
    // 昨天
    if (isYesterday(date, now)) {
      const timeStr = formatTimeOnly(date, use24Hour, showSeconds)
      return `昨天 ${timeStr}`
    }
    
    // 本周内
    if (isThisWeek(date, now)) {
      const weekday = getWeekdayName(date)
      const timeStr = formatTimeOnly(date, use24Hour, showSeconds)
      return `${weekday} ${timeStr}`
    }
  }

  // 完整日期时间格式
  return formatFullDateTime(date, now, showYear, use24Hour, showSeconds)
}

/**
 * 格式化为简短的相对时间
 * @param {number|string|Date} timestamp 时间戳
 * @returns {string} 简短的相对时间
 */
export const formatRelativeTime = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`
  if (diff < 2592000000) return `${Math.floor(diff / 604800000)}周前`
  if (diff < 31536000000) return `${Math.floor(diff / 2592000000)}个月前`
  return `${Math.floor(diff / 31536000000)}年前`
}

/**
 * 格式化为聊天消息时间格式
 * @param {number|string|Date} timestamp 时间戳
 * @returns {string} 聊天消息时间格式
 */
export const formatChatTime = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()

  if (isToday(date, now)) {
    return formatTimeOnly(date, true, false)
  }
  
  if (isYesterday(date, now)) {
    return `昨天 ${formatTimeOnly(date, true, false)}`
  }
  
  if (isThisYear(date, now)) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${formatTimeOnly(date, true, false)}`
  }
  
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

/**
 * 格式化为对话历史时间格式
 * @param {number|string|Date} timestamp 时间戳
 * @returns {string} 对话历史时间格式
 */
export const formatHistoryTime = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  // 5分钟内
  if (diff < 300000) {
    return '刚刚'
  }
  
  // 今天内
  if (isToday(date, now)) {
    return `今天 ${formatTimeOnly(date, true, false)}`
  }
  
  // 昨天
  if (isYesterday(date, now)) {
    return `昨天 ${formatTimeOnly(date, true, false)}`
  }
  
  // 本周内
  if (isThisWeek(date, now)) {
    const weekday = getWeekdayName(date)
    return `${weekday} ${formatTimeOnly(date, true, false)}`
  }
  
  // 本年内
  if (isThisYear(date, now)) {
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }
  
  // 跨年
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

/**
 * 判断是否为今天
 */
const isToday = (date, now) => {
  return date.toDateString() === now.toDateString()
}

/**
 * 判断是否为昨天
 */
const isYesterday = (date, now) => {
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  return date.toDateString() === yesterday.toDateString()
}

/**
 * 判断是否为本周
 */
const isThisWeek = (date, now) => {
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  
  return date >= startOfWeek
}

/**
 * 判断是否为今年
 */
const isThisYear = (date, now) => {
  return date.getFullYear() === now.getFullYear()
}

/**
 * 获取星期名称
 */
const getWeekdayName = (date) => {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return weekdays[date.getDay()]
}

/**
 * 格式化时间部分（时:分:秒）
 */
const formatTimeOnly = (date, use24Hour = true, showSeconds = false) => {
  let hours = date.getHours()
  const minutes = date.getMinutes()
  const seconds = date.getSeconds()
  
  let timeStr = ''
  
  if (use24Hour) {
    timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  } else {
    const period = hours >= 12 ? '下午' : '上午'
    hours = hours % 12 || 12
    timeStr = `${period}${hours}:${minutes.toString().padStart(2, '0')}`
  }
  
  if (showSeconds) {
    timeStr += `:${seconds.toString().padStart(2, '0')}`
  }
  
  return timeStr
}

/**
 * 格式化完整日期时间
 */
const formatFullDateTime = (date, now, showYear, use24Hour, showSeconds) => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const timeStr = formatTimeOnly(date, use24Hour, showSeconds)
  
  let dateStr = ''
  
  if (showYear === 'always' || (showYear === 'auto' && !isThisYear(date, now))) {
    dateStr = `${year}年${month}月${day}日`
  } else {
    dateStr = `${month}月${day}日`
  }
  
  return `${dateStr} ${timeStr}`
}

/**
 * 获取时间段描述
 * @param {Date} date 日期对象
 * @returns {string} 时间段描述
 */
export const getTimePeriod = (date) => {
  const hour = date.getHours()
  
  if (hour >= 5 && hour < 8) return '清晨'
  if (hour >= 8 && hour < 11) return '上午'
  if (hour >= 11 && hour < 13) return '中午'
  if (hour >= 13 && hour < 17) return '下午'
  if (hour >= 17 && hour < 19) return '傍晚'
  if (hour >= 19 && hour < 22) return '晚上'
  return '深夜'
}

/**
 * 格式化持续时间
 * @param {number} duration 持续时间（毫秒）
 * @returns {string} 格式化的持续时间
 */
export const formatDuration = (duration) => {
  const seconds = Math.floor(duration / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) return `${days}天${hours % 24}小时`
  if (hours > 0) return `${hours}小时${minutes % 60}分钟`
  if (minutes > 0) return `${minutes}分钟${seconds % 60}秒`
  return `${seconds}秒`
}

/**
 * 获取友好的时间描述
 * @param {number|string|Date} timestamp 时间戳
 * @returns {string} 友好的时间描述
 */
export const getFriendlyTime = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 0) return '未来时间'
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`
  
  return formatHistoryTime(timestamp)
}
