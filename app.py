# -*- coding: utf-8 -*-
"""
宏观资产配置优化器 - V12：综合费率统计 + 自定义 Portfolio 构建器
V11 基础上新增：落地基金表下费率汇总（加权费率/一次性申购费/分布）、自定义选基+权重+穿透拟合度。
"""
import streamlit as st
import pandas as pd
import requests
import ipaddress
import urllib.parse
from datetime import datetime
import datetime as _dt
import hashlib
from pathlib import Path
from zoneinfo import ZoneInfo
import numpy as np
from scipy.optimize import minimize
from plotly.subplots import make_subplots
import plotly.graph_objects as go

# 基金 NAV CSV：优先读本地 data/nav/，不存在再读 GitHub Raw（部署后用）
NAV_DATA_DIR = Path(__file__).resolve().parent / "data" / "nav"
GITHUB_RAW_BASE = "https://raw.githubusercontent.com/jiangx-lang/portfolio/master/data/nav/"

# 每日报告 PDF / 市场播客 目录（服务器 /root/market_files，本地为项目下 market_files）
import os
import threading
if os.path.exists("/root/market_files"):
    MARKET_FILES_BASE = Path("/root/market_files")
else:
    MARKET_FILES_BASE = Path(__file__).resolve().parent / "market_files"
MARKET_PDFS = MARKET_FILES_BASE / "pdfs"
MARKET_PODCASTS = MARKET_FILES_BASE / "podcasts"
MARKET_FILES_BASE.mkdir(parents=True, exist_ok=True)
MARKET_PDFS.mkdir(exist_ok=True)
MARKET_PODCASTS.mkdir(exist_ok=True)
# 静态文件服务 base URL（PDF 链接用），服务器可设环境变量 FILE_SERVER_BASE_URL
FILE_SERVER_BASE_URL = os.environ.get("FILE_SERVER_BASE_URL", "http://43.161.234.75:8504")
FILE_SERVER_PORT = 8504


def _start_static_file_server():
    """后台启动静态文件服务 8504，不阻塞 Streamlit。若端口已被占用则跳过。"""
    try:
        from http.server import HTTPServer, SimpleHTTPRequestHandler
        class Handler(SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=str(MARKET_FILES_BASE), **kwargs)
        server = HTTPServer(("", FILE_SERVER_PORT), Handler)
        t = threading.Thread(target=server.serve_forever, daemon=True)
        t.start()
    except OSError:
        pass  # 端口已被占用，说明已启动
    except Exception:
        pass


# 渣打 WMP 数据模块（导入失败时仍显示 Tab，便于排查）
WMP_AVAILABLE = False
WMP_ERROR = None
try:
    from db_manager import get_wmp_display_data, init_db, insert_nav_records
    from wmp_scraper import scrape_wmp
    WMP_AVAILABLE = True
except Exception as e:
    WMP_ERROR = f"{type(e).__name__}: {e}"

# --- Supabase 访客雷达（可选，依赖 st.secrets）---
def get_supabase_client():
    try:
        from supabase import create_client
        url = st.secrets.get("SUPABASE_URL") or st.secrets.get("supabase", {}).get("SUPABASE_URL")
        key = st.secrets.get("SUPABASE_KEY") or st.secrets.get("supabase", {}).get("SUPABASE_KEY")
        if url and key:
            return create_client(url, key)
    except Exception:
        pass
    return None


def get_real_ip():
    try:
        headers = st.context.headers
        ips = []
        if "X-Forwarded-For" in headers:
            ips.extend([ip.strip() for ip in headers["X-Forwarded-For"].split(",")])
        if "X-Real-Ip" in headers:
            ips.append(headers["X-Real-Ip"].strip())
        for ip in ips:
            try:
                parsed = ipaddress.ip_address(ip)
                if not parsed.is_private and not parsed.is_loopback:
                    return ip
            except ValueError:
                continue
    except Exception:
        pass
    return "隐身访客"


def get_geo_location(ip):
    if ip == "隐身访客" or not ip:
        return ip
    try:
        res = requests.get(f"http://ip-api.com/json/{ip}?lang=zh-CN", timeout=2).json()
        if res.get("status") == "success":
            return f"{res['city']}, {res['country']} ({ip})"
    except Exception:
        pass
    return ip


def track_visitor():
    if st.session_state.get("has_logged"):
        return
    st.session_state.has_logged = True
    raw_ip = get_real_ip()
    geo_ip = get_geo_location(raw_ip)
    now_str = datetime.now(ZoneInfo("Asia/Shanghai")).strftime("%Y-%m-%d %H:%M:%S")
    try:
        from supabase import create_client
        url = st.secrets.get("SUPABASE_URL") or st.secrets.get("supabase", {}).get("SUPABASE_URL")
        key = st.secrets.get("SUPABASE_KEY") or st.secrets.get("supabase", {}).get("SUPABASE_KEY")
        if not url or not key:
            return
        client = create_client(url, key)
        res = client.table("visitor_logs").select("visits").eq("ip", geo_ip).execute()
        if res.data and len(res.data) > 0:
            new_visits = res.data[0]["visits"] + 1
            client.table("visitor_logs").update({"visits": new_visits, "last_visit": now_str}).eq("ip", geo_ip).execute()
        else:
            client.table("visitor_logs").insert({"ip": geo_ip, "visits": 1, "last_visit": now_str}).execute()
    except Exception:
        pass


st.set_page_config(page_title="锦城轮动系统 · JinCity Rotation Engine", layout="wide", initial_sidebar_state="collapsed")

# --- 0. 状态管理 ---
if "device" not in st.session_state:
    st.session_state.device = None
if "entry" not in st.session_state:
    st.session_state.entry = None


def set_device(device_type, entry_type="config"):
    st.session_state.device = device_type
    st.session_state.entry = entry_type
    st.rerun()


def back_to_landing():
    st.session_state.device = None
    st.session_state.entry = None
    st.rerun()


def _notes_request_upload():
    st.session_state.notes_show_pwd = True


def _podcast_request_upload():
    st.session_state.podcast_show_pwd = True


def _set_notes_delete_pending(path_str):
    st.session_state.notes_delete_pending = path_str


def _do_notes_delete(path_str):
    p = Path(path_str)
    if p.exists():
        p.unlink(missing_ok=True)
    if "notes_delete_pending" in st.session_state:
        del st.session_state.notes_delete_pending
    st.rerun()


def _clear_notes_delete_pending():
    if "notes_delete_pending" in st.session_state:
        del st.session_state.notes_delete_pending
    st.rerun()


def _set_podcast_delete_pending(path_str):
    st.session_state.podcast_delete_pending = path_str


def _do_podcast_delete(path_str):
    p = Path(path_str)
    if p.exists():
        p.unlink(missing_ok=True)
    if "podcast_delete_pending" in st.session_state:
        del st.session_state.podcast_delete_pending
    st.rerun()


def _clear_podcast_delete_pending():
    if "podcast_delete_pending" in st.session_state:
        del st.session_state.podcast_delete_pending
    st.rerun()


# ─────────────────────────────────────────────
#  每日随机格言（同一天所有用户看同一句）
# ─────────────────────────────────────────────
DAILY_QUOTES = [
    ("The market is a device for transferring money from the impatient to the patient.", "Warren Buffett"),
    ("It's not always easy to do what's not popular, but that's where you make your money.", "Warren Buffett"),
    ("Risk comes from not knowing what you're doing.", "Warren Buffett"),
    ("Behind every stock is a company. Find out what it's doing.", "Peter Lynch"),
    ("In this business, if you're good, you're right six times out of ten.", "Peter Lynch"),
    ("The person that turns over the most rocks wins the game.", "Peter Lynch"),
    ("Know what you own, and know why you own it.", "Peter Lynch"),
    ("The stock market is filled with individuals who know the price of everything, but the value of nothing.", "Philip Fisher"),
    ("The best time to sell a stock is almost never.", "Philip Fisher"),
    ("I am not a businessman, I am an artist.", "Philip Fisher"),
    ("When something is important enough, you do it even if the odds are not in your favor.", "Elon Musk"),
    ("I think it's very important to have a feedback loop.", "Elon Musk"),
    ("The first step is to establish that something is possible; then probability will occur.", "Elon Musk"),
    ("The market can stay irrational longer than you can stay solvent.", "John Maynard Keynes"),
    ("Successful investing is anticipating the anticipations of others.", "John Maynard Keynes"),
    ("The difficulty lies not so much in developing new ideas as in escaping from old ones.", "John Maynard Keynes"),
    ("Every individual endeavours to employ his capital so that its produce may be of greatest value.", "Adam Smith, The Wealth of Nations"),
    ("The real price of everything is the toil and trouble of acquiring it.", "Adam Smith, The Wealth of Nations"),
    ("No society can surely be flourishing and happy, of which the far greater part of the members are poor and miserable.", "Adam Smith, The Wealth of Nations"),
    ("It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness.", "Charles Dickens, A Tale of Two Cities"),
    ("It was the spring of hope, it was the winter of despair.", "Charles Dickens, A Tale of Two Cities"),
    ("We had everything before us, we had nothing before us.", "Charles Dickens, A Tale of Two Cities"),
    ("价格是你付出的，价值是你得到的。", "沃伦·巴菲特"),
    ("投资最重要的三个字：安全边际。", "本杰明·格雷厄姆"),
    ("牛市让你赚钱，熊市让你成长。", "彼得·林奇"),
    ("分散投资是对无知的保护，对于知道自己在做什么的人来说意义不大。", "沃伦·巴菲特"),
    ("市场短期是投票机，长期是称重机。", "本杰明·格雷厄姆"),
    ("那是最好的时代，那是最坏的时代；那是智慧的年代，那是愚蠢的年代。", "查尔斯·狄更斯《双城记》"),
    ("现在是希望之春，现在是绝望之冬。", "查尔斯·狄更斯《双城记》"),
    ("劳动是所有财富的真实源泉。", "亚当·斯密《国富论》"),
    ("分工是国民财富增长的根本原因。", "亚当·斯密《国富论》"),
    # Integrity / 诚信 / 圣经
    ("Whoever walks in integrity walks securely, but whoever takes crooked paths will be found out.", "Proverbs 10:9"),
    ("The integrity of the upright guides them, but the crookedness of the treacherous destroys them.", "Proverbs 11:3"),
    ("Do to others as you would have them do to you.", "Luke 6:31"),
    ("You shall not go around as a slanderer among your people.", "Leviticus 19:16"),
    ("Whoever secretly slanders his neighbor, him I will destroy.", "Psalm 101:5"),
    ("A false witness will not go unpunished, and he who breathes out lies will perish.", "Proverbs 19:9"),
    ("The man of integrity walks securely, but he who takes crooked paths will be found out.", "King Solomon"),
    ("Real integrity is doing the right thing, knowing that nobody's going to know whether you did it or not.", "Oprah Winfrey"),
    ("In looking for people to hire, look for three qualities: integrity, intelligence, and energy. If they don't have the first, the other two will kill you.", "Warren Buffett"),
    ("It takes 20 years to build a reputation and five minutes to ruin it.", "Warren Buffett"),
    ("Associate yourself with people of good quality, for it is better to be alone than in bad company.", "Booker T. Washington"),
    ("The measure of a man's character is what he would do if he knew he never would be found out.", "Thomas Macaulay"),
    ("Non-cooperation with evil is as much a duty as cooperation with good.", "Mahatma Gandhi"),
    ("The world suffers a lot. Not because of the violence of bad people, but because of the silence of good people.", "Napoleon Bonaparte"),
    ("All that is necessary for evil to triumph is for good men to do nothing.", "Edmund Burke"),
    ("己所不欲，勿施于人。", "孔子《论语》"),
    ("君子坦荡荡，小人长戚戚。", "孔子《论语》"),
    ("不患人之不己知，患其不能也。", "孔子《论语》"),
    ("投我以木桃，报之以琼瑶。", "《诗经·卫风·木瓜》"),
    ("君子喻于义，小人喻于利。", "孔子《论语》"),
]


def get_daily_quote():
    today = str(_dt.date.today())
    idx = int(hashlib.md5(today.encode()).hexdigest(), 16) % len(DAILY_QUOTES)
    return DAILY_QUOTES[idx]


# --- 1. 核心数据 ---
SCB_TARGET = {
    "平稳 (Income)":     {"股票": 33, "固定收益": 58, "黄金": 6, "现金": 3},
    "均衡 (Balanced)":   {"股票": 54, "固定收益": 38, "黄金": 6, "现金": 2},
    "进取 (Aggressive)": {"股票": 74, "固定收益": 17, "黄金": 6, "现金": 3},
}

# 标准组合的二级细分（对应图片 Fig.3 Foundation Balanced 细项）
SCB_DETAIL = {
    "平稳 (Income)": {
        "股票": {
            "North America": 14, "Europe ex-UK": 3, "UK": 1, "Japan": 1, "Asia ex-Japan": 4
        },
        "固定收益": {
            "DM IG Government": 25, "DM IG Corporate": 10, "DM HY Corporate": 1,
            "EM USD Government": 8, "EM Local Ccy Government": 6, "Asia USD": 8
        },
        "黄金": {"Gold": 6},
        "现金": {"USD Cash": 3},
    },
    "均衡 (Balanced)": {
        "股票": {
            "North America": 38, "Europe ex-UK": 6, "UK": 1, "Japan": 2, "Asia ex-Japan": 7
        },
        "固定收益": {
            "DM IG Government": 16, "DM IG Corporate": 5, "DM HY Corporate": 1,
            "EM USD Government": 6, "EM Local Ccy Government": 5, "Asia USD": 5
        },
        "黄金": {"Gold": 6},
        "现金": {"USD Cash": 2},
    },
    "进取 (Aggressive)": {
        "股票": {
            "North America": 51, "Europe ex-UK": 8, "UK": 2, "Japan": 3, "Asia ex-Japan": 10
        },
        "固定收益": {
            "DM IG Government": 8, "DM IG Corporate": 1,
            "EM USD Government": 4, "EM Local Ccy Government": 2, "Asia USD": 3
        },
        "黄金": {"Gold": 6},
        "现金": {"USD Cash": 2},
    },
}

# fee_rate 来自爬虫 updated_funds_fees.xlsx（小数 0.02 表示 2%，已转为百分点 2.0）
MRF_POOL = {
    "东方汇理香港组合-灵活配置增长": {"brand": "Amundi", "股票": 70, "固定收益": 25, "现金": 5, "fee_rate": 3.0},
    "东方汇理香港组合-灵活配置均衡": {"brand": "Amundi", "股票": 50, "固定收益": 45, "现金": 5, "fee_rate": 3.0},
    "东方汇理香港组合-灵活配置平稳": {"brand": "Amundi", "股票": 30, "固定收益": 60, "现金": 10, "fee_rate": 3.0},
    "东亚联丰环球股票基金":           {"brand": "BEA",   "股票": 95, "固定收益": 0,  "现金": 5, "fee_rate": 2.5},
    "东亚联丰亚洲债券及货币基金":     {"brand": "BEA",   "股票": 0,  "固定收益": 95, "现金": 5, "fee_rate": 2.0},
    "惠理高息股票基金":               {"brand": "ValuePartners", "股票": 95, "固定收益": 0, "现金": 5, "fee_rate": 2.5},
    "惠理价值基金":                   {"brand": "ValuePartners", "股票": 95, "固定收益": 0, "现金": 5, "fee_rate": 2.5},
    "摩根国际债":                     {"brand": "JPM",   "股票": 0,  "固定收益": 95, "现金": 5, "fee_rate": 2.0},
    "摩根太平洋科技":                 {"brand": "JPM",   "股票": 95, "固定收益": 0,  "现金": 5, "fee_rate": 2.5},
    "摩根太平洋证券":                 {"brand": "JPM",   "股票": 95, "固定收益": 0,  "现金": 5, "fee_rate": 1.5},
    "摩根亚洲股息":                   {"brand": "JPM",   "股票": 95, "固定收益": 0,  "现金": 5, "fee_rate": 2.5},
    "摩根亚洲总收益":                 {"brand": "JPM",   "股票": 50, "固定收益": 45, "现金": 5, "fee_rate": 1.0},
    "瑞士百达策略收益基金":           {"brand": "Pictet","股票": 40, "固定收益": 50, "现金": 10, "fee_rate": 3.0},
    "中银香港环球股票基金":           {"brand": "BOC",   "股票": 95, "固定收益": 0,  "现金": 5, "fee_rate": 1.5},
    "中银香港香港股票基金":           {"brand": "BOC",   "股票": 95, "固定收益": 0,  "现金": 5, "fee_rate": 1.5},
    "施罗德亚洲高息股债基金M类别(人民币派息)": {"brand": "Schroders", "股票": 64, "固定收益": 23, "现金": 13, "fee_rate": 2.0},
}
# 未来接 DB：fund_fees 表 (fund_name TEXT PRIMARY KEY, fee_rate REAL, updated_at TEXT)

# 渣打铁律：垃圾债占比不超限。东亚联丰亚洲债券为纯垃圾债，算法中排除，用其他固收产品替代。
EXCLUDED_FUNDS = {"东亚联丰亚洲债券及货币基金"}
# Tab1 最高费率方案：候选为申购费 >= 该值的基金（多基金公司 2.5%～3% 一起优化）；Tab3 补充方案申购费放宽至 1.5%～3%
FEE_FIRST_MIN_FEE = 2.5
DIVERSIFY_FEE_MIN, DIVERSIFY_FEE_MAX = 1.5, 3.0
# Tab3 建议 3～4 只；Tab2 不限制数量
MAX_FUNDS_DIVERSIFY = 4
# 权重低于此比例的基金不展示（操作意义不大），剔除后重新归一化（Tab2 不用此过滤，以最优配置为目标）
MIN_WEIGHT_DISPLAY = 0.10
# 费率优先 Tab1 不推荐摩根国际债；债券端用东方汇理灵活配置平稳
FEE_FIRST_EXCLUDE_BOND_FUNDS = {"摩根国际债"}
PREFERRED_BOND_PROXY = "东方汇理香港组合-灵活配置平稳"

def _pool_without_excluded():
    """可用于优化的基金池（排除纯垃圾债等）。"""
    return [f for f in MRF_POOL if f not in EXCLUDED_FUNDS]

# 基金补充明细（债券信用/股票地区与行业/Top 持股），按基金名称索引，供展示或穿透用
MRF_FUND_DETAIL = {
    "施罗德亚洲高息股债基金M类别(人民币派息)": {
        "bond_credit": {"投资级别债券": 70.54, "垃圾债": 29.46},
        "bond_region": "亚洲债券",
        "equity_region": {
            "中国大陆": 14.35, "中国香港": 4.46, "中国台湾": 8.98, "印度": 5.51,
            "澳大利亚": 3.99, "韩国": 3.78, "新加坡": 5.13, "日本": 1.94, "其他": 16.02,
        },
        "equity_sector": {
            "金融": 14.46, "科技": 10.87, "非必须消费品": 4.73, "公共事业": 3.78,
            "通讯": 4.08, "房地产信托": 3.68, "工业制造": 2.64, "其他": 19.69,
        },
        "top_holdings": [
            ("台积电", 2.29), ("CHINA CONSTRUCTION BANK CORP H", 1.78),
            ("HON HAI PRECISION INDUSTRY LTD", 1.69), ("DBS GROUP HOLDINGS LTD", 1.59),
            ("联发科技", 1.34),
        ],
    },
}
# 启动时 conn.execute("SELECT fund_name, fee_rate FROM fund_fees"); for name, fee in rows: MRF_POOL[name]["fee_rate"] = fee or 0.0

# 资产颜色映射
ASSET_COLORS = {
    "股票":    "#1d6fa4",
    "固定收益": "#2c8c6b",
    "黄金":    "#d4a017",
    "现金":    "#8c8c8c",
}


def _compute_achieved(funds: list, weights: list) -> dict:
    """根据 funds + weights 计算穿透后股/债/金/现占比（黄金 MRF 无暴露故恒为 0）。"""
    achieved = {"股票": 0.0, "固定收益": 0.0, "黄金": 0.0, "现金": 0.0}
    for i, f in enumerate(funds):
        achieved["股票"] += MRF_POOL[f]["股票"] * weights[i]
        achieved["固定收益"] += MRF_POOL[f]["固定收益"] * weights[i]
        achieved["现金"] += MRF_POOL[f]["现金"] * weights[i]
    return achieved


def calc_fee_summary(funds: list, weights: list) -> dict:
    """综合费率统计：加权平均、最高/最低基金及费率、明细。"""
    if not funds or not weights or len(funds) != len(weights):
        return {
            "weighted_avg": 0.0, "max_fee_fund": "", "max_fee": 0.0,
            "min_fee_fund": "", "min_fee": 0.0, "fee_breakdown": [],
        }
    breakdown = []
    weighted_sum = 0.0
    for f, w in zip(funds, weights):
        fee = MRF_POOL[f].get("fee_rate") or 0.0
        contribution = w * fee
        weighted_sum += contribution
        breakdown.append({"fund": f, "weight": w, "fee": fee, "contribution": contribution})
    if not breakdown:
        return {
            "weighted_avg": 0.0, "max_fee_fund": "", "max_fee": 0.0,
            "min_fee_fund": "", "min_fee": 0.0, "fee_breakdown": [],
        }
    by_fee = sorted(breakdown, key=lambda x: x["fee"])
    return {
        "weighted_avg": weighted_sum,
        "max_fee_fund": by_fee[-1]["fund"],
        "max_fee": by_fee[-1]["fee"],
        "min_fee_fund": by_fee[0]["fund"],
        "min_fee": by_fee[0]["fee"],
        "fee_breakdown": breakdown,
    }


def calc_fit_score(achieved: dict, target: dict) -> float:
    """与标准组合的拟合度 0–100，基于股/债/现均方误差归一化。"""
    keys = ["股票", "固定收益", "现金"]
    mse = np.mean([(achieved.get(k, 0) - target.get(k, 0)) ** 2 for k in keys])
    max_mse = np.mean([(target.get(k, 0)) ** 2 for k in keys]) or 1e-6
    score = max(0.0, (1 - mse / max_mse) * 100)
    return float(score)


def _drop_small_weights(funds: list, weights: list, min_weight: float = MIN_WEIGHT_DISPLAY):
    """剔除权重低于 min_weight 的基金，重新归一化；低于 10% 操作意义不大不展示。"""
    keep = [i for i in range(len(weights)) if weights[i] >= min_weight]
    if not keep or len(keep) == len(weights):
        return funds, weights
    new_f = [funds[i] for i in keep]
    s = sum(weights[i] for i in keep)
    if s <= 0:
        return funds, weights
    new_w = [weights[i] / s for i in keep]
    return new_f, new_w


def _minimize_weights_3d(fund_names: list, target_alloc: dict):
    """
    3 维（股/债/现）加权最小二乘：min ||Aw - b||^2, sum(w)=1, w>=0。
    target 使用比例（0~1），黄金无 MRF 暴露不参与。
    """
    if not fund_names:
        return [], []
    n = len(fund_names)
    # b: 目标比例（股/债/现，归一化到三者之和=1 以与 A 一致，因 A 每行和为 100）
    s = target_alloc["股票"] + target_alloc["固定收益"] + target_alloc["现金"]
    b = np.array([
        target_alloc["股票"] / s,
        target_alloc["固定收益"] / s,
        target_alloc["现金"] / s,
    ], dtype=float)
    # A: 3 x n，每列一只基金的股/债/现占比（比例 0~1）
    A = np.array([
        [MRF_POOL[f]["股票"] / 100.0 for f in fund_names],
        [MRF_POOL[f]["固定收益"] / 100.0 for f in fund_names],
        [MRF_POOL[f]["现金"] / 100.0 for f in fund_names],
    ], dtype=float)

    def obj(w):
        return np.sum((A @ w - b) ** 2)

    w0 = np.ones(n) / n
    bounds = [(0.0, 1.0)] * n
    cons = {"type": "eq", "fun": lambda w: np.sum(w) - 1.0}
    res = minimize(obj, w0, method="SLSQP", bounds=bounds, constraints=cons)
    if not res.success:
        return fund_names, list(w0)
    w = res.x
    # 剔除权重 < 3% 的碎股，重新归一化
    w = np.maximum(w, 0.0)
    w[w < 0.03] = 0.0
    if w.sum() <= 0:
        return fund_names, list(np.ones(n) / n)
    w = w / w.sum()
    # 只保留权重大于 0 的基金
    keep = w > 1e-6
    return [fund_names[i] for i in range(n) if keep[i]], [float(w[i]) for i in range(n) if keep[i]]


def combo_fee_first(target_alloc: dict):
    """
    Tab1 最高费率配置：候选为申购费 >= FEE_FIRST_MIN_FEE 的基金（多基金公司 2.5%～3% 一起做优化），
    排除摩根国际债，债券端用东方汇理平稳；优化后剔除 <10% 权重的碎单。
    """
    pool = _pool_without_excluded()
    min_fee = FEE_FIRST_MIN_FEE
    high_fee = [f for f in pool if (MRF_POOL[f].get("fee_rate") or 0) >= min_fee and f not in FEE_FIRST_EXCLUDE_BOND_FUNDS]
    has_bond = any(MRF_POOL[f]["固定收益"] > 60 for f in high_fee)
    if not has_bond and PREFERRED_BOND_PROXY in pool and PREFERRED_BOND_PROXY not in high_fee:
        high_fee.append(PREFERRED_BOND_PROXY)
    selected = high_fee if len(high_fee) >= 2 else pool
    if len(selected) < 2:
        selected = pool
    funds, weights = _minimize_weights_3d(selected, target_alloc)
    funds, weights = _drop_small_weights(funds, weights)
    achieved = _compute_achieved(funds, weights)
    return funds, weights, achieved


def combo_optimizer(target_alloc: dict):
    """
    Tab2 最优配置组合：不限制基金数量，全池 3D 二次规划，以达到最优配置比例为目标。
    仅剔除 <3% 碎股（在 _minimize_weights_3d 内），不做 10% 下限过滤。
    """
    all_funds = _pool_without_excluded()
    funds, weights = _minimize_weights_3d(all_funds, target_alloc)
    achieved = _compute_achieved(funds, weights)
    return funds, weights, achieved


def combo_diversify(target_alloc: dict, used_funds_set: set):
    """
    Tab3 补充方案：排除 Tab1+Tab2 已用基金与纯垃圾债，申购费放宽至 1.5%～3% 做优化，
    最多保留 3～4 只，按权重取前 N 只后剔除 <10% 碎单。
    """
    pool = _pool_without_excluded()
    fee_min, fee_max = DIVERSIFY_FEE_MIN, DIVERSIFY_FEE_MAX
    available = [f for f in pool if f not in used_funds_set and fee_min <= (MRF_POOL[f].get("fee_rate") or 0) <= fee_max]
    if not available:
        available = [f for f in pool if f not in used_funds_set]
    if not available:
        available = pool
    add_from = [f for f in used_funds_set if f in MRF_POOL and f not in EXCLUDED_FUNDS]
    has_equity = any(MRF_POOL[f]["股票"] > 0 for f in available)
    has_bond = any(MRF_POOL[f]["固定收益"] > 0 for f in available)
    if add_from:
        if not has_equity:
            equity_used = [f for f in add_from if MRF_POOL[f]["股票"] > 0]
            if equity_used:
                best = max(equity_used, key=lambda x: MRF_POOL[x].get("fee_rate") or 0)
                available.append(best)
        if not has_bond:
            bond_used = [f for f in add_from if MRF_POOL[f]["固定收益"] > 0]
            if bond_used:
                best = max(bond_used, key=lambda x: MRF_POOL[x].get("fee_rate") or 0)
                if best not in available:
                    available.append(best)
    funds, weights = _minimize_weights_3d(available, target_alloc)
    if len(funds) > MAX_FUNDS_DIVERSIFY:
        paired = sorted(zip(weights, funds), key=lambda x: x[0], reverse=True)[:MAX_FUNDS_DIVERSIFY]
        funds = [f for _, f in paired]
        w_sum = sum(w for w, _ in paired)
        weights = [w / w_sum for w, _ in paired]
    funds, weights = _drop_small_weights(funds, weights)
    achieved = _compute_achieved(funds, weights)
    return funds, weights, achieved


# ─────────────────────────────────────────────
#  渲染辅助：标准组合构成表
# ─────────────────────────────────────────────
def render_standard_portfolio_table(risk_level: str, target_alloc: dict):
    """
    渲染标准组合构成表：
    - 顶层四类汇总（股票/固定收益/黄金/现金）
    - 二级细分明细（来自 SCB_DETAIL）
    """
    st.markdown("### 📊 标准组合构成")
    st.caption(f"渣打 SCB Foundation — **{risk_level}**")

    detail = SCB_DETAIL.get(risk_level, {})

    rows = []
    for asset_class, target_pct in target_alloc.items():
        sub = detail.get(asset_class, {})
        # 顶层合计行
        rows.append({
            "资产类别": f"**{asset_class}**",
            "细分": "—",
            "目标占比": f"**{target_pct}%**",
        })
        # 细分行
        for sub_name, sub_pct in sub.items():
            rows.append({
                "资产类别": "",
                "细分": f"↳ {sub_name}",
                "目标占比": f"{sub_pct}%",
            })

    df = pd.DataFrame(rows)
    st.dataframe(
        df,
        use_container_width=True,
        hide_index=True,
        column_config={
            "资产类别": st.column_config.TextColumn("资产类别", width="small"),
            "细分":     st.column_config.TextColumn("细分项目", width="medium"),
            "目标占比": st.column_config.TextColumn("目标占比", width="small"),
        }
    )


# ─────────────────────────────────────────────
#  渲染辅助：穿透对比 metric 行
# ─────────────────────────────────────────────
def render_penetration_metrics(achieved: dict, target_alloc: dict, device: str = "desktop"):
    """显示穿透后各资产类别 vs 基准对比（4 个 metric）"""
    if device == "mobile":
        c1, c2 = st.columns(2)
        c1.metric("📉 股票敞口",  f"{achieved['股票']:.1f}%",    f"基准: {target_alloc['股票']}%",    delta_color="off")
        c2.metric("🛡️ 固收敞口", f"{achieved['固定收益']:.1f}%", f"基准: {target_alloc['固定收益']}%", delta_color="off")
        c3, c4 = st.columns(2)
        gold_delta = achieved["黄金"] - target_alloc["黄金"]
        c3.metric("🥇 黄金敞口", "0.0%", f"{gold_delta:.0f}% (缺项)", delta_color="inverse")
        c4.metric("💵 现金敞口", f"{achieved['现金']:.1f}%", f"基准: {target_alloc['现金']}%", delta_color="off")
    else:
        col1, col2, col3, col4 = st.columns(4)
        col1.metric("📉 穿透后: 股票",  f"{achieved['股票']:.1f}%",    f"基准: {target_alloc['股票']}%",    delta_color="off")
        col2.metric("🛡️ 穿透后: 固收", f"{achieved['固定收益']:.1f}%", f"基准: {target_alloc['固定收益']}%", delta_color="off")
        gold_delta = achieved["黄金"] - target_alloc["黄金"]
        col3.metric("🥇 穿透后: 黄金", "0.0%", f"{gold_delta:.0f}% (缺项)", delta_color="inverse")
        col4.metric("💵 穿透后: 现金", f"{achieved['现金']:.1f}%", f"基准: {target_alloc['现金']}%", delta_color="off")


# ─────────────────────────────────────────────
#  渲染辅助：落地基金产品 + 底层穿透明细
# ─────────────────────────────────────────────
def render_fund_penetration_table(
    funds: list,
    weights: list,
    capital: float,
    weighted_avg_fee: float | None = None,
    is_new_fund: list | None = None,
):
    """
    渲染落地基金产品表格，含申购费列；
    可选 weighted_avg_fee 在表下方显示组合加权平均申购费；
    可选 is_new_fund（与 funds 同长）用于 Tab3 显示「是否新增品种」✅/➕
    """
    st.markdown("### 💼 建议落地基金 & 底层穿透")
    st.caption("以下产品组合旨在贴近上方标准组合。底层持仓来自各基金招募说明书。")

    base = {
        "落地基金产品": funds,
        "品牌": [MRF_POOL[f]["brand"] for f in funds],
        "配置权重(%)": [round(w * 100, 1) for w in weights],
        "申购费率(%)": [round(MRF_POOL[f].get("fee_rate") or 0.0, 2) for f in funds],
        "底层: 股票%": [MRF_POOL[f]["股票"] for f in funds],
        "底层: 固收%": [MRF_POOL[f]["固定收益"] for f in funds],
        "底层: 现金%": [MRF_POOL[f]["现金"] for f in funds],
        "买入金额(¥)": [round(capital * w) for w in weights],
    }
    if is_new_fund is not None and len(is_new_fund) == len(funds):
        base["是否新增品种"] = ["✅" if x else "➕" for x in is_new_fund]
    df = pd.DataFrame(base)
    col_cfg = {
        "配置权重(%)": st.column_config.ProgressColumn("配置权重(%)", min_value=0, max_value=100, format="%.1f%%"),
        "申购费率(%)": st.column_config.NumberColumn("申购费率(%)", format="%.2f%%"),
        "底层: 股票%": st.column_config.ProgressColumn("底层 股票%", min_value=0, max_value=100, format="%d%%"),
        "底层: 固收%": st.column_config.ProgressColumn("底层 固收%", min_value=0, max_value=100, format="%d%%"),
        "底层: 现金%": st.column_config.ProgressColumn("底层 现金%", min_value=0, max_value=100, format="%d%%"),
        "买入金额(¥)": st.column_config.NumberColumn("买入金额", format="¥%d"),
    }
    st.dataframe(df, use_container_width=True, hide_index=True, column_config=col_cfg)
    if weighted_avg_fee is not None:
        st.caption(f"**组合加权平均申购费** = Σ(权重 × 申购费) = **{weighted_avg_fee:.2f}%**")


INDUSTRY_AVG_FEE = 1.2  # 行业平均费率 %，用于 delta 对比


def render_fee_summary(funds: list, weights: list, capital: float):
    """在落地基金表格下方展示：组合加权费率、一次性申购费、费率分布（三列 metric）。"""
    summary = calc_fee_summary(funds, weights)
    if not summary["fee_breakdown"]:
        return
    wavg = summary["weighted_avg"]
    delta_vs_industry = wavg - INDUSTRY_AVG_FEE
    delta_color = "inverse" if delta_vs_industry > 0 else "normal"
    c1, c2, c3 = st.columns(3)
    with c1:
        st.metric(
            "💰 组合加权费率",
            f"{wavg:.2f}%",
            delta=f"{delta_vs_industry:+.2f}% vs 行业约{INDUSTRY_AVG_FEE}%",
            delta_color=delta_color,
        )
    with c2:
        one_time_fee = capital * wavg / 100
        st.metric("📅 一次性申购费", f"¥{one_time_fee:,.0f}", help="基于当前投资金额的一次性申购费估算")
    with c3:
        st.caption("📊 费率分布")
        st.markdown(
            f"**最贵**: {summary['max_fee_fund'][:12]}…（{summary['max_fee']:.2f}%）  \n"
            f"**最便宜**: {summary['min_fee_fund'][:12]}…（{summary['min_fee']:.2f}%）"
        )


# ─────────────────────────────────────────────
#  渲染辅助：加权穿透汇总 vs 标准对比表
# ─────────────────────────────────────────────
def render_penetration_summary(achieved: dict, target_alloc: dict):
    """渲染穿透后汇总 vs 标准组合的对比表，含偏差列"""
    st.markdown("### 🎯 穿透汇总 vs 标准基准")

    rows = []
    for asset, target_pct in target_alloc.items():
        ach = achieved.get(asset, 0.0)
        diff = ach - target_pct
        diff_str = f"+{diff:.1f}%" if diff > 0 else (f"{diff:.1f}%" if diff != 0 else "持平")
        status = "✅" if abs(diff) <= 5 else ("⚠️ 缺项" if diff < -5 else "⚠️ 超配")
        rows.append({
            "资产类别": asset,
            "标准目标%": target_pct,
            "穿透后%": round(ach, 1),
            "偏差":  diff_str,
            "状态":  status,
        })
    df = pd.DataFrame(rows)
    st.dataframe(
        df,
        use_container_width=True,
        hide_index=True,
        column_config={
            "标准目标%": st.column_config.NumberColumn("标准目标", format="%d%%"),
            "穿透后%":   st.column_config.NumberColumn("穿透后实际", format="%.1f%%"),
        }
    )


# ─────────────────────────────────────────────
#  基金 NAV 交互曲线图（GitHub Raw CSV，无数据时模拟）
# ─────────────────────────────────────────────
@st.cache_data(ttl=3600)
def load_fund_nav(fund_name: str) -> pd.DataFrame:
    """优先读本地 data/nav/{fund_name}.csv，否则从 GitHub Raw 拉取。列需含 date/csvdate 与 nav。"""
    local_path = NAV_DATA_DIR / f"{fund_name}.csv"
    try:
        if local_path.exists():
            df = pd.read_csv(local_path, encoding="utf-8")
        else:
            url = GITHUB_RAW_BASE + urllib.parse.quote(fund_name) + ".csv"
            df = pd.read_csv(url)
        if "csvdate" in df.columns and "date" not in df.columns:
            df = df.rename(columns={"csvdate": "date"})
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
        df["nav"] = pd.to_numeric(df["nav"], errors="coerce")
        df = df.dropna(subset=["date", "nav"]).sort_values("date").reset_index(drop=True)
        return df
    except Exception:
        return pd.DataFrame()


def calc_returns(df: pd.DataFrame) -> dict:
    """计算各区间收益率，(nav_end/nav_start)-1，不足则 None。"""
    if df.empty or len(df) < 2:
        return {k: None for k in ("YTD", "1Y", "2Y", "3Y", "5Y", "成立以来")}
    df = df.sort_values("date").reset_index(drop=True)
    latest = df["date"].max()
    nav_end = df.loc[df["date"] == latest, "nav"].iloc[-1]
    out = {}
    # YTD
    ytd_start = df[df["date"] >= pd.Timestamp(latest.year, 1, 1)]
    if not ytd_start.empty:
        nav_start = ytd_start["nav"].iloc[0]
        out["YTD"] = (nav_end / nav_start) - 1 if nav_start and nav_start > 0 else None
    else:
        out["YTD"] = None
    # 1Y/2Y/3Y/5Y
    for label, days in [("1Y", 365), ("2Y", 730), ("3Y", 1095), ("5Y", 1825)]:
        cut = latest - pd.DateOffset(days=days)
        start_df = df[df["date"] <= cut].tail(1)
        if not start_df.empty:
            nav_start = start_df["nav"].iloc[0]
            out[label] = (nav_end / nav_start) - 1 if nav_start and nav_start > 0 else None
        else:
            out[label] = None
    # 成立以来
    nav_start = df["nav"].iloc[0]
    out["成立以来"] = (nav_end / nav_start) - 1 if nav_start and nav_start > 0 else None
    return out


def calc_annual_returns(df: pd.DataFrame) -> pd.DataFrame:
    """按自然年计算年度收益率，返回 year, return_pct。"""
    if df.empty or len(df) < 2:
        return pd.DataFrame(columns=["year", "return_pct"])
    df = df.sort_values("date").reset_index(drop=True)
    df["year"] = df["date"].dt.year
    rows = []
    for y in df["year"].unique():
        sub = df[df["year"] == y]
        if len(sub) < 2:
            continue
        nav_start = sub["nav"].iloc[0]
        nav_end = sub["nav"].iloc[-1]
        if nav_start and nav_start > 0:
            rows.append({"year": int(y), "return_pct": (nav_end / nav_start) - 1})
    return pd.DataFrame(rows)


def render_fund_nav_chart(fund_name: str, unique_key: str = "") -> None:
    """绘制基金 NAV 走势 + 年度收益柱状图。unique_key 必须全局唯一（tab 名+基金名+序号），避免 Streamlit 重复 element ID。"""
    df = load_fund_nav(fund_name)
    is_mock = False
    if df.empty:
        dates = pd.date_range("2020-01-01", periods=1200, freq="B")
        np.random.seed(hash(fund_name) % 2**32)
        nav = (1 + np.random.normal(0.0003, 0.008, len(dates))).cumprod()
        df = pd.DataFrame({"date": dates, "nav": nav})
        is_mock = True

    chart_col, stat_col = st.columns([3, 1])
    with stat_col:
        st.markdown("**区间收益率**")
        returns = calc_returns(df)
        for period, ret in returns.items():
            if ret is None:
                st.metric(period, "—", delta=None)
            else:
                pct_str = f"{ret*100:+.2f}%"
                st.metric(period, pct_str, delta=None, delta_color="normal" if ret >= 0 else "inverse")

    with chart_col:
        range_options = ["YTD", "1Y", "2Y", "3Y", "5Y", "全部"]
        selected_range = st.radio("时间范围", range_options, index=1, horizontal=True, key=f"radio_{unique_key}")
        latest = df["date"].max()
        range_map = {
            "YTD": latest.replace(month=1, day=1),
            "1Y": latest - pd.DateOffset(years=1),
            "2Y": latest - pd.DateOffset(years=2),
            "3Y": latest - pd.DateOffset(years=3),
            "5Y": latest - pd.DateOffset(years=5),
            "全部": df["date"].min(),
        }
        start_date = range_map[selected_range]
        df_filtered = df[df["date"] >= start_date].copy()

        fig = make_subplots(
            rows=2, cols=1,
            shared_xaxes=False,
            row_heights=[0.65, 0.35],
            vertical_spacing=0.12,
            subplot_titles=("单位净值走势", "自然年度收益率 (%)"),
        )
        fig.add_trace(
            go.Scatter(
                x=df_filtered["date"], y=df_filtered["nav"], mode="lines",
                line=dict(color="#1d6fa4", width=1.8), name="单位净值",
                hovertemplate="<b>%{x|%Y-%m-%d}</b><br>净值: %{y:.4f}<extra></extra>",
            ),
            row=1, col=1,
        )
        fig.add_trace(
            go.Scatter(
                x=df_filtered["date"], y=df_filtered["nav"], fill="tozeroy",
                fillcolor="rgba(29,111,164,0.08)", line=dict(width=0),
                showlegend=False, hoverinfo="skip",
            ),
            row=1, col=1,
        )
        annual = calc_annual_returns(df)
        if not annual.empty:
            colors = ["#2c8c6b" if r >= 0 else "#c0392b" for r in annual["return_pct"]]
            fig.add_trace(
                go.Bar(
                    x=annual["year"].astype(str), y=(annual["return_pct"] * 100).round(2),
                    marker_color=colors, name="年度收益%",
                    hovertemplate="<b>%{x}年</b><br>收益率: %{y:.2f}%<extra></extra>",
                ),
                row=2, col=1,
            )
        fig.update_layout(
            height=520, margin=dict(l=10, r=10, t=40, b=10), showlegend=False,
            plot_bgcolor="white", paper_bgcolor="white", hovermode="x unified",
            xaxis=dict(rangeslider=dict(visible=True, thickness=0.04), showgrid=True, gridcolor="#f0f0f0"),
            yaxis=dict(showgrid=True, gridcolor="#f0f0f0"),
            xaxis2=dict(showgrid=False), yaxis2=dict(showgrid=True, gridcolor="#f0f0f0", ticksuffix="%", zeroline=True, zerolinecolor="#999"),
        )
        if is_mock:
            fig.add_annotation(text="⚠️ 模拟数据，仅供演示", xref="paper", yref="paper", x=0.5, y=1.08, showarrow=False, font=dict(color="#e67e22", size=12))
        st.plotly_chart(fig, use_container_width=True, key=f"chart_{unique_key}")


# ─────────────────────────────────────────────
#  主渲染函数：电脑端（并排布局）
# ─────────────────────────────────────────────
def render_desktop_ui(
    funds: list,
    weights: list,
    achieved: dict,
    risk_level: str,
    target_alloc: dict,
    capital: float,
    weighted_avg_fee: float | None = None,
    is_new_fund: list | None = None,
    tab_name: str = "t1",
):
    # ── 区块一：标准组合构成 ──────────────────────────────
    with st.container():
        left_col, right_col = st.columns([1, 1], gap="large")

        with left_col:
            render_standard_portfolio_table(risk_level, target_alloc)

        with right_col:
            st.markdown("### 🔍 穿透汇总 vs 标准基准")
            st.caption("各基金底层持仓加权后 vs SCB 目标")
            render_penetration_metrics(achieved, target_alloc, device="desktop")
            st.write("")
            render_penetration_summary(achieved, target_alloc)

    st.divider()

    # ── 区块二：建议落地基金 + 底层穿透明细 ──────────────
    render_fund_penetration_table(
        funds, weights, capital,
        weighted_avg_fee=weighted_avg_fee,
        is_new_fund=is_new_fund,
    )
    render_fee_summary(funds, weights, capital)

    # ── 区块三：每只基金详细穿透卡片 ─────────────────────
    st.markdown("### 🃏 各基金底层持仓明细")
    st.caption("展示每只建议基金的底层资产构成，帮助理解如何逼近标准组合")

    cols = st.columns(len(funds))
    for i, (f, w) in enumerate(zip(funds, weights)):
        fund_data = MRF_POOL[f]
        fee = fund_data.get("fee_rate") or 0.0
        with cols[i]:
            with st.container(border=True):
                st.markdown(f"**{f}**")
                st.caption(f"品牌: {fund_data['brand']} | 申购费: {fee:.2f}%")
                st.markdown(f"配置权重: **{w*100:.1f}%** | 买入: **¥{capital*w:,.0f}**")
                st.write("")
                # 底层持仓可视化
                for asset, color in [("股票", "#1d6fa4"), ("固定收益", "#2c8c6b"), ("现金", "#8c8c8c")]:
                    pct = fund_data[asset]
                    contribution = pct * w
                    st.markdown(
                        f"<div style='margin-bottom:4px;'>"
                        f"  <span style='font-size:12px;color:#555;'>{asset}</span>"
                        f"  <span style='float:right;font-size:12px;font-weight:600;'>{pct}%</span>"
                        f"</div>"
                        f"<div style='background:#eee;border-radius:4px;height:8px;margin-bottom:8px;'>"
                        f"  <div style='background:{color};width:{pct}%;height:8px;border-radius:4px;'></div>"
                        f"</div>"
                        f"<div style='font-size:11px;color:#888;margin-bottom:10px;'>"
                        f"  贡献至组合: {contribution:.1f}%"
                        f"</div>",
                        unsafe_allow_html=True
                    )
                with st.expander("📈 净值走势 & 历史收益"):
                    render_fund_nav_chart(f, unique_key=f"{tab_name}_{risk_level}_{f}_{i}")

    # ── 区块四：自定义 Portfolio 构建器 ─────────────────────
    _render_custom_portfolio_builder(risk_level, target_alloc, capital, tab_name, device="desktop")


# ─────────────────────────────────────────────
#  主渲染函数：手机端（竖向布局）
# ─────────────────────────────────────────────
def render_mobile_ui(
    funds: list,
    weights: list,
    achieved: dict,
    risk_level: str,
    target_alloc: dict,
    capital: float,
    weighted_avg_fee: float | None = None,
    is_new_fund: list | None = None,
    tab_name: str = "t1",
):
    # 标准组合构成（折叠）
    with st.expander("📊 标准组合构成（点击展开）", expanded=False):
        render_standard_portfolio_table(risk_level, target_alloc)

    st.write("---")

    # 穿透指标
    st.markdown("#### 穿透结果 vs 基准")
    render_penetration_metrics(achieved, target_alloc, device="mobile")

    st.write("---")

    # 落地基金卡片
    st.markdown("#### 💼 具体买入清单")
    for i, f in enumerate(funds):
        fee = MRF_POOL[f].get("fee_rate") or 0.0
        tag = " ✅ 新增" if (is_new_fund and i < len(is_new_fund) and is_new_fund[i]) else " ➕ 复用"
        with st.container(border=True):
            st.markdown(f"**{f}**{tag if is_new_fund else ''}")
            st.markdown(f"**配置权重**: `{weights[i] * 100:.1f}%` ｜ **金额**: `¥{capital * weights[i]:,.0f}` ｜ 申购费 {fee:.2f}%")
            st.caption(f"底层物理持仓: 股{MRF_POOL[f]['股票']}% / 债{MRF_POOL[f]['固定收益']}% / 现{MRF_POOL[f]['现金']}%")
            with st.expander("📈 净值走势"):
                render_fund_nav_chart(f, unique_key=f"{tab_name}_{risk_level}_{f}_{i}")
    if weighted_avg_fee is not None:
        st.caption(f"组合加权平均申购费 = **{weighted_avg_fee:.2f}%**")
    render_fee_summary(funds, weights, capital)

    st.write("---")
    render_penetration_summary(achieved, target_alloc)

    _render_custom_portfolio_builder(risk_level, target_alloc, capital, tab_name, device="mobile")


# ─────────────────────────────────────────────
#  自定义 Portfolio 构建器（每 Tab 底部 expander）
# ─────────────────────────────────────────────
def _key_safe(s: str) -> str:
    """用于 Streamlit key 的简短安全字符串（去空格、括号等）。"""
    return (s or "").replace(" ", "_").replace("(", "").replace(")", "").replace("-", "_")[:30]


def _render_custom_portfolio_builder(
    risk_level: str, target_alloc: dict, capital: float, tab_name: str, device: str = "desktop"
):
    """展开后：选基金 → 分配权重 → 计算穿透与拟合度。"""
    rk = _key_safe(risk_level)
    with st.expander("🛠️ 自定义 Portfolio 构建器", expanded=False):
        st.markdown("#### 第一步：选择你的基金组合")
        if device == "mobile":
            st.caption("下滑列表，点击勾选要纳入组合的基金（可多选）")
            selected_funds = []
            for f in MRF_POOL.keys():
                fd = MRF_POOL[f]
                short = f"股{fd['股票']}% 债{fd['固定收益']}% 现{fd['现金']}%"
                cb_key = f"custom_cb_{rk}_{tab_name}_{_key_safe(f)}"
                if st.checkbox(f"{f}（{short}）", key=cb_key):
                    selected_funds.append(f)
        else:
            selected_funds = st.multiselect(
                "从基金池中选择（可多选）",
                options=list(MRF_POOL.keys()),
                default=[],
                key=f"custom_funds_{rk}_{tab_name}",
            )

        if not selected_funds:
            st.caption("请至少选择一只基金后分配权重。")
            return

        st.markdown("#### 第二步：分配权重")
        st.caption("拖动滑块分配各基金权重，总和须等于 100%。可先点「等权分配」再微调。")
        n = len(selected_funds)
        equal = 100 // n
        defaults = [equal] * n
        defaults[-1] += 100 - sum(defaults)

        if st.button("⚖️ 等权分配", key=f"equal_weight_{rk}_{tab_name}"):
            for i, f in enumerate(selected_funds):
                w_key = f"weight_{_key_safe(f)}_{rk}_{tab_name}"
                st.session_state[w_key] = defaults[i]
            st.rerun()

        weights_vals = []
        for i, f in enumerate(selected_funds):
            fd = MRF_POOL[f]
            lab = f"{f}（底层：股{fd['股票']}% / 债{fd['固定收益']}% / 现{fd['现金']}%）"
            w_key = f"weight_{_key_safe(f)}_{rk}_{tab_name}"
            default_val = defaults[i] if w_key not in st.session_state else st.session_state[w_key]
            v = st.slider(lab, min_value=0, max_value=100, value=default_val, step=5, key=w_key)
            weights_vals.append((f, v))

        total = sum(v for _, v in weights_vals)
        if total == 100:
            st.success(f"✅ 权重合计：{total}%")
        else:
            st.warning(f"⚠️ 权重合计：{total}%，请调整至 100%")

        st.markdown("#### 第三步：计算结果")
        if total != 100:
            st.caption("权重合计为 100% 后可查看穿透与拟合度。")
            return

        if st.button("🔍 计算自定义组合", key=f"calc_{rk}_{tab_name}"):
            st.session_state[f"custom_calc_done_{rk}_{tab_name}"] = True
        if not st.session_state.get(f"custom_calc_done_{rk}_{tab_name}", False):
            return

        w_list = [v / 100.0 for _, v in weights_vals]
        selected_funds_ordered = [f for f, _ in weights_vals]
        custom_achieved = _compute_achieved(selected_funds_ordered, w_list)

        # A. 综合费率
        st.markdown("**A. 综合费率**")
        render_fee_summary(selected_funds_ordered, w_list, capital)

        # B. 穿透后资产配置
        st.markdown("**B. 穿透后资产配置**")
        if device == "mobile":
            cc1, cc2 = st.columns(2)
            cc1.metric("📉 股票", f"{custom_achieved['股票']:.1f}%", f"基准 {target_alloc['股票']}%", delta_color="off")
            cc2.metric("🛡️ 固收", f"{custom_achieved['固定收益']:.1f}%", f"基准 {target_alloc['固定收益']}%", delta_color="off")
            cc3, cc4 = st.columns(2)
            cc3.metric("🥇 黄金", "0.0% (缺项)", delta_color="off")
            cc4.metric("💵 现金", f"{custom_achieved['现金']:.1f}%", f"基准 {target_alloc['现金']}%", delta_color="off")
        else:
            dc1, dc2, dc3, dc4 = st.columns(4)
            dc1.metric("📉 穿透: 股票", f"{custom_achieved['股票']:.1f}%", f"基准 {target_alloc['股票']}%", delta_color="off")
            dc2.metric("🛡️ 穿透: 固收", f"{custom_achieved['固定收益']:.1f}%", f"基准 {target_alloc['固定收益']}%", delta_color="off")
            dc3.metric("🥇 穿透: 黄金", "0.0% (缺项)", delta_color="off")
            dc4.metric("💵 穿透: 现金", f"{custom_achieved['现金']:.1f}%", f"基准 {target_alloc['现金']}%", delta_color="off")

        # C. 拟合度
        score = calc_fit_score(custom_achieved, target_alloc)
        st.metric("🎯 与标准组合拟合度", f"{score:.1f} / 100", delta=None)
        if score >= 85:
            st.caption("🟢 优秀 — 高度贴合标准组合")
        elif score >= 70:
            st.caption("🟡 良好 — 基本符合风险目标")
        elif score >= 50:
            st.caption("🟠 一般 — 偏离较大，建议调整")
        else:
            st.caption("🔴 较差 — 与标准组合差异显著")

        # D. 偏差明细表
        st.markdown("**D. 偏差明细表**")
        rows = []
        for asset, target_pct in target_alloc.items():
            ach = custom_achieved.get(asset, 0.0)
            diff = ach - target_pct
            diff_str = f"+{diff:.1f}%" if diff > 0 else (f"{diff:.1f}%" if diff != 0 else "持平")
            status = "✅" if abs(diff) <= 5 else ("⚠️ 缺项" if diff < -5 else "⚠️ 超配")
            rows.append({"资产类别": asset, "标准目标%": target_pct, "自定义组合%": round(ach, 1), "偏差": diff_str, "状态": status})
        st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)

        # E. 自定义组合基金明细
        st.markdown("**E. 自定义组合基金明细**")
        e_rows = []
        for f, v in weights_vals:
            w = v / 100.0
            fd = MRF_POOL[f]
            fee = fd.get("fee_rate") or 0.0
            e_rows.append({
                "基金": f,
                "权重%": v,
                "股/债/现": f"{fd['股票']}/{fd['固定收益']}/{fd['现金']}",
                "申购费率%": fee,
                "申购费估算¥": round(capital * w * fee / 100),
            })
        st.dataframe(pd.DataFrame(e_rows), use_container_width=True, hide_index=True)


# ─────────────────────────────────────────────
#  每日报告 PDF / 市场播客
# ─────────────────────────────────────────────
def _parse_date_from_filename(name: str) -> str:
    """从文件名解析 YYYYMMDD，若没有则返回空。"""
    import re
    m = re.match(r"^(\d{8})", name)
    return m.group(1) if m else ""


def _yyyymm_from_filename(name: str) -> str:
    """从文件名解析 YYYYMM（年月），用于筛选。"""
    s = _parse_date_from_filename(name)
    return s[:6] if len(s) >= 6 else ""


def _title_from_filename(name: str) -> str:
    """去掉日期前缀后的标题。"""
    import re
    s = re.sub(r"^\d{8}[\s_\-]*", "", name)
    return Path(s).stem if s else name


def _render_daily_reports_tab():
    """每日报告：列出 pdfs 目录下 PDF，卡片 + 查看报告链接。"""
    st.markdown("### 📄 每日报告")
    if not MARKET_PDFS.exists():
        st.info("暂无报告，敬请期待。")
        return
    pdfs = sorted(MARKET_PDFS.glob("*.pdf"), key=lambda p: p.name, reverse=True)
    if not pdfs:
        st.info("暂无报告，敬请期待。")
        return
    for p in pdfs:
        with st.container(border=True):
            title = _title_from_filename(p.name)
            date_str = _parse_date_from_filename(p.name)
            if date_str and len(date_str) >= 8:
                date_str = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
            size_mb = p.stat().st_size / (1024 * 1024)
            st.markdown(f"**{title}**")
            st.caption(f"日期：{date_str} ｜ 大小：{size_mb:.2f} MB")
            url = f"{FILE_SERVER_BASE_URL}/pdfs/{urllib.parse.quote(p.name)}"
            st.markdown(f'<a href="{url}" target="_blank" rel="noopener">查看报告</a>', unsafe_allow_html=True)


def _render_podcast_tab():
    """市场播客：列出 podcasts 目录下 mp3/m4a/wav，嵌入 st.audio 播放。"""
    st.markdown("### 🎙️ 市场播客")
    if not MARKET_PODCASTS.exists():
        st.info("暂无播客，敬请期待。")
        return
    exts = (".mp3", ".m4a", ".wav")
    audios = [p for p in MARKET_PODCASTS.iterdir() if p.suffix.lower() in exts]
    audios.sort(key=lambda p: p.name, reverse=True)
    if not audios:
        st.info("暂无播客，敬请期待。")
        return
    for p in audios:
        with st.container(border=True):
            title = _title_from_filename(p.name)
            date_str = _parse_date_from_filename(p.name)
            if date_str and len(date_str) >= 8:
                date_str = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
            st.markdown(f"**{title}**")
            if date_str:
                st.caption(f"日期：{date_str}")
            with open(p, "rb") as f:
                st.audio(f.read(), format=f"audio/{p.suffix.lower().lstrip('.')}")


# ─────────────────────────────────────────────
#  引导页
# ─────────────────────────────────────────────
# ─────────────────────────────────────────────
if st.session_state.device is None:
    st.title("🎯 锦城轮动系统 · JinCity Rotation Engine")
    st.write("请选择入口与设备：")

    st.subheader("锦城轮动系统 · JinCity Rotation Engine")
    r1c1, r1c2 = st.columns(2)
    with r1c1:
        st.button("📱 手机", key="cfg_mobile", on_click=set_device, args=("mobile", "config"), use_container_width=True)
    with r1c2:
        st.button("💻 电脑", key="cfg_desktop", on_click=set_device, args=("desktop", "config"), use_container_width=True)

    st.write("")
    st.subheader("WMP NAV")
    r2c1, r2c2 = st.columns(2)
    with r2c1:
        st.button("📱 手机", key="wmp_mobile", on_click=set_device, args=("mobile", "wmp"), use_container_width=True)
    with r2c2:
        st.button("💻 电脑", key="wmp_desktop", on_click=set_device, args=("desktop", "wmp"), use_container_width=True)

    st.write("")
    st.subheader("📝 市场笔记")
    st.button("进入市场笔记 →", key="notes_enter", on_click=set_device, args=("desktop", "notes"), use_container_width=True)

    st.write("")
    st.subheader("🎙️ 播客")
    st.button("进入播客 →", key="podcast_enter", on_click=set_device, args=("desktop", "podcast"), use_container_width=True)

    st.markdown("---")
    quote_text, quote_author = get_daily_quote()
    st.markdown(
        f"""
        <div style='text-align:center; padding: 20px 40px; color: #aaa;'>
            <p style='font-style:italic; font-size:15px; margin-bottom:6px;'>"{quote_text}"</p>
            <p style='font-size:12px; letter-spacing:1px;'>— {quote_author}</p>
        </div>
        """,
        unsafe_allow_html=True
    )
    st.stop()

# 访客追踪
track_visitor()

# 全局合规提示
st.error("⚠️ **合规风险提示**：本模拟器仅作算法演示，不可作为实际交易决策！")

# ─────────────────────────────────────────────
#  WMP 入口
# ─────────────────────────────────────────────
if st.session_state.entry == "wmp":
    if st.session_state.device == "desktop":
        with st.sidebar:
            st.button("⬅️ 返回首页", on_click=back_to_landing)
    else:
        st.button("⬅️ 返回首页", on_click=back_to_landing)
    st.subheader("🏦 渣打 WMP 净值")
    if not WMP_AVAILABLE:
        st.error("**WMP 模块未加载**。请安装依赖后重启：`pip install requests beautifulsoup4`")
        if WMP_ERROR:
            st.code(WMP_ERROR, language="text")
    else:
        if st.button("🔄 抓取今日净值并写入 CSV"):
            with st.spinner("正在抓取渣打 WMP 页面…"):
                records = scrape_wmp()
            if records:
                init_db()
                n = insert_nav_records(records)
                st.success(f"已写入 {n} 条新记录（共抓取 {len(records)} 条）。")
            else:
                st.warning("未抓取到数据，请检查网络或稍后重试。")
        df_wmp = get_wmp_display_data()
        if df_wmp.empty:
            st.info("暂无净值历史数据。请先点击「抓取今日净值并写入 CSV」。")
        else:
            yield_cols = ["daily% 【年化】", "1W收益率% 【年化】", "1M收益率% 【年化】", "3M收益率% 【年化】"]
            def _color_yield(val):
                if val == "N/A" or not isinstance(val, str):
                    return ""
                try:
                    num = float(str(val).replace("%", "").strip())
                    if num > 0:
                        return "color: red"
                    if num < 0:
                        return "color: green"
                except ValueError:
                    pass
                return ""
            styled = df_wmp.style.apply(lambda s: [_color_yield(v) for v in s], subset=yield_cols)
            st.dataframe(styled, use_container_width=True, hide_index=True)
        st.caption("**赎回到账**：WMP 产品 T+1 到账；142890 T+2 到账；汇华 CIO 系列 T+5 到账。")
    st.stop()

# ─────────────────────────────────────────────
#  市场笔记入口（直接展示，上传/删除需密码）
# ─────────────────────────────────────────────
if st.session_state.entry == "notes":
    st.button("⬅️ 返回首页", on_click=back_to_landing)
    st.subheader("📝 市场笔记")
    # 删除确认
    if st.session_state.get("notes_delete_pending"):
        st.warning("确认删除该文件？此操作不可恢复。")
        c1, c2 = st.columns(2)
        with c1:
            st.button("确认删除", key="notes_confirm_del", on_click=_do_notes_delete, args=(st.session_state.notes_delete_pending,))
        with c2:
            st.button("取消", key="notes_cancel_del", on_click=_clear_notes_delete_pending)
        st.stop()
    # 左侧：月份筛选
    all_pdfs = sorted(MARKET_PDFS.glob("*.pdf"), key=lambda p: p.name, reverse=True)
    months = sorted({_yyyymm_from_filename(p.name) for p in all_pdfs if _yyyymm_from_filename(p.name)}, reverse=True)
    month_options = ["全部"] + months
    with st.sidebar:
        st.caption("📅 按月份筛选")
        selected_month = st.selectbox("月份", month_options, key="notes_month_filter", label_visibility="collapsed")
    if selected_month != "全部":
        pdfs = [p for p in all_pdfs if _yyyymm_from_filename(p.name) == selected_month]
    else:
        pdfs = all_pdfs
    # 主区：文件列表（按日期倒序）
    if not pdfs:
        st.info("暂无报告" if selected_month == "全部" else f"该月暂无报告")
    for p in pdfs:
        with st.container(border=True):
            row1 = st.columns([5, 1] if st.session_state.get("notes_upload_unlocked", False) else [1])
            with row1[0]:
                title = _title_from_filename(p.name)
                date_str = _parse_date_from_filename(p.name)
                if date_str and len(date_str) >= 8:
                    date_str = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
                size_mb = p.stat().st_size / (1024 * 1024)
                st.markdown(f"**{title}**")
                st.caption(f"日期：{date_str} ｜ 大小：{size_mb:.2f} MB")
                url = f"{FILE_SERVER_BASE_URL}/pdfs/{urllib.parse.quote(p.name)}"
                st.markdown(f'<a href="{url}" target="_blank" rel="noopener">📄 查看报告</a>', unsafe_allow_html=True)
            if st.session_state.get("notes_upload_unlocked", False) and len(row1) > 1:
                with row1[1]:
                    st.button("🗑️ 删除", key=f"notes_del_{p.name}", on_click=_set_notes_delete_pending, args=(str(p),), type="secondary")
    # 底部：上传入口（密码后显示）
    st.write("")
    st.button("上传内容", key="notes_upload_btn", on_click=_notes_request_upload)
    if st.session_state.get("notes_show_pwd", False):
        pwd = st.text_input("请输入密码", type="password", key="notes_pwd")
        if pwd == "cd123":
            st.session_state.notes_upload_unlocked = True
            st.session_state.notes_show_pwd = False
            st.rerun()
        elif pwd:
            st.error("密码错误")
    if st.session_state.get("notes_upload_unlocked", False):
        st.success("✅ 已登录")
        up_pdf = st.file_uploader("上传 PDF 报告", type=["pdf"], key="notes_upload_pdf")
        if up_pdf is not None:
            today_prefix = _dt.date.today().strftime("%Y%m%d") + "_"
            filename = up_pdf.name
            if not (len(filename) >= 8 and filename[:8].isdigit()):
                filename = today_prefix + filename
            out = MARKET_PDFS / filename
            out.write_bytes(up_pdf.getvalue())
            st.success(f"上传成功 ✅ {filename}")
    st.stop()

# ─────────────────────────────────────────────
#  播客入口（直接展示，上传/删除需密码）
# ─────────────────────────────────────────────
if st.session_state.entry == "podcast":
    st.button("⬅️ 返回首页", on_click=back_to_landing)
    st.subheader("🎙️ 播客")
    # 删除确认
    if st.session_state.get("podcast_delete_pending"):
        st.warning("确认删除该文件？此操作不可恢复。")
        c1, c2 = st.columns(2)
        with c1:
            st.button("确认删除", key="podcast_confirm_del", on_click=_do_podcast_delete, args=(st.session_state.podcast_delete_pending,))
        with c2:
            st.button("取消", key="podcast_cancel_del", on_click=_clear_podcast_delete_pending)
        st.stop()
    exts = (".mp3", ".m4a", ".wav")
    all_audios = sorted([p for p in MARKET_PODCASTS.iterdir() if p.suffix.lower() in exts], key=lambda p: p.name, reverse=True)
    # 左侧：月份筛选
    months = sorted({_yyyymm_from_filename(p.name) for p in all_audios if _yyyymm_from_filename(p.name)}, reverse=True)
    month_options = ["全部"] + months
    with st.sidebar:
        st.caption("📅 按月份筛选")
        selected_month = st.selectbox("月份", month_options, key="podcast_month_filter", label_visibility="collapsed")
    if selected_month != "全部":
        audios = [p for p in all_audios if _yyyymm_from_filename(p.name) == selected_month]
    else:
        audios = all_audios
    # 主区：文件列表（按日期倒序）
    if not audios:
        st.info("暂无播客" if selected_month == "全部" else "该月暂无播客")
    for p in audios:
        with st.container(border=True):
            row1 = st.columns([5, 1] if st.session_state.get("podcast_upload_unlocked", False) else [1])
            with row1[0]:
                title = _title_from_filename(p.name)
                date_str = _parse_date_from_filename(p.name)
                if date_str and len(date_str) >= 8:
                    date_str = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
                size_mb = p.stat().st_size / (1024 * 1024)
                st.markdown(f"**{title}**")
                st.caption(f"日期：{date_str} ｜ 大小：{size_mb:.2f} MB")
                with open(p, "rb") as f:
                    st.audio(f.read(), format=f"audio/{p.suffix.lower().lstrip('.')}")
            if st.session_state.get("podcast_upload_unlocked", False) and len(row1) > 1:
                with row1[1]:
                    st.button("🗑️ 删除", key=f"podcast_del_{p.name}", on_click=_set_podcast_delete_pending, args=(str(p),), type="secondary")
    # 底部：上传入口（密码后显示）
    st.write("")
    st.button("上传内容", key="podcast_upload_btn", on_click=_podcast_request_upload)
    if st.session_state.get("podcast_show_pwd", False):
        pwd = st.text_input("请输入密码", type="password", key="podcast_pwd")
        if pwd == "cd123":
            st.session_state.podcast_upload_unlocked = True
            st.session_state.podcast_show_pwd = False
            st.rerun()
        elif pwd:
            st.error("密码错误")
    if st.session_state.get("podcast_upload_unlocked", False):
        st.success("✅ 已登录")
        up_audio = st.file_uploader("上传音频", type=["mp3", "m4a", "wav"], key="podcast_upload_audio")
        if up_audio is not None:
            today_prefix = _dt.date.today().strftime("%Y%m%d") + "_"
            filename = up_audio.name
            if not (len(filename) >= 8 and filename[:8].isdigit()):
                filename = today_prefix + filename
            out = MARKET_PODCASTS / filename
            out.write_bytes(up_audio.getvalue())
            st.success(f"上传成功 ✅ {filename}")
    st.stop()

# ─────────────────────────────────────────────
#  宏观资产配置主界面
# ─────────────────────────────────────────────
if st.session_state.device == "mobile":
    st.subheader("⚙️ 资产配置参数")
    risk_level = st.selectbox("投资目标 (SCB基准)", list(SCB_TARGET.keys()), index=0)
    capital = st.number_input("投资金额 (元)", min_value=10000, value=1000000, step=10000)
else:
    with st.sidebar:
        st.button("⬅️ 返回首页", on_click=back_to_landing)
        st.header("⚙️ 引擎控制台")
        risk_level = st.selectbox("投资目标 (SCB基准)", list(SCB_TARGET.keys()), index=0)
        capital = st.number_input("投资金额 (元)", min_value=10000, value=1000000, step=10000)

target_alloc = SCB_TARGET[risk_level]

# 当前基准一行摘要
st.write(
    f"当前基准：**渣打 - {risk_level}** "
    f"(股{target_alloc['股票']}% / 债{target_alloc['固定收益']}% / 金{target_alloc['黄金']}% / 现{target_alloc['现金']}%)"
)
st.divider()

# ─────────────────────────────────────────────
#  三组合：先统一算好再渲染，保证 Tab3 的 used_funds 与 Tab1/Tab2 一致
# ─────────────────────────────────────────────
res_fee = combo_fee_first(target_alloc)
res_opt = combo_optimizer(target_alloc)
used_funds_set = set(res_fee[0]) | set(res_opt[0])
res_div = combo_diversify(target_alloc, used_funds_set)

def _weighted_avg_fee(funds: list, weights: list) -> float:
    """组合加权平均申购费（%），fee_rate 存为百分点如 1.5 表示 1.5%。"""
    return sum((MRF_POOL[f].get("fee_rate") or 0.0) * w for f, w in zip(funds, weights))

is_mobile = st.session_state.device == "mobile"
_start_static_file_server()

tab_labels = (
    ["💰 精选 Portfolio（手续费优先）", "🎯 Model Portfolio（最优匹配）", "🔄 补充 Portfolio（差异化配置）", "📄 每日报告", "🎙️ 市场播客"]
    if is_mobile else
    ["💰 Tab1: 精选 Portfolio（手续费优先）", "🎯 Tab2: Model Portfolio（最优匹配）", "🔄 Tab3: 补充 Portfolio（差异化配置）", "📄 每日报告", "🎙️ 市场播客"]
)
t1, t2, t3, t4_pdf, t5_podcast = st.tabs(tab_labels)

with t1:
    f1, w1, a1 = res_fee
    waf1 = _weighted_avg_fee(f1, w1)
    if is_mobile:
        render_mobile_ui(f1, w1, a1, risk_level, target_alloc, capital, weighted_avg_fee=waf1, is_new_fund=None, tab_name="t1")
    else:
        render_desktop_ui(f1, w1, a1, risk_level, target_alloc, capital, weighted_avg_fee=waf1, is_new_fund=None, tab_name="t1")

with t2:
    f2, w2, a2 = res_opt
    if is_mobile:
        render_mobile_ui(f2, w2, a2, risk_level, target_alloc, capital, weighted_avg_fee=None, is_new_fund=None, tab_name="t2")
    else:
        render_desktop_ui(f2, w2, a2, risk_level, target_alloc, capital, weighted_avg_fee=None, is_new_fund=None, tab_name="t2")

with t3:
    f3, w3, a3 = res_div
    is_new = [f not in used_funds_set for f in f3]
    if is_mobile:
        render_mobile_ui(f3, w3, a3, risk_level, target_alloc, capital, weighted_avg_fee=None, is_new_fund=is_new, tab_name="t3")
    else:
        render_desktop_ui(f3, w3, a3, risk_level, target_alloc, capital, weighted_avg_fee=None, is_new_fund=is_new, tab_name="t3")

with t4_pdf:
    _render_daily_reports_tab()

with t5_podcast:
    _render_podcast_tab()

# ─────────────────────────────────────────────
#  引擎状态监控（折叠）
# ─────────────────────────────────────────────
st.divider()
with st.expander("♏ 引擎状态监控", expanded=False):
    try:
        import supabase
        if "SUPABASE_URL" in st.secrets and "SUPABASE_KEY" in st.secrets:
            client = supabase.create_client(st.secrets["SUPABASE_URL"], st.secrets["SUPABASE_KEY"])
            res = client.table("visitor_logs").select("*").order("last_visit", desc=True).execute()
            logs = res.data
            st.caption(f"👁️ 累计独立访客: {len(logs)}")
            if logs:
                df_logs = pd.DataFrame(logs)
                if set(["ip", "visits", "last_visit"]).issubset(df_logs.columns):
                    df_logs = df_logs[["ip", "visits", "last_visit"]]
                    df_logs.columns = ["访客 IP/定位", "频次", "最后出没"]
                st.dataframe(df_logs, hide_index=True, use_container_width=True)
    except Exception:
        pass

quote_text, quote_author = get_daily_quote()
st.markdown("---")
st.markdown(
    f"""
    <div style='text-align:center; padding: 20px 40px; color: #aaa;'>
        <p style='font-style:italic; font-size:15px; margin-bottom:6px;'>"{quote_text}"</p>
        <p style='font-size:12px; letter-spacing:1px;'>— {quote_author}</p>
    </div>
    """,
    unsafe_allow_html=True
)
