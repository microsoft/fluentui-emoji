# build_proof.py

"""
Builds proof (test) HTML & text files from asset & generated font data.
"""

import argparse
from io import StringIO
import json
from pathlib import Path
from string import Template
import re

from fontTools.ttLib import TTFont

from utils import groups, get_popular

ap = argparse.ArgumentParser()
ap.add_argument("assets",
                type=Path)

mxg = ap.add_mutually_exclusive_group()
mxg.add_argument("--group",
                 choices=groups,
                 action='append',
                 default=[],
                 )
mxg.add_argument("--popular",
                 type=int)

# TODO: add args for collecting font files instead of hard-coding
# TODO: add args for specifying output html & text filenames/paths
opts = ap.parse_args()

if bool(opts.popular):
    opts.popular = get_popular(opts.popular)
elif opts.group == []:
    opts.group = groups

lines = set()

chr_to_label_map = {}

for mdp in opts.assets.rglob("**/metadata.json"):
    with open(mdp) as mdf:
        md = json.load(mdf)

    if opts.popular:
        if md['cldr'] not in opts.popular:
            continue
    elif md['group'] not in opts.group:
        continue

    sks = md.get('unicodeSkintones')
    if sks:
        for sk in sks:
            ucs = "".join([chr(int(uc, 16)) for uc in sk.split(" ")])
            lines.add(ucs)
            lbl = "U+" + " ".join([c.upper() for c in sk.split(" ")])
            chr_to_label_map[ucs] = (mdp.parent.name, lbl)
    else:
        ucf = md.get('unicode')
        ucs = "".join([chr(int(uc, 16)) for uc in ucf.split(" ")])
        lines.add(ucs)
        lbl = "U+" + " ".join([c.upper() for c in ucf.split(" ")])
        chr_to_label_map[ucs] = (mdp.parent.name, lbl)

txt = open("proof.txt", 'w')
sl = sorted(lines)
txt.write("\n".join(sl))
txt.close()

tmpl = Template("""<html>
    <head>
        <meta charset="utf8" />
        <title>Emoji Proof</title>
        <style>
            @font-face {
                font-family: flemjcolor;
                src: url("font_color.woff2") format("woff2");
            }
            @font-face {
                font-family: flemjflat;
                src: url("font_flat.woff2") format("woff2");
            }
            @font-face {
                font-family: flemjhc;
                src: url("font_hc.woff2") format("woff2");
            }
            body {
                font-size: 200px;
            }
            .ec {
                font-family: flemjcolor;
            }
            .ef {
                font-family: flemjflat;
            }
            .eh {
                font-family: flemjhc;
            }
            .lbl {
                font-family: sans-serif;
                font-size: 12px;
            }
        </style>
    </head>
    <body>
$emoji
    </body>
</html>
""")

emoji_html = StringIO()
no_fp = re.compile(r'[\U0001F3FB-\U0001F3FF]')
for line in sl:
    has_fp = no_fp.search(line)
    lbl_full = chr_to_label_map[line]
    emoji_html.write(f'        <div><span class="ec">{line}</span>'
                     f'<span class="ef">{line}</span>'
                     f'<span class="eh">{"" if has_fp else line}</span>'
                     f'<span class="lbl">{lbl_full[0]} ({lbl_full[1]})</span>'
                     '</div>\n')

html = open("proof.html", 'w')
html.write(tmpl.substitute(emoji=emoji_html.getvalue()))
html.close

# make woffs
font = TTFont("font_color.otf")
font.flavor = 'woff2'
font.save("font_color.woff2")

font = TTFont("font_flat.otf")
font.flavor = 'woff2'
font.save("font_flat.woff2")

font = TTFont("font_hc.otf")
font.flavor = 'woff2'
font.save("font_hc.woff2")
