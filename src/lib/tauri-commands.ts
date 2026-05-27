import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

export type ConfigTargetKind = "global" | "userdata";

export interface ConfigTarget {
  id: string;
  kind: ConfigTargetKind;
  label: string;
  path: string;
  steam_id: string | null;
  account_id: string | null;
  account_name: string | null;
  avatar_url: string | null;
}

export interface BackupInfo {
  name: string;
  path: string;
  created_at: string;
  file_count: number;
  total_size: number;
  source_kind: string;
  source_label: string;
  source_path: string;
  source_account_id: string | null;
  source_account_name: string | null;
  source_avatar_url: string | null;
}

export interface AppSettings {
  backup_path: string;
  setup_completed: boolean;
}

export interface CfgEntry {
  key: string;
  value: string;
  comment: string;
  value_type: "toggle" | "number" | "string";
  min: number | null;
  max: number | null;
}

export interface CfgSection {
  name: string;
  header_lines: string[];
  entries: CfgEntry[];
}

export async function detectCs2Path(): Promise<string> {
  return invoke<string>("detect_cs2_path");
}

export async function detectAllCs2Paths(): Promise<string[]> {
  return invoke<string[]>("detect_all_cs2_paths");
}

export async function detectConfigTargets(): Promise<ConfigTarget[]> {
  return invoke<ConfigTarget[]>("detect_config_targets");
}

export async function getDefaultBackupPath(): Promise<string> {
  return invoke<string>("get_default_backup_path");
}

export async function getSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_settings_cmd");
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  return invoke("save_settings_cmd", { settings });
}

export async function selectBackupFolder(): Promise<string | null> {
  const selected = await open({
    title: "选择备份保存位置",
    directory: true,
    multiple: false,
  });
  return typeof selected === "string" ? selected : null;
}

export async function openFolder(path: string): Promise<void> {
  return invoke("open_folder", { path });
}

export async function listBackups(): Promise<BackupInfo[]> {
  return invoke<BackupInfo[]>("list_backups");
}

export async function createBackup(
  name: string,
  target: ConfigTarget,
): Promise<BackupInfo> {
  return invoke<BackupInfo>("create_backup", {
    name,
    sourcePath: target.path,
    sourceKind: target.kind,
    sourceLabel: target.label,
    sourceAccountId: target.account_id,
    sourceAccountName: target.account_name,
    sourceAvatarUrl: target.avatar_url,
  });
}

export async function restoreBackup(name: string, targetPath: string): Promise<void> {
  return invoke("restore_backup", { name, targetPath });
}

export async function deleteBackup(name: string): Promise<void> {
  return invoke("delete_backup", { name });
}

export async function renameBackup(oldName: string, newName: string): Promise<void> {
  return invoke("rename_backup", { oldName, newName });
}

export async function exportBackupZip(name: string): Promise<string | null> {
  const targetPath = await save({
    title: "导出备份为 zip",
    defaultPath: `${name}.zip`,
    filters: [{ name: "ZIP 压缩包", extensions: ["zip"] }],
  });
  if (!targetPath) return null;
  return invoke<string>("export_backup_zip", { name, targetPath });
}

export async function readCfgFile(cs2Path: string, fileName: string): Promise<string> {
  return invoke<string>("read_cfg_file", { cs2Path, fileName });
}

export async function listCfgFiles(cs2Path: string): Promise<string[]> {
  return invoke<string[]>("list_cfg_files", { cs2Path });
}

export async function saveCfgFile(
  cs2Path: string,
  fileName: string,
  content: string,
): Promise<void> {
  return invoke("save_cfg_file", { cs2Path, fileName, content });
}

export function makeDefaultBackupName(prefix = "backup"): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${prefix}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours(),
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export function makeTargetBackupName(target: ConfigTarget): string {
  const prefix = target.kind === "global" ? "global-cfg" : `userdata-${slugify(target.label)}`;
  return makeDefaultBackupName(prefix).slice(0, 80).replace(/[. ]+$/g, "");
}

export function slugify(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "steam-user";
}

export function validateBackupName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "请输入备份名称。";
  if (trimmed.length > 80) return "备份名称不能超过 80 个字符。";
  if (/[<>:"/\\|?*\x00-\x1F]/.test(trimmed)) {
    return '备份名称不能包含 < > : " / \\ | ? * 等非法字符。';
  }
  if (trimmed === "." || trimmed === "..") return "备份名称不能使用当前目录或上级目录。";
  if (/[. ]$/.test(trimmed)) return "备份名称不能以空格或句点结尾。";
  return null;
}

export function sourceKindLabel(kind: string): string {
  if (kind === "global") return "全局 cfg";
  if (kind === "userdata") return "userdata";
  return "未知来源";
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`;
}

export function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function formatRelativeTime(dateStr: string): string {
  const timestamp = new Date(dateStr).getTime();
  if (Number.isNaN(timestamp)) return "未知时间";
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "刚刚";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return formatDate(dateStr);
}

export async function readAutoCfg(cfgDir: string): Promise<CfgSection[]> {
  return invoke<CfgSection[]>("read_auto_cfg", { cfgDir });
}

export async function writeAutoCfg(cfgDir: string, sections: CfgSection[]): Promise<void> {
  return invoke("write_auto_cfg", { cfgDir, sections });
}

export async function getAutoCfgTemplate(): Promise<CfgSection[]> {
  return invoke<CfgSection[]>("get_auto_cfg_template");
}

export async function installAutoCfgTemplate(cfgDir: string): Promise<void> {
  return invoke("install_auto_cfg_template", { cfgDir });
}

export interface UpdateInfo {
  version: string;
  tag: string;
  body: string;
  exe_url: string;
  published_at: string;
}

export async function checkForUpdate(currentVersion: string): Promise<UpdateInfo | null> {
  return invoke<UpdateInfo | null>("check_update", { currentVersion });
}

export async function downloadUpdate(url: string): Promise<string> {
  return invoke<string>("download_update", { url });
}

export async function installUpdate(exePath: string): Promise<void> {
  return invoke("install_update", { exePath });
}
