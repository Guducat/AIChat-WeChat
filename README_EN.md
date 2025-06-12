# AI Chat Assistant WeChat Mini Program

[![GitHub stars](https://img.shields.io/github/stars/Guducat/AIChat-WeChat?style=flat-square)](https://github.com/Guducat/AIChat-WeChat/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/Guducat/AIChat-WeChat?style=flat-square)](https://github.com/Guducat/AIChat-WeChat/network)
[![GitHub issues](https://img.shields.io/github/issues/Guducat/AIChat-WeChat?style=flat-square)](https://github.com/Guducat/AIChat-WeChat/issues)
[![GitHub license](https://img.shields.io/github/license/Guducat/AIChat-WeChat?style=flat-square)](https://github.com/Guducat/AIChat-WeChat/blob/master/LICENSE)
[![WeChat MiniProgram](https://img.shields.io/badge/WeChat-MiniProgram-brightgreen?style=flat-square)](https://developers.weixin.qq.com/miniprogram/dev/framework/)
[![Vant Weapp](https://img.shields.io/badge/UI-Vant%20Weapp-blue?style=flat-square)](https://vant-ui.github.io/vant-weapp/)

> 🤖 An intelligent AI chat assistant WeChat mini program based on SiliconFlow API, supporting multimodal interaction, reasoning model inference, local data management, and more

English | [中文](./README.md)

## ✨ Features

### 🧠 AI Chat Functionality
- **Multi-model Support**: DeepSeek-V3, DeepSeek-R1, Qwen2.5-VL-72B and other mainstream AI models
- **Intelligent Conversation**: Professional and friendly text-based AI assistant services
- **Streaming Response**: Real-time display of AI replies for better user experience  
- **Chat History**: Locally stored conversation records with history management
- **Token Statistics**: Accurate input/output token usage tracking
- **Cost Calculation**: Real-time API call cost calculation (¥/million tokens)

### 👁️ Multimodal Interaction
- **Image-Text Chat**: Support for uploading images for visual understanding and analysis
- **Smart Recognition**: Automatic model type detection with dynamic enable/disable of image upload
- **Base64 Encoding**: Secure image processing and transmission mechanism
- **Format Support**: Support for JPG, PNG, GIF, WebP and other image formats

### 🔬 Reasoning Model Support
- **Inference Process Display**: Visualization of reasoning processes for models like DeepSeek-R1
- **Collapsible Panels**: Expandable/collapsible thinking content for optimized interface experience
- **Real-time Updates**: Real-time display of reasoning processes for enhanced interaction

### 💾 Data Management
- **Local Storage**: Local saving of chat history, user settings, and API configurations
- **Token Statistics**: Precise tracking of input/output token usage
- **Cost Calculation**: Real-time calculation of API call costs with ¥/million tokens display
- **Data Export**: Support for sharing and exporting conversation records

### 🎨 User Interface
- **Modern Design**: Based on Vant Weapp component library with #1296DB theme color
- **Responsive Layout**: Adapts to different screen sizes with safe area support
- **Interaction Optimization**: Smooth animations and user feedback
- **Markdown Rendering**: Integrated towxml for rich text content display

## 🛠️ Tech Stack

### Frontend Framework
- **WeChat Mini Program**: Native mini program development framework
- **Vant Weapp 1.11.7**: Lightweight UI component library
- **towxml 3.0**: HTML/Markdown to WXML rendering library

### API Integration
- **SiliconFlow API**: AI model service provider
- **Streaming Response**: Chunked transfer based on wx.request
- **Multimodal Support**: Image-text message format compliant with SiliconFlow API specifications

### Data Storage
- **WeChat Local Storage**: wx.setStorageSync/wx.getStorageSync
- **Encrypted Storage**: Secure storage of sensitive data (API Keys)
- **Data Management**: Automatic cleanup of expired data and storage optimization

## 🚀 Quick Start

### Requirements
- WeChat Developer Tools (latest version)
- Node.js 14+
- WeChat Mini Program developer account

### Installation Steps

1. **Clone the Project**
```bash
git clone https://github.com/Guducat/AIChat-WeChat.git
cd AIChat-WeChat
```

2. **Install Dependencies**
```bash
npm install
```

3. **Configure WeChat Developer Tools**
- Open WeChat Developer Tools
- Import project, select project root directory
- Execute in tools: Tools -> Build npm

4. **Configure API Key**
- Visit [SiliconFlow Official Website](https://siliconflow.cn) to register an account
- Create API Key
- Configure API Key in mini program personal center

5. **Run Project**
- Click "Compile" in WeChat Developer Tools
- Select simulator or real device preview

## ⚙️ Configuration

### API Configuration
Configure API-related parameters in `utils/constants.js`:

```javascript
// SiliconFlow API Configuration
export const SILICONFLOW_API_BASE = 'https://api.siliconflow.cn/v1'
export const USE_MOCK_DATA = false // Set to false for production
```

### Model Configuration
Manage AI model information in `utils/aiInfo.js`:

```javascript
export const AI_MODELS_CONFIG = [
  {
    id: 'deepseek-ai/DeepSeek-V3',
    name: 'DeepSeek-V3',
    pricePerInputToken: 2,    // ¥2/million tokens
    pricePerOutputToken: 8,   // ¥8/million tokens
    supportMultimodal: false
  }
  // More model configurations...
]
```

### Domain Whitelist
Add the following domains in WeChat Mini Program backend:
- `https://api.siliconflow.cn` (request legal domain)

## 📱 Usage

### Basic Chat
1. Select AI model on homepage
2. Input text message
3. Click "Start Chat" to send message
4. View AI reply and token statistics

### Image-Text Chat
1. Select multimodal-supported model (e.g., Qwen2.5-VL-72B)
2. Click "Select Image" to upload image
3. Input text description (optional)
4. Send message for image-text interaction

### Reasoning Models
1. Select reasoning models like DeepSeek-R1
2. View reasoning process after sending message
3. Click collapsible panel to expand/collapse thinking content

### Data Management
1. View chat history in "Chat Records" page
2. View token statistics and costs in "Profile" page
3. Support data clearing and export functions

## 📊 Supported AI Models

| Model Name | Type | Context Length | Input Price | Output Price | Special Features |
|------------|------|----------------|-------------|--------------|------------------|
| DeepSeek-V3 | Text | 64K | ¥2/million tokens | ¥8/million tokens | Cost-effective |
| DeepSeek-R1 | Reasoning | 96K | ¥4/million tokens | ¥16/million tokens | Thinking process |
| Qwen2.5-VL-72B | Multimodal | 128K | ¥4.13/million tokens | ¥4.13/million tokens | Visual understanding |

## 🏗️ Project Structure

```
AIChat-WeChat/
├── pages/                 # Page files
│   ├── home/              # Homepage
│   ├── chat/              # Chat page
│   ├── chat-history/      # Chat history
│   ├── profile/           # Profile center
│   └── stats/             # Statistics page
├── utils/                 # Utility classes
│   ├── api.js            # API call wrapper
│   ├── siliconflow-api.js # SiliconFlow API
│   ├── storage.js        # Local storage management
│   ├── aiInfo.js         # AI model information
│   └── constants.js      # Constants definition
├── towxml/               # Markdown rendering library
├── docs/                 # Project documentation
├── images/               # Image resources
└── app.js               # Application entry
```

## 🔧 Development Guide

### Adding New AI Models
1. Add model configuration in `utils/aiInfo.js`
```javascript
{
  id: 'new-model-id',
  name: 'New Model Name',
  description: 'Model description',
  pricePerInputToken: 2,
  pricePerOutputToken: 8,
  supportMultimodal: false,
  isThinkingModel: false
}
```
2. Update `SILICONFLOW_MODELS` list
3. Configure model pricing information
4. Test model functionality

### Customizing UI Theme
1. Modify theme color variables in `app.wxss`
2. Update tabBar colors in `app.json`
3. Adjust Vant component theme colors

### Extending Storage Features
1. Add new storage methods in `utils/storage.js`
2. Define storage key names in `utils/constants.js`
3. Implement data cleanup and migration logic

### Debugging Tips
1. Enable debug mode in developer tools
2. Use `console.log` to track key data flows
3. Set `USE_MOCK_DATA = true` in `utils/constants.js` for offline testing
4. Check network requests and response data formats

## 🐛 Troubleshooting

### Common Issues

**Q: API call fails with 401 error**
A: Check if API Key is correctly configured, ensure valid SiliconFlow API Key is entered in profile center

**Q: Image upload fails**
A: Ensure a multimodal-supported model is selected (e.g., Qwen2.5-VL-72B), check image format and size limits

**Q: Chat history lost**
A: Check if local storage was cleared, ensure WeChat mini program has sufficient storage space

**Q: Token statistics inaccurate**
A: Check usage field in API response, ensure model returns correct token statistics

**Q: Reasoning model thinking process not displayed**
A: Ensure a reasoning-supported model is selected (e.g., DeepSeek-R1), check if API request includes `enable_thinking: true`

### Performance Optimization

1. **Image Compression**: Automatically compress images before upload to reduce transfer time
2. **Caching Mechanism**: Cache frequently used data to reduce redundant requests
3. **Pagination Loading**: Use pagination for chat history to avoid loading too much data at once
4. **Memory Management**: Regularly clean expired data to free storage space

## 🔒 Security Notes

### API Key Security
- API Keys are stored locally with WeChat mini program encryption
- Complete API Keys are never exposed during network transmission
- Recommend regular API Key rotation

### Data Privacy
- All conversation data is stored only locally on user devices
- No data is uploaded to third-party servers
- Users can clear local data at any time

### Network Security
- All API requests use HTTPS encrypted transmission
- Complies with WeChat mini program security specifications
- Supports domain whitelist verification


## 📄 License

This project is licensed under the [MIT License](LICENSE).

## 👨‍💻 Author

**Guducat (孤独豹猫)**
- GitHub: [@Guducat](https://github.com/Guducat)
- Email: guducat@qq.com

## 🤝 Contributing

Welcome to submit Issues and Pull Requests to improve this project!

1. Fork this repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## ⭐ Support

If this project helps you, please give it a ⭐️!

## 📞 Technical Support

For questions or suggestions, please contact via:
- Submit [GitHub Issue](https://github.com/Guducat/AIChat-WeChat/issues)
- Send email to: guducat@qq.com

---

**Important Notes:**
1. Please ensure a valid SiliconFlow API Key is configured before use
2. Pay attention to API call costs, recommend setting usage limits
3. Regularly backup important conversation data
4. Comply with WeChat Mini Program platform specifications and relevant laws and regulations
5. Note API usage fees, suggest setting usage limits
6. Back up important conversation data regularly
7. Follow WeChat Mini Program platform rules and relevant laws
