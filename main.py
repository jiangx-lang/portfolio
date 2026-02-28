# -*- coding: utf-8 -*-
"""
Portfolio Matcher - 基金投资组合匹配系统
Phase 1 最后一步：批量扫描 onepage 目录下所有摩根基金 PDF，将解析结果以 JSON 形式打印到终端，供人工校验。
"""

import json
import sys
from pathlib import Path

# 控制台输出 UTF-8，避免 Windows 下中文乱码
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from fund_factory import get_parser_for_file, parse_fund_pdf


# 目标文件夹：优先使用指定绝对路径，不存在时退回到脚本所在目录的 onepage 子目录
ONEPAGE_DIR = Path(r"D:\portoflio for mrf\onepage")
if not ONEPAGE_DIR.exists():
    ONEPAGE_DIR = Path(__file__).resolve().parent / "onepage"

# 支持解析的 PDF：文件名包含以下任一关键字（摩根、百达等）
SUPPORTED_KEYWORDS = ("摩根", "百达", "jpm", "pictet")


def main() -> None:
    if not ONEPAGE_DIR.is_dir():
        print(f"错误：目标目录不存在: {ONEPAGE_DIR}")
        return

    pdf_files = list(ONEPAGE_DIR.glob("*.pdf"))
    supported_pdfs = [p for p in pdf_files if get_parser_for_file(p) is not None]

    if not supported_pdfs:
        print(f"在 {ONEPAGE_DIR} 下未找到可解析的 PDF（文件名需包含：{SUPPORTED_KEYWORDS}）。")
        print(f"当前该目录下 PDF 数量: {len(pdf_files)}")
        return

    print(f"共找到 {len(supported_pdfs)} 个可解析基金 PDF，开始批量解析……\n")
    print("=" * 60)

    success_count = 0
    for pdf_path in sorted(supported_pdfs, key=lambda p: p.name):
        try:
            data = parse_fund_pdf(pdf_path)
            success_count += 1
            # 使用 Pydantic 的 model_dump() 转成字典，再用 json.dumps 保证中文正常显示、格式易读
            json_str = json.dumps(
                data.model_dump(),
                ensure_ascii=False,
                indent=2,
            )
            print(f"\n【{data.fund_name}】 {pdf_path.name}\n")
            print(json_str)
            print("\n" + "-" * 60)
        except FileNotFoundError as e:
            print(f"\n[跳过] 文件不存在: {pdf_path.name}\n  错误: {e}\n" + "-" * 60)
        except ValueError as e:
            print(f"\n[跳过] 解析失败: {pdf_path.name}\n  错误: {e}\n" + "-" * 60)
        except Exception as e:
            print(f"\n[跳过] 未预期错误: {pdf_path.name}\n  错误: {e}\n" + "-" * 60)

    print(f"\n批量扫描结束。成功解析: {success_count}/{len(supported_pdfs)} 个文件。")


if __name__ == "__main__":
    main()
