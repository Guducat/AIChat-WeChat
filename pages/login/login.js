// pages/login/login.js
import { userLogin } from '../../utils/api.js'
import { saveUserInfo, saveLoginStatus } from '../../utils/storage.js'
import { LOGIN_STATUS } from '../../utils/constants.js'

const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

Page({
  data: {
    userInfo: {
      avatarUrl: defaultAvatarUrl,
      nickName: '',
    },
    hasUserInfo: false,
    canIUseGetUserProfile: wx.canIUse('getUserProfile'),
    canIUseNicknameComp: wx.canIUse('input.type.nickname'),
    isLoading: false
  },

  onLoad() {
    // 页面加载时不需要检查认证状态，因为这是登录页面
  },
  
  /**
   * 头像选择
   */
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    this.setData({
      'userInfo.avatarUrl': avatarUrl,
      hasUserInfo: true
    })
  },

  /**
   * 昵称输入
   */
  onInputChange(e) {
    this.setData({
      'userInfo.nickName': e.detail.value
    })
  },

  /**
   * 微信登录（使用填写的头像昵称）
   */
  onWechatLogin() {
    const { userInfo } = this.data

    if (!userInfo.nickName || !userInfo.avatarUrl) {
      wx.showToast({
        title: '请完善头像和昵称',
        icon: 'none'
      })
      return
    }

    this.performLogin(userInfo)
  },

  /**
   * 游客登录
   */
  onGuestLogin() {
    const guestInfo = {
      nickName: '游客用户',
      avatarUrl: defaultAvatarUrl
    }
    this.performLogin(guestInfo)
  },

  /**
   * 执行登录
   */
  async performLogin(userInfo) {
    this.setData({ isLoading: true })

    try {
      const response = await userLogin(userInfo)

      if (response.code === 200) {
        // 保存用户信息和登录状态
        saveUserInfo(response.data.userInfo)
        saveLoginStatus(LOGIN_STATUS.LOGGED_IN)

        wx.showToast({
          title: '登录成功',
          icon: 'success'
        })

        // 延迟返回上一页
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        throw new Error(response.message || '登录失败')
      }
    } catch (error) {
      console.error('登录失败:', error)
      wx.showToast({
        title: error.message || '登录失败',
        icon: 'error'
      })
    } finally {
      this.setData({ isLoading: false })
    }
  },

  /**
   * 返回上一页
   */
  onGoBack() {
    wx.navigateBack()
  },
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    const { nickName } = this.data.userInfo
    this.setData({
      "userInfo.avatarUrl": avatarUrl,
      hasUserInfo: nickName && avatarUrl && avatarUrl !== defaultAvatarUrl,
    })
  },
  onInputChange(e) {
    const nickName = e.detail.value
    const { avatarUrl } = this.data.userInfo
    this.setData({
      "userInfo.nickName": nickName,
      hasUserInfo: nickName && avatarUrl && avatarUrl !== defaultAvatarUrl,
    })
  },
  getUserProfile(e) {
    // 推荐使用wx.getUserProfile获取用户信息，开发者每次通过该接口获取用户个人信息均需用户确认，开发者妥善保管用户快速填写的头像昵称，避免重复弹窗
    wx.getUserProfile({
      desc: '展示用户信息', // 声明获取用户个人信息后的用途，后续会展示在弹窗中，请谨慎填写
      success: (res) => {
        console.log(res)
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        })
      }
    })
  },
})
