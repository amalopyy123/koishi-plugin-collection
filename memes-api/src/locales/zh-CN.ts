const zhCNLocale: any = {
  commands: {
    meme: {
      description: '制作各种表情包',
    },
    'meme.list': {
      description: '查看表情列表',
    },
    'meme.info': {
      description: '查看表情详情',
    },
    'meme.generate': {
      description: '生成表情包，每个表情会注册为本命令的子命令',
      usage:
        '可使用 `自己`、`@自己`、`@某人`、`@用户ID` 作为头像输入。\n' +
        '可在使用命令时回复带图消息，被回复消息中的图片会作为图片参数输入。\n' +
        '可使用多个 `#名称` 参数覆盖对应位置的图片名称。',
      examples:
        'meme generate 5000兆 我去 洛天依\n' +
        'meme generate rua @自己\n' +
        'meme generate steam消息 #一大块小饼干 "Visual Studio Code"',
    },
    'meme.random': {
      description: '生成随机表情',
    },
    'meme.md5': {
      description: '计算图片 MD5',
    },
  },
  'memes-api': {
    errors: {
      'syntax-error': {
        'unexpected-char':
          '参数语法错误，遇到意外字符 {char}（索引 {index}），如需原样输入请使用反斜杠转义。',
        'unterminated-quote':
          '参数语法错误，存在未闭合的引号 {char}（索引 {index}）。',
      },
      'can-not-get-avatar': '无法获取平台 {platform} 中 ID 为 {userId} 的用户头像。',
      'download-image-failed': '下载图片失败。',
      'option-type-mismatch': {
        number: '选项 {0} 类型不正确，应为数字。',
      },
      'option-number-too-small': '选项 {0} 的值过小，应不小于 {1}。',
      'option-number-too-big': '选项 {0} 的值过大，应不大于 {1}。',
      'md5-no-image': '请附带或回复 1 张图片。',
      'md5-too-many-images': '一次只能计算 1 张图片的 MD5，请只提供 1 张图片。',
      'md5-unsupported-avatar-input':
        '暂不支持通过 @用户 或 @自己 计算头像 MD5，请直接发送图片。',
      'md5-compute-failed': '计算图片 MD5 失败。',
      'no-such-meme': '未找到表情 {0}。',
      'image-number-mismatch': '输入图片数量不符合要求，应为 {0}，当前为 {1}。',
      'text-number-mismatch': '输入文字数量不符合要求，应为 {0}，当前为 {1}。',
      'text-over-length': '输入文本过长。',
      'meme-feedback': '{0}',
      'other-error': '发生错误：{0}',
    },
    list: {
      tip:
        '触发方式：“关键词 + 图片/文字”\n' +
        '发送“表情详情 + 关键词”查看参数与预览\n' +
        '当前支持的表情列表：\n{0}',
      'tip-no-shortcut':
        '触发命令：“meme generate <关键词> [...图片/文字]”\n' +
        '发送 “meme info <关键词>” 查看参数与预览\n' +
        '当前支持的表情列表：\n{0}',
    },
    info: {
      key: '表情名：{0}',
      keywords: '关键词：{0}',
      shortcuts: '快捷指令：{0}',
      'image-num': '需要图片数量：{0}',
      'text-num': '需要文字数量：{0}',
      'default-texts': '默认文字：{0}',
      option: ' * {0} - {1}',
      options: '可选参数：\n{0}',
      preview: '表情预览：\n{0}',
    },
    random: {
      'no-suitable-meme': '找不到符合当前输入参数的表情。',
      info: '关键词：{0}',
    },
    md5: {
      result: 'MD5: {0}',
    },
  },
  _config: [
    {
      $desc: '生成指令配置',
      enableShortcut:
        '是否注册类似原版 `memes` 插件的快捷触发方式，例如 `5000兆 我去 洛天依`。',
      shortcutUsePrefix: '快捷触发是否需要带命令前缀。',
      silentShortcut: '快捷触发时是否关闭参数错误提示。',
      moreSilent: '快捷触发时是否进一步关闭更多错误提示。',
      autoUseDefaultTexts: '未提供文字时是否自动使用后端默认文字。',
      autoUseSenderAvatarWhenOnlyOne: '仅需要 1 张图片且未提供时，是否自动使用发送者头像。',
      autoUseSenderAvatarWhenOneLeft:
        '已提供部分图片且只差 1 张达到最小要求时，是否自动补发送者头像。',
      enableProtectedTargetSwap:
        '是否启用受保护目标互换。命中受保护 QQ 时，会交换发送者与目标头像位置。',
      protectedTargetUserId: '受保护的目标 QQ 号。',
    },
    {
      $desc: '图片保护配置',
      enableProtectedImageSwap:
        '是否启用图片 MD5 保护。命中列表中的图片会被替换为发送者头像。',
      protectedImageMd5List:
        '受保护图片的 MD5 列表，仅检测用户直接发送或引用的真实图片。',
    },
    {
      $desc: '表情列表配置',
      listSortBy: {
        $desc: '表情排序方式。',
        $inner: ['默认', '类型', '表情名', '关键词', '创建时间', '修改时间'],
      },
      listSortReverse: '是否倒序显示表情列表。',
      listNewTimeDelta: '在该时间范围内创建的表情会标记为“新”。单位：天。',
      listTextTemplate:
        '表情列表显示文字模板，可用变量：{index}、{key}、{keywords}、{shortcuts}、{tags}。',
      listAddCategoryIcon: '列表中是否显示表情类别图标。',
    },
    {
      $desc: '其他命令配置',
      randomMemeShowInfo: '使用 `meme random` 时是否附带返回表情关键词。',
      generateSubCommandCountToFather:
        '执行表情子命令时，是否同时计入 `meme generate` 的调用次数。',
      randomCommandCountToGenerate:
        '执行 `meme random` 时，是否同时计入 `meme generate` 的调用次数。',
    },
    {
      $desc: '请求配置',
      requestConfig: {
        timeout: '请求超时时间。',
        proxyAgent: '代理服务器地址。',
        keepAlive: '是否保持连接。',
        endpoint: '后端服务地址。',
        headers: '额外附加的请求头。',
      },
      getInfoConcurrency: '启动时拉取表情信息的并发数。',
    },
    {
      $desc: '调试配置',
      debug: '是否输出调试日志。',
    },
  ],
}

export default zhCNLocale
