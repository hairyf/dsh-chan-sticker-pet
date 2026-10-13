# Maid DeepSeek Sticker

157 个透明贴纸动作 + 透明待机动画，500×500、30 fps。单击随机播放全部 157 个动作，工作事件使用对应动作池。

<p align="center">
 <img src="preview/preview.gif">
</p>

在支持 GitHub 视频宠物导入的 DSH 宿主（[DSH Tauri](https://github.com/dsh-tauri/deepseek-harness-desktop)）中导入：

```text
https://github.com/hairyf/dsh-pet-sticker
```

Windows/Linux 使用 VP9-alpha `webm/`；macOS 使用 HEVC-alpha `mov/`。手动运行 `build-mov`，`animations` 填 `[]` 重建全部 158 个视频，填 `["待机-静态"]` 只重建待机 MOV。增量模式要求仓库已启用 MOV 且其余文件齐全；所选视频通过原生透明度验证后直接提交到仓库，不发布 Release 或 artifact。旧 Release 的 ProRes 仅为编辑素材，不能替代 HEVC-alpha。

工作状态沿用 [上游配置](https://github.com/PC2005-cloud/dsh-pet/blob/main/dsh-pet/assets/config.jsonc) 的六档顺序：思考、工作、结果、等待、完成、失败。完成只播放庆祝、加油、点赞、10 分；“一切都好 1/2/3”归入情绪类，仍可点击播放。

原时长不足 1 秒的 59 个短循环已用 FFmpeg `-stream_loop 2 -c copy` 无损合成三个完整周期并覆盖同名 WebM（例如“摇可乐”从 0.233 秒延长至 0.699 秒）；RGBA 解码逐周期一致，未重编码，保留透明度。对应 MOV 通过现有增量构建生成。

转换与检查（Node.js、FFmpeg/ffprobe）：

```sh
node convert.mjs convert "原始 GIF 目录"
node convert.mjs configure "原始 GIF 目录"
node convert.mjs verify
python3 scripts/build-mov.py self-check
```

转换只写 WebM，不覆盖 HEVC MOV；原始 GIF 不入库。`configure` 保留现有待机 WebM。`verify` 检查 WebM 解码透明度及启用的 MOV 编码信息；MOV 全帧透明度由 CI 使用原生 AVFoundation 验证。待机、移动和转向共用待机动画，不跟随鼠标朝向。待机源为 `idle_transparent_silent.webm`，已统一为 500×500、30 fps，约 10 秒、无音轨；沿用 `待机-静态` 文件名以保持动作引用兼容。

编码参考 [dsh-pet-mov](https://github.com/dsh-tauri/dsh-pet-mov)，复用 [dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 固定提交的 Swift 编码器；未使用其角色素材。贴纸版权与商用许可归原素材权利人。
