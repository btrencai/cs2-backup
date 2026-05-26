import { useEffect, useMemo, useState } from "react";
import { toast } from "@heroui/react";
import {
  getDefaultBackupPath,
  getSettings,
  saveSettings,
  selectBackupFolder,
  type AppSettings,
} from "../lib/tauri-commands";

function Icon({ path }: { path: string }) {
  return (
    <svg className="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

export default function FirstRunSetup() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [defaultPath, setDefaultPath] = useState("");
  const [backupPath, setBackupPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    Promise.all([getSettings(), getDefaultBackupPath()])
      .then(([nextSettings, nextDefaultPath]) => {
        if (!mounted) return;
        setSettings(nextSettings);
        setDefaultPath(nextDefaultPath);
        setBackupPath(nextSettings.backup_path || nextDefaultPath);
      })
      .catch((e) => {
        toast.danger("初始化设置失败", { description: String(e) });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const shouldShow = useMemo(() => !loading && settings && !settings.setup_completed, [loading, settings]);

  const chooseFolder = async () => {
    try {
      const selected = await selectBackupFolder();
      if (selected) setBackupPath(selected);
    } catch (e) {
      toast.danger("选择目录失败", { description: String(e) });
    }
  };

  const completeSetup = async (useDefault = false) => {
    if (!settings || saving) return;

    const trimmed = backupPath.trim();
    if (!trimmed && !useDefault) {
      toast.warning("请先选择备份保存位置");
      return;
    }

    setSaving(true);
    try {
      const nextPath = useDefault || trimmed === defaultPath ? "" : trimmed;
      const nextSettings = {
        ...settings,
        backup_path: nextPath,
        setup_completed: true,
      };
      await saveSettings(nextSettings);
      setSettings(nextSettings);
      toast.success("备份位置已设置", {
        description: nextPath || defaultPath,
      });
    } catch (e) {
      toast.danger("保存设置失败", { description: String(e) });
    } finally {
      setSaving(false);
    }
  };

  if (!shouldShow) return null;

  return (
    <div className="modal-layer first-run-layer">
      <div className="modal-backdrop" />
      <section className="first-run-panel">
        <div className="first-run-brand">
          <span className="first-run-logo">
            <img src="/csgo-icon.svg" alt="CS2 Config Backup" draggable={false} />
          </span>
          <div>
            <p className="eyebrow">首次启动</p>
            <h2 className="first-run-title">设置备份保存位置</h2>
          </div>
        </div>

        <p className="first-run-copy">
          请选择一个稳定、可长期访问的目录用于保存 CS2 配置备份。后续所有全局 cfg 和 userdata 备份都会写入这里。
        </p>

        <div className="first-run-field">
          <label className="form-label" htmlFor="first-run-backup-path">
            备份目录
          </label>
          <div className="first-run-input-row">
            <input
              id="first-run-backup-path"
              className="input"
              value={backupPath}
              onChange={(event) => setBackupPath(event.target.value)}
              placeholder={defaultPath}
            />
            <button className="button secondary" type="button" onClick={chooseFolder}>
              <Icon path="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
              选择目录
            </button>
          </div>
          <p className="muted" style={{ margin: "8px 0 0" }}>
            默认位置：<span className="mono">{defaultPath}</span>
          </p>
        </div>

        <div className="first-run-actions">
          <button className="button secondary" type="button" disabled={saving} onClick={() => completeSetup(true)}>
            使用默认位置
          </button>
          <button className="button primary" type="button" disabled={saving} onClick={() => completeSetup(false)}>
            {saving ? <span className="spinner" /> : null}
            保存并进入
          </button>
        </div>

        <p className="first-run-copyright">Copyright © 2026 CS2 Config Backup. All rights reserved.</p>
      </section>
    </div>
  );
}
