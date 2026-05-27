import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@heroui/react";
import { useNavigate } from "react-router-dom";
import AvatarSelect, { type AvatarSelectOption } from "../components/AvatarSelect";
import { Icon, CsgoIcon, USER_ICON_PATH } from "../components/Icons";
import {
  createBackup,
  detectConfigTargets,
  formatDate,
  formatFileSize,
  formatRelativeTime,
  getDefaultBackupPath,
  getSettings,
  listBackups,
  makeTargetBackupName,
  openFolder,
  sourceKindLabel,
  type AppSettings,
  type BackupInfo,
  type ConfigTarget,
} from "../lib/tauri-commands";

function GlobalCfgIcon() {
  return <img className="target-logo" src="/csgo-icon.svg" alt="CS2 全局 cfg" draggable={false} />;
}

function BackupSourceMark({ backup }: { backup: BackupInfo }) {
  const [avatarFailed, setAvatarFailed] = useState(false);

  if (backup.source_kind === "userdata") {
    return (
      <span className="recent-backup-mark userdata">
        {backup.source_avatar_url && !avatarFailed ? (
          <img
            src={backup.source_avatar_url}
            alt={backup.source_label || "Steam 用户"}
            draggable={false}
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          <Icon path={USER_ICON_PATH} />
        )}
      </span>
    );
  }

  return (
    <span className="recent-backup-mark global">
      <CsgoIcon className="recent-backup-logo" alt="CS2" />
    </span>
  );
}

function TargetAvatar({ target }: { target: ConfigTarget }) {
  const [avatarFailed, setAvatarFailed] = useState(false);

  if (target.kind === "userdata") {
    if (target.avatar_url && !avatarFailed) {
      return (
        <img
          className="steam-avatar"
          src={target.avatar_url}
          alt={target.label}
          draggable={false}
          onError={() => setAvatarFailed(true)}
        />
      );
    }

    return <Icon path={USER_ICON_PATH} />;
  }

  return <GlobalCfgIcon />;
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

interface TargetCardProps {
  target: ConfigTarget;
  busy: boolean;
  onBackup: (target: ConfigTarget) => void;
  onOpen: (path: string) => void;
}

function TargetCard({ target, busy, onBackup, onOpen }: TargetCardProps) {
  const isUserdata = target.kind === "userdata";

  return (
    <article className="target-card">
      <div className="target-head">
        <div className={isUserdata ? "target-icon userdata" : "target-icon global"}>
          <TargetAvatar target={target} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h3 className="backup-name">{target.label}</h3>
          <p className="backup-meta">
            {sourceKindLabel(target.kind)}
            {target.account_name ? ` · ${target.account_name}` : ""}
            {target.account_id ? ` · ${target.account_id}` : ""}
          </p>
        </div>
      </div>

      <p className="muted truncate" title={target.path} style={{ margin: "14px 0 0" }}>
        {target.path}
      </p>

      <div className="target-actions">
        <button className="button primary" type="button" disabled={busy} onClick={() => onBackup(target)}>
          {busy ? <span className="spinner" /> : <Icon path="M12 4.5v15m7.5-7.5h-15" />}
          {busy ? "备份中" : "立即备份"}
        </button>
        <button className="button secondary" type="button" onClick={() => onOpen(target.path)}>
          打开目录
        </button>
      </div>
    </article>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [defaultBackupPath, setDefaultBackupPath] = useState("");
  const [targets, setTargets] = useState<ConfigTarget[]>([]);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [busyTargetId, setBusyTargetId] = useState<string | null>(null);
  const [selectedUserdataId, setSelectedUserdataId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, b, defaultPath, detectedTargets] = await Promise.all([
        getSettings(),
        listBackups(),
        getDefaultBackupPath(),
        detectConfigTargets(),
      ]);
      setSettings(s);
      setBackups(b);
      setDefaultBackupPath(defaultPath);
      setTargets(detectedTargets);
    } catch (e) {
      toast.danger("加载数据失败", { description: String(e) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshTargets = async () => {
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

  const globalTargets = useMemo(() => targets.filter((target) => target.kind === "global"), [targets]);
  const userdataTargets = useMemo(() => targets.filter((target) => target.kind === "userdata"), [targets]);
  const selectedUserdataTarget = useMemo(
    () => userdataTargets.find((target) => target.id === selectedUserdataId) || userdataTargets[0],
    [selectedUserdataId, userdataTargets],
  );
  const userdataOptions = useMemo<AvatarSelectOption[]>(
    () =>
      userdataTargets.map((target) => ({
        id: target.id,
        label: target.label,
        meta: [target.account_name, target.account_id].filter(Boolean).join(" · "),
        avatarUrl: target.avatar_url,
      })),
    [userdataTargets],
  );

  useEffect(() => {
    if (userdataTargets.length === 0) {
      if (selectedUserdataId) setSelectedUserdataId("");
      return;
    }

    if (!userdataTargets.some((target) => target.id === selectedUserdataId)) {
      setSelectedUserdataId(userdataTargets[0].id);
    }
  }, [selectedUserdataId, userdataTargets]);

  const stats = useMemo(() => {
    const totalSize = backups.reduce((sum, backup) => sum + backup.total_size, 0);
    const totalFiles = backups.reduce((sum, backup) => sum + backup.file_count, 0);
    const latest = backups[0]?.created_at;
    return { totalSize, totalFiles, latest };
  }, [backups]);

  const handleBackup = async (target: ConfigTarget) => {
    setBusyTargetId(target.id);
    await nextFrame();

    try {
      const backup = await createBackup(makeTargetBackupName(target), target);
      setBackups((prev) => [backup, ...prev]);
      toast.success("备份完成", { description: `${target.label} -> ${backup.name}` });
    } catch (e) {
      toast.danger("备份失败", { description: String(e) });
    } finally {
      setBusyTargetId(null);
    }
  };

  const handleOpenPath = async (path: string) => {
    try {
      await openFolder(path);
    } catch (e) {
      toast.danger("无法打开目录", { description: String(e) });
    }
  };

  const backupPath = settings?.backup_path || defaultBackupPath;

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">CS2 Config Backup</p>
          <h1 className="page-title">选择要备份的配置范围</h1>
          <p className="page-description">
            全局 cfg 来自游戏安装目录；userdata 来自 Steam 账号目录，并用本地 Steam 登录信息标出用户名。
          </p>
        </div>
        <div className="toolbar-actions">
          <button className="button secondary" type="button" disabled={detecting} onClick={refreshTargets}>
            {detecting ? <span className="spinner" /> : <Icon path="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />}
            重新检测
          </button>
          <button className="button accent" type="button" onClick={() => handleOpenPath(backupPath)}>
            <Icon path="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
            备份目录
          </button>
        </div>
      </div>

      <div className="grid stats-grid">
        <div className="card stat-card">
          <p className="stat-label">已检测目标</p>
          <p className="stat-value">{targets.length}</p>
          <p className="stat-note">全局 {globalTargets.length} · 用户 {userdataTargets.length}</p>
        </div>
        <div className="card stat-card">
          <p className="stat-label">备份数量</p>
          <p className="stat-value">{backups.length}</p>
          <p className="stat-note">手动快照</p>
        </div>
        <div className="card stat-card">
          <p className="stat-label">文件总数</p>
          <p className="stat-value">{stats.totalFiles}</p>
          <p className="stat-note">不含元数据文件</p>
        </div>
        <div className="card stat-card">
          <p className="stat-label">总大小</p>
          <p className="stat-value">{formatFileSize(stats.totalSize)}</p>
          <p className="stat-note">所有备份合计</p>
        </div>
        <div className="card stat-card">
          <p className="stat-label">最近备份</p>
          <p className="stat-value" style={{ fontSize: 18 }}>
            {stats.latest ? formatRelativeTime(stats.latest) : "暂无"}
          </p>
          <p className="stat-note">{stats.latest ? formatDate(stats.latest) : "点击备份后显示"}</p>
        </div>
      </div>

      <div className="feature-grid">
        <section className="card pad feature-section">
          <div className="card-title-row">
            <h2 className="card-title">
              <CsgoIcon />
              备份全局 cfg 文件夹
            </h2>
            <span className="badge accent">{globalTargets.length} 个</span>
          </div>
          <p className="card-description">
            从 Steam 注册表和库目录定位游戏安装路径，备份 `game/csgo/cfg` 或 `game/cs2/cfg`。
          </p>
          <div className="target-list">
            {globalTargets.length === 0 ? (
              <div className="mini-empty">未检测到全局 cfg。确认 CS2 已安装后点“重新检测”。</div>
            ) : (
              globalTargets.map((target) => (
                <TargetCard
                  key={target.id}
                  target={target}
                  busy={busyTargetId === target.id}
                  onBackup={handleBackup}
                  onOpen={handleOpenPath}
                />
              ))
            )}
          </div>
        </section>

        <section className="card pad feature-section">
          <div className="card-title-row">
            <h2 className="card-title">
              <CsgoIcon />
              备份 userdata 文件夹
            </h2>
            <span className="badge blue">{userdataTargets.length} 个账号</span>
          </div>
          <p className="card-description">
            备份 `Steam/userdata/账号ID/730/local/cfg`，用户名来自 Steam 本地登录记录，方便区分是谁的 cfg。
          </p>
          <div className="target-list">
            {userdataTargets.length === 0 ? (
              <div className="mini-empty">未检测到 userdata cfg。需要至少登录过 Steam 且 CS2 生成过本地配置。</div>
            ) : (
              <>
                <div className="target-selector">
                  <AvatarSelect
                    label="选择 Steam 用户"
                    options={userdataOptions}
                    value={selectedUserdataTarget?.id || ""}
                    onChange={setSelectedUserdataId}
                  />
                </div>
                {selectedUserdataTarget && (
                <TargetCard
                  key={selectedUserdataTarget.id}
                  target={selectedUserdataTarget}
                  busy={busyTargetId === selectedUserdataTarget.id}
                  onBackup={handleBackup}
                  onOpen={handleOpenPath}
                />
                )}
              </>
            )}
          </div>
        </section>
      </div>

      <section className="card pad">
        <div className="card-title-row">
          <h2 className="card-title">
            <CsgoIcon />
            最近备份
          </h2>
          <button className="button ghost" type="button" onClick={() => navigate("/backups")}>
            查看全部
          </button>
        </div>

        {backups.length === 0 ? (
          <div className="empty-state">
            <CsgoIcon className="empty-csgo-icon" alt="CS2" />
            <p className="empty-title">暂无备份</p>
            <p className="empty-text">在上方选择全局 cfg 或 userdata 后点击立即备份。</p>
          </div>
        ) : (
          <div className="grid" style={{ gap: 10 }}>
            {backups.slice(0, 5).map((backup) => (
              <div className="card recent-backup-item" key={backup.name}>
                <BackupSourceMark backup={backup} />
                <div className="toolbar recent-backup-content">
                  <div style={{ minWidth: 0 }}>
                    <p className="backup-name">{backup.name}</p>
                    <p className="backup-meta">
                      {sourceKindLabel(backup.source_kind)} · {backup.source_label || "旧备份"} · {backup.file_count} 个文件 · {formatFileSize(backup.total_size)}
                    </p>
                  </div>
                  <span className="badge green">{formatRelativeTime(backup.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
