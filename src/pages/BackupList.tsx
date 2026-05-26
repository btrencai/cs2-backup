import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "@heroui/react";
import AvatarSelect, { type AvatarSelectOption } from "../components/AvatarSelect";
import BackupCard from "../components/BackupCard";
import CfgEditor from "../components/CfgEditor";
import {
  deleteBackup,
  exportBackupZip,
  formatFileSize,
  listBackups,
  openFolder,
  renameBackup,
  restoreBackup,
  type BackupInfo,
} from "../lib/tauri-commands";

type SortMode = "newest" | "oldest" | "name" | "size";

interface UserBackupGroup {
  key: string;
  label: string;
  path: string;
  avatarUrl: string | null;
  backups: BackupInfo[];
}

function Icon({ path }: { path: string }) {
  return (
    <svg className="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

function CsgoIcon({ className = "inline-csgo-icon", alt = "" }: { className?: string; alt?: string }) {
  return <img className={className} src="/csgo-icon.svg" alt={alt} draggable={false} />;
}

function accountIdFromPath(path: string): string {
  const match = path.match(/[\\/]userdata[\\/](\d+)[\\/]730[\\/]local[\\/]cfg/i);
  return match?.[1] || "";
}

function getUserGroupKey(backup: BackupInfo): string {
  return backup.source_path || backup.source_label || "__unknown-userdata";
}

function getUserGroupLabel(backup: BackupInfo): string {
  const accountId = backup.source_account_id || accountIdFromPath(backup.source_path);
  const label = backup.source_label || backup.source_account_name || "";
  if (label && accountId) return `${label} · ${accountId}`;
  if (label) return label;
  if (backup.source_label) return backup.source_label;
  if (accountId) return `Steam 用户 ${accountId}`;
  return "未知用户目录";
}

export default function BackupList() {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorPath, setEditorPath] = useState("");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [globalExpanded, setGlobalExpanded] = useState(false);
  const [userdataExpanded, setUserdataExpanded] = useState(false);
  const [selectedUserKey, setSelectedUserKey] = useState("");
  const [exportingName, setExportingName] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      setBackups(await listBackups());
    } catch (e) {
      toast.danger("加载备份失败", { description: String(e) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredBackups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = normalized
      ? backups.filter((backup) =>
          [
            backup.name,
            backup.path,
            backup.source_kind,
            backup.source_label,
            backup.source_path,
            backup.source_account_id,
            backup.source_account_name,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalized),
        )
      : backups;

    return [...filtered].sort((a, b) => {
      if (sortMode === "oldest") return a.created_at.localeCompare(b.created_at);
      if (sortMode === "name") return a.name.localeCompare(b.name, "zh-CN");
      if (sortMode === "size") return b.total_size - a.total_size;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [backups, query, sortMode]);

  const globalBackups = useMemo(
    () => filteredBackups.filter((backup) => backup.source_kind !== "userdata"),
    [filteredBackups],
  );

  const userdataBackups = useMemo(
    () => filteredBackups.filter((backup) => backup.source_kind === "userdata"),
    [filteredBackups],
  );

  const userdataGroups = useMemo(() => {
    const groups = new Map<string, UserBackupGroup>();

    for (const backup of userdataBackups) {
      const key = getUserGroupKey(backup);
      const existing = groups.get(key);
      if (existing) {
        existing.backups.push(backup);
        if (!existing.avatarUrl && backup.source_avatar_url) {
          existing.avatarUrl = backup.source_avatar_url;
        }
      } else {
        groups.set(key, {
          key,
          label: getUserGroupLabel(backup),
          path: backup.source_path,
          avatarUrl: backup.source_avatar_url || null,
          backups: [backup],
        });
      }
    }

    return [...groups.values()].sort((a, b) => {
      const latestA = a.backups[0]?.created_at || "";
      const latestB = b.backups[0]?.created_at || "";
      return latestB.localeCompare(latestA);
    });
  }, [userdataBackups]);

  useEffect(() => {
    if (userdataGroups.length === 0) {
      if (selectedUserKey) setSelectedUserKey("");
      return;
    }

    if (!userdataGroups.some((group) => group.key === selectedUserKey)) {
      setSelectedUserKey(userdataGroups[0].key);
    }
  }, [selectedUserKey, userdataGroups]);

  const selectedUserGroup = useMemo(
    () => userdataGroups.find((group) => group.key === selectedUserKey) || userdataGroups[0],
    [selectedUserKey, userdataGroups],
  );
  const userdataOptions = useMemo<AvatarSelectOption[]>(
    () =>
      userdataGroups.map((group) => ({
        id: group.key,
        label: group.label,
        meta: `${group.backups.length} 个备份`,
        avatarUrl: group.avatarUrl,
      })),
    [userdataGroups],
  );

  const totalSize = useMemo(() => backups.reduce((sum, backup) => sum + backup.total_size, 0), [backups]);

  const handleRestore = async (name: string) => {
    const backup = backups.find((item) => item.name === name);
    if (!backup?.source_path) {
      toast.warning("这个备份缺少来源路径", {
        description: "旧版本备份无法自动判断应恢复到哪个 cfg 目录。",
      });
      return;
    }
    try {
      await restoreBackup(name, backup.source_path);
      toast.success("恢复完成", { description: `已恢复「${name}」。` });
    } catch (e) {
      toast.danger("恢复失败", { description: String(e) });
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await deleteBackup(name);
      setBackups((prev) => prev.filter((b) => b.name !== name));
      toast.success("备份已删除", { description: name });
    } catch (e) {
      toast.danger("删除失败", { description: String(e) });
    }
  };

  const handleRename = async (oldName: string, newName: string) => {
    try {
      await renameBackup(oldName, newName);
      setBackups((prev) =>
        prev.map((backup) =>
          backup.name === oldName
            ? {
                ...backup,
                name: newName,
                path: backup.path.replace(
                  new RegExp(`${oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
                  newName,
                ),
              }
            : backup,
        ),
      );
      toast.success("重命名完成", { description: newName });
    } catch (e) {
      toast.danger("重命名失败", { description: String(e) });
    }
  };

  const handleEdit = (name: string) => {
    const backup = backups.find((b) => b.name === name);
    if (backup) {
      setEditorPath(backup.path);
      setEditorOpen(true);
    }
  };

  const handleOpen = async (path: string) => {
    try {
      await openFolder(path);
    } catch (e) {
      toast.danger("无法打开目录", { description: String(e) });
    }
  };

  const handleExport = async (name: string) => {
    setExportingName(name);
    try {
      const targetPath = await exportBackupZip(name);
      if (targetPath) {
        toast.success("导出完成", { description: targetPath });
      }
    } catch (e) {
      toast.danger("导出失败", { description: String(e) });
    } finally {
      setExportingName(null);
    }
  };

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
          <p className="eyebrow">Backups</p>
          <h1 className="page-title">备份管理</h1>
          <p className="page-description">按全局目录和用户目录管理备份，支持恢复、编辑、导出 zip 和删除。</p>
        </div>
        <div className="toolbar-actions">
          <span className="badge accent">{backups.length} 个备份</span>
          <span className="badge blue">{formatFileSize(totalSize)}</span>
          <button className="button secondary" type="button" onClick={loadData}>
            <Icon path="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            刷新
          </button>
        </div>
      </div>

      <div className="card pad">
        <div className="toolbar">
          <input
            className="input"
            style={{ maxWidth: 420 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索备份名称、来源或路径"
          />
          <select className="select" style={{ maxWidth: 180 }} value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
            <option value="newest">最新优先</option>
            <option value="oldest">最早优先</option>
            <option value="name">名称排序</option>
            <option value="size">大小排序</option>
          </select>
        </div>
      </div>

      {filteredBackups.length === 0 ? (
        <div className="empty-state">
          <CsgoIcon className="empty-csgo-icon" alt="CS2" />
          <p className="empty-title">{backups.length === 0 ? "暂无备份" : "没有匹配的备份"}</p>
          <p className="empty-text">{backups.length === 0 ? "回到仪表盘创建第一个备份。" : "换个关键词或清空搜索条件。"}</p>
        </div>
      ) : (
        <div className="page-stack">
          <BackupCategorySection
            title="全局目录"
            description="全局 cfg 备份和旧版本未标记来源的备份。"
            badgeClass="badge accent"
            backups={globalBackups}
            emptyText="还没有全局 cfg 的备份。"
            expanded={globalExpanded}
            onToggleExpanded={() => setGlobalExpanded((value) => !value)}
            onRestore={handleRestore}
            onDelete={handleDelete}
            onRename={handleRename}
            onEdit={handleEdit}
            onOpen={handleOpen}
            onExport={handleExport}
            exportingName={exportingName}
          />

          <BackupCategorySection
            title="用户目录"
            description="先选择 Steam 用户目录，再查看该用户对应的 userdata 备份。"
            badgeClass="badge blue"
            backups={selectedUserGroup?.backups || []}
            emptyText="还没有用户目录（userdata）的备份。"
            expanded={userdataExpanded}
            onToggleExpanded={() => setUserdataExpanded((value) => !value)}
            onRestore={handleRestore}
            onDelete={handleDelete}
            onRename={handleRename}
            onEdit={handleEdit}
            onOpen={handleOpen}
            onExport={handleExport}
            exportingName={exportingName}
            totalCount={userdataBackups.length}
            controls={
              userdataGroups.length > 0 ? (
                <div className="backup-user-picker">
                  <AvatarSelect
                    label="选择用户目录"
                    options={userdataOptions}
                    value={selectedUserGroup?.key || ""}
                    onChange={(value) => {
                      setSelectedUserKey(value);
                      setUserdataExpanded(false);
                    }}
                  />
                  {selectedUserGroup?.path && (
                    <p className="muted truncate" title={selectedUserGroup.path} style={{ margin: "8px 0 0" }}>
                      {selectedUserGroup.path}
                    </p>
                  )}
                </div>
              ) : null
            }
          />
        </div>
      )}

      <CfgEditor isOpen={editorOpen} onClose={() => setEditorOpen(false)} cs2Path={editorPath} />
    </div>
  );
}

interface BackupCategorySectionProps {
  title: string;
  description: string;
  badgeClass: string;
  backups: BackupInfo[];
  emptyText: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  onRestore: (name: string) => void | Promise<void>;
  onDelete: (name: string) => void | Promise<void>;
  onRename: (oldName: string, newName: string) => void | Promise<void>;
  onEdit: (name: string) => void;
  onOpen: (path: string) => void | Promise<void>;
  onExport: (name: string) => void | Promise<void>;
  exportingName: string | null;
  controls?: ReactNode;
  totalCount?: number;
}

function BackupCategorySection({
  title,
  description,
  badgeClass,
  backups,
  emptyText,
  expanded,
  onToggleExpanded,
  onRestore,
  onDelete,
  onRename,
  onEdit,
  onOpen,
  onExport,
  exportingName,
  controls,
  totalCount,
}: BackupCategorySectionProps) {
  const visibleBackups = expanded ? backups : backups.slice(0, 3);
  const hiddenCount = Math.max(0, backups.length - visibleBackups.length);
  const displayCount = totalCount ?? backups.length;

  return (
    <section className="card pad backup-category">
      <div className="backup-category-header">
        <div className="backup-category-titleblock">
          <h2 className="backup-section-title">
            <CsgoIcon />
            {title}
          </h2>
          <p className="backup-category-description">{description}</p>
        </div>
        <span className={badgeClass}>{displayCount} 个</span>
      </div>

      {controls}

      {backups.length === 0 ? (
        <div className="mini-empty">{emptyText}</div>
      ) : (
        <>
          <div className="backup-list-rows">
            {visibleBackups.map((backup) => (
              <BackupCard
                key={backup.name}
                backup={backup}
                onRestore={onRestore}
                onDelete={onDelete}
                onRename={onRename}
                onEdit={onEdit}
                onOpen={onOpen}
                onExport={onExport}
                exporting={exportingName === backup.name}
              />
            ))}
          </div>
          {backups.length > 3 && (
            <button className="button ghost backup-expand-button" type="button" onClick={onToggleExpanded}>
              {expanded ? "收起，只看最近 3 条" : `展开其余 ${hiddenCount} 条`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
