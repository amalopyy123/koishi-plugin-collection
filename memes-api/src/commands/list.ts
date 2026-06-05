import { Context, Time, h } from 'koishi'

import { Config, ListSortBy } from '../config'

export async function apply(ctx: Context, config: Config) {
  const subCmd = ctx.$.cmd.subcommand('.list')

  if (config.enableShortcut) {
    subCmd.alias('表情包制作').alias('表情列表').alias('头像表情包').alias('文字表情包')
  }

  subCmd.action(async ({ session }) => {
    if (!session) return

    const nowTimestamp = Date.now()
    const timeDeltaMs = config.listNewTimeDelta * Time.day

    let infos = Object.values(ctx.$.infos)
    switch (config.listSortBy) {
      case ListSortBy.Key:
        infos = infos.sort((a, b) => a.key.localeCompare(b.key))
        break
      case ListSortBy.Keywords:
        infos = infos.sort((a, b) =>
          (a.keywords[0] ?? a.key).localeCompare(b.keywords[0] ?? b.key),
        )
        break
      case ListSortBy.DateCreated:
        infos = infos.sort(
          (a, b) =>
            new Date(a.date_created).getTime() - new Date(b.date_created).getTime(),
        )
        break
      case ListSortBy.DateModified:
        infos = infos.sort(
          (a, b) =>
            new Date(a.date_modified).getTime() - new Date(b.date_modified).getTime(),
        )
        break
      case ListSortBy.Type:
        infos = infos.sort(
          (a, b) =>
            Number(a.params_type.max_images > 0) - Number(b.params_type.max_images > 0),
        )
        break
      case ListSortBy.Default:
      default:
        break
    }

    if (config.listSortReverse) infos.reverse()

    const memeList = infos.map((info) => {
      const labels: ('new' | 'hot')[] = []
      const compareTimestamp = new Date(info.date_created).getTime()
      if (nowTimestamp - compareTimestamp <= timeDeltaMs) {
        labels.push('new')
      }
      return {
        meme_key: info.key,
        disabled: false,
        labels,
      }
    })

    let imgBlob: Blob
    try {
      imgBlob = await ctx.$.api.renderList({
        meme_list: memeList,
        text_template: config.listTextTemplate,
        add_category_icon: config.listAddCategoryIcon,
      })
    } catch (e) {
      return ctx.$.handleError(session, e)
    }

    const msgParams = [h.image(await imgBlob.arrayBuffer(), imgBlob.type)]
    return config.enableShortcut
      ? session.i18n('memes-api.list.tip', msgParams)
      : session.i18n('memes-api.list.tip-no-shortcut', msgParams)
  })
}
