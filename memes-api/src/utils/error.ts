import { Context, Session, h } from 'koishi'
import { MemeError } from 'meme-generator-api'

import { Config } from '../config'
import { ArgSyntaxError } from './arg-parse'
import { GetAvatarFailedError } from './user-info'

declare module '../index' {
  interface MemeInternal {
    handleResolveArgsError: (session: Session, e: unknown) => h.Fragment | undefined
    handleResolveImagesAndInfosError: (
      session: Session,
      e: unknown,
    ) => h.Fragment | undefined
    handleRenderError: (session: Session, e: unknown) => h.Fragment | undefined
    handleError: (session: Session, e: unknown) => h.Fragment | undefined
  }
}

export async function apply(ctx: Context, config: Config) {
  ctx.$.handleResolveArgsError = (session, e) => {
    if (!(e instanceof ArgSyntaxError)) throw e
    ctx.logger.warn(e.message)
    return config.silentShortcut && session.memesApi.shortcut
      ? undefined
      : session.text(ArgSyntaxError.getI18NKey(e), e)
  }

  ctx.$.handleResolveImagesAndInfosError = (session, e) => {
    if (e instanceof GetAvatarFailedError) {
      return config.silentShortcut && session.memesApi.shortcut && config.moreSilent
        ? undefined
        : session.text('memes-api.errors.can-not-get-avatar', e)
    }
    ctx.logger.warn(e)
    return config.silentShortcut && session.memesApi.shortcut && config.moreSilent
      ? undefined
      : session.text('memes-api.errors.download-image-failed')
  }

  ctx.$.handleRenderError = (session, e) => {
    if (!(e instanceof MemeError) || !e.type) throw e
    ctx.logger.warn(e)
    const memeError = e
    const shouldSilence =
      config.silentShortcut &&
      session.memesApi.shortcut &&
      (config.moreSilent ||
        ['image-number-mismatch', 'text-number-mismatch', 'arg-mismatch'].includes(
          memeError.type,
        ))
    return shouldSilence ? undefined : memeError.memeMessage
  }

  ctx.$.handleError = (session, e) => {
    ctx.logger.warn(e)
    if (e instanceof ArgSyntaxError) {
      return session.text(ArgSyntaxError.getI18NKey(e), e)
    }
    if (e instanceof MemeError) {
      const memeError = e
      return memeError.type
        ? memeError.memeMessage
        : session.text('memes-api.errors.other-error', [memeError.message])
    }
    throw e
  }
}
