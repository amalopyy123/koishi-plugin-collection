import { Context } from 'koishi'
import { MemeInfoResponse } from 'meme-generator-api'

import { Config } from '../config'

declare module '../index' {
  interface MemeInternal {
    apiVersion: string
    infos: Record<string, MemeInfoResponse>
    updateInfos: (progressCallback?: (now: number, total: number) => void) => Promise<void>
    findMeme: (query: string) => MemeInfoResponse | undefined
  }
}

export async function apply(ctx: Context, config: Config) {
  ctx.$.infos = {}
  ctx.$.apiVersion = '0.1.0'

  ctx.$.updateInfos = async (progressCallback) => {
    const keys = await ctx.$.api.getKeys()
    const total = keys.length
    progressCallback?.(0, total)

    const { default: pLimit } = await import('p-limit')
    const limit = pLimit(config.getInfoConcurrency)

    let completed = 0
    const entries = await Promise.all(
      keys.map((key) =>
        limit(async () => {
          const info = await ctx.$.api.getInfo(key)
          completed += 1
          progressCallback?.(completed, total)
          return [key, info] as const
        }),
      ),
    )

    for (const key in ctx.$.infos) delete ctx.$.infos[key]
    Object.assign(ctx.$.infos, Object.fromEntries(entries))
  }

  ctx.$.findMeme = (query) => {
    query = query.trim()
    if (query in ctx.$.infos) return ctx.$.infos[query]

    const lowered = query.toLowerCase()
    for (const info of Object.values(ctx.$.infos)) {
      for (const keyword of info.keywords) {
        if (keyword.toLowerCase() === lowered) return info
      }
      for (const tag of info.tags) {
        if (tag.toLowerCase() === lowered) return info
      }
      for (const shortcut of info.shortcuts) {
        const candidate = (shortcut.humanized ?? shortcut.key).toLowerCase()
        if (candidate === lowered) return info
      }
    }
  }
}
