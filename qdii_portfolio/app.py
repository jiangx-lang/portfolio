"""
app.py  —  锦城轮动系统 QDII · JinCity Rotation Engine
"""

import streamlit as st
import sys
from pathlib import Path

st.set_page_config(
    page_title="锦城轮动 QDII · JinCity",
    page_icon="🎯",
    layout="wide",
    initial_sidebar_state="expanded",
)

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "fund_tagging.db"
if "--db" in sys.argv:
    idx = sys.argv.index("--db")
    if idx + 1 < len(sys.argv):
        DB_PATH = Path(sys.argv[idx + 1])

sys.path.insert(0, str(ROOT))
if str(ROOT.parent) not in sys.path:
    sys.path.insert(0, str(ROOT.parent))

import fund_tagging.db as ftdb
ftdb.configure(str(DB_PATH))
try:
    ftdb.init_schema()
except Exception:
    pass

# ── 设备选择逻辑（复用 MRF 模式）────────────────────────────────
def set_device(device_type: str):
    st.session_state["device"] = device_type
    st.rerun()

# URL 参数初始化（MRF 首页传入 ?device=mobile 或 ?device=desktop）
if "device" not in st.session_state:
    params = st.query_params
    if params.get("device") in ("mobile", "desktop"):
        st.session_state["device"] = params.get("device")
    else:
        st.session_state["device"] = "desktop"   # 默认电脑

is_mobile = st.session_state["device"] == "mobile"

# ── 页面路由 ──────────────────────────────────────────────────────
from pages import theme_search, portfolio_builder, nav_chart, miss_log, admin

PAGES = {
    "🔍  主题基金搜索": theme_search,
    "📐  组合构建器":   portfolio_builder,
    "📈  历史业绩曲线": nav_chart,
    "📋  未命中记录":   miss_log,
    "⚙️  管理后台":     admin,
}

MRF_URL  = st.secrets.get("MRF_APP_URL",  "http://43.161.234.75:8501") if hasattr(st, "secrets") else "http://43.161.234.75:8501"
QDII_URL = st.secrets.get("QDII_APP_URL", "http://43.161.234.75:8502") if hasattr(st, "secrets") else "http://43.161.234.75:8502"

# ── 侧栏 ─────────────────────────────────────────────────────────
with st.sidebar:
    # 系统入口
    st.markdown(f"""
<a href="{QDII_URL}" target="_self"
   style="display:block;padding:10px 14px;background:#185FA5;color:white;
          border-radius:8px;text-decoration:none;font-size:13px;font-weight:500;
          margin-bottom:6px;line-height:1.5">
  🎯 锦城轮动 QDII<br>
  <span style="font-size:11px;opacity:0.8;font-weight:400">JinCity Rotation Engine</span>
</a>
<a href="{MRF_URL}" target="_blank"
   style="display:block;padding:10px 14px;background:#0F6E56;color:white;
          border-radius:8px;text-decoration:none;font-size:13px;font-weight:500;
          margin-bottom:2px;line-height:1.5">
  📊 锦城轮动 MRF<br>
  <span style="font-size:11px;opacity:0.8;font-weight:400">JinCity Rotation Engine</span>
</a>
""", unsafe_allow_html=True)

    st.divider()

    # 设备切换
    st.markdown("<p style='font-size:11px;color:gray;margin:0 0 6px 0'>显示模式</p>",
                unsafe_allow_html=True)
    dev_col1, dev_col2 = st.columns(2)
    with dev_col1:
        st.button("📱 手机", key="sw_mobile",
                  type="primary" if is_mobile else "secondary",
                  on_click=set_device, args=("mobile",),
                  use_container_width=True)
    with dev_col2:
        st.button("💻 电脑", key="sw_desktop",
                  type="primary" if not is_mobile else "secondary",
                  on_click=set_device, args=("desktop",),
                  use_container_width=True)

    st.divider()

    st.markdown("<p style='font-size:11px;color:gray;margin:0 0 4px 0'>QDII 功能导航</p>",
                unsafe_allow_html=True)
    choice = st.radio("导航", list(PAGES.keys()), label_visibility="collapsed")

    st.divider()
    device_label = "📱 手机模式" if is_mobile else "💻 电脑模式"
    st.caption(f"{device_label}  ·  `{DB_PATH.name}`")

# ── 渲染（传入 is_mobile）────────────────────────────────────────
PAGES[choice].render(is_mobile=is_mobile)
