import { Context, Random, h } from 'koishi'

import { Config } from '../config'
import { checkInRange, formatKeywords } from '../utils'
import { ImagesAndInfos, ResolvedArgs } from './generate'

export async function apply(ctx: Context, config: Config) {
  const subCmd = ctx.$.cmd.subcommand('.random [args:el]')

  if (config.enableShortcut) {
    subCmd.alias('随机表情')
  }

  subCmd.action(async ({ session }, args) => {
    if (!session || !session.userId) return

    if (config.randomCommandCountToGenerate) {
      const msg = await ctx.$.checkAndCountToGenerate(session)
      if (msg) return msg
    }

    let resolvedArgs: ResolvedArgs
    try {
      resolvedArgs = await ctx.$.resolveArgs(session, args ?? [])
    } catch (e) {
      return ctx.$.handleResolveArgsError(session, e)
    }

    const { imageInfos, texts, names, effectiveSenderUserId } = resolvedArgs
    const autoUse = !imageInfos.length && !texts.length
    if (autoUse) {
      imageInfos.push({ kind: 'user', userId: effectiveSenderUserId, source: 'auto' })
    }

    const suitableMemes = Object.values(ctx.$.infos).filter((info) => {
      const { min_images, max_images, min_texts, max_texts } = info.params_type
      return (
        checkInRange(imageInfos.length, min_images, max_images) &&
        (autoUse || checkInRange(texts.length, min_texts, max_texts))
      )
    })

    if (!suitableMemes.length) {
      return session.text('memes-api.random.no-suitable-meme')
    }

    let uploadInfo: ImagesAndInfos
    try {
      uploadInfo = await ctx.$.resolveImagesAndInfos(session, imageInfos, names)
      uploadInfo = await ctx.$.applyProtectedImageSwap(
        session,
        uploadInfo,
        effectiveSenderUserId,
        'random',
      )
    } catch (e) {
      return ctx.$.handleResolveImagesAndInfosError(session, e)
    }

    while (suitableMemes.length) {
      const index = Random.int(0, suitableMemes.length)
      const info = suitableMemes[index]
      suitableMemes.splice(index, 1)

      let img: Blob
      try {
        img = await ctx.$.uploadImgAndRenderMeme(
          info,
          autoUse ? info.params_type.default_texts : texts,
          uploadInfo,
        )
      } catch (e) {
        ctx.logger.warn(e)
        continue
      }

      const elements = [h.image(await img.arrayBuffer(), img.type)]
      if (config.randomMemeShowInfo) {
        elements.unshift(...session.i18n('memes-api.random.info', [formatKeywords(info.keywords)]))
      }
      return elements
    }

    return session.text('memes-api.random.no-suitable-meme')
  })
}
