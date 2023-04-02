// 对象存储类型
export const UPLOADER_TYPE = {
  ALIYUN: 'ALIYUN', // 阿里云
  TXYUN: 'TXYUN', // 腾讯云
  HUAWEI: 'HUAWEI' // 华为云
}

/**
 * @param {String} params.type
 * @param {String} params.getOptionFun
 */
export const UploaderInstance = (function () {
  let instance
  return function (params) {
    if (!instance) {
      instance = new SadaisUploader(params)
    }
    return instance
  }
})()

class SadaisUploader {
  constructor(params) {
    this._init(params)
  }

  /**
   * 初始化
   * @param {Object} options
   */
  async _init(params) {
    this.params = params
    // 不在初始化的时候调用接口，上传文件时再调用，故注释以下代码
    // this._initOptions()
  }

  /**
   * 获取配置信息
   */
  async initOptions(customParams) {
    if (!this.params) this.params = {}

    if (customParams) {
      return (this.params = {
        ...this.params,
        ...customParams
      })
    }
    let { type, getOptionFun } = this.params

    if (getOptionFun) {
      const options = await getOptionFun(type)
      if (!options) return
      if (options.path && !options.path.endsWith('/')) {
        options.path = options.path + '/'
      }
      this.options = { ...options, type }
    }
  }

  /**
   * 是否超时
   */
  _isTimeOut() {
    // 比服务器timeOut时间提前10s过期
    const timeout = this.options.timeOut - 1000 * 10
    return new Date().getTime() > timeout
  }

  /**
   * 单文件上传
   * @param {File} file
   * @return Promise
   */
  async uploadFile(file) {
    if (!this.options || this._isTimeOut()) {
      await this.initOptions()
    }
    if (!file.name && file.path) {
      const isBlobFile = file.path.startsWith('blob')
      const isBase64File = file.path.startsWith('data')
      const suffix =
        isBlobFile || isBase64File ? '.png' : file.path.substring(file.path.lastIndexOf('.'))
      file.name = this._guid() + suffix
    }
    return new Promise((resolve, reject) => {
      const { domain } = this.options

      // 请求地址
      const formData = this._buildParams(file)

      const apiUrl = formData.url
      const uploadedFilePath = `${domain}${domain.endsWith('/') ? '' : '/'}${formData.key}`
      const success = {
        data: uploadedFilePath,
        head: { ret: 0, msg: 'success' }
      }
      const error = {
        data: file.name,
        head: { ret: 1, msg: 'fail' }
      }

      try {
        // uniapp
        uni.uploadFile({
          url: apiUrl,
          filePath: file.path, // uni api提供的blob格式图片地址
          name: 'file',
          formData,
          success: (res) => {
            const { statusCode } = res
            if (statusCode == 200) {
              resolve(success)
            } else {
              error.head.msg = res
              reject(error)
            }
          },
          fail: (error) => {
            console.log(error)
            reject(error)
          }
        })
        // H5 input:file接收内容
      } catch (e) {
        console.log('uni报错，调用XMLHttpRequest', e)
        const data = new FormData()
        Object.keys(formData).forEach((key) => {
          data.append(key, formData[key])
        })
        data.append('file', file)
        const xhr = new XMLHttpRequest()
        xhr.open('POST', apiUrl, true)
        xhr.onreadystatechange = () => {
          if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 200) {
              resolve(success)
            } else {
              reject(error)
            }
          }
        }
        xhr.send(data)
      }
    })
  }

  /**
   * 多文件上传
   * @param {Array<File>} files
   * @return Promise
   */
  async uploadFiles(files) {
    const successUrls = []
    const failNames = []
    for (const file of files) {
      const { data, head } = await this.uploadFile(file)
      if (head.ret === 0) {
        successUrls.push(data)
      } else {
        failNames.push(data)
      }
    }
    return { successUrls, failNames }
  }

  /**
   * 通用文件上传
   * @param { File | Array<file> } file 文件或文件数组
   */
   async upload(file) {
    if (!file) return
    let files = Array.isArray(file) ? file : [file]
    const result = []
    for (let i = 0; i < files.length; i++) {
      const item = files[i]
      const { data, head } = await this.uploadFile(item)
      result.push({
        index: i,
        url: data,
        ret: head.ret
      })
    }
    return result
  }

  // 按类型组装过参数
  _buildParams(file) {
    const opt = this.options
    const type = opt.type
    const params = {
      name: file.name,
      policy: opt.policy,
      success_action_status: '200',
      key: this._getUploadFilePath(file.name)
    }
    const endPoint = opt.endPoint.replace('https://', '').replace('http://', '')
    if (UPLOADER_TYPE.TXYUN === type) {
      params['q-ak'] = opt.accessKeyId
      params['q-signature'] = opt.signature // 签名
      params['q-sign-algorithm'] = 'sha1' // 签名算法
      params['q-key-time'] = opt.param['q-sign-time']
      // params['q-sign-time'] = opt.param['q-sign-time']
      params.url = `https://${opt.bucketName}.cos.${endPoint}.myqcloud.com`
    } else if (UPLOADER_TYPE.HUAWEI === type) {
      params.AccessKeyId = opt.accessKeyId
      params.signature = opt.signature
      params.url = `https://${opt.bucketName}.obs.${endPoint}.myhuaweicloud.com`
    } else {
      params.signature = opt.signature
      params.OSSAccessKeyId = opt.accessKeyId
      params.bucket = opt.bucketName

      params.url = `https://${opt.bucketName}.${endPoint}`
    }
    return params
  }

   /**
   * 获取上传文件路径
   * @param {String} name 文件名
   * @returns
   */
    _getUploadFilePath(name) {
      const { useOriginalName, path } = this.options
      const lastIndexOf = name.lastIndexOf('.')
      const originalName = name.substring(0, lastIndexOf)
      const suffix = name.substring(lastIndexOf + 1)
      const fileName = useOriginalName ? `/${originalName}` : ''
      // 为了保证使用文件原名时，文件不被覆盖，仍然使用随机生成方式
      return `${path}${this._getNowDate()}/${this._guid()}${fileName}.${suffix}`
    }

  /**
   * 获取当前日期
   * @returns YYYY-MM-DD
   */
  _getNowDate() {
    const date = new Date()
    const year = date.getFullYear()
    let month = date.getMonth() + 1
    let day = date.getDate()
    if (month < 10) {
      month = `0${month}`
    }
    if (day < 10) {
      day = `0${day}`
    }

    return `${year}${month}${day}`
  }

  /**
   * 生成guid，用于生成随机文件名
   * @return String
   */
  _guid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0,
        v = c == 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }
}
