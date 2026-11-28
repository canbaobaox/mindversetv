"""Verify built packages and prepare the unsigned payload for the signing job."""
import hashlib
import json
from pathlib import Path
import sys

# MindVerseTV 自建清单：运行包只发我们自己的 Release；模型第二源走
# HuggingFace 官方地址（与官方权重同一份，sha 已核对）。
GITHUB_BASE = "https://github.com/canbaobaox/mindversetv/releases/download/depth-runtime-v2/"
MODEL_NAME = "video_depth_anything_vits.pth"
MODEL_SIZE = 116440756
MODEL_SHA256 = "13379300b739e659f076a59d52e9801bd8d38c541a7e71f73bbca4dcfb013609"
MODEL_HF_URL = "https://huggingface.co/depth-anything/Video-Depth-Anything-Small/resolve/main/video_depth_anything_vits.pth"


def component_urls(name):
    return [GITHUB_BASE + name]


def verify_file(root, entry):
    name = entry["name"]
    if Path(name).name != name or "/" in name or "\\" in name:
        raise ValueError("unsafe artifact name")
    path = root / name
    if path.stat().st_size != entry["size"] or entry["size"] <= 0:
        raise ValueError("artifact size mismatch")
    with path.open("rb") as source:
        digest = hashlib.file_digest(source, "sha256").hexdigest()
    if digest != entry["sha256"]:
        raise ValueError("artifact hash mismatch")
    return {"urls": component_urls(name), "size": entry["size"], "sha256": digest}


def verify_model(root, size=MODEL_SIZE, sha256=MODEL_SHA256):
    # The GitHub URL is only truthful if the model file is staged for upload:
    # dist/depth/* is what `gh release upload` publishes. Fail loudly instead
    # of shipping a manifest whose first model URL 404s.
    try:
        verify_file(root, {"name": MODEL_NAME, "size": size, "sha256": sha256})
    except FileNotFoundError:
        raise ValueError("model file missing from release staging: " + MODEL_NAME) from None


def prepare(root, cpu_only=False, model_size=MODEL_SIZE, model_sha256=MODEL_SHA256):
    runtimes = {}
    for variant in ("cpu",) if cpu_only else ("cpu", "cuda"):
        name = f"beeftv-depth-runtime-v1-windows-amd64-{variant}.zip"
        meta = json.loads((root / (name + ".json")).read_text(encoding="utf-8-sig"))
        if meta["name"] != name or not 0 < meta["files"] <= 50000 or not 0 < meta["expandedSize"] <= 12 << 30:
            raise ValueError("invalid runtime metadata")
        if meta.get("parts"):
            parts = []
            whole = hashlib.sha256()
            for index, part in enumerate(meta["parts"], 1):
                if part["name"] != f"{name}.part-{index:03d}" or part["size"] >= 2 << 30:
                    raise ValueError("invalid release part")
                parts.append(verify_file(root, part))
                with (root / part["name"]).open("rb") as source:
                    while chunk := source.read(1024 * 1024):
                        whole.update(chunk)
            if sum(p["size"] for p in parts) != meta["size"] or whole.hexdigest() != meta["sha256"]:
                raise ValueError("assembled runtime mismatch")
            artifact = {"urls": [], "size": meta["size"], "sha256": meta["sha256"], "parts": parts}
        else:
            artifact = verify_file(root, meta)
        artifact.update(files=meta["files"], expandedSize=meta["expandedSize"])
        runtimes[f"windows-amd64/{variant}"] = artifact
    verify_model(root, model_size, model_sha256)
    model_urls = [GITHUB_BASE + MODEL_NAME, MODEL_HF_URL]
    return {"version": 2, "runtimes": runtimes, "model": {
        "urls": model_urls,
        "size": model_size,
        "sha256": model_sha256,
    }}


if __name__ == "__main__":
    cpu_only = "--cpu-only" in sys.argv[3:]
    Path(sys.argv[2]).write_text(json.dumps(prepare(Path(sys.argv[1]), cpu_only=cpu_only), separators=(",", ":")), encoding="utf-8")
