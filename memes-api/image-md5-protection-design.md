# Image MD5 Protection Design

## Goal

Add an image-based protection mode similar to the existing protected target swap behavior.

When an input image matches a configured MD5 list, the plugin enters protection mode and replaces the matched image position with the sender's avatar.

This design intentionally keeps the behavior simple and predictable for the first version.

Also add a small helper command for calculating image MD5, so administrators can collect MD5 values for protected images without using external tools.

## Motivation

The current protection mechanism only works for protected user IDs.

That is effective when the protected target is referenced by `@user` or by platform user ID, but it does not cover cases where users directly upload a local image or forward an image that should be protected.

Image MD5 protection is intended to cover that gap.

## Scope

This feature should apply to:

- Directly uploaded images in command arguments
- Images contained in quoted messages
- Image inputs used by both `generate` and `random`

This feature should not apply to:

- Images resolved from `@user`
- Images resolved from `@自己`
- Images fetched from sender avatar auto-fill logic before protection is triggered

Decision:

- `@user` and `@自己` resolved avatars are explicitly excluded from MD5 protection checks in the first version.

## Basic Rule

If any input image MD5 matches a configured protected MD5 list:

1. The matched image slot is replaced with the sender avatar.
2. The original matched image is removed from that slot.
3. The command continues with normal rendering flow.

For the first version, this is defined as **replacement**, not strict two-way swap.

Reason:

- In many cases the sender avatar does not already exist in the input list.
- A true position swap becomes ambiguous when there is no existing sender-avatar slot.

## Config Proposal

Add the following config items:

```ts
enableProtectedImageSwap: boolean
protectedImageMd5List: string[]
```

Suggested defaults:

```ts
enableProtectedImageSwap = false
protectedImageMd5List = []
```

Suggested config descriptions:

- `enableProtectedImageSwap`: Enable image MD5 based protection mode.
- `protectedImageMd5List`: Protected image MD5 list. If an input image matches any item in this list, the matched slot will be replaced with the sender avatar.

## Helper Command Proposal

Add a helper command for calculating image MD5.

Suggested command shape:

```text
meme md5 [image]
```

First-version command decision:

- Command name: `meme md5`
- Alias: none

Reason:

- The command is maintenance-oriented rather than a common end-user feature.
- An explicit English subcommand is easier to keep stable.
- Avoiding aliases reduces accidental triggering and keeps the surface area small.

## Helper Command Goal

The command is intended for maintenance and configuration support.

Typical uses:

- Calculate the MD5 of a candidate protected image
- Verify why a protected image rule did or did not match
- Quickly collect MD5 values from forwarded or quoted images

This command is not a general user-facing meme feature.

## Helper Command Input Rules

For the first version:

- Accept exactly one real image input
- Support direct image input in the current message
- Support image input from quoted message content
- Do not support `@user` or `@自己` avatar resolution as MD5 input

If multiple images are provided:

- Return an error asking the user to provide exactly one image

If no image is provided:

- Return an error asking the user to attach or quote one image

Suggested first-version error texts:

- No image: `请附带或回复 1 张图片。`
- Multiple images: `只能计算 1 张图片的 MD5，请只提供 1 张图片。`
- Unsupported avatar input: `暂不支持通过 @用户 或 @自己 计算头像 MD5，请直接发送图片。`

## Helper Command Output

Return the MD5 in lowercase hexadecimal format.

Suggested minimal output:

```text
MD5: <value>
```

Optional future enhancement:

- Include a short hint that the value can be copied into `protectedImageMd5List`

## Helper Command Permission

Recommended first-version rule:

- Restrict the command to administrators or other trusted operators

Reason:

- The command is mainly for maintenance
- It does not need to be a high-frequency public command

Exact authority design can follow the existing permission style of the plugin host environment.

## Trigger Stage

The MD5 check should happen after image inputs are fully resolved, but before upload/render.

Recommended stage:

1. Parse raw arguments into image references and text arguments.
2. Apply existing protected target user ID swap logic.
3. Resolve image references into actual image blobs.
4. Compute MD5 for non-user image inputs.
5. If any MD5 matches, replace matched slot with sender avatar.
6. Continue existing validation and render flow.

Reason:

- MD5 can only be computed after the image content is available.
- This avoids mixing transport-level image fetching with raw argument parsing logic.

## Matching Strategy

For the first version:

- Only compute MD5 for inputs that originally come from image sources such as uploaded images or quoted images.
- Do not compute MD5 for user avatars resolved from `@user` or `@自己`.
- Use exact lowercase hexadecimal MD5 matching.
- Normalize configured MD5 values with trim and lowercase before comparison.

## Multi-Image Behavior

If multiple input images match the protected list:

- Replace every matched image slot with the sender avatar.

Reason:

- Handling only the first match would make the result dependent on input order.
- Replacing all matches is easier to explain and easier to test.

## Sender Avatar Source

When protection mode is triggered, the replacement avatar should use the same sender avatar resolution path already used elsewhere in the plugin.

This means:

- Use the effective sender identity after existing protected target user ID logic is applied.
- If protected target user ID swap has already changed the effective sender, use that effective sender avatar.

This keeps both protection features behaviorally consistent.

## Interaction With Existing Logic

### Protected Target User ID Swap

Recommended order:

1. Apply protected target user ID swap on parsed user-image references.
2. Resolve image blobs.
3. Apply image MD5 protection on blob-based image inputs.

Reason:

- The user ID protection works at reference level.
- The MD5 protection works at binary-content level.

### Auto Use Sender Avatar

Recommended order:

1. Parse inputs
2. Apply protected target user ID swap
3. Apply auto-fill logic when needed
4. Resolve images
5. Apply image MD5 protection

Reason:

- Auto-fill is part of existing argument completion behavior.
- MD5 protection should only inspect real image inputs, not interfere with whether the command is eligible to run.

### Random Command

The same protection rule should apply to `random`.

Reason:

- `random` also consumes user-provided image inputs.
- Different behavior between `generate` and `random` would be surprising.

### Helper Command

The helper MD5 command should follow the same image source rules as the protection feature:

- Uploaded images are supported
- Quoted images are supported
- `@user` and `@自己` resolved avatars are not supported for MD5 calculation in the first version

## Failure Handling

If image MD5 computation fails for one image:

- Recommended first-version behavior: treat it as a normal image and continue.
- Do not fail the whole command only because MD5 detection could not be completed.
- Log a warning for debugging.

Reason:

- Protection is a defensive feature.
- It should not introduce avoidable command failures for users.

## Logging

When image MD5 protection is triggered:

- Output a debug log.
- The log should include enough information to confirm that protection was triggered.
- The log should avoid printing full image content or other unnecessary sensitive payloads.

Suggested log fields:

- Command type such as `generate` or `random`
- Number of matched protected images
- Matched input indexes
- Effective sender user ID if available

If MD5 computation fails for an image:

- Output a warning log and continue normal command flow.

When the helper MD5 command is used:

- Output a debug log if needed by the existing logging style
- Avoid logging full binary payloads or remote image bodies

## Performance Considerations

The plugin already downloads or resolves image blobs before rendering, so MD5 adds extra CPU work but not necessarily extra network requests.

For the first version:

- Compute MD5 only for non-user image inputs
- Reuse already-downloaded blob data
- Do not add persistent cache unless profiling shows it is needed

## Example Scenarios

### Case 1: Single uploaded protected image

Input:

- `meme generate foo <protected-image>`

Expected behavior:

- The protected image slot is replaced with sender avatar.

### Case 2: Two images, second one is protected

Input:

- `meme generate foo <normal-image> <protected-image>`

Expected behavior:

- The second slot becomes sender avatar.
- The first slot stays unchanged.

### Case 3: Quoted image is protected

Input:

- User replies to a message containing a protected image
- User sends `foo hello`

Expected behavior:

- The quoted protected image is replaced with sender avatar.

### Case 4: `@someone` image input

Input:

- `meme generate foo @123456`

Expected behavior:

- No MD5 protection check is applied to the resolved avatar image.

### Case 5: Multiple protected images

Input:

- `meme generate foo <protected-image-a> <protected-image-b>`

Expected behavior:

- Both matched slots are replaced with sender avatar.

### Case 6: Helper command with one uploaded image

Input:

- `meme md5 <image>`

Expected behavior:

- Return the lowercase MD5 of that image.

### Case 7: Helper command with one quoted image

Input:

- User replies to a message containing one image
- User sends `meme md5`

Expected behavior:

- Return the lowercase MD5 of the quoted image.

### Case 8: Helper command with multiple images

Input:

- `meme md5 <image-a> <image-b>`

Expected behavior:

- Return an error asking for exactly one image.

### Case 9: Helper command with `@someone`

Input:

- `meme md5 @123456`

Expected behavior:

- Return an error because avatar-based input is not supported in the first version.

## Limitations

- MD5 only matches byte-identical images.
- Re-compressed, cropped, resized, or watermarked variants will not match.
- This is image-file protection, not semantic-image protection.

Because of that, this feature should be treated as a practical local rule, not a robust anti-abuse mechanism.

## Open Questions

Questions for future iteration:

1. Should a future version support strict swap semantics when sender avatar already exists in another slot?

## Recommended First-Version Decision

Implement the smallest coherent behavior:

- Exact MD5 list matching
- Only inspect uploaded or quoted images
- Replace all matched image slots with effective sender avatar
- Reuse the same rule in both `generate` and `random`
- Do not fail command on MD5 detection issues

This version is simple enough to explain, test, and maintain.
