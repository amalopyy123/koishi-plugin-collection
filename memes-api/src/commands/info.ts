import { Context, h } from 'koishi'

import { Config } from '../config'
import { formatKeywords, formatRange, listJoin } from '../utils'

export async function apply(ctx: Context, config: Config) {
  const subCmd = ctx.$.cmd.subcommand('.info <query:string>', { checkArgCount: true })

  if (config.enableShortcut) {
    subCmd.alias('表情详情').alias('表情帮助').alias('表情示例')
  }

  subCmd.action(async ({ session }, query) => {
    if (!session) return

    const info = ctx.$.findMeme(query)
    if (!info) {
      return session.text('memes-api.errors.no-such-meme', [query])
    }

    const p = info.params_type
    const msg: h[][] = [
      session.i18n('memes-api.info.key', [info.key]),
      session.i18n('memes-api.info.keywords', [formatKeywords(info.keywords)]),
    ]

    if (info.shortcuts.length) {
      msg.push(
        session.i18n('memes-api.info.shortcuts', [
          formatKeywords(info.shortcuts.map((value) => value.humanized ?? value.key)),
        ]),
      )
    }

    if (p.max_images) {
      msg.push(
        session.i18n('memes-api.info.image-num', [
          formatRange(p.min_images, p.max_images),
        ]),
      )
    }

    if (p.max_texts) {
      msg.push(
        session.i18n('memes-api.info.text-num', [
          formatRange(p.min_texts, p.max_texts),
        ]),
        session.i18n('memes-api.info.default-texts', [formatKeywords(p.default_texts)]),
      )
    }

    if (p.args_type?.parser_options) {
      const options = ctx.$.transformToKoishiOptions(p.args_type)
      if (options.length) {
        const optionInfos = options.map((value) =>
          session.i18n('memes-api.info.option', [
            `${value.names
              .map((name) => (name.length > 1 ? `--${name}` : `-${name}`))
              .join(' | ')}${value.type === 'boolean' ? '' : ` [${value.argName}: ${value.type}]`}`,
            value.description,
          ]),
        )
        msg.push(
          session.i18n('memes-api.info.options', [
            listJoin(optionInfos, [h.text('\n')]).flat(),
          ]),
        )
      }
    }

    let previewImg: Blob
    try {
      previewImg = await ctx.$.api.renderPreview(info.key)
    } catch (e) {
      return ctx.$.handleError(session, e)
    }

    msg.push(
      session.i18n('memes-api.info.preview', [
        h.image(await previewImg.arrayBuffer(), previewImg.type),
      ]),
    )

    return listJoin(msg, [h.text('\n')]).flat()
  })
}
