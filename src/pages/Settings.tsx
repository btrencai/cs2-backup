import { useCallback, useEffect, useState } from "react";
import { toast } from "@heroui/react";
import { Icon, CsgoIcon, UserIcon } from "../components/Icons";
import {
  detectConfigTargets,
  getDefaultBackupPath,
  getSettings,
  openFolder,
  saveSettings,
  sourceKindLabel,
  checkForUpdate,
  getLatestVersion,
  getAppVersion,
  type AppSettings,
  type ConfigTarget,
  type UpdateInfo,
} from "../lib/tauri-commands";

function TargetMiniIcon({ target }: { target: ConfigTarget }) {
  const [avatarFailed, setAvatarFailed] = useState(false);

  if (target.kind === "userdata") {
    if (target.avatar_url && !avatarFailed) {
      return (
        <span className="path-avatar">
          <img src={target.avatar_url} alt={target.label} draggable={false} onError={() => setAvatarFailed(true)} />
        </span>
      );
    }

    return (
      <span className="path-avatar fallback">
        <UserIcon />
      </span>
    );
  }

  return (
    <span className="path-avatar cs2">
      <img src="/csgo-icon.svg" alt="CS2 全局 cfg" draggable={false} />
    </span>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [targets, setTargets] = useState<ConfigTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [defaultBackupPath, setDefaultBackupPath] = useState("");
  const [appVersion, setAppVersion] = useState("");
  const [latestVersion, setLatestVersion] = useState("");
  const [latestCheckFailed, setLatestCheckFailed] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const [nextSettings, defaultPath, detectedTargets, currentVer] = await Promise.all([
        getSettings(),
        getDefaultBackupPath(),
        detectConfigTargets(),
        getAppVersion(),
      ]);
      setSettings(nextSettings);
      setDefaultBackupPath(defaultPath);
      setTargets(detectedTargets);
      setAppVersion(currentVer);

      try {
        const latestVer = await getLatestVersion();
        setLatestVersion(latestVer);
        setLatestCheckFailed(false);
      } catch {
        setLatestVersion("");
        setLatestCheckFailed(true);
      }
    } catch (e) {
      toast.danger("加载设置失败", { description: String(e) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await saveSettings(settings);
      toast.success("设置已保存");
    } catch (e) {
      toast.danger("保存失败", { description: String(e) });
    } finally {
      setSaving(false);
    }
  };

  const handleDetect = async () => {
    setDetecting(true);
    try {
      const detectedTargets = await detectConfigTargets();
      setTargets(detectedTargets);
      toast.success("检测完成", { description: `找到 ${detectedTargets.length} 个配置目标。` });
    } catch (e) {
      toast.danger("检测失败", { description: String(e) });
    } finally {
      setDetecting(false);
    }
  };

  const handleOpenPath = async (path: string) => {
    try {
      await openFolder(path);
    } catch (e) {
      toast.danger("无法打开目录", { description: String(e) });
    }
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const currentVer = appVersion || (await getAppVersion());
      const info = await checkForUpdate(currentVer);
      if (info) {
        setUpdateInfo(info);
        setLatestVersion(info.version);
        setLatestCheckFailed(false);
        toast.success("发现新版本", { description: `${info.tag} 已发布` });
      } else {
        try {
          const latest = await getLatestVersion();
          setLatestVersion(latest);
          setLatestCheckFailed(false);
        } catch {
          setLatestCheckFailed(true);
        }
        setUpdateInfo(null);
        toast.success("已是最新版本", { description: `当前版本 v${currentVer}` });
      }
    } catch (e) {
      setLatestCheckFailed(true);
      toast.danger("检测更新失败", { description: String(e) });
    } finally {
      setCheckingUpdate(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (!settings) {
    return <p className="muted">加载设置失败。</p>;
  }

  const backupPath = settings.backup_path || defaultBackupPath;

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h1 className="page-title">设置</h1>
          <p className="page-description">
            这里只配置备份保存位置。CS2 全局 cfg 和 userdata 会通过 Steam 注册表与本地登录记录自动检测。
          </p>
        </div>
        <div className="toolbar-actions">
          <button className="button secondary" type="button" onClick={loadSettings}>
            <Icon path="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            重新加载
          </button>
          <button className="button primary" type="button" disabled={saving} onClick={handleSave}>
            {saving ? <span className="spinner" /> : <Icon path="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0h-9A2.25 2.25 0 0 0 5.25 6v14.25l6.75-3.375 6.75 3.375V6a2.25 2.25 0 0 0-2.25-2.25Z" />}
            保存设置
          </button>
        </div>
      </div>

      <section className="card pad settings-section">
        <div className="card-title-row">
          <h2 className="card-title">
            <CsgoIcon />
            备份存储位置
          </h2>
          <button className="button secondary" type="button" onClick={() => handleOpenPath(backupPath)}>
            打开目录
          </button>
        </div>
        <input
          className="input"
          value={settings.backup_path}
          onChange={(e) => setSettings((prev) => (prev ? { ...prev, backup_path: e.target.value } : prev))}
          placeholder={defaultBackupPath}
        />
        <p className="muted" style={{ margin: 0 }}>
          留空则使用默认路径：<span className="mono">{defaultBackupPath}</span>
        </p>
      </section>

      <section className="card pad settings-section">
        <div className="card-title-row">
          <h2 className="card-title">
            <CsgoIcon />
            自动检测结果
          </h2>
          <button className="button accent" type="button" disabled={detecting} onClick={handleDetect}>
            {detecting ? <span className="spinner" /> : null}
            重新检测
          </button>
        </div>
        <p className="card-description">
          Steam 路径来自注册表；账号名称来自本地 `config/loginusers.vdf`，无需联网或 Steam Web API Key。
        </p>
        <div className="target-list">
          {targets.length === 0 ? (
            <div className="mini-empty">未检测到配置目标。</div>
          ) : (
            targets.map((target) => (
              <button className="path-option" key={target.id} type="button" onClick={() => handleOpenPath(target.path)}>
                <TargetMiniIcon target={target} />
                <span className={target.kind === "global" ? "badge accent path-kind" : "badge blue path-kind"}>
                  {sourceKindLabel(target.kind)}
                </span>
                <span className="path-text">
                  {target.label} · {target.path}
                </span>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="card pad settings-section">
        <div className="card-title-row">
          <h2 className="card-title">
            <CsgoIcon />
            版本信息
          </h2>
          <button className="button accent" type="button" disabled={checkingUpdate} onClick={handleCheckUpdate}>
            {checkingUpdate ? <span className="spinner" /> : <Icon path="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />}
            检测更新
          </button>
        </div>
        <div className="version-info-grid">
          <div className="version-item">
            <span className="version-label">当前版本</span>
            <span className="version-value">v{appVersion}</span>
          </div>
          <div className="version-item">
            <span className="version-label">最新版本</span>
            <span className={`version-value${updateInfo ? " has-update" : latestCheckFailed ? " check-failed" : ""}`}>
              {latestVersion ? `v${latestVersion}` : latestCheckFailed ? "检测失败" : "未检测"}
            </span>
          </div>
          {updateInfo && (
            <div className="version-update-hint">
              <span className="badge accent">有新版本</span>
              <span className="muted">启动时会自动提示更新，也可重启应用触发自动检测。</span>
            </div>
          )}
          {!updateInfo && latestVersion && (
            <div className="version-update-hint">
              <span className="badge green">已是最新</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
