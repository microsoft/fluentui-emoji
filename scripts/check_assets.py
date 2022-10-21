# check_assets.py

"""
Performs several checks on asset folder contents including:
 - metadata content
 - folder content
"""

import argparse
import json
from pathlib import Path
import sys
from utils import styles

SK_FOLDERS = {'Default',
              'Light',
              'Medium-Light',
              'Medium',
              'Medium-Dark',
              'Dark'}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("assets",
                    help="Path to asset root folder",
                    type=Path)
    opts = ap.parse_args()

    errors = False

    for jp in opts.assets.rglob("**/metadata.json"):
        folder = jp.parent
        with open(jp, 'r') as jf:
            md = json.load(jf)

        uc = md.get('unicode')
        ucbase = uc.split(" ")[0]
        sks = md.get('unicodeSkintones')

        if sks is not None:
            # check unicode base at start of sk seq
            for sk in sks:
                if not sk.startswith(ucbase):
                    errors = True
                    print(f"{folder.name} metadata: unicodeSkintone {sk} doesn't start with {ucbase}")  # noqa: E501
            # check that all Skintone folders exist and contain styles
            for fldr in SK_FOLDERS:
                if (folder / fldr).exists():
                    for st in styles:
                        if st == "High Contrast" and fldr != "Default":
                            continue
                        if not (folder / fldr / st).exists():
                            errors = True
                            print(f"{folder.name}: missing {fldr}/{st} style folder")  # noqa: E501
                else:
                    errors = True
                    print(f"{folder.name}: missing {fldr} skintone folder")
        else:
            # ensure skintone folders DO NOT exist
            for fldr in SK_FOLDERS:
                if (folder / fldr).exists():
                    errors = True
                    print(f"{folder.name}: unexpected {fldr} skintone folder present")  # noqa: E501
            # ensure style folders are present
            for st in styles:
                if not (folder / st).exists():
                    errors = True
                    print(f"{folder.name}: missing {st} style folder")

    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
