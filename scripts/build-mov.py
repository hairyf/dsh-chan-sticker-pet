import json
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[1]


def probe(path):
    result = subprocess.run([
        "ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0",
        "-show_streams", "-show_format", "-of", "json", str(path)
    ], check=True, stdout=subprocess.PIPE, text=True, encoding="utf-8", timeout=120)
    return json.loads(result.stdout)


def motion_names(config):
    def names(value):
        if isinstance(value, str):
            return {value}
        assert isinstance(value, list), "animation reference must be a string or list"
        return {name for item in value for name in names(item)}

    animations = config.get("animations", {})
    values = list(config.get("motions", {}).values()) + list(animations.get("motions", {}).values())
    values += [animations[key] for key in ("idle", "turn", "drag", "clicks") if key in animations]
    values += list(animations.get("events", {}).values())
    values += [category["actions"] for category in animations.get("categories", [])]
    values += [action["name"] for action in animations.get("moves", {}).get("actions", [])]
    return {name for value in values for name in names(value)}


def matching_sources(root):
    sources = sorted((root / "webm").glob("*.webm"))
    assert len(sources) == 158, "expected exactly 158 WebM animations"
    config = json.loads((root / "config.jsonc").read_text(encoding="utf-8"))
    assert motion_names(config) <= {path.stem for path in sources}, "configured animation missing"
    return sources


def validate_source(path, media):
    stream = media["streams"][0]
    assert stream["codec_name"] == "vp9" and (stream["width"], stream["height"]) == (500, 500), path
    assert stream["r_frame_rate"] == "30/1", path
    assert int(stream["nb_read_frames"]) > 1, path
    pixels = subprocess.run([
        "ffmpeg", "-v", "error", "-c:v", "libvpx-vp9", "-i", str(path),
        "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "-"
    ], check=True, stdout=subprocess.PIPE, timeout=120).stdout
    assert len(pixels) == 500 * 500 * 4, path
    alpha = pixels[3::4]
    all_alpha = subprocess.run([
        "ffmpeg", "-v", "error", "-c:v", "libvpx-vp9", "-i", str(path),
        "-vf", "fps=30,format=rgba,alphaextract,scale=32:32", "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "gray", "-"
    ], check=True, stdout=subprocess.PIPE, timeout=120).stdout
    assert len(all_alpha) >= 2048 and len(all_alpha) % 1024 == 0, path
    assert min(all_alpha) < 100 and max(all_alpha) > 200, f"source alpha missing: {path}"
    frames = len(all_alpha) // 1024
    assert abs(frames / 30 - float(media["format"]["duration"])) <= 1 / 30 + 0.001, f"normalized duration changed: {path}"
    return sum(alpha) / len(alpha), frames


def select_sources(sources, requested):
    assert isinstance(requested, list), "animations must be a JSON array"
    assert all(isinstance(name, str) for name in requested), "animation names must be strings"
    assert len(set(requested)) == len(requested), "duplicate animation names"
    available = {path.stem for path in sources}
    assert set(requested) <= available, "unknown animation name"
    return [path for path in sources if not requested or path.stem in requested]


def build():
    sources = matching_sources(ROOT)
    selected = select_sources(sources, json.loads(os.environ.get("ANIMATIONS", "[]")))
    output_dir = ROOT / "mov"
    output_dir.mkdir(exist_ok=True)
    if len(selected) != len(sources):
        pet = json.loads((ROOT / "pet.json").read_text(encoding="utf-8"))
        assert pet["ext"]["mac"] == "mov", "incremental build requires an enabled MOV baseline"
        for source in sources:
            if source not in selected:
                target = output_dir / (source.stem + ".mov")
                assert target.is_file() and target.stat().st_size > 0, f"missing baseline MOV: {target}"
    print(f"selected {len(selected)}/{len(sources)} animations", flush=True)
    for source in selected:
        print(f"validating {source.name}", flush=True)
        media = probe(source)
        mean, frames = validate_source(source, media)
        print(f"encoding {source.name}: packets={media['streams'][0]['nb_read_frames']}, CFR30 frames={frames}, duration={media['format']['duration']}", flush=True)
        target = output_dir / (source.stem + ".mov")
        with TemporaryDirectory(prefix="hevc-alpha-", dir=output_dir) as temporary:
            encoded = Path(temporary) / "output.mov"
            decoder = subprocess.Popen([
                "ffmpeg", "-v", "error", "-c:v", "libvpx-vp9", "-i", str(source),
                "-an", "-vf", "fps=30", "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "bgra", "-"
            ], stdout=subprocess.PIPE)
            try:
                encoder = subprocess.run([
                    os.environ["ENCODER"], str(encoded), "500", "500", "30"
                ], stdin=decoder.stdout, timeout=300)
                decoder.stdout.close()
                assert decoder.wait(timeout=30) == 0, source
                encoder.check_returncode()
            finally:
                if decoder.poll() is None:
                    decoder.kill()
                    decoder.wait()
            output = probe(encoded)
            assert output["streams"][0]["codec_name"] == "hevc", source
            assert output["streams"][0]["codec_tag_string"] == "hvc1", source
            assert output["streams"][0]["r_frame_rate"] == "30/1", source
            assert 0 < encoded.stat().st_size < 100 * 1024 * 1024, source
            subprocess.run([
                os.environ["ALPHA_VERIFIER"], str(encoded), str(frames),
                media["format"]["duration"], str(mean)
            ], check=True, timeout=300)
            encoded.replace(target)
    assert {path.stem for path in output_dir.glob("*.mov")} == {path.stem for path in sources}
    pet_path = ROOT / "pet.json"
    pet = json.loads(pet_path.read_text(encoding="utf-8"))
    pet["ext"]["mac"] = "mov"
    pet["macUriPath"] = "mov"
    pet_path.write_text(json.dumps(pet, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"ok: {len(selected)} source-matched HEVC-alpha MOV encoded and verified; 158 MOV present; macOS manifest enabled")


def self_check():
    with TemporaryDirectory() as temporary:
        root = Path(temporary)
        (root / "webm").mkdir()
        names = ["Popcat 帧", "六七(呆)"] + [f"动作 {index}" for index in range(155)]
        config = {"motions": {"idle": "待机-静态"}, "animations": {"clicks": ["Popcat 帧", "六七(呆)"], "categories": [{"name": "not-a-reference", "actions": ["六七(呆)"]}], "events": {"error": ["Popcat 帧"]}, "moves": {"actions": [{"name": "待机-静态"}]}}}
        assert motion_names(config) == {"待机-静态", "Popcat 帧", "六七(呆)"}
        (root / "config.jsonc").write_text(json.dumps(config), encoding="utf-8")
        for name in names + ["待机-静态"]:
            (root / "webm" / (name + ".webm")).touch()
        sources = matching_sources(root)
        assert len(sources) == 158
        assert select_sources(sources, []) == sources
        assert [path.stem for path in select_sources(sources, ["待机-静态"])] == ["待机-静态"]
        assert len(select_sources(sources, ["Popcat 帧", "六七(呆)"])) == 2
        for invalid in (["missing"], ["待机-静态", "待机-静态"], "待机-静态", [123]):
            try:
                select_sources(sources, invalid)
            except AssertionError:
                pass
            else:
                raise AssertionError("invalid selection accepted")
        (root / "webm" / "unexpected.webm").touch()
        try:
            matching_sources(root)
        except AssertionError:
            pass
        else:
            raise AssertionError("extra source accepted")
        (root / "webm" / "unexpected.webm").unlink()
        (root / "webm" / "Popcat 帧.webm").rename(root / "webm" / "wrong-name.webm")
        try:
            matching_sources(root)
        except AssertionError:
            pass
        else:
            raise AssertionError("missing configured source accepted")
    assert len(matching_sources(ROOT)) == 158
    print("ok: 158 sources and motion references; spaces, Chinese and parentheses; extra/missing source rejected")


if __name__ == "__main__":
    assert sys.argv[1:] in (["run"], ["self-check"]), "usage: build-mov.py run|self-check"
    if sys.argv[1] == "self-check":
        self_check()
    else:
        build()
