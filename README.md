# AI对话助手微信小程序

[![GitHub stars](https://img.shields.io/github/stars/Guducat/AIChat-WeChat?style=flat-square)](https://github.com/Guducat/AIChat-WeChat/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/Guducat/AIChat-WeChat?style=flat-square)](https://github.com/Guducat/AIChat-WeChat/network)
[![GitHub issues](https://img.shields.io/github/issues/Guducat/AIChat-WeChat?style=flat-square)](https://github.com/Guducat/AIChat-WeChat/issues)
[![GitHub license](https://img.shields.io/github/license/Guducat/AIChat-WeChat?style=flat-square)](https://github.com/Guducat/AIChat-WeChat/blob/master/LICENSE)
[![WeChat MiniProgram](https://img.shields.io/badge/WeChat-MiniProgram-brightgreen?style=flat-square)](https://developers.weixin.qq.com/miniprogram/dev/framework/)
[![Vant Weapp](https://img.shields.io/badge/UI-Vant%20Weapp-blue?style=flat-square)](https://vant-ui.github.io/vant-weapp/)

> 🤖 基于SiliconFlow API的智能AI对话助手微信小程序，支持多模态交互、思考模型推理、本地数据管理等功能

[English](./README_EN.md) | 中文

## ✨ 功能特性

### 🧠 AI对话功能
- **多模型支持**：DeepSeek-V3、DeepSeek-R1、Qwen2.5-VL-72B等主流AI模型
- **智能对话**：支持文本对话，提供专业、友善的AI助手服务
- **流式响应**：实时显示AI回复内容，提升用户体验
- **对话历史**：本地保存对话记录，支持历史回顾和管理

### 👁️ 多模态交互
- **图文对话**：支持上传图片进行视觉理解和分析
- **智能识别**：自动检测模型类型，动态启用/禁用图片上传功能
- **Base64编码**：安全的图片处理和传输机制
- **格式支持**：支持JPG、PNG、GIF、WebP等多种图片格式

### 🔬 思考模型支持
- **推理过程展示**：DeepSeek-R1等思考模型的推理过程可视化
- **折叠面板**：思考内容可展开/收起，优化界面体验
- **实时更新**：推理过程实时显示，增强交互感

### 💾 数据管理
- **本地存储**：对话历史、用户设置、API配置本地保存
- **Token统计**：精确统计输入/输出Token使用量
- **费用计算**：实时计算API调用费用，支持¥/百万tokens显示
- **数据导出**：支持对话记录分享和导出功能

### 🎨 用户界面
- **现代化设计**：基于Vant Weapp组件库，使用#1296DB主题色
- **响应式布局**：适配不同屏幕尺寸，支持安全区域
- **交互优化**：流畅的动画效果和用户反馈
- **Markdown渲染**：集成towxml支持富文本内容显示

## 🛠️ 技术栈

### 前端框架
- **微信小程序**：原生小程序开发框架
- **Vant Weapp 1.11.7**：轻量级UI组件库
- **towxml 3.0**：HTML/Markdown转WXML渲染库

### API集成
- **SiliconFlow API**：AI模型服务提供商
- **流式响应**：基于wx.request的分块传输
- **多模态支持**：符合SiliconFlow API规范的图文消息格式

### 数据存储
- **微信本地存储**：wx.setStorageSync/wx.getStorageSync
- **加密存储**：敏感数据（API Key）安全存储
- **数据管理**：自动清理过期数据，优化存储空间

## 🚀 快速开始

### 环境要求
- 微信开发者工具（最新版本）
- Node.js 14+
- 微信小程序开发账号

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/Guducat/AIChat-WeChat.git
cd AIChat-WeChat
```

2. **安装依赖**
```bash
npm install
```

3. **配置微信开发者工具**
- 打开微信开发者工具
- 导入项目，选择项目根目录
- 在工具中执行：工具 -> 构建npm

4. **配置API Key**
- 访问 [SiliconFlow官网](https://siliconflow.cn) 注册账号
- 创建API Key
- 在小程序个人中心配置API Key

5. **运行项目**
- 在微信开发者工具中点击"编译"
- 选择模拟器或真机预览

## ⚙️ 配置说明

### API配置
在 `utils/constants.js` 中配置API相关参数：

```javascript
// SiliconFlow API配置
export const SILICONFLOW_API_BASE = 'https://api.siliconflow.cn/v1'
export const USE_MOCK_DATA = false // 生产环境设为false
```

### 模型配置
在 `utils/aiInfo.js` 中管理AI模型信息：

```javascript
export const AI_MODELS_CONFIG = [
  {
    id: 'deepseek-ai/DeepSeek-V3',
    name: 'DeepSeek-V3',
    pricePerInputToken: 2,    // ¥2/百万tokens
    pricePerOutputToken: 8,   // ¥8/百万tokens
    supportMultimodal: false
  }
  // 更多模型配置...
]
```

### 域名白名单
在微信小程序后台添加以下域名：
- `https://api.siliconflow.cn` (request合法域名)

## 📱 功能使用

### 基础对话
1. 在主页选择AI模型
2. 输入文本消息
3. 点击"开始对话"发送消息
4. 查看AI回复和Token统计

### 图文对话
1. 选择支持多模态的模型（如Qwen2.5-VL-72B）
2. 点击"选择图片"上传图片
3. 输入文本描述（可选）
4. 发送消息进行图文交互

### 思考模型
1. 选择DeepSeek-R1等思考模型
2. 发送消息后可查看推理过程
3. 点击折叠面板展开/收起思考内容

### 数据管理
1. 在"对话记录"页面查看历史对话
2. 在"个人"页面查看Token统计和费用
3. 支持清空数据和导出功能

## 📊 支持的AI模型

| 模型名称 | 类型 | 上下文长度 | 输入价格 | 输出价格 | 特殊功能 |
|---------|------|-----------|----------|----------|----------|
| DeepSeek-V3 | 文本 | 64K | ¥2/百万tokens | ¥8/百万tokens | 高性价比 |
| DeepSeek-R1 | 推理 | 96K | ¥4/百万tokens | ¥16/百万tokens | 思考过程 |
| Qwen2.5-VL-72B | 多模态 | 128K | ¥4.13/百万tokens | ¥4.13/百万tokens | 视觉理解 |

## 🏗️ 项目结构

```
AIChat-WeChat/
├── pages/                 # 页面文件
│   ├── home/              # 主页
│   ├── chat/              # 对话页面
│   ├── chat-history/      # 对话历史
│   ├── profile/           # 个人中心
│   └── stats/             # 统计页面
├── utils/                 # 工具类
│   ├── api.js            # API调用封装
│   ├── siliconflow-api.js # SiliconFlow API
│   ├── storage.js        # 本地存储管理
│   ├── aiInfo.js         # AI模型信息
│   └── constants.js      # 常量定义
├── towxml/               # Markdown渲染库
├── docs/                 # 项目文档
├── images/               # 图片资源
└── app.js               # 应用入口
```

## 🔧 开发指南

### 添加新AI模型
1. 在 `utils/aiInfo.js` 中添加模型配置
```javascript
{
  id: 'new-model-id',
  name: '新模型名称',
  description: '模型描述',
  pricePerInputToken: 2,
  pricePerOutputToken: 8,
  supportMultimodal: false,
  isThinkingModel: false
}
```
2. 更新 `SILICONFLOW_MODELS` 列表
3. 配置模型定价信息
4. 测试模型功能

### 自定义UI主题
1. 修改 `app.wxss` 中的主题色变量
2. 更新 `app.json` 中的tabBar配色
3. 调整Vant组件的主题色

### 扩展存储功能
1. 在 `utils/storage.js` 中添加新的存储方法
2. 在 `utils/constants.js` 中定义存储键名
3. 实现数据清理和迁移逻辑

### 调试技巧
1. 开启开发者工具的调试模式
2. 使用 `console.log` 记录关键数据流
3. 在 `utils/constants.js` 中设置 `USE_MOCK_DATA = true` 进行离线测试
4. 检查网络请求和响应数据格式

## 🐛 故障排除

### 常见问题

**Q: API调用失败，返回401错误**
A: 检查API Key是否正确配置，确保在个人中心正确输入了有效的SiliconFlow API Key

**Q: 图片上传失败**
A: 确保选择的是支持多模态的模型（如Qwen2.5-VL-72B），检查图片格式和大小限制

**Q: 对话历史丢失**
A: 检查本地存储是否被清理，确保微信小程序有足够的存储空间

**Q: Token统计不准确**
A: 检查API响应中的usage字段，确保模型返回了正确的token统计信息

**Q: 思考模型推理过程不显示**
A: 确保选择的是支持推理的模型（如DeepSeek-R1），检查API请求中是否包含 `enable_thinking: true`

### 性能优化

1. **图片压缩**：上传前自动压缩图片以减少传输时间
2. **缓存机制**：缓存常用数据减少重复请求
3. **分页加载**：对话历史采用分页加载避免一次性加载过多数据
4. **内存管理**：定期清理过期数据释放存储空间

## 🔒 安全说明

### API Key安全
- API Key采用微信小程序本地加密存储
- 不会在网络传输中暴露完整的API Key
- 建议定期更换API Key

### 数据隐私
- 所有对话数据仅存储在用户设备本地
- 不会上传到第三方服务器
- 用户可随时清空本地数据

### 网络安全
- 所有API请求均使用HTTPS加密传输
- 遵循微信小程序安全规范
- 支持域名白名单验证

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源协议。

## 👨‍💻 作者

**孤独豹猫 (Guducat)**
- GitHub: [@Guducat](https://github.com/Guducat)
- Email: guducat@qq.com

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目！

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## ⭐ 支持

如果这个项目对你有帮助，请给它一个 ⭐️！

## 📞 技术支持

如有问题或建议，请通过以下方式联系：
- 提交 [GitHub Issue](https://github.com/Guducat/AIChat-WeChat/issues)
- 发送邮件至：guducat@qq.com

---

**注意事项：**
1. 使用前请确保已配置有效的SiliconFlow API Key
2. 注意API调用费用，建议设置使用限额
3. 定期备份重要对话数据
4. 遵守微信小程序平台规范和相关法律法规
