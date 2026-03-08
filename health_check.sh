#!/usr/bin/env bash
# =============================================================================
# Linux VPS 健康检查脚本 (Ubuntu/Debian)
#
# 用途：输出系统基础信息、资源使用、网络状态、进程与异常、可选服务等，
#       并生成初步诊断摘要，便于日常维护与排障。
#
# 运行方式：
#   ./health_check.sh           # 默认完整检查
#   ./health_check.sh --full    # 完整检查
#   ./health_check.sh --quick   # 快速检查（基础+资源+关键网络+诊断）
#
# 推荐使用 sudo 执行，以便完整读取 journalctl、dmesg、ss、/var/log 等。
# 结果同时输出到终端和日志文件：health_report_YYYY-MM-DD_HHMMSS.log
# =============================================================================

set -u
# 不使用 set -e，避免单条命令失败导致脚本退出

# 日志文件名
REPORT_FILE="health_report_$(date +%F_%H%M%S).log"
# 模式：full | quick
MODE="full"
[ "${1:-}" = "--quick" ] && MODE="quick"
[ "${1:-}" = "--full" ]  && MODE="full"

# 输出到终端并追加到日志
log() {
    echo "$@" | tee -a "$REPORT_FILE"
}

section() {
    log ""
    log "=============================================================================="
    log "$1"
    log "=============================================================================="
}

sub() {
    log ""
    log "--- $1 ---"
}

# 执行命令，失败不退出，缺失命令时提示 [SKIP]
run_cmd() {
    local name="$1"
    shift
    if ! command -v "$1" &>/dev/null; then
        log "[SKIP] $name not installed"
        return 0
    fi
    "$@" 2>&1 | tee -a "$REPORT_FILE" || log "[WARN] command returned non-zero"
}

# 执行可能需 root 的命令，失败静默跳过
run_cmd_opt() {
    local name="$1"
    shift
    if ! command -v "$1" &>/dev/null; then
        log "[SKIP] $name not installed"
        return 0
    fi
    "$@" 2>/dev/null | tee -a "$REPORT_FILE" || true
}

# ---------- 仅 quick 时也执行的基础块 ----------
do_basic() {
    section "【系统基础信息】"
    sub "hostname"
    hostname 2>/dev/null | tee -a "$REPORT_FILE" || log "[SKIP] hostname"
    sub "当前时间"
    date 2>/dev/null | tee -a "$REPORT_FILE" || log "[SKIP] date"
    sub "uptime"
    uptime 2>/dev/null | tee -a "$REPORT_FILE" || log "[SKIP] uptime"
    sub "内核版本"
    uname -r 2>/dev/null | tee -a "$REPORT_FILE" || log "[SKIP] uname"
    sub "操作系统版本"
    [ -f /etc/os-release ] && grep -E "^(NAME|VERSION)=" /etc/os-release | sed 's/^/  /' | tee -a "$REPORT_FILE" || log "  [SKIP] /etc/os-release"
    sub "公网 IP"
    (curl -s --connect-timeout 3 ifconfig.me 2>/dev/null || curl -s --connect-timeout 3 icanhazip.com 2>/dev/null) | tee -a "$REPORT_FILE" || log "  [SKIP] 无法获取"
    sub "最近启动时间"
    if [ -r /proc/uptime ]; then
        uptime_sec=$(awk '{print int($1)}' /proc/uptime)
        boot_epoch=$(($(date +%s) - uptime_sec))
        log "  $(date -d "@$boot_epoch" 2>/dev/null || date -r "$boot_epoch" 2>/dev/null || echo "  $boot_epoch")"
    else
        log "  [SKIP] /proc/uptime"
    fi
}

do_resources() {
    section "【资源使用】"
    sub "load average"
    [ -r /proc/loadavg ] && log "  $(cat /proc/loadavg)" || log "[SKIP] /proc/loadavg"
    sub "CPU 使用率 (top -bn1 前5行)"
    run_cmd "top" top -bn1 2>/dev/null | head -5
    sub "内存 (free -h)"
    run_cmd "free" free -h
    sub "swap"
    run_cmd "swapon" swapon --show 2>/dev/null || log "  (无 swap 或不可读)"
    sub "磁盘 (df -h)"
    df -h 2>/dev/null | tee -a "$REPORT_FILE" || log "[SKIP] df"
    sub "磁盘 inode (df -i)"
    df -i 2>/dev/null | tee -a "$REPORT_FILE" || log "[SKIP] df -i"
    sub "磁盘 IO (iostat)"
    if command -v iostat &>/dev/null; then
        iostat -x 1 2 2>/dev/null | tee -a "$REPORT_FILE" || true
    else
        log "[SKIP] iostat not installed (可选: apt install sysstat)"
    fi
}

do_network_quick() {
    section "【网络状态（摘要）】"
    sub "ESTABLISHED 连接数"
    if command -v ss &>/dev/null; then
        cnt=$(ss -tun state established 2>/dev/null | tail -n +2 | wc -l)
        log "  $cnt"
    elif command -v netstat &>/dev/null; then
        cnt=$(netstat -tun 2>/dev/null | grep -c ESTABLISHED || echo 0)
        log "  $cnt"
    else
        log "[SKIP] ss/netstat not installed"
    fi
    sub "ping 1.1.1.1 (5次)"
    run_cmd_opt "ping" ping -c 5 1.1.1.1
    sub "ping 8.8.8.8 (5次)"
    run_cmd_opt "ping" ping -c 5 8.8.8.8
}

do_network_full() {
    section "【网络状态】"
    sub "网卡 (ip addr)"
    run_cmd_opt "ip" ip addr
    sub "网卡统计 (ip -s link)"
    run_cmd_opt "ip" ip -s link
    sub "路由表"
    run_cmd_opt "ip" ip route || run_cmd_opt "route" route -n
    sub "ESTABLISHED 连接数"
    if command -v ss &>/dev/null; then
        cnt=$(ss -tun state established 2>/dev/null | tail -n +2 | wc -l)
        log "  $cnt"
    else
        run_cmd_opt "netstat" netstat -tun 2>/dev/null | grep -c ESTABLISHED || true
    fi
    sub "LISTEN 端口"
    run_cmd_opt "ss" ss -tuln || run_cmd_opt "netstat" netstat -tuln
    sub "socket 概览 (ss -s)"
    run_cmd_opt "ss" ss -s
    sub "ping 1.1.1.1 (5次)"
    run_cmd_opt "ping" ping -c 5 1.1.1.1
    sub "ping 8.8.8.8 (5次)"
    run_cmd_opt "ping" ping -c 5 8.8.8.8
    sub "路由测试 1.1.1.1"
    if command -v traceroute &>/dev/null; then
        traceroute -n -m 10 1.1.1.1 2>/dev/null | head -15 | tee -a "$REPORT_FILE" || true
    elif command -v tracepath &>/dev/null; then
        tracepath -n 1.1.1.1 2>/dev/null | head -15 | tee -a "$REPORT_FILE" || true
    else
        log "[SKIP] traceroute/tracepath not installed"
    fi
    sub "网络相关内核/日志"
    if command -v dmesg &>/dev/null; then
        dmesg 2>/dev/null | grep -iE "drop|retransmit|error|fail|link" | tail -20 | tee -a "$REPORT_FILE" || true
    fi
    if command -v journalctl &>/dev/null; then
        journalctl -k -n 200 --no-pager 2>/dev/null | grep -iE "drop|retransmit|error|fail|link" | tail -15 | tee -a "$REPORT_FILE" || true
    fi
}

do_process_full() {
    section "【进程与异常】"
    sub "top 10 CPU"
    run_cmd "ps" ps aux --sort=-%cpu 2>/dev/null | head -11
    sub "top 10 内存"
    run_cmd "ps" ps aux --sort=-%mem 2>/dev/null | head -11
    sub "高占用 (python/node/xray/v2ray/nginx/docker)"
    for name in python node xray v2ray nginx docker; do
        cnt=$(pgrep -c -f "$name" 2>/dev/null || echo 0)
        [ "${cnt:-0}" -gt 0 ] && log "  $name: $cnt 个进程" && ps aux 2>/dev/null | grep -F "$name" | grep -v grep | head -3 | tee -a "$REPORT_FILE"
    done
    sub "系统错误日志 (journalctl -p err -n 50)"
    run_cmd_opt "journalctl" journalctl -p err -n 50 --no-pager
    sub "内核日志 (dmesg tail 100)"
    run_cmd_opt "dmesg" dmesg 2>/dev/null | tail -100
    sub "OOM 检查"
    if command -v dmesg &>/dev/null; then
        if dmesg 2>/dev/null | grep -qi "out of memory\|oom\|killed process"; then
            log "  [注意] 发现 OOM 相关记录"
            dmesg 2>/dev/null | grep -i "out of memory\|oom\|killed" | tail -5 | tee -a "$REPORT_FILE"
        else
            log "  未发现近期 OOM"
        fi
    else
        log "[SKIP] dmesg (建议 sudo)"
    fi
    sub "SSH 登录失败/爆破"
    for f in /var/log/auth.log /var/log/secure; do
        [ -r "$f" ] || continue
        log "  文件: $f"
        n=$(grep -c "Failed password" "$f" 2>/dev/null || echo 0)
        log "  Failed password 条数: $n"
        grep "Failed password" "$f" 2>/dev/null | tail -3 | tee -a "$REPORT_FILE"
        break
    done
    if command -v journalctl &>/dev/null; then
        journalctl -u ssh* -u sshd* --no-pager -n 20 2>/dev/null | grep -i "failed\|invalid" | tail -5 | tee -a "$REPORT_FILE" || true
    fi
}

do_services_full() {
    section "【可选服务检查】"
    if ! command -v systemctl &>/dev/null; then
        log "[SKIP] systemctl not available"
        return 0
    fi
    for svc in xray v2ray nginx docker sshd; do
        if systemctl list-unit-files --type=service 2>/dev/null | grep -q "^${svc}.service"; then
            sub "服务 $svc"
            systemctl status "$svc" --no-pager -l 2>/dev/null | head -12 | tee -a "$REPORT_FILE" || log "  状态获取失败"
        fi
    done
    sub "xray/v2ray 配置路径"
    for path in /usr/local/etc/xray/config.json /etc/xray/config.json /usr/local/etc/v2ray/config.json /etc/v2ray/config.json; do
        [ -e "$path" ] && log "  存在: $path"
    done
}

do_summary() {
    section "【初步诊断摘要】"
    SUMMARY=""
    # CPU 负载
    NPROC=$(nproc 2>/dev/null || echo 1)
    LOAD=$(awk '{print $1}' /proc/loadavg 2>/dev/null || echo 0)
    if [ -n "$LOAD" ] && [ -n "$NPROC" ]; then
        if awk -v l="$LOAD" -v n="$NPROC" 'BEGIN{exit !(l>n*2)}' 2>/dev/null; then
            SUMMARY="${SUMMARY}- CPU 负载偏高 (load=$LOAD, 核数=$NPROC)\n"
        fi
    fi
    # 内存/swap
    if command -v free &>/dev/null; then
        mem_total=$(free -b 2>/dev/null | awk '/^Mem:/{print $2}')
        mem_avail=$(free -b 2>/dev/null | awk '/^Mem:/{print $7}')
        [ -n "$mem_total" ] && [ "${mem_total:-0}" -gt 0 ] && pct=$(( (mem_total - mem_avail) * 100 / mem_total )) && [ "$pct" -ge 90 ] && SUMMARY="${SUMMARY}- 内存使用率较高 (约 ${pct}%)\n"
        swap_total=$(free -b 2>/dev/null | awk '/^Swap:/{print $2}')
        swap_used=$(free -b 2>/dev/null | awk '/^Swap:/{print $3}')
        [ -n "$swap_total" ] && [ "${swap_total:-0}" -gt 0 ] && [ -n "$swap_used" ] && spct=$(( swap_used * 100 / swap_total )) && [ "$spct" -ge 50 ] && SUMMARY="${SUMMARY}- swap 使用率较高，存在内存压力\n"
    fi
    # 磁盘
    while read -r line; do
        pct=$(echo "$line" | awk '{print $5}' | tr -d '%')
        mp=$(echo "$line" | awk '{print $6}')
        [ -n "$pct" ] && [ "$pct" -ge 90 ] 2>/dev/null && SUMMARY="${SUMMARY}- 磁盘使用率偏高: $mp (${pct}%)\n"
    done < <(df -h 2>/dev/null | tail -n +2)
    while read -r line; do
        iuse=$(echo "$line" | awk '{print $5}' | tr -d '%')
        mp=$(echo "$line" | awk '{print $6}')
        [ -n "$iuse" ] && [ "$iuse" -ge 90 ] 2>/dev/null && SUMMARY="${SUMMARY}- 磁盘 inode 使用率偏高: $mp (${iuse}%)\n"
    done < <(df -i 2>/dev/null | tail -n +2)
    # 网络丢包
    [ -f "$REPORT_FILE" ] && grep -q "100% packet loss\|100% 丢失" "$REPORT_FILE" 2>/dev/null && SUMMARY="${SUMMARY}- 网络存在严重丢包 (ping 失败)\n"
    # SSH 爆破
    for f in /var/log/auth.log /var/log/secure; do
        [ -r "$f" ] || continue
        fc=$(grep -c "Failed password" "$f" 2>/dev/null || echo 0)
        [ "${fc:-0}" -gt 100 ] && SUMMARY="${SUMMARY}- 存在较多 SSH 登录失败记录，可能有爆破迹象\n"
        break
    done
    # OOM
    command -v dmesg &>/dev/null && dmesg 2>/dev/null | grep -qi "out of memory\|oom kill" && SUMMARY="${SUMMARY}- 曾发生 OOM kill\n"
    # 服务异常 (简单检查)
    if command -v systemctl &>/dev/null; then
        for svc in xray v2ray nginx docker sshd; do
            if systemctl list-unit-files --type=service 2>/dev/null | grep -q "^${svc}.service"; then
                if ! systemctl is-active --quiet "$svc" 2>/dev/null; then
                    SUMMARY="${SUMMARY}- 服务 $svc 未在运行\n"
                fi
            fi
        done
    fi
    [ -z "$SUMMARY" ] && SUMMARY="未发现明显异常。建议结合上述数据人工复核。\n"
    echo -e "$SUMMARY" | tee -a "$REPORT_FILE"
}

# ========== 主流程 ==========
echo "Health check started at $(date)" | tee "$REPORT_FILE"
log "Mode: $MODE | Report: $REPORT_FILE | User: $(whoami)"
log "[Tip] 建议使用 sudo 运行以完整读取 journalctl、dmesg、/var/log 等"
log ""

do_basic
do_resources

if [ "$MODE" = "quick" ]; then
    do_network_quick
else
    do_network_full
    do_process_full
    do_services_full
fi

do_summary

log ""
log "Health check finished at $(date)"
log "Report saved to: $REPORT_FILE"
