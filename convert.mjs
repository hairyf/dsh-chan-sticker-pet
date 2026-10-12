import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const source = process.argv[3]
const ffmpeg = process.env.FFMPEG || 'ffmpeg'
const ffprobe = process.env.FFPROBE || (ffmpeg === 'ffmpeg' ? 'ffprobe' : join(dirname(ffmpeg), process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe'))
const idle = '待机-静态'
const motions = { idle, turn: idle, 'moving-left': idle, 'moving-right': idle, dragging: idle, waving: '打招呼 1', thinking: '正在思考', working: '打字(普通)', result: '记录 2', waiting: idle, running: '打字(普通)', review: '记录 2', failed: '汗', success: '加油', error: '汗' }
const formats = [
  ['webm', 'vp9', ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '24', '-deadline', 'good', '-cpu-used', '4', '-auto-alt-ref', '0']],
  ['mov', 'prores', ['-c:v', 'prores_ks', '-profile:v', '4', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', '-vendor', 'apl0']],
]

function run(exe, args, capture = false) {
  const result = spawnSync(exe, args, { stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit', maxBuffer: 32 * 1024 * 1024 })
  if (result.error) throw result.error
  assert.equal(result.status, 0, `${exe} failed: ${args.join(' ')}`)
  return result.stdout
}

function encode(args) {
  run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...args])
}

function probe(path) {
  return JSON.parse(run(ffprobe, ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', path], true))
}

function decoded(path, filter, format) {
  const decoder = path.endsWith('.webm') ? ['-c:v', 'libvpx-vp9'] : []
  return run(ffmpeg, ['-v', 'error', ...decoder, '-i', path, '-vf', filter, '-f', 'rawvideo', '-pix_fmt', format, '-'], true)
}

function configure() {
  mkdirSync(join(root, 'preview'), { recursive: true })
  const frame = join(root, 'preview', 'idle.png')
  encode(['-i', join(source, '蓝色大肥鱼_眨眼_2026-08-18-14-38-44.gif'), '-frames:v', '1', frame])
  for (const [format, , options] of formats)
    encode(['-loop', '1', '-i', frame, '-t', '2', '-r', '30', '-an', '-threads', '4', ...options, ...(format === 'webm' ? ['-lossless', '1', '-crf', '0'] : []), join(root, format, `${idle}.${format}`)])
  copyFileSync(join(source, '蓝色大肥鱼_打招呼 1_2026-08-18-14-14-29.gif'), join(root, 'preview', 'preview.gif'))
  writeFileSync(join(root, 'config.jsonc'), JSON.stringify({ motions, animationWeights: { idle: 1, turn: 0, move: 0 } }, null, 2) + '\n')
  writeFileSync(join(root, 'pet.json'), JSON.stringify({ id: 'dsh-chan-sticker-pet', kind: 'dsh', displayName: '蓝色大肥鱼贴纸', description: '完整视频动作；待机使用眨眼素材的中性首帧，不跟随鼠标转向。MOV 为编辑归档格式，非 macOS 透明播放格式。', configPath: 'config.jsonc', uriPath: 'webm', previewPath: 'preview/preview.gif', ext: { default: 'webm', mac: 'webm' }, size: 400 }, null, 2) + '\n')
}

function verify() {
  const catalog = JSON.parse(readFileSync(join(root, 'catalog.json'), 'utf8'))
  assert.equal(catalog.animations.length, 157)
  for (const animation of [...catalog.animations, { name: idle, duration: 2, webm: `webm/${idle}.webm`, mov: `mov/${idle}.mov` }]) {
    for (const [format, codec] of formats) {
      const path = join(root, animation[format])
      const media = probe(path)
      const stream = media.streams[0]
      assert.equal(stream.codec_name, codec, path)
      assert.equal(stream.width, 500, path)
      assert.equal(stream.height, 500, path)
      assert(Number(stream.nb_read_frames) > 1, path)
      assert(Math.abs(Number(media.format.duration) - animation.duration) < 0.1, `${path}: duration changed`)
      const bytes = decoded(path, 'format=rgba,alphaextract,scale=32:32', 'gray')
      assert(bytes.length >= 2048 && bytes.length % 1024 === 0, `${path}: alpha frames missing`)
      assert(bytes.some(x => x === 0) && bytes.some(x => x > 240), `${path}: transparency lost`)
    }
  }
  const config = JSON.parse(readFileSync(join(root, 'config.jsonc'), 'utf8'))
  assert.deepEqual(config.motions, motions)
  for (const name of new Set(Object.values(motions)))
    for (const [format] of formats) assert(statSync(join(root, format, `${name}.${format}`)).size > 0)
  const gif = readFileSync(join(root, 'preview', 'preview.gif'))
  assert.match(gif.subarray(0, 6).toString(), /^GIF8[79]a$/)
  assert.equal(gif.readUInt16LE(6), 500)
  assert.equal(gif.readUInt16LE(8), 500)
  const preview = probe(join(root, 'preview', 'preview.gif'))
  assert(Number(preview.streams[0].nb_read_frames) > 1)
  const raw = decoded(join(root, 'webm', `${idle}.webm`), 'format=rgba,scale=32:32', 'rgba')
  const frameBytes = 32 * 32 * 4
  assert(raw.length > frameBytes)
  for (let i = frameBytes; i < raw.length; i += frameBytes)
    assert(raw.subarray(0, frameBytes).equals(raw.subarray(i, i + frameBytes)), 'idle must remain still')
  const message = 'ok: 157 animation pairs + static idle; VP9/ProRes, 500x500, durations and decoded alpha verified; animated square GIF and identical idle frames verified. macOS HEVC-alpha playback not provided.'
  writeFileSync(join(root, 'validation.txt'), message + '\n')
  console.log(message)
}

const command = process.argv[2]
assert(['convert', 'configure', 'verify'].includes(command), 'usage: node convert.mjs convert|configure|verify [GIF directory]')
assert(command === 'verify' || source, 'convert/configure requires a GIF directory argument')
if (command === 'convert') {
  for (const [format] of formats) mkdirSync(join(root, format), { recursive: true })
  const files = readdirSync(source).filter(name => name.endsWith('.gif')).sort()
  assert.equal(files.length, 157, 'source GIF count changed')
  const animations = []
  for (const [index, name] of files.entries()) {
    const input = join(source, name)
    const info = probe(input)
    assert.equal(info.streams[0].width, 500, input)
    assert.equal(info.streams[0].height, 500, input)
    const stem = name.replace(/^蓝色大肥鱼_/, '').replace(/_2026-.*\.gif$/, '')
    console.log(`${index + 1}/${files.length}: ${stem}`)
    for (const [format, , options] of formats) {
      const output = join(root, format, `${stem}.${format}`)
      if (statSync(output, { throwIfNoEntry: false })?.size > 0) continue
      encode(['-i', input, '-vf', 'fps=30,format=rgba', '-an', '-threads', '4', ...options, output])
    }
    animations.push({ name: stem, source: name, duration: Number(info.format.duration), webm: `webm/${stem}.webm`, mov: `mov/${stem}.mov` })
  }
  writeFileSync(join(root, 'catalog.json'), JSON.stringify({ id: 'dsh-chan-sticker-pet', formats: { webm: 'VP9 alpha', mov: 'ProRes 4444 alpha (not HEVC alpha)' }, limitations: ['No true directional poses; turn and movement use static neutral idle.', 'macOS transparent playback requires separately produced HEVC-with-Alpha MOV.'], animations }, null, 2) + '\n')
}
if (command !== 'verify') configure()
verify()
