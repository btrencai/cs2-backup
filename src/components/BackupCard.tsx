import { useEffect, useRef, useState } from "react";
import type { BackupInfo } from "../lib/tauri-commands";
import { Icon, CsgoIcon, USER_ICON_PATH } from "./Icons";
import {
  formatDate,
  formatFileSize,
  formatRelativeTime,
  sourceKindLabel,
  validateBackupName,
} from "../lib/tauri-commands";

interface BackupCardProps {
  backup: BackupInfo;
  onRestore: (name: string) => void;
  onDelete: (name: string) => void;
  onRename: (oldName: string, newName: string) => void;
  onEdit: (name: string) => void;
  onOpen: (path: string) => void;
  onExport: (name: string) => void;
  exporting?: boolean;
}

function BackupSourceMark({ backup }: { backup: BackupInfo }) {
  const [avatarFailed, setAvatarFailed] = useState(false);

  if (backup.source_kind === "userdata") {
    return (
      <span className="backup-row-mark userdata">
        {backup.source_avatar_url && !avatarFailed ? (
          <img
            className="backup-row-avatar"
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
    <span className="backup-row-mark global">
      <CsgoIcon className="backup-row-logo" alt="" />
    </span>
  );
}

export default function BackupCard({
  backup,
  onRestore,
  onDelete,
  onRename,
  onEdit,
  onOpen,
  onExport,
  exporting = false,
}: BackupCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [newName, setNewName] = useState(backup.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameError = validateBackupName(newName);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const submitRename = () => {
    const trimmed = newName.trim();
    if (!renameError && trimmed !== backup.name) {
      onRename(backup.name, trimmed);
    }
    setRenameOpen(false);
  };

  return (
    <>
      <article className="card backup-card backup-row">
        <div className="backup-row-main">
          <BackupSourceMark backup={backup} />
          <div className="backup-row-content">
            <div className="backup-row-titleline">
              <h3 className="backup-name">{backup.name}</h3>
              <span className="badge green">{formatRelativeTime(backup.created_at)}</span>
            </div>
            <p className="backup-meta">
              {formatDate(backup.created_at)} · {sourceKindLabel(backup.source_kind)}
              {backup.source_label ? ` · ${backup.source_label}` : ""}
            </p>
            <p className="muted truncate" title={backup.path} style={{ margin: "8px 0 0" }}>
              {backup.path}
            </p>
            {backup.source_path && (
              <p className="muted truncate" title={backup.source_path} style={{ margin: "4px 0 0" }}>
                来源：{backup.source_path}
              </p>
            )}
          </div>

          <div className="backup-row-facts">
            <span className="badge blue">{backup.file_count} 个文件</span>
            <span className="badge accent">{formatFileSize(backup.total_size)}</span>
          </div>

          <div className="backup-row-actions">
            <button className="button primary" type="button" onClick={() => setRestoreOpen(true)}>
              <Icon path="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              恢复
            </button>
            <button className="button secondary" type="button" onClick={() => onEdit(backup.name)}>
              <Icon path="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5A3.375 3.375 0 0 0 10.125 2.25H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              编辑
            </button>
            <button className="button secondary" type="button" disabled={exporting} onClick={() => onExport(backup.name)}>
              {exporting ? <span className="spinner" /> : <Icon path="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M7.5 12 12 16.5m0 0 4.5-4.5M12 16.5V3" />}
              {exporting ? "导出中" : "导出 ZIP"}
            </button>
          </div>

          <div className="menu-wrap" ref={menuRef}>
            <button
              className="button secondary icon-button"
              type="button"
              aria-label="更多操作"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Icon path="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
            </button>
            {menuOpen && (
              <div className="menu">
                <button
                  className="menu-item"
                  type="button"
                  onClick={() => {
                    onOpen(backup.path);
                    setMenuOpen(false);
                  }}
                >
                  <Icon path="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                  打开目录
                </button>
                <button
                  className="menu-item"
                  type="button"
                  onClick={() => {
                    setNewName(backup.name);
                    setRenameOpen(true);
                    setMenuOpen(false);
                  }}
                >
                  <Icon path="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                  重命名
                </button>
                <button
                  className="menu-item danger"
                  type="button"
                  onClick={() => {
                    setDeleteOpen(true);
                    setMenuOpen(false);
                  }}
                >
                  <Icon path="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673A2.25 2.25 0 0 1 15.916 21H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  删除
                </button>
              </div>
            )}
          </div>
        </div>
      </article>

      {restoreOpen && (
        <div className="modal-layer">
          <div className="modal-backdrop" onClick={() => setRestoreOpen(false)} />
          <div className="modal-panel">
            <h3 className="modal-title">恢复备份</h3>
            <p className="muted" style={{ margin: 0 }}>
              将备份 <strong style={{ color: "var(--text-primary)" }}>{backup.name}</strong> 覆盖恢复到当前 CS2 cfg 目录。建议恢复前先创建当前状态备份。
            </p>
            <div className="modal-actions">
              <button className="button secondary" type="button" onClick={() => setRestoreOpen(false)}>
                取消
              </button>
              <button
                className="button primary"
                type="button"
                onClick={() => {
                  onRestore(backup.name);
                  setRestoreOpen(false);
                }}
              >
                确认恢复
              </button>
            </div>
          </div>
        </div>
      )}

      {renameOpen && (
        <div className="modal-layer">
          <div className="modal-backdrop" onClick={() => setRenameOpen(false)} />
          <div className="modal-panel">
            <h3 className="modal-title">重命名备份</h3>
            <input
              className="input"
              value={newName}
              autoFocus
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !renameError && submitRename()}
              placeholder="备份名称"
            />
            {renameError && <p className="muted" style={{ color: "var(--danger)", margin: "8px 0 0" }}>{renameError}</p>}
            <div className="modal-actions">
              <button className="button secondary" type="button" onClick={() => setRenameOpen(false)}>
                取消
              </button>
              <button className="button primary" type="button" disabled={Boolean(renameError)} onClick={submitRename}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div className="modal-layer">
          <div className="modal-backdrop" onClick={() => setDeleteOpen(false)} />
          <div className="modal-panel">
            <h3 className="modal-title">删除备份</h3>
            <p className="muted" style={{ margin: 0 }}>
              确定删除 <strong style={{ color: "var(--text-primary)" }}>{backup.name}</strong> 吗？此操作不可撤销。
            </p>
            <div className="modal-actions">
              <button className="button secondary" type="button" onClick={() => setDeleteOpen(false)}>
                取消
              </button>
              <button
                className="button danger"
                type="button"
                onClick={() => {
                  onDelete(backup.name);
                  setDeleteOpen(false);
                }}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
