# cloud-upload-sdk

- 原生JavaScript实现的文件上传SDK的封装，支持`阿里云` / `腾讯云` / `华为云` OSS 对象存储
- 支持 `单文件上传`、`多文件上传` 和 `通用上传`（包括单文件和多文件）, 支持浏览器环境和小程序环境（Uniapp）
- 将`Endpoint`、`AccessKeyId`、`signature` 等关键参数组成的实例对象存储在后端中, 通过接口请求获取, 保证关键数据的安全性
- 通过 `XMLHttpRequest` 请求（小程序使用 uni.uploadFile）, FormData 携带对应参数, 请求对应的OSS接口, 实现文件上传

## 使用

### 引入SDK

```js
import { UploaderInstance, UPLOADER_TYPE } from 'src/index.js';
```

### 获取OSS实例Options


```js
export const apiGetUploadOptions = async type => {
  const params = { type }
  const { data } = await request.get('后端获取OSS实例信息的接口', params)
  return data
}
```

### 初始化uploader实例

```js
const uploader = new UploaderInstance({
  type: UPLOADER_TYPE.ALIYUN,
  getOptionFun: async type => {
    // 获取option示例
    const { head, data } = await apiGetUploadOptions(type)
    if (head.ret !== Consts.RET_CODE.SUCCESS) return null

    return data
  }
})
```

### 上传文件

#### 单文件上传

```js
const { data, head:{ msg, ret } } = await uploader.uploadFile(file)
// 0-成功 1-失败
if(ret !== Consts.RET_CODE.SUCCESS) return console.error(msg)

const fileUrl = data
```

#### 多文件上传

```js
const { successUrls, failNames } = await uploader.uploadFiles(files)
// successUrls - 上传成功的 url数组
// failNames - 上传失败的 fileName数组
```

#### 通用文件上传（支持单文件和多文件）

```js
const [{ index, url, ret }] = await uploader.upload(file | files)
// 返回数组
// index：上传文件的下标；
// ret：状态，0-成功，1-失败；
// url：上传成功的路径 或 上传失败的文件名
```