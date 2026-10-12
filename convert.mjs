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
const formats = [
  ['webm', 'vp9', ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '24', '-deadline', 'good', '-cpu-used', '4', '-auto-alt-ref', '0']],
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
  const pet = JSON.parse(readFileSync(join(root, 'pet.json'), 'utf8'))
  writeFileSync(join(root, 'pet.json'), JSON.stringify({ ...pet, displayName: 'Maid DeepSeek Sticker', description: '157 个贴纸动作与静态待机。' }, null, 2) + '\n')
}

function verify() {
  const files = readdirSync(join(root, 'webm')).filter(name => name.endsWith('.webm'))
  assert.equal(files.length, 158)
  for (const name of files) {
    for (const [format, codec] of formats) {
      const path = join(root, format, name)
      const media = probe(path)
      const stream = media.streams[0]
      assert.equal(stream.codec_name, codec, path)
      assert.equal(stream.width, 500, path)
      assert.equal(stream.height, 500, path)
      assert(Number(stream.nb_read_frames) > 1, path)
      assert(Number(media.format.duration) > 0, `${path}: duration missing`)
      const bytes = decoded(path, 'format=rgba,alphaextract,scale=32:32', 'gray')
      assert(bytes.length >= 2048 && bytes.length % 1024 === 0, `${path}: alpha frames missing`)
      assert(bytes.some(x => x === 0) && bytes.some(x => x > 240), `${path}: transparency lost`)
    }
  }
  const config = JSON.parse(readFileSync(join(root, 'config.jsonc'), 'utf8'))
  for (const key of ['idle', 'turn', 'moving-left', 'moving-right', 'dragging', 'waiting'])
    assert.equal(config.motions[key], idle, `${key} must remain static`)
  const animations = config.animations || {}
  const values = [...Object.values(config.motions || {}), ...Object.values(animations.motions || {}), ...['idle', 'turn', 'drag', 'clicks'].filter(key => key in animations).map(key => animations[key]), ...Object.values(animations.events || {}), ...(animations.categories || []).map(category => category.actions), ...(animations.moves?.actions || []).map(action => action.name)]
  const names = new Set(values.flat(Infinity))
  assert([...names].every(name => typeof name === 'string'), 'animation references must be strings')
  for (const name of names)
    for (const [format] of formats) assert(statSync(join(root, format, `${name}.${format}`)).size > 0)
  assert(Array.isArray(animations.clicks), 'click animation pool is required')
  assert.equal(names.size, 158, 'all animations must be referenced')
  assert.equal(new Set(animations.clicks).size, 157, 'all original animations must be clickable')
  assert.deepEqual(config.animationWeights, { idle: 100, turn: 0, move: 0 })
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
  const pet = JSON.parse(readFileSync(join(root, 'pet.json'), 'utf8'))
  if (pet.ext.mac === 'mov') {
    assert.equal(pet.macUriPath, 'mov')
    assert.equal(readdirSync(join(root, 'mov')).filter(name => name.endsWith('.mov')).length, 158)
    for (const name of files) {
      const path = join(root, 'mov', name.replace(/\.webm$/, '.mov'))
      const media = probe(path)
      const source = probe(join(root, 'webm', name))
      assert.equal(media.streams[0].codec_name, 'hevc', path)
      assert.equal(media.streams[0].codec_tag_string, 'hvc1', path)
      assert.equal(media.streams[0].width, 500, path)
      assert.equal(media.streams[0].height, 500, path)
      assert.equal(media.streams[0].nb_read_frames, source.streams[0].nb_read_frames, path)
      assert(Math.abs(Number(media.format.duration) - Number(source.format.duration)) < 0.1, path)
    }
  }
  const message = 'ok: 158 VP9-alpha WebM; dimensions, durations, decoded alpha, animated GIF and static idle verified. Enabled MOV checked for HEVC metadata only; native decoded alpha is verified by build-mov CI.'
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
  }
}
if (command !== 'verify') configure()
verify()
