# dsh-chan-sticker-pet

蓝色大肥鱼透明视频宠物：157 个完整动作 + 1 个静态待机，500×500、30 fps。素材由用户提供，未调用 AI 视频生成、未使用上游角色素材。

<p align="center">
 <img src="preview/preview.gif">
</p>

## 安装与平台限制

需要支持 `kind: dsh` 本地视频清单的新版桌面宿主；旧安装版不能直接加载。本包供 Windows/Linux 的 VP9-alpha 透明视频播放，**不支持 macOS 透明播放**。MOV 是 ProRes 4444-alpha 编辑格式，不是 Safari/WKWebView 所需的 HEVC-with-Alpha。

在支持 GitHub 宠物导入的宿主中，使用仓库地址注册远端清单与资源 URL。导入只读取清单和配置，不下载整仓或全部视频；播放时按需加载远端 WebM：

```text
https://github.com/hairyf/dsh-chan-sticker-pet
```

如需离线本地资源，也可手工下载仓库 ZIP，解压后将包含 `pet.json` 的整个目录放入宿主的宠物目录：发行版为 `~/.dsh/pets`，调试版为 `~/.dsh.dev/pets`。两者隔离。导入后在设置中选择宠物；导入不会自动更改当前选择。更新宿主源码需要重新构建并启动对应版本，重开设置页不能更新旧二进制。

## 资产位置

- 根目录 `pet.json`、`config.jsonc` 是清单和动作映射；`preview/preview.gif` 是清单引用的动态预览。
- `webm/`：157 个 VP9-alpha 完整动作 + `待机-静态.webm`，全部为普通 Git 文件，不使用 Git LFS；仓库 ZIP / codeload 包含可播放视频。合计 70,700,294 字节，最大单文件 1,314,933 字节。
- [Release v1.0.0](https://github.com/hairyf/dsh-chan-sticker-pet/releases/tag/v1.0.0) 的 `dsh-chan-sticker-pet-mov-01-of-16.zip` 至 `dsh-chan-sticker-pet-mov-16-of-16.zip`：16 个独立 ZIP，每包小于 128 MiB，合计包含全部 158 个 ProRes 4444-alpha MOV（原文件共 1,842,714,140 字节），无重复、无需拼接。ZIP 内均为 `mov/<动作名>.mov`；下载全部包到同一目录后，在 PowerShell 执行 `Get-ChildItem -File -Filter 'dsh-chan-sticker-pet-mov-??-of-16.zip' | ForEach-Object { Expand-Archive -LiteralPath $_.FullName -DestinationPath '<宠物根目录>' -Force }`。运行宠物不需要 MOV；远端注册和按需播放不会自动下载 Release 的 MOV。
- `preview/idle.png`：取「眨眼」中性首帧；两个格式的静态待机均为该帧的 2 秒视频。待机、转向、移动、等待、抓取共用此姿态，不采样鼠标朝向。
- `catalog.json`：157 个原动作的源文件名、原时长及两种视频路径；其中 MOV 路径在下载并解压 Release 后有效。额外静态待机由配置引用。

默认宽度 400 px。宿主使用 16:9 容器、等比 contain 方形视频，画面不拉伸。工作、思考、结果、成功、错误使用完整动作，仅待机保持静止。

## 转换和校验

需要 Node.js、FFmpeg 和 ffprobe。ffprobe 与 FFmpeg 位于同一目录，或分别设置 `FFMPEG`、`FFPROBE`。转换与重做配置必须显式提供原始 GIF 目录，不保存机器绝对路径。原始 157 个 GIF 不在本仓库中；展示用 GIF 已包含。

```powershell
node ./convert.mjs convert "<原始 GIF 目录>"
node ./convert.mjs configure "<原始 GIF 目录>"
node ./convert.mjs verify
```

`convert` 可续跑全部原始 GIF 转码；`configure` 重做静态待机、预览与配置。`verify` 不需要原始 GIF，但需要先解压 Release 的 MOV：它实际解码检查两种视频的编码、500×500、帧数、原时长和透明像素，并检查方形动态 GIF、动作资源存在以及待机逐帧不动。成功时生成的本地 `validation.txt` 不提交到仓库。此校验不是 macOS 播放验证。

本流程参考 [dsh-pet](https://github.com/PC2005-cloud/dsh-pet)，未使用其动画、提示词或源视频。原表情包版权与商用许可由素材权利人决定；本仓库的发布和格式转换不声称所有权，也不授予新的许可。

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
