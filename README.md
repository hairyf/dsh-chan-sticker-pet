# Maid DeepSeek Sticker

157 个透明贴纸动作 + 静态待机，500×500、30 fps。单击随机播放全部 157 个动作，工作事件使用对应动作池。

<p align="center">
 <img src="preview/preview.gif">
</p>

在支持 GitHub 视频宠物导入的 DSH 宿主中导入：

```text
https://github.com/hairyf/dsh-pet-sticker
```

Windows/Linux 使用 VP9-alpha `webm/`；macOS 使用 HEVC-alpha `mov/`。手动运行 `build-mov`，校验全部 158 个视频后直接提交到仓库并启用 macOS 清单，不发布 Release 或 artifact。首次成功前，清单仍使用 WebM，macOS 不支持透明播放。旧 Release 的 ProRes 仅为编辑素材，不能替代 HEVC-alpha。

转换与检查（Node.js、FFmpeg/ffprobe）：

```sh
node convert.mjs convert "原始 GIF 目录"
node convert.mjs configure "原始 GIF 目录"
node convert.mjs verify
python3 scripts/build-mov.py self-check
```

转换只写 WebM，不覆盖 HEVC MOV；原始 GIF 不入库。`verify` 检查 WebM 解码透明度及启用的 MOV 编码信息；MOV 全帧透明度由 CI 使用原生 AVFoundation 验证。待机、移动和转向共用静态姿态，不跟随鼠标朝向。

编码参考 [dsh-pet-mov](https://github.com/dsh-tauri/dsh-pet-mov)，复用 [dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 固定提交的 Swift 编码器；未使用其角色素材。贴纸版权与商用许可归原素材权利人。
