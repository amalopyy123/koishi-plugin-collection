import { Command, Context } from 'koishi'

import { Config } from '../config'
import * as Generate from './generate'
import * as Info from './info'
import * as List from './list'
import * as Md5 from './md5'
import * as Random from './random'
import * as Shortcut from './shortcut'

declare module '../index' {
  interface MemeInternal {
    cmd: Command
  }
}

export async function apply(ctx: Context, config: Config) {
  ctx.$.cmd = ctx.command('meme').alias('memes').alias('memes-api')
  await Generate.apply(ctx, config)
  await Shortcut.apply(ctx, config)
  await Random.apply(ctx, config)
  await Md5.apply(ctx, config)
  await List.apply(ctx, config)
  await Info.apply(ctx, config)
}
