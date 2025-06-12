// SiliconFlow API 调试工具
// 专门用于诊断和修复401认证错误

import { SILICONFLOW_API_BASE } from './constants.js'
import { getSiliconFlowApiKey } from './storage.js'

/**
 * 详细的API调试测试
 * @param {string} testApiKey 测试用的API Key
 * @param {Function} onProgress 进度回调
 * @param {Function} onComplete 完成回调
 */
export const debugSiliconFlowAPI = (testApiKey, onProgress, onComplete) => {
  const results = {
    tests: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0
    }
  }

  const apiKey = testApiKey || getSiliconFlowApiKey()
  
  // 测试步骤
  const tests = [
    {
      name: 'API Key格式验证',
      test: () => testApiKeyFormat(apiKey)
    },
    {
      name: '网络连接测试',
      test: () => testNetworkConnection()
    },
    {
      name: '请求头格式测试',
      test: () => testRequestHeaders(apiKey)
    },
    {
      name: 'SiliconFlow API认证测试',
      test: () => testSiliconFlowAuth(apiKey)
    },
    {
      name: '完整API调用测试',
      test: () => testFullApiCall(apiKey)
    }
  ]

  let currentTest = 0
  results.summary.total = tests.length

  const runNextTest = () => {
    if (currentTest >= tests.length) {
      onComplete && onComplete(results)
      return
    }

    const test = tests[currentTest]
    onProgress && onProgress({
      current: currentTest + 1,
      total: tests.length,
      testName: test.name
    })

    test.test().then(result => {
      results.tests.push({
        name: test.name,
        ...result
      })
      
      if (result.success) {
        results.summary.passed++
      } else {
        results.summary.failed++
      }

      currentTest++
      setTimeout(runNextTest, 500) // 延迟执行下一个测试
    }).catch(error => {
      results.tests.push({
        name: test.name,
        success: false,
        error: error.message,
        details: error.details || ''
      })
      results.summary.failed++
      currentTest++
      setTimeout(runNextTest, 500)
    })
  }

  runNextTest()
}

/**
 * 测试API Key格式
 */
const testApiKeyFormat = (apiKey) => {
  return new Promise((resolve) => {
    const result = {
      success: false,
      message: '',
      details: ''
    }

    if (!apiKey) {
      result.message = 'API Key未配置'
      result.details = '请先在个人中心配置SiliconFlow API Key'
      resolve(result)
      return
    }

    if (typeof apiKey !== 'string') {
      result.message = 'API Key类型错误'
      result.details = `期望string类型，实际${typeof apiKey}类型`
      resolve(result)
      return
    }

    const trimmedKey = apiKey.trim()
    
    if (trimmedKey.length === 0) {
      result.message = 'API Key为空字符串'
      resolve(result)
      return
    }

    if (trimmedKey.length < 20) {
      result.message = 'API Key长度过短'
      result.details = `当前长度${trimmedKey.length}，建议长度至少20字符`
      resolve(result)
      return
    }

    if (!trimmedKey.startsWith('sk-')) {
      result.message = 'API Key格式可能有误'
      result.details = 'SiliconFlow API Key通常以"sk-"开头'
      result.success = true // 不是致命错误，只是警告
    } else {
      result.success = true
      result.message = 'API Key格式正确'
      result.details = `长度: ${trimmedKey.length}, 前缀: ${trimmedKey.substring(0, 8)}...`
    }

    resolve(result)
  })
}

/**
 * 测试网络连接
 */
const testNetworkConnection = () => {
  return new Promise((resolve) => {
    const result = {
      success: false,
      message: '',
      details: ''
    }

    // 测试基本网络连接
    wx.request({
      url: 'https://api.siliconflow.cn',
      method: 'GET',
      timeout: 10000,
      success: (res) => {
        result.success = true
        result.message = '网络连接正常'
        result.details = `状态码: ${res.statusCode}`
        resolve(result)
      },
      fail: (error) => {
        result.message = '网络连接失败'
        result.details = error.errMsg || '未知网络错误'
        
        // 分析具体的网络错误
        if (error.errMsg && error.errMsg.includes('domain')) {
          result.details += '\n可能原因: 域名未添加到微信小程序白名单'
        } else if (error.errMsg && error.errMsg.includes('timeout')) {
          result.details += '\n可能原因: 网络超时'
        }
        
        resolve(result)
      }
    })
  })
}

/**
 * 测试请求头格式
 */
const testRequestHeaders = (apiKey) => {
  return new Promise((resolve) => {
    const result = {
      success: false,
      message: '',
      details: ''
    }

    if (!apiKey) {
      result.message = 'API Key未提供，无法测试请求头'
      resolve(result)
      return
    }

    // 构建测试请求头
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': 'WeChat-MiniProgram'
    }

    // 验证请求头格式
    const authHeader = headers.Authorization
    if (!authHeader.startsWith('Bearer ')) {
      result.message = 'Authorization头格式错误'
      result.details = '应该以"Bearer "开头'
      resolve(result)
      return
    }

    const token = authHeader.replace('Bearer ', '')
    if (token !== apiKey) {
      result.message = 'Authorization头中的token与API Key不匹配'
      resolve(result)
      return
    }

    result.success = true
    result.message = '请求头格式正确'
    result.details = `Authorization: Bearer ${apiKey.substring(0, 8)}...`
    resolve(result)
  })
}

/**
 * 测试SiliconFlow API认证
 */
const testSiliconFlowAuth = (apiKey) => {
  return new Promise((resolve) => {
    const result = {
      success: false,
      message: '',
      details: ''
    }

    if (!apiKey) {
      result.message = 'API Key未提供，无法测试认证'
      resolve(result)
      return
    }

    // 发送最简单的认证测试请求
    wx.request({
      url: `${SILICONFLOW_API_BASE}/models`,
      method: 'GET',
      header: {
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'WeChat-MiniProgram'
      },
      timeout: 15000,
      success: (res) => {
        if (res.statusCode === 200) {
          result.success = true
          result.message = 'API认证成功'
          result.details = `获取到${res.data?.data?.length || 0}个模型`
        } else if (res.statusCode === 401) {
          result.message = 'API认证失败 (401)'
          result.details = res.data?.message || res.data || 'Invalid token'
          
          // 分析401错误的具体原因
          if (typeof res.data === 'string' && res.data.includes('Invalid token')) {
            result.details += '\n可能原因: API Key无效或已过期'
          }
        } else {
          result.message = `API请求失败 (${res.statusCode})`
          result.details = res.data?.message || res.data || '未知错误'
        }
        resolve(result)
      },
      fail: (error) => {
        result.message = 'API认证请求失败'
        result.details = error.errMsg || '网络请求失败'
        resolve(result)
      }
    })
  })
}

/**
 * 测试完整API调用
 */
const testFullApiCall = (apiKey) => {
  return new Promise((resolve) => {
    const result = {
      success: false,
      message: '',
      details: ''
    }

    if (!apiKey) {
      result.message = 'API Key未提供，无法测试完整调用'
      resolve(result)
      return
    }

    const testData = {
      model: 'deepseek-ai/DeepSeek-V3',
      messages: [
        {
          role: 'user',
          content: 'Hello'
        }
      ],
      max_tokens: 10,
      temperature: 0.7,
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
      timeout: 30000,
      success: (res) => {
        if (res.statusCode === 200 && res.data?.choices) {
          result.success = true
          result.message = '完整API调用成功'
          result.details = `模型: ${res.data.model}, Token使用: ${res.data.usage?.total_tokens || 0}`
        } else if (res.statusCode === 401) {
          result.message = '完整API调用认证失败 (401)'
          result.details = res.data?.message || res.data || 'Invalid token'
        } else {
          result.message = `完整API调用失败 (${res.statusCode})`
          result.details = res.data?.message || res.data || '未知错误'
        }
        resolve(result)
      },
      fail: (error) => {
        result.message = '完整API调用网络失败'
        result.details = error.errMsg || '网络请求失败'
        resolve(result)
      }
    })
  })
}

/**
 * 生成调试报告
 */
export const generateDebugReport = (results) => {
  let report = '=== SiliconFlow API 调试报告 ===\n\n'
  
  report += `测试概况: ${results.summary.passed}/${results.summary.total} 通过\n\n`
  
  results.tests.forEach((test, index) => {
    const status = test.success ? '✅' : '❌'
    report += `${index + 1}. ${status} ${test.name}\n`
    report += `   ${test.message}\n`
    if (test.details) {
      report += `   详情: ${test.details}\n`
    }
    if (test.error) {
      report += `   错误: ${test.error}\n`
    }
    report += '\n'
  })
  
  // 添加解决建议
  if (results.summary.failed > 0) {
    report += '=== 解决建议 ===\n\n'
    
    const failedTests = results.tests.filter(t => !t.success)
    
    if (failedTests.some(t => t.name.includes('网络连接'))) {
      report += '1. 网络连接问题:\n'
      report += '   - 检查微信小程序后台是否添加了 api.siliconflow.cn 到request合法域名\n'
      report += '   - 确认网络连接正常\n\n'
    }
    
    if (failedTests.some(t => t.name.includes('认证'))) {
      report += '2. API认证问题:\n'
      report += '   - 验证API Key是否正确和有效\n'
      report += '   - 检查API Key是否有足够的权限\n'
      report += '   - 确认API Key未过期\n\n'
    }
    
    if (failedTests.some(t => t.name.includes('格式'))) {
      report += '3. API Key格式问题:\n'
      report += '   - 确保API Key完整，没有多余的空格\n'
      report += '   - 验证API Key以"sk-"开头\n\n'
    }
  }
  
  return report
}
