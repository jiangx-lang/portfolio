# -*- coding: utf-8 -*-
"""
检查：本地 .env 填入 SUPABASE_URL / SUPABASE_KEY 后是否能连上 Supabase。
在 qdii_portfolio 目录下运行：  python check_supabase_env.py
"""
from pathlib import Path

def main():
    root = Path(__file__).resolve().parent
    env_file = root / ".env"

    # 1. 是否有 .env
    if not env_file.exists():
        print("❌ 未找到 .env 文件")
        print(f"   请在 {root} 下创建 .env，并填入：")
        print("   SUPABASE_URL=https://xxxxx.supabase.co")
        print("   SUPABASE_KEY=your-anon-key")
        return

    # 2. 加载 .env
    try:
        from dotenv import load_dotenv
        load_dotenv(env_file)
    except ImportError:
        print("❌ 请安装: pip install python-dotenv")
        return

    import os
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_KEY", "").strip()

    if not url or not key:
        print("❌ .env 中 SUPABASE_URL 或 SUPABASE_KEY 为空")
        print("   请填写有效的 URL 和 anon key（Supabase 项目 Settings → API）")
        return

    print("✅ .env 已加载，SUPABASE_URL 和 SUPABASE_KEY 已设置")

    # 3. 能否连上 Supabase
    try:
        from supabase import create_client
        client = create_client(url, key)
        r = client.table("nav_history").select("isin").limit(1).execute()
        count = client.table("nav_history").select("isin", count="exact").execute()
        n = count.count or 0
        print(f"✅ Supabase 连接正常，nav_history 表共 {n} 条记录")
    except ImportError:
        print("❌ 请安装: pip install supabase")
    except Exception as e:
        print(f"❌ Supabase 连接失败: {e}")
        print("   请确认：① URL/KEY 正确 ② 已在 Supabase SQL Editor 执行建表 SQL")


if __name__ == "__main__":
    main()
