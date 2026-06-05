import { ActType, MemeArgsResponse, MemeInfoResponse, UserInfo } from 'meme-generator-api'
import { Command, Context, Session, h, paramCase } from 'koishi'

import { Config } from '../config'
import {
  checkInRange,
  computeBlobMd5,
  constructBlobFromFileResp,
  formatRange,
  normalizeMd5,
  splitArgString,
} from '../utils'

export interface SessionInternal {
  inGenerateSubCommand?: boolean
  shortcut?: boolean
}

declare module 'koishi' {
  interface Session {
    memesApi: SessionInternal
  }
}

export interface OptionInfo {
  names: string[]
  argName: string
  type: string
  description: string
}

export type ImageFetchInfo =
  | { kind: 'image'; src: string; source: 'quote' | 'image' }
  | { kind: 'user'; userId: string; source: 'self' | 'mention' | 'auto' }

export interface ResolvedArgs {
  imageInfos: ImageFetchInfo[]
  texts: string[]
  names: string[]
  effectiveSenderUserId: string
}

export interface ImagesAndInfos {
  images: Blob[]
  userInfos: UserInfo[]
  names: string[]
  imageInfos: ImageFetchInfo[]
  explicitNameCount: number
}

declare module '../index' {
  interface MemeInternal {
    argTypeMap: Record<string, string>
    transformToKoishiOptions: (args: MemeArgsResponse) => OptionInfo[]
    applyOptionEffects: (
      session: Session,
      options: Record<string, any>,
      info: MemeInfoResponse,
    ) => Promise<Record<string, any>>
    resolveArgs(session: Session, args: h[]): Promise<ResolvedArgs>
    resolveImagesAndInfos: (
      session: Session,
      imageInfos: ImageFetchInfo[],
      existingNames?: string[],
    ) => Promise<ImagesAndInfos>
    checkAndCountToGenerate(session: Session): Promise<h[] | undefined>
    uploadImgAndRenderMeme(
      meme: MemeInfoResponse,
      texts: string[],
      uploadInfo: ImagesAndInfos,
      options?: Record<string, any>,
    ): Promise<Blob>
    applyProtectedImageSwap(
      session: Session,
      uploadInfo: ImagesAndInfos,
      effectiveSenderUserId: string,
      commandType: 'generate' | 'random',
    ): Promise<ImagesAndInfos>
    reRegisterGenerateCommands: () => Promise<void>
  }
}

export async function apply(ctx: Context, config: Config) {
  const protectedImageMd5Set = new Set(
    config.protectedImageMd5List.map(normalizeMd5).filter(Boolean),
  )

  const cmdGenerate = ctx.$.cmd.subcommand('.generate').action(async ({ session }) => {
    if (session?.memesApi.inGenerateSubCommand) return
    return session?.execute('help meme.generate')
  })

  const generateSubCommands: Command[] = []

  ctx.$.argTypeMap = {
    str: 'string',
    int: 'integer',
    float: 'number',
    bool: 'boolean',
  }

  ctx.$.transformToKoishiOptions = (args) => {
    const options: OptionInfo[] = []
    for (const arg of args.parser_options) {
      const trimmedNames = arg.names.map((value) => value.replace(/^-+/, ''))
      const name =
        trimmedNames.filter((value) => value in args.args_model)[0] ??
        trimmedNames
          .filter((value) => /^[a-zA-Z0-9-_]+$/.test(value))
          .sort((value) => -value.length)[0]
      const aliases = trimmedNames.filter((value) => value !== name)

      if (!arg.args?.length) {
        options.push({
          names: [name, ...aliases],
          argName: name,
          type: 'boolean',
          description: arg.help_text ?? '',
        })
        continue
      }

      const withSuffix = arg.args.length > 1
      const aliasesSuffixed = withSuffix
        ? aliases.map((value) => `${value}-${name}`)
        : aliases

      for (const argInfo of arg.args) {
        const argName = argInfo?.name ?? name
        const argType = ctx.$.argTypeMap[argInfo?.value] ?? 'string'
        const nameSuffixed = withSuffix ? `${name}-${paramCase(argName)}` : name
        options.push({
          names: [nameSuffixed, ...aliasesSuffixed],
          argName,
          type: argType,
          description: arg.help_text ?? '',
        })
      }
    }

    return options
  }

  ctx.$.applyOptionEffects = async (_session, options, info) => {
    const parserOptions = info.params_type.args_type?.parser_options
    if (!parserOptions) return options

    const nextOptions = { ...options }
    for (const option of parserOptions) {
      const optionName = option.names
        .map((value) => value.replace(/^-+/, ''))
        .find((value) => value in nextOptions)
      if (!optionName || nextOptions[optionName] !== true) continue

      const { action, dest } = option
      if (!action || !dest) continue

      switch (action.type) {
        case ActType.STORE:
          nextOptions[dest] = action.value
          break
        case ActType.APPEND:
          nextOptions[dest] = (nextOptions[dest] ?? []).concat(action.value)
          break
        case ActType.COUNT:
          nextOptions[dest] = (nextOptions[dest] ?? 0) + 1
          break
      }

      delete nextOptions[optionName]
    }

    return nextOptions
  }

  ctx.$.resolveArgs = async (session, args) => {
    if (!session.userId) {
      throw new TypeError('userId not found in session')
    }

    const senderUserId = session.userId
    const imageInfos: ImageFetchInfo[] = []
    const texts: string[] = []
    const names: string[] = []
    const quotedSrcs = new Set<string>()

    if (session.quote?.elements) {
      const visitQuote = (element: h) => {
        if (element.children.length) {
          for (const child of element.children) visitQuote(child)
        }
        if (element.type === 'img') {
          const src = element.attrs.src
          if (src && !quotedSrcs.has(src)) {
            imageInfos.push({ kind: 'image', src, source: 'quote' })
            quotedSrcs.add(src)
          }
        }
      }
      for (const child of session.quote.elements) visitQuote(child)
    }

    const textBuffer: string[] = []
    const resolveBuffer = () => {
      if (!textBuffer.length) return
      const bufferTexts = splitArgString(textBuffer.join('')).filter((value) => {
        if (value === '自己' || value === '@自己') {
          imageInfos.push({ kind: 'user', userId: senderUserId, source: 'self' })
          return false
        }
        if (value.startsWith('@')) {
          imageInfos.push({
            kind: 'user',
            userId: value.slice(1),
            source: 'mention',
          })
          return false
        }
        if (value.startsWith('#')) {
          names.push(value.slice(1))
          return false
        }
        return true
      })
      textBuffer.length = 0
      texts.push(...bufferTexts)
    }

    const visit = (element: h) => {
      if (element.children.length) {
        for (const child of element.children) visit(child)
      }

      if (element.type === 'text') {
        const content = element.attrs.content
        if (content) textBuffer.push(content)
        return
      }

      resolveBuffer()

      switch (element.type) {
        case 'img': {
          const src = element.attrs.src
          if (src && !quotedSrcs.has(src)) {
            imageInfos.push({ kind: 'image', src, source: 'image' })
          }
          break
        }
        case 'at': {
          const userId = element.attrs.id
          if (userId) {
            imageInfos.push({ kind: 'user', userId, source: 'mention' })
          }
          break
        }
      }
    }

    for (const child of args) visit(child)
    resolveBuffer()

    let effectiveSenderUserId = senderUserId
    const protectedTargetUserId =
      config.enableProtectedTargetSwap && config.protectedTargetUserId
        ? config.protectedTargetUserId.trim()
        : ''

    if (
      protectedTargetUserId &&
      imageInfos.some((info) => info.kind === 'user' && info.userId === protectedTargetUserId)
    ) {
      effectiveSenderUserId = protectedTargetUserId
      for (const info of imageInfos) {
        if (info.kind !== 'user') continue
        if (info.userId === senderUserId) {
          info.userId = protectedTargetUserId
        } else if (info.userId === protectedTargetUserId) {
          info.userId = senderUserId
        }
      }
    }

    return { imageInfos, texts, names, effectiveSenderUserId }
  }

  ctx.$.resolveImagesAndInfos = async (session, imageInfos, existingNames) => {
    const imageInfoKeys = imageInfos.map((value) => JSON.stringify(value))
    const imageMap: Record<string, Blob> = {}
    const userInfoMap: Record<string, UserInfo> = {}

    const tasks = [...new Set(imageInfoKeys)].map(async (key) => {
      const index = imageInfoKeys.indexOf(key)
      const info = imageInfos[index]

      let url: string
      let userInfo: UserInfo
      if (info.kind === 'image') {
        url = info.src
        userInfo = {}
      } else {
        ;({ url, userInfo } = await ctx.$.getInfoFromID(session, info.userId))
      }

      imageMap[key] = constructBlobFromFileResp(await ctx.http.file(url))
      userInfoMap[key] = userInfo
    })

    await Promise.all(tasks)

    const images = imageInfoKeys.map((key) => imageMap[key])
    const userInfos = imageInfoKeys.map((key) => userInfoMap[key])
    const names = [
      ...(existingNames ?? []),
      ...userInfos
        .slice(existingNames?.length ?? 0)
        .map((value) => value.name ?? session.author?.nick ?? session.username ?? ''),
    ]

    return {
      images,
      userInfos,
      names,
      imageInfos: imageInfos.slice(),
      explicitNameCount: existingNames?.length ?? 0,
    }
  }

  ctx.$.checkAndCountToGenerate = async (session) => {
    ;(session.memesApi ??= {}).inGenerateSubCommand = true
    const fatherRet = await session.execute('meme.generate', true)
    delete session.memesApi.inGenerateSubCommand
    return fatherRet.length ? fatherRet : undefined
  }

  ctx.$.uploadImgAndRenderMeme = async (meme, texts, uploadInfo, options) => {
    const args = {
      user_infos: uploadInfo.userInfos.map((userInfo, index) => ({
        ...userInfo,
        name: uploadInfo.names[index] ?? userInfo.name,
      })),
      ...(options ?? {}),
    }

    return ctx.$.api.renderMeme(meme.key, {
      texts,
      images: uploadInfo.images,
      args,
    })
  }

  ctx.$.applyProtectedImageSwap = async (
    session,
    uploadInfo,
    effectiveSenderUserId,
    commandType,
  ) => {
    if (!config.enableProtectedImageSwap || !protectedImageMd5Set.size) {
      return uploadInfo
    }

    const matchedIndexes: number[] = []
    for (let index = 0; index < uploadInfo.imageInfos.length; index += 1) {
      const imageInfo = uploadInfo.imageInfos[index]
      if (imageInfo.kind !== 'image') continue

      try {
        const md5 = normalizeMd5(await computeBlobMd5(uploadInfo.images[index]))
        if (protectedImageMd5Set.has(md5)) {
          matchedIndexes.push(index)
        }
      } catch (e) {
        ctx.logger.warn('Failed to compute image md5 for protected image check')
        ctx.logger.warn(e)
      }
    }

    if (!matchedIndexes.length) return uploadInfo

    let senderUploadInfo: ImagesAndInfos
    try {
      senderUploadInfo = await ctx.$.resolveImagesAndInfos(session, [
        { kind: 'user', userId: effectiveSenderUserId, source: 'auto' },
      ])
    } catch (e) {
      ctx.logger.warn('Failed to resolve sender avatar for protected image swap')
      ctx.logger.warn(e)
      return uploadInfo
    }

    const images = uploadInfo.images.slice()
    const userInfos = uploadInfo.userInfos.map((value) => ({ ...value }))
    const names = uploadInfo.names.slice()
    const senderImage = senderUploadInfo.images[0]
    const senderUserInfo = senderUploadInfo.userInfos[0]
    const senderName = senderUploadInfo.names[0]

    for (const index of matchedIndexes) {
      images[index] = senderImage
      userInfos[index] = { ...senderUserInfo, name: senderName }
      if (index >= uploadInfo.explicitNameCount) {
        names[index] = senderName
      }
    }

    ctx.logger.debug(
      `Protected image swap triggered in ${commandType}, matched ${matchedIndexes.length} images at indexes [${matchedIndexes.join(', ')}], effective sender ${effectiveSenderUserId}`,
    )

    return {
      ...uploadInfo,
      images,
      userInfos,
      names,
    }
  }

  const registerGenerateOptions = (cmd: Command, info: MemeInfoResponse) => {
    const args = info.params_type.args_type
    if (!args) return cmd

    for (const option of ctx.$.transformToKoishiOptions(args)) {
      const [name, ...aliases] = option.names
      cmd.option(name, `[${option.argName}:${option.type}] ${option.description}`, {
        aliases,
      })
    }

    return cmd
  }

  const registerGenerateCmd = (meme: MemeInfoResponse) => {
    const subCmd = cmdGenerate.subcommand(`.${meme.key} [args:el]`, {
      strictOptions: true,
      hidden: true,
    })

    registerGenerateOptions(subCmd, meme)

    return subCmd.action(async ({ session, options }, args) => {
      if (!session || !session.userId) return

      if (config.generateSubCommandCountToFather) {
        const msg = await ctx.$.checkAndCountToGenerate(session)
        if (msg) return msg
      }

      if (options) {
        options = await ctx.$.applyOptionEffects(session, options, meme)
      }

      let resolvedArgs: ResolvedArgs
      try {
        resolvedArgs = await ctx.$.resolveArgs(session, args ?? [])
      } catch (e) {
        return ctx.$.handleResolveArgsError(session, e)
      }

      const { imageInfos, texts, names, effectiveSenderUserId } = resolvedArgs
      const {
        min_images: minImages,
        max_images: maxImages,
        min_texts: minTexts,
        max_texts: maxTexts,
        default_texts: defaultTexts,
      } = meme.params_type

      const autoUseAvatar =
        (config.autoUseSenderAvatarWhenOnlyOne && !imageInfos.length && minImages === 1) ||
        (config.autoUseSenderAvatarWhenOneLeft &&
          imageInfos.length > 0 &&
          imageInfos.length + 1 === minImages)
      if (autoUseAvatar) {
        imageInfos.unshift({ kind: 'user', userId: effectiveSenderUserId, source: 'auto' })
      }
      if (!texts.length && config.autoUseDefaultTexts) {
        texts.push(...defaultTexts)
      }

      if (!checkInRange(imageInfos.length, minImages, maxImages)) {
        return config.silentShortcut && session.memesApi.shortcut
          ? undefined
          : session.text('memes-api.errors.image-number-mismatch', [
              formatRange(minImages, maxImages),
              imageInfos.length,
            ])
      }
      if (!checkInRange(texts.length, minTexts, maxTexts)) {
        return config.silentShortcut && session.memesApi.shortcut
          ? undefined
          : session.text('memes-api.errors.text-number-mismatch', [
              formatRange(minTexts, maxTexts),
              texts.length,
            ])
      }

      let uploadInfo: ImagesAndInfos
      try {
        uploadInfo = await ctx.$.resolveImagesAndInfos(session, imageInfos, names)
        uploadInfo = await ctx.$.applyProtectedImageSwap(
          session,
          uploadInfo,
          effectiveSenderUserId,
          'generate',
        )
      } catch (e) {
        return ctx.$.handleResolveImagesAndInfosError(session, e)
      }

      let res: Blob
      try {
        res = await ctx.$.uploadImgAndRenderMeme(meme, texts, uploadInfo, options)
      } catch (e) {
        return ctx.$.handleRenderError(session, e)
      }

      return h.image(await res.arrayBuffer(), res.type)
    })
  }

  ctx.$.reRegisterGenerateCommands = async () => {
    for (const cmd of generateSubCommands) cmd.dispose()
    generateSubCommands.length = 0
    generateSubCommands.push(
      ...Object.values(ctx.$.infos).map((info) => registerGenerateCmd(info)),
    )
  }
}
