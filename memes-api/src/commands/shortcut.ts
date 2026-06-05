import { Context, escapeRegExp } from 'koishi'

import { Config } from '../config'
import { escapeArgs, replaceBracketVar, transformRegex } from '../utils'

declare module '../index' {
  interface MemeInternal {
    refreshShortcuts?: () => Promise<void>
  }
}

interface ShortcutInfo {
  name: string
  pattern: string
  args: string[]
  flags?: string
}

interface KeywordInfo {
  name: string
  keyword: string
}

export async function apply(ctx: Context, config: Config) {
  if (!config.enableShortcut) return

  const shortcuts: ShortcutInfo[] = []

  ctx.$.refreshShortcuts = async () => {
    const tmpKeywords: KeywordInfo[] = []
    const tmpRegexps: ShortcutInfo[] = []

    for (const name in ctx.$.infos) {
      const info = ctx.$.infos[name]
      info.keywords.forEach((keyword) => {
        tmpKeywords.push({ name, keyword })
      })
      info.shortcuts.forEach((shortcut) => {
        const { pattern, flags } = transformRegex(shortcut.key)
        tmpRegexps.push({
          name,
          pattern,
          flags,
          args: shortcut.args ?? [],
        })
      })
    }

    shortcuts.length = 0
    shortcuts.push(
      ...tmpKeywords
        .sort((a, b) => b.keyword.length - a.keyword.length)
        .map(({ name, keyword }) => ({
          name,
          pattern: `${escapeRegExp(keyword)}(?=\\s|$)`,
          args: [],
          flags: '',
        })),
      ...tmpRegexps,
    )
  }

  const resolveArgs = (args: string[], res: RegExpExecArray): string => {
    return args.map((value) => replaceBracketVar(value, res)).join(' ')
  }

  ctx.middleware(async (session, next) => {
    const { content } = session
    if (!content) return next()

    const cmdPrefixRegex = (() => {
      if (config.shortcutUsePrefix) {
        const cmdPfxCfg = session.resolve((ctx.root.config as Context.Config).prefix)
        const cmdPfx = cmdPfxCfg instanceof Array ? cmdPfxCfg : [cmdPfxCfg ?? '']
        const hasEmptyPfx = cmdPfx.includes('')
        const cmdPfxNotEmpty = cmdPfx.filter(Boolean)
        if (cmdPfxNotEmpty.length) {
          return `(?:${cmdPfxNotEmpty.map(escapeRegExp).join('|')})${hasEmptyPfx ? '?' : ''}`
        }
      }
      return ''
    })()

    for (const shortcut of shortcuts) {
      const res = new RegExp(`^${cmdPrefixRegex}${shortcut.pattern}`, shortcut.flags).exec(
        content,
      )
      if (!res) continue

      ;(session.memesApi ??= {}).shortcut = true
      return session.execute(
        `meme.generate.${shortcut.name}` +
          ` ${escapeArgs([resolveArgs(shortcut.args, res)])}` +
          ` ${content.slice(res.index + res[0].length)}`,
      )
    }

    return next()
  })
}
