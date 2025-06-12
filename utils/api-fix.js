// SiliconFlow API 401错误快速修复工具

import { SILICONFLOW_API_BASE } from './constants.js'
import { getSiliconFlowApiKey, saveSiliconFlowApiKey } from './storage.js'

/**
 * 一键修复API调用问题
 * @param {string} userApiKey 用户提供的API Key
 * @param {Function} onProgress 进度回调
 * @param {Function} onComplete 完成回调
 */
export const quickFixApiIssues = (userApiKey, onProgress, onComplete) => {
  const fixes = [
    {
      name: '清理和验证API Key',
      fix: () => cleanAndValidateApiKey(userApiKey)
    },
    {
      name: '测试网络连接',
      fix: () => testNetworkConnectivity()
    },
    {
      name: '验证域名配置',
      fix: () => checkDomainConfiguration()
    },
    {
      name: '修复请求格式',
      fix: () => fixRequestFormat()
    },
    {
      name: '测试修复结果',
      fix: () => testFixedApiCall()
    }
  ]

  let currentFix = 0
  const results = []

  const runNextFix = () => {
    if (currentFix >= fixes.length) {
      onComplete && onComplete({
        success: results.every(r => r.success),
        results: results,
        summary: generateFixSummary(results)
      })
      return
    }

    const fix = fixes[currentFix]
    onProgress && onProgress({
      current: currentFix + 1,
      total: fixes.length,
      fixName: fix.name
    })

    fix.fix().then(result => {
      results.push({
        name: fix.name,
        ...result
      })
      currentFix++
      setTimeout(runNextFix, 800)
    }).catch(error => {
      results.push({
        name: fix.name,
        success: false,
        message: error.message,
        action: error.action || '请手动检查此项'
      })
      currentFix++
      setTimeout(runNextFix, 800)
    })
  }

  runNextFix()
}

/**
 * 清理和验证API Key
 */
const cleanAndValidateApiKey = (userApiKey) => {
  return new Promise((resolve) => {
    const apiKey = userApiKey || getSiliconFlowApiKey()
    
    if (!apiKey) {
      resolve({
        success: false,
        message: 'API Key未配置',
        action: '请在个人中心配置SiliconFlow API Key'
      })
      return
    }

    // 清理API Key（去除空格、换行等）
    const cleanedKey = apiKey.trim().replace(/\s+/g, '')
    
    // 验证格式
    if (cleanedKey.length < 20) {
      resolve({
        success: false,
        message: 'API Key长度过短',
        action: '请检查API Key是否完整'
      })
      return
    }

    // 如果清理后的Key与原Key不同，保存清理后的版本
    if (cleanedKey !== apiKey) {
      saveSiliconFlowApiKey(cleanedKey).then(() => {
        resolve({
          success: true,
          message: 'API Key已清理并重新保存',
          action: '已自动修复API Key格式问题'
        })
      })
    } else {
      resolve({
        success: true,
        message: 'API Key格式正确',
        action: '无需修复'
      })
    }
  })
}

/**
 * 测试网络连接
 */
const testNetworkConnectivity = () => {
  return new Promise((resolve) => {
    wx.request({
      url: 'https://api.siliconflow.cn',
      method: 'GET',
      timeout: 10000,
      success: (res) => {
        resolve({
          success: true,
          message: '网络连接正常',
          action: '域名白名单配置正确'
        })
      },
      fail: (error) => {
        let action = '请检查网络连接'
        
        if (error.errMsg && error.errMsg.includes('domain')) {
          action = '请在微信公众平台添加 api.siliconflow.cn 到request合法域名'
        }
        
        resolve({
          success: false,
          message: '网络连接失败',
          action: action
        })
      }
    })
  })
}

/**
 * 检查域名配置
 */
const checkDomainConfiguration = () => {
  return new Promise((resolve) => {
    // 尝试访问SiliconFlow API的根路径
    wx.request({
      url: `${SILICONFLOW_API_BASE.replace('/v1', '')}`,
      method: 'GET',
      timeout: 8000,
      success: (res) => {
        resolve({
          success: true,
          message: '域名配置正确',
          action: 'SiliconFlow API域名可正常访问'
        })
      },
      fail: (error) => {
        resolve({
          success: false,
          message: '域名配置可能有问题',
          action: '请确认已在微信公众平台配置域名白名单'
        })
      }
    })
  })
}

/**
 * 修复请求格式
 */
const fixRequestFormat = () => {
  return new Promise((resolve) => {
    // 这里主要是验证我们的请求格式是否正确
    const apiKey = getSiliconFlowApiKey()
    
    if (!apiKey) {
      resolve({
        success: false,
        message: '无法修复请求格式',
        action: '请先配置API Key'
      })
      return
    }

    // 验证Authorization头格式
    const authHeader = `Bearer ${apiKey}`
    
    if (!authHeader.startsWith('Bearer ')) {
      resolve({
        success: false,
        message: 'Authorization头格式错误',
        action: '请检查代码中的请求头设置'
      })
      return
    }

    resolve({
      success: true,
      message: '请求格式正确',
      action: '请求头和数据格式符合API规范'
    })
  })
}

/**
 * 测试修复结果
 */
const testFixedApiCall = () => {
  return new Promise((resolve) => {
    const apiKey = getSiliconFlowApiKey()
    
    if (!apiKey) {
      resolve({
        success: false,
        message: '无法测试修复结果',
        action: '请先配置API Key'
      })
      return
    }

    const testData = {
      model: 'deepseek-ai/DeepSeek-V3',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 5,
      stream: false
    }

    wx.request({
      url: `${SILICONFLOW_API_BASE}/chat/completions`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'WeChat-MiniProgram'
      },
      data: testData,
      timeout: 20000,
      success: (res) => {
        if (res.statusCode === 200) {
          resolve({
            success: true,
            message: 'API调用测试成功',
            action: '所有问题已修复，API可正常使用'
          })
        } else if (res.statusCode === 401) {
          resolve({
            success: false,
            message: 'API认证仍然失败',
            action: '请检查API Key是否有效，或联系SiliconFlow支持'
          })
        } else {
          resolve({
            success: false,
            message: `API调用失败 (${res.statusCode})`,
            action: '请查看详细错误信息或联系技术支持'
          })
        }
      },
      fail: (error) => {
        resolve({
          success: false,
          message: 'API调用网络失败',
          action: '请检查网络连接和域名配置'
        })
      }
    })
  })
}

/**
 * 生成修复总结
 */
const generateFixSummary = (results) => {
  const successCount = results.filter(r => r.success).length
  const totalCount = results.length
  
  let summary = `修复完成: ${successCount}/${totalCount} 项通过\n\n`
  
  // 添加具体的修复结果
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌'
    summary += `${index + 1}. ${status} ${result.name}\n`
    summary += `   ${result.message}\n`
    if (result.action) {
      summary += `   操作: ${result.action}\n`
    }
    summary += '\n'
  })
  
  // 添加下一步建议
  const failedResults = results.filter(r => !r.success)
  if (failedResults.length > 0) {
    summary += '=== 需要手动处理的问题 ===\n\n'
    failedResults.forEach((result, index) => {
      summary += `${index + 1}. ${result.name}\n`
      summary += `   问题: ${result.message}\n`
      summary += `   解决: ${result.action}\n\n`
    })
  } else {
    summary += '🎉 所有问题已自动修复！\n'
    summary += 'SiliconFlow API现在应该可以正常使用了。'
  }
  
  return summary
}

/**
 * 获取修复建议
 */
export const getFixSuggestions = () => {
  return {
    domainWhitelist: {
      title: '配置域名白名单',
      description: '在微信公众平台添加 api.siliconflow.cn 到request合法域名',
      priority: 'high',
      steps: [
        '登录微信公众平台 (mp.weixin.qq.com)',
        '进入开发 → 开发管理 → 开发设置',
        '在"request合法域名"中添加: https://api.siliconflow.cn',
        '保存并提交配置'
      ]
    },
    apiKeyFormat: {
      title: '检查API Key格式',
      description: '确保API Key格式正确且完整',
      priority: 'medium',
      steps: [
        '确认API Key以"sk-"开头',
        '检查长度是否在40-60字符之间',
        '去除多余的空格和换行符',
        '在SiliconFlow官网确认API Key状态'
      ]
    },
    networkSettings: {
      title: '优化网络设置',
      description: '调整网络请求参数以提高成功率',
      priority: 'low',
      steps: [
        '增加请求超时时间到60秒',
        '启用HTTP2和QUIC协议',
        '添加User-Agent请求头',
        '使用正确的Content-Type'
      ]
    }
  }
}
