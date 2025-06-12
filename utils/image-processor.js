// 图片处理工具
// 专门处理多模态API所需的图片格式转换

/**
 * 将微信小程序本地图片转换为Base64格式
 * @param {string} filePath 微信小程序本地文件路径
 * @returns {Promise<string>} Base64格式的图片数据
 */
export const convertWxFileToBase64 = (filePath) => {
  return new Promise((resolve, reject) => {
    if (!filePath) {
      reject(new Error('文件路径不能为空'))
      return
    }

    console.log('开始转换图片为Base64:', {
      filePath: filePath,
      pathType: filePath.startsWith('data:image/') ? 'base64' :
                filePath.startsWith('http://tmp/') ? 'wx-temp' :
                filePath.startsWith('wxfile://') ? 'wx-file' :
                filePath.startsWith('http') ? 'http-url' : 'unknown'
    })

    // 如果已经是Base64格式，直接返回
    if (filePath.startsWith('data:image/')) {
      console.log('图片已经是Base64格式，直接返回')
      resolve(filePath)
      return
    }

    // 如果是外部HTTP URL（非微信临时文件），直接返回
    if (filePath.startsWith('http') && !filePath.startsWith('http://tmp/')) {
      console.log('外部HTTP URL，直接返回')
      resolve(filePath)
      return
    }

    // 微信小程序临时文件路径需要转换为Base64
    // 包括: wxfile://, http://tmp/, 相对路径等

    // 使用微信API读取文件并转换为Base64
    console.log('尝试读取文件:', filePath)

    wx.getFileSystemManager().readFile({
      filePath: filePath,
      encoding: 'base64',
      success: (res) => {
        try {
          console.log('文件读取成功，开始处理Base64数据:', {
            originalPath: filePath,
            dataLength: res.data ? res.data.length : 0
          })

          // 检测图片格式
          const imageType = detectImageType(filePath)
          const base64Data = `data:image/${imageType};base64,${res.data}`

          // 验证生成的Base64数据
          if (!validateBase64Image(base64Data)) {
            throw new Error('生成的Base64数据验证失败')
          }

          console.log('图片转换成功:', {
            originalPath: filePath,
            imageType: imageType,
            base64Length: res.data.length,
            finalLength: base64Data.length,
            isValid: validateBase64Image(base64Data)
          })

          resolve(base64Data)
        } catch (error) {
          console.error('Base64数据处理失败:', {
            error: error.message,
            filePath: filePath,
            dataExists: !!res.data
          })
          reject(new Error(`Base64数据处理失败: ${error.message}`))
        }
      },
      fail: (error) => {
        console.error('读取文件失败:', {
          filePath: filePath,
          error: error,
          errMsg: error.errMsg
        })

        // 提供更详细的错误信息
        let errorMessage = '读取文件失败'
        if (error.errMsg) {
          if (error.errMsg.includes('no such file')) {
            errorMessage = '文件不存在或路径无效'
          } else if (error.errMsg.includes('permission')) {
            errorMessage = '没有文件访问权限'
          } else {
            errorMessage = `文件读取错误: ${error.errMsg}`
          }
        }

        reject(new Error(errorMessage))
      }
    })
  })
}

/**
 * 检测图片类型
 * @param {string} filePath 文件路径
 * @returns {string} 图片类型 (jpeg, png, gif, webp)
 */
const detectImageType = (filePath) => {
  const extension = filePath.toLowerCase().split('.').pop()
  
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'jpeg'
    case 'png':
      return 'png'
    case 'gif':
      return 'gif'
    case 'webp':
      return 'webp'
    case 'bmp':
      return 'bmp'
    default:
      return 'jpeg' // 默认为jpeg
  }
}

/**
 * 批量转换图片为Base64格式
 * @param {Array} files 文件数组
 * @returns {Promise<Array>} 转换后的文件数组
 */
export const convertFilesToBase64 = async (files) => {
  if (!files || files.length === 0) {
    return []
  }

  console.log('开始批量转换图片，数量:', files.length)

  const convertPromises = files.map(async (file, index) => {
    try {
      console.log(`转换图片 ${index + 1}/${files.length}:`, {
        fileUrl: file.fileUrl,
        fileName: file.fileName,
        fileType: file.fileType
      })

      // 验证文件对象
      if (!file.fileUrl) {
        throw new Error('文件URL为空')
      }

      // 如果已经是Base64格式，验证并返回
      if (file.fileUrl && file.fileUrl.startsWith('data:image/')) {
        console.log(`图片 ${index + 1} 已经是Base64格式`)

        // 验证Base64格式
        if (!validateBase64Image(file.fileUrl)) {
          throw new Error('Base64格式验证失败')
        }

        return {
          ...file,
          isValid: true
        }
      }

      // 转换为Base64
      console.log(`开始转换图片 ${index + 1}:`, file.fileUrl)
      const base64Url = await convertWxFileToBase64(file.fileUrl)

      // 验证转换结果
      if (!base64Url || !validateBase64Image(base64Url)) {
        throw new Error('Base64转换结果验证失败')
      }

      const convertedFile = {
        ...file,
        fileUrl: base64Url,
        originalUrl: file.fileUrl, // 保存原始URL
        isValid: true
      }

      console.log(`图片 ${index + 1} 转换完成:`, {
        originalUrl: file.fileUrl,
        base64Length: base64Url.length,
        isValid: validateBase64Image(base64Url)
      })

      return convertedFile

    } catch (error) {
      console.error(`转换图片 ${index + 1} 失败:`, {
        error: error.message,
        fileUrl: file.fileUrl,
        fileName: file.fileName
      })

      // 转换失败时返回原始文件，但标记为无效
      return {
        ...file,
        isValid: false,
        error: error.message,
        errorDetail: `图片转换失败: ${error.message}`
      }
    }
  })

  try {
    const results = await Promise.all(convertPromises)
    const validFiles = results.filter(file => file.isValid !== false)
    
    console.log(`批量转换完成，成功: ${validFiles.length}/${files.length}`)
    return validFiles

  } catch (error) {
    console.error('批量转换失败:', error)
    throw error
  }
}

/**
 * 验证Base64图片数据
 * @param {string} base64Data Base64图片数据
 * @returns {boolean} 是否有效
 */
export const validateBase64Image = (base64Data) => {
  if (!base64Data || typeof base64Data !== 'string') {
    return false
  }

  // 检查Base64格式
  const base64Pattern = /^data:image\/(jpeg|jpg|png|gif|webp|bmp);base64,/i
  if (!base64Pattern.test(base64Data)) {
    console.log('Base64格式验证失败:', base64Data.substring(0, 50))
    return false
  }

  // 检查Base64数据长度
  const base64Content = base64Data.split(',')[1]
  if (!base64Content || base64Content.length < 50) {
    return false
  }

  return true
}

/**
 * 压缩图片（如果需要）
 * @param {string} filePath 图片路径
 * @param {Object} options 压缩选项
 * @returns {Promise<string>} 压缩后的图片路径
 */
export const compressImage = (filePath, options = {}) => {
  const {
    quality = 0.8,
    width = 1024,
    height = 1024
  } = options

  return new Promise((resolve, reject) => {
    wx.compressImage({
      src: filePath,
      quality: quality,
      compressedWidth: width,
      compressedHeight: height,
      success: (res) => {
        console.log('图片压缩成功:', {
          originalPath: filePath,
          compressedPath: res.tempFilePath
        })
        resolve(res.tempFilePath)
      },
      fail: (error) => {
        console.error('图片压缩失败:', error)
        // 压缩失败时返回原始路径
        resolve(filePath)
      }
    })
  })
}

/**
 * 获取图片信息
 * @param {string} filePath 图片路径
 * @returns {Promise<Object>} 图片信息
 */
export const getImageInfo = (filePath) => {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({
      src: filePath,
      success: (res) => {
        resolve({
          width: res.width,
          height: res.height,
          path: res.path,
          type: res.type || 'unknown'
        })
      },
      fail: (error) => {
        reject(new Error(`获取图片信息失败: ${error.errMsg || '未知错误'}`))
      }
    })
  })
}

/**
 * 处理多模态消息中的图片
 * @param {Object} message 消息对象
 * @returns {Promise<Object>} 处理后的消息对象
 */
export const processMultimodalMessage = async (message) => {
  if (!message.files || message.files.length === 0) {
    return message
  }

  console.log('开始处理多模态消息中的图片')

  try {
    // 过滤出图片文件
    const imageFiles = message.files.filter(file => file.fileType === 'image')
    const otherFiles = message.files.filter(file => file.fileType !== 'image')

    if (imageFiles.length === 0) {
      return message
    }

    // 转换图片为Base64格式
    const convertedImages = await convertFilesToBase64(imageFiles)

    // 合并处理后的文件
    const processedFiles = [...convertedImages, ...otherFiles]

    return {
      ...message,
      files: processedFiles
    }

  } catch (error) {
    console.error('处理多模态消息失败:', error)
    
    // 处理失败时返回原始消息，但移除无效的图片
    return {
      ...message,
      files: message.files.filter(file => file.fileType !== 'image')
    }
  }
}

/**
 * 检查图片大小限制
 * @param {string} base64Data Base64图片数据
 * @param {number} maxSizeMB 最大大小（MB）
 * @returns {boolean} 是否超出限制
 */
export const checkImageSizeLimit = (base64Data, maxSizeMB = 10) => {
  if (!base64Data) return false

  // 计算Base64数据的实际大小
  const base64Content = base64Data.split(',')[1] || base64Data
  const sizeInBytes = (base64Content.length * 3) / 4
  const sizeInMB = sizeInBytes / (1024 * 1024)

  console.log('图片大小检查:', {
    sizeInMB: sizeInMB.toFixed(2),
    maxSizeMB: maxSizeMB,
    isOverLimit: sizeInMB > maxSizeMB
  })

  return sizeInMB > maxSizeMB
}

/**
 * 格式化图片错误信息
 * @param {Error} error 错误对象
 * @returns {string} 用户友好的错误信息
 */
export const formatImageError = (error) => {
  if (!error) return '未知错误'

  const message = error.message || error.errMsg || '未知错误'

  if (message.includes('file not found')) {
    return '图片文件不存在'
  } else if (message.includes('permission denied')) {
    return '没有访问图片的权限'
  } else if (message.includes('network')) {
    return '网络连接失败'
  } else if (message.includes('format')) {
    return '图片格式不支持'
  } else if (message.includes('size')) {
    return '图片文件过大'
  } else {
    return `图片处理失败: ${message}`
  }
}
