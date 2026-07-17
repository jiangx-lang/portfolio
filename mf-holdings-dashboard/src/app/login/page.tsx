"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Sparkles,
  Gem,
  Crown,
  TrendingUp,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  User,
  Loader2,
  AlertTriangle,
  LogIn,
  UserPlus,
} from "lucide-react";
import { LEVELS, FEATURES } from "@/lib/progress";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

type AuthMode = "login" | "register";

const modeTabs: { key: AuthMode; label: string; icon: typeof LogIn }[] = [
  { key: "login", label: "登录", icon: LogIn },
  { key: "register", label: "注册", icon: UserPlus },
];

/* Lv1–3 等级预览：图标渐进（Sparkles → Gem → Crown），数据取自 progress 体系 */
const levelSteps = [
  {
    level: 1,
    icon: Sparkles,
    iconTone: "text-slate-300 border-white/10 bg-white/[0.04]",
    def: LEVELS[0],
    features: FEATURES.filter((f) => f.requiredLevel === 1).slice(0, 3),
  },
  {
    level: 2,
    icon: Gem,
    iconTone: "text-info border-info/25 bg-info/[0.07]",
    def: LEVELS[1],
    features: FEATURES.filter((f) => f.requiredLevel === 2).slice(0, 3),
  },
  {
    level: 3,
    icon: Crown,
    iconTone: "text-gold border-gold/30 bg-gold/[0.08]",
    def: LEVELS[2],
    features: FEATURES.filter((f) => f.requiredLevel === 3).slice(0, 3),
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (!username.trim() || !password) return false;
    if (mode === "register" && !confirmPassword) return false;
    return true;
  }, [loading, username, password, confirmPassword, mode]);

  const switchMode = (next: AuthMode) => {
    if (next === mode) return;
    setMode(next);
    setError("");
    setPassword("");
    setConfirmPassword("");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    // 注册模式先走前端校验：不通过则本地提示，不发请求
    if (mode === "register") {
      if (!/^[a-z0-9_]{3,20}$/.test(username.trim().toLowerCase())) {
        setError("用户名需为 3-20 位字母、数字或下划线");
        return;
      }
      if (password.length < 6) {
        setError("密码至少 6 位");
        return;
      }
      if (password !== confirmPassword) {
        setError("两次输入的密码不一致");
        return;
      }
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        mode === "login" ? "/api/auth/login" : "/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          data?.error ||
            (mode === "login" ? "用户名或密码错误" : "注册失败，请稍后重试")
        );
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-navy text-slate-100">
      {/* 背景：基底渐变 + 克制光斑 + 细网格 */}
      <div className="absolute inset-0 bg-gradient-dark" />
      <div
        className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(148,163,194,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,194,0.05)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_75%_65%_at_50%_40%,black,transparent)]"
        aria-hidden
      />
      <motion.div
        className="absolute top-[8%] left-[12%] w-80 h-80 rounded-full bg-info/10 blur-[130px]"
        animate={{ y: [0, -18, 0], x: [0, 10, 0], opacity: [0.25, 0.4, 0.25] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" as const }}
      />
      <motion.div
        className="absolute top-[30%] right-[10%] w-96 h-96 rounded-full bg-info/[0.07] blur-[140px]"
        animate={{ y: [0, -14, 0], x: [0, -8, 0], opacity: [0.2, 0.35, 0.2] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" as const, delay: 3 }}
      />
      <motion.div
        className="absolute bottom-[12%] left-[32%] w-80 h-80 rounded-full bg-gold/[0.08] blur-[130px]"
        animate={{ y: [0, -16, 0], x: [0, 6, 0], opacity: [0.18, 0.32, 0.18] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" as const, delay: 6 }}
      />

      <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">
        {/* 左侧 —— 品牌与等级预览（lg 以上显示） */}
        <motion.div
          className="hidden lg:flex lg:w-[55%] xl:w-1/2 flex-col justify-center px-12 xl:px-20 py-16"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="mb-10">
            <span className="eyebrow mb-5">Private Research · Members Only</span>
            <h1 className="font-display text-6xl xl:text-7xl font-bold leading-none tracking-wide text-gradient-gold mt-4 mb-5">
              ATLAS
            </h1>
            <p className="font-display text-xl xl:text-2xl text-slate-200 mb-4">
              以研究丈量世界，让每一次使用都沉淀为专属能力。
            </p>
            <p className="text-sm text-slate-400 max-w-xl leading-relaxed">
              登录后，每一次浏览、每一次 AI 摘要、每一次阅读，都会累积为你的成长等级。
              没有付费墙，只有对你使用价值的回馈。
            </p>
          </motion.div>

          {/* Lv1–3 纵向步骤感卡片 */}
          <div className="relative space-y-3 max-w-xl">
            <div
              className="absolute left-[38px] top-9 bottom-9 w-px bg-gradient-to-b from-white/10 via-gold/25 to-transparent"
              aria-hidden
            />
            {levelSteps.map((step) => (
              <motion.div
                key={step.level}
                variants={itemVariants}
                className="relative glass-card flex items-center gap-4 p-4"
              >
                <div
                  className={`w-11 h-11 shrink-0 rounded-xl border flex items-center justify-center ${step.iconTone}`}
                >
                  <step.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[11px] text-gold-light tracking-wider">
                      Lv.{step.level}
                    </span>
                    <span className="text-base font-semibold">{step.def.name}</span>
                    <span className="text-xs text-slate-500">{step.def.tagline}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400 truncate">
                    解锁：{step.features.map((f) => f.name).join(" · ")}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-sm text-gold">{step.def.minXp}</div>
                  <div className="text-[10px] text-slate-500 tracking-wider">所需 XP</div>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            variants={itemVariants}
            className="mt-9 flex items-center gap-6 text-xs text-slate-500"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-info" />
              <span>浏览页面 <span className="font-mono text-slate-400">+5 XP</span></span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-gold-light" />
              <span>AI 摘要 <span className="font-mono text-slate-400">+20 XP</span></span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-gold" />
              <span>深度分析 <span className="font-mono text-slate-400">+25 XP</span></span>
            </div>
          </motion.div>
        </motion.div>

        {/* 右侧 / 移动端 —— 登录 / 注册表单 */}
        <div className="flex-1 flex flex-col justify-center items-center px-5 py-10 lg:px-12 lg:py-16">
          <motion.div
            className="w-full max-w-md"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* 移动端品牌区 */}
            <motion.div variants={itemVariants} className="lg:hidden text-center mb-8">
              <span className="eyebrow mb-4">Private Research</span>
              <h1 className="font-display text-4xl font-bold tracking-wide text-gradient-gold mt-3 mb-3">
                ATLAS
              </h1>
              <p className="text-sm text-slate-400 px-4">
                登录后，每一次使用都会让你获得新能力。
              </p>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="glass-panel glow-border p-6 sm:p-8"
            >
              {/* 登录 / 注册 分段切换（notes 页同款金色胶囊控件） */}
              <div className="mb-6 flex items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.04] p-1">
                {modeTabs.map(({ key, label, icon: Icon }) => {
                  const active = mode === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => switchMode(key)}
                      className={
                        active
                          ? "flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-gold px-4 py-2 text-sm font-semibold text-navy transition"
                          : "flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm text-slate-400 transition hover:text-slate-100"
                      }
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="mb-6">
                <span className="eyebrow">Member Access</span>
                <h2 className="font-display text-2xl font-bold text-white mt-2 mb-1">
                  {mode === "login" ? "欢迎回来" : "创建账号"}
                </h2>
                <p className="text-sm text-slate-400">
                  {mode === "login"
                    ? "Cookie 有效期 30 天，无需重复登录"
                    : "注册即自动登录，每一次使用都会累积 XP"}
                </p>
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    用户名
                  </label>
                  <div className="relative">
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      inputMode="text"
                      spellCheck={false}
                      placeholder={
                        mode === "login"
                          ? "请输入用户名"
                          : "3-20 位字母/数字/下划线"
                      }
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 pl-10 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-gold/60 focus:bg-white/[0.06] focus:ring-1 focus:ring-gold/30"
                    />
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    密码
                  </label>
                  <div className="relative">
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={
                        mode === "login" ? "current-password" : "new-password"
                      }
                      placeholder={
                        mode === "login" ? "请输入密码" : "至少 6 位"
                      }
                      type={showPassword ? "text" : "password"}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 pl-10 pr-10 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-gold/60 focus:bg-white/[0.06] focus:ring-1 focus:ring-gold/30"
                    />
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                      aria-label={showPassword ? "隐藏密码" : "显示密码"}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {mode === "register" && (
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      确认密码
                    </label>
                    <div className="relative">
                      <input
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        placeholder="再次输入密码"
                        type={showPassword ? "text" : "password"}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 pl-10 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-gold/60 focus:bg-white/[0.06] focus:ring-1 focus:ring-gold/30"
                      />
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    </div>
                  </div>
                )}

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="badge badge-red w-full justify-start px-4 py-2.5 text-xs"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {error}
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="btn-gold w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {mode === "login" ? "登录中..." : "注册中..."}
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      {mode === "login" ? "登录" : "注册并登录"}
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </button>
              </form>

              <div className="mt-5 text-center text-xs text-slate-500">
                {mode === "login"
                  ? "没有账号？点击上方注册，30 秒创建你的投研档案"
                  : "已有账号？点击上方登录"}
              </div>
            </motion.div>

            {/* 移动端等级预览 */}
            <motion.div
              variants={itemVariants}
              className="lg:hidden mt-6 grid grid-cols-3 gap-3"
            >
              {levelSteps.map((step) => (
                <div key={step.level} className="glass-card p-3">
                  <div
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center mb-2 ${step.iconTone}`}
                  >
                    <step.icon className="w-4 h-4" />
                  </div>
                  <div className="font-mono text-[10px] text-gold-light tracking-wider mb-0.5">
                    Lv.{step.level}
                  </div>
                  <div className="text-xs font-semibold mb-0.5">{step.def.name}</div>
                  <div className="font-mono text-[10px] text-slate-500">
                    {step.def.minXp} XP
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
