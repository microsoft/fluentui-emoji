# copy_assets.py

"""
Processes asset metadata.json data, copies & renames asset files for
subsequent handling with nanoemoji.
"""

import argparse
import json
from pathlib import Path
import shutil

from utils import groups, styles, get_popular

fp = {
    "1f3fb": "Light",
    "1f3fc": "Medium-Light",
    "1f3fd": "Medium",
    "1f3fe": "Medium-Dark",
    "1f3ff": "Dark",
}

skip = {
    # Various issues with metadata or files/folders
    "Handshake",  # skintone metadata broken
    "Person genie",  # skintone metadata broken
    "Troll",  # skintone metadata broken
    "Foot",  # has unicodeSkintones but no skintone files
    "Woman with bunny ears",  # does not have unicodeSkintones but has skintone files  # noqa: E501
    "Person wrestling",  # does not have unicodeSkintones but has skintone files  # noqa: E501
    "O button blood type",  # unexpected "(blood_type)" in filenames
    "Man with bunny ears",  # does not have unicodeSkintones but has skintone files  # noqa: E501
    "Person with bunny ears",  # does not have unicodeSkintones but has skintone files  # noqa: E501
    "Skier",  # does not have unicodeSkintones but has skintone files
    "Man wrestling",  # does not have unicodeSkintones but has skintone files
    "Woman wrestling",  # does not have unicodeSkintones but has skintone files
    "Playground slide",  # missing Color assets
}

skip_color = {
    # OverflowErrors from nanoemoji on Radial and Linear Gradients: during
    # conversion, gradients result in coordinates that land outside of the
    # addressable font design space.
    "Four leaf clover",  # OverflowError: PaintRadialGradient.c0[1] (141281.3530250125) is out of bounds: [-32768...32767]  # noqa: E501
    "Mosque",  # OverflowError: PaintLinearGradient.p0[1] (-12738287.5) is out of bounds: [-32768...32767]  # noqa: E501
    "Shopping bags",  # OverflowError: PaintLinearGradient.p0[0] (24512550.0) is out of bounds: [-32768...32767]  # noqa: E501
    "Person superhero",  # OverflowError: PaintRadialGradient.c0[1] (55620.33544509259) is out of bounds: [-32768...32767]  # noqa: E501
    "Woman superhero",  # OverflowError: PaintRadialGradient.c0[1] (55620.33544509259) is out of bounds: [-32768...32767]  # noqa: E501
    "Man superhero",  # OverflowError: PaintRadialGradient.c0[1] (55620.33544509259) is out of bounds: [-32768...32767]  # noqa: E501
    "Person vampire",  # OverflowError: PaintRadialGradient.c0[1] (51856.59705427739) is out of bounds: [-32768...32767]  # noqa: E501
    "Woman vampire",  # OverflowError: PaintRadialGradient.c0[1] (52465.75228787113) is out of bounds: [-32768...32767]  # noqa: E501
    "Man vampire",  # OverflowError: PaintRadialGradient.c0[1] (52465.49226755863) is out of bounds: [-32768...32767]  # noqa: E501
    "Umbrella",  # OverflowError: PaintRadialGradient.c0[1] (3183512433.8043113) is out of bounds: [-32768...32767]  # noqa: E501
    "Umbrella with rain drops",  # OverflowError: PaintRadialGradient.c0[1] (3207452659.4881115) is out of bounds: [-32768...32767]  # noqa: E501
    "Potted plant",  # OverflowError: PaintRadialGradient.c0[0] (-118957.11303242316) is out of bounds: [-32768...32767]  # noqa: E501
}

skip_3d = {
    "Pregnant person",  # missing Medium-Dark/3D asset
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("assets",
                    help="Path to root assets folder",
                    type=Path)
    ap.add_argument("--style",
                    choices=styles,
                    default="Flat",
                    )
    ap.add_argument("--svgs",
                    type=Path)
    ap.add_argument("--font-family")
    ap.add_argument("--ttf",
                    action="store_true")

    mxg = ap.add_mutually_exclusive_group()
    mxg.add_argument("--group",
                     choices=groups,
                     action='append',
                     default=[],
                     )
    mxg.add_argument("--popular",
                     type=int)

    opts = ap.parse_args()

    if bool(opts.popular):
        opts.popular = get_popular(opts.popular)
    elif opts.group == []:
        opts.group = groups

    if not opts.svgs:
        opts.svgs = opts.assets.parent / "svgs"

    if not opts.font_family:
        opts.font_family = f"Fluent UI Emoji {opts.style}"

    if opts.svgs.exists():
        shutil.rmtree(opts.svgs)
    opts.svgs.mkdir(parents=True, exist_ok=True)

    for mdp in opts.assets.rglob("**/metadata.json"):
        move_files(mdp, opts)


def get_asset_path(parent, style, fps=None):
    pr = parent.name.replace(" ", "_")
    st = style.replace(" ", "_")
    ext = "png" if style == "3D" else "svg"
    fn = f'{pr}_{st}{"_" + fps if fps else ""}.{ext}'.lower()
    if fps:
        return parent / fps / style / fn
    else:
        return parent / style / fn


def pico_unsupported(svg_path):
    with open(svg_path) as f:
        s = f.read()

    return bool("<mask" in s)


def move_files(metadata_path, opts):
    with open(metadata_path) as mf:
        metadata = json.load(mf)

    if opts.popular:
        if metadata.get('cldr') not in opts.popular:
            return
    elif metadata.get('group') not in opts.group:
        return

    parent = metadata_path.parent
    asset_name = parent.name

    if asset_name in skip:
        print(f"--> Skipping {asset_name} (metadata/file issues)")
        return

    if opts.style == "Color" and asset_name in skip_color:
        print(f"--> Skipping {asset_name} (color processing error)")
        return

    if opts.style == "3D" and asset_name in skip_3d:
        print(f"--> Skipping {asset_name} (metadata/file issues)")
        return

    sk = metadata.get('unicodeSkintones')
    uc = metadata.get('unicode')
    ext = "png" if opts.style == "3D" else "svg"
    if sk:
        for t in sk:
            if t == uc:
                fps = "Default"
            else:
                try:
                    fps = fp.get(t.split(" ")[1])
                except Exception:
                    print(parent)
                    raise
            src = get_asset_path(parent, opts.style, fps)
            if ext == "svg" and pico_unsupported(src):
                print(f"--> Skipping {src} (unsupported in picosvg)")
                continue
            dst = opts.svgs / f"emoji_u{t.replace(' ', '_')}.{ext}"
            shutil.copyfile(src, dst)

            if opts.style == "High Contrast":
                break
    else:
        src = get_asset_path(parent, opts.style)
        if ext == "svg" and pico_unsupported(src):
            print(f"--> Skipping {src} (unsupported in picosvg)")
            return
        dst = opts.svgs / f"emoji_u{uc.replace(' ', '_')}.{ext}"
        shutil.copyfile(src, dst)


if __name__ == '__main__':
    main()
