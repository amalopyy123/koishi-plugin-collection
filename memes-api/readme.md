# koishi-plugin-gouqi-memes-api-custom

基于 Python 版 `meme` 后端的 Koishi 表情包插件自定义分支。

这个分支在上游 `koishi-plugin-memes-api` 的基础上，保留了常用的表情生成、列表、详情、随机表情和快捷触发能力，并增加了一些更偏本地使用的定制功能。

## Features

- Support Python `meme` backend
- Support meme list, meme info, meme preview, meme generate, and random meme
- Support keyword shortcut trigger
- Support auto fill sender avatar in some image-missing cases
- Support auto fill default texts
- Support protected target user ID swap
- Support protected image MD5 replacement
- Support `meme md5` helper command for calculating image MD5

## Backend Requirement

This plugin is intended for the Python version of the `meme` backend, not `meme-generator-rs`.

Default backend endpoint:

```text
http://127.0.0.1:2233
```

You need to deploy and run the Python version of the `meme` backend first, then point this plugin to the correct backend address if needed.

## Commands

Main commands:

- `meme list`
- `meme info <keyword>`
- `meme generate <keyword> [...images/texts]`
- `meme random [...images/texts]`
- `meme md5 [image]`

If shortcut mode is enabled, some memes can also be triggered directly by keyword without explicitly typing `meme generate`.

## Examples

```text
meme list
meme info 5000兆
meme generate 5000兆 我去 洛天依
meme generate rua @自己
meme random
```

MD5 helper examples:

```text
meme md5
```

Usage notes:

- You can reply to a message containing an image, then send `meme md5`
- You can send one image together with `meme md5`
- First version does not support calculating avatar MD5 from `@用户` or `@自己`

## Custom Behavior In This Fork

Compared with a plain upstream setup, this fork mainly adds or keeps the following custom behavior:

### Auto Fill Behavior

- Auto use default texts when the user does not provide texts
- Auto use sender avatar when the meme needs one image and the user does not provide one
- Auto use sender avatar when only one required image is still missing

### Protected Target Swap

When `enableProtectedTargetSwap` is enabled and the input mentions a protected user ID, the plugin swaps the sender and protected target positions in the current generation flow.

### Protected Image MD5 Replacement

When `enableProtectedImageSwap` is enabled and an input image MD5 matches `protectedImageMd5List`:

- The matched image slot is replaced with the sender avatar
- All matched image slots are replaced, not only the first one
- `@用户` and `@自己` resolved avatars are not checked by MD5 in the first version
- The plugin outputs a debug log when protection is triggered

This rule applies to both `meme generate` and `meme random`.

### MD5 Helper Command

`meme md5` is a maintenance helper command for administrators.

It is intended for:

- Collecting MD5 values for protected images
- Verifying whether an image matches the configured MD5 list
- Troubleshooting why image protection did or did not trigger

First-version rules:

- Only one real image is allowed each time
- Supports direct image input
- Supports quoted image input
- Does not support `@用户` or `@自己` avatar input

## Config

Important config items:

- `requestConfig.endpoint`: backend endpoint
- `getInfoConcurrency`: fetch meme info concurrency at startup
- `enableShortcut`: enable keyword shortcut trigger
- `shortcutUsePrefix`: whether shortcut trigger requires command prefix
- `autoUseDefaultTexts`: auto fill default texts
- `autoUseSenderAvatarWhenOnlyOne`: auto fill sender avatar when only one image is required
- `autoUseSenderAvatarWhenOneLeft`: auto fill sender avatar when one required image is still missing
- `enableProtectedTargetSwap`: enable protected target swap
- `protectedTargetUserId`: protected target user ID
- `enableProtectedImageSwap`: enable image MD5 protection
- `protectedImageMd5List`: protected image MD5 list

Typical example:

```yaml
plugins:
  gouqi-memes-api-custom:
    requestConfig:
      endpoint: http://127.0.0.1:2233
    getInfoConcurrency: 8
    enableShortcut: true
    shortcutUsePrefix: true
    autoUseDefaultTexts: true
    autoUseSenderAvatarWhenOnlyOne: true
    autoUseSenderAvatarWhenOneLeft: true
    enableProtectedTargetSwap: false
    protectedTargetUserId: ""
    enableProtectedImageSwap: true
    protectedImageMd5List:
      - d41d8cd98f00b204e9800998ecf8427e
      - 5d41402abc4b2a76b9719d911017c592
```

If you want to collect protected image MD5 values first:

1. Reply to an image and send `meme md5`
2. Copy the returned MD5 value
3. Add it to `protectedImageMd5List`

## Notes

- Image MD5 matching is exact matching on binary content
- If an image is recompressed, cropped, resized, or otherwise modified, its MD5 may change
- This means image protection is useful as a local practical rule, but it is not a robust anti-abuse mechanism

## Related File

Detailed design notes for the MD5 protection feature:

- [image-md5-protection-design.md](./image-md5-protection-design.md)
