import { Context } from 'koishi'

import { Config } from '../config'
import { computeBlobMd5 } from '../utils'
import { ImageFetchInfo } from './generate'

function isRealImageInput(info: ImageFetchInfo): boolean {
  return info.kind === 'image'
}

export async function apply(ctx: Context, _config: Config) {
  const subCmd = ctx.$.cmd.subcommand('.md5 [args:el]', { authority: 3 })

  subCmd.action(async ({ session }, args) => {
    if (!session) return

    let resolvedArgs
    try {
      resolvedArgs = await ctx.$.resolveArgs(session, args ?? [])
    } catch (e) {
      return ctx.$.handleResolveArgsError(session, e)
    }

    const avatarInputs = resolvedArgs.imageInfos.filter((info) => info.kind === 'user')
    if (avatarInputs.length) {
      return session.text('memes-api.errors.md5-unsupported-avatar-input')
    }

    const realImageInputs = resolvedArgs.imageInfos.filter(isRealImageInput)
    if (!realImageInputs.length) {
      return session.text('memes-api.errors.md5-no-image')
    }
    if (realImageInputs.length > 1) {
      return session.text('memes-api.errors.md5-too-many-images')
    }

    let uploadInfo
    try {
      uploadInfo = await ctx.$.resolveImagesAndInfos(session, realImageInputs)
    } catch (e) {
      return ctx.$.handleResolveImagesAndInfosError(session, e)
    }

    try {
      const md5 = await computeBlobMd5(uploadInfo.images[0])
      return session.text('memes-api.md5.result', [md5])
    } catch (e) {
      ctx.logger.warn(e)
      return session.text('memes-api.errors.md5-compute-failed')
    }
  })
}
