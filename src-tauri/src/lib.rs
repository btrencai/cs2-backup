use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::State;
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::CompressionMethod;

mod path_detect;

const TARGETS_CACHE_TTL: Duration = Duration::from_secs(5);

struct TargetsCache {
    targets: Vec<path_detect::ConfigTarget>,
    fetched_at: Instant,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BackupInfo {
    pub name: String,
    pub path: String,
    pub created_at: String,
    pub file_count: usize,
    pub total_size: u64,
    pub source_kind: String,
    pub source_label: String,
    pub source_path: String,
    pub source_account_id: Option<String>,
    pub source_account_name: Option<String>,
    pub source_avatar_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(default)]
pub struct AppSettings {
    pub backup_path: String,
    pub setup_completed: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            backup_path: String::new(),
            setup_completed: false,
        }
    }
}

pub struct AppState {
    pub settings: Mutex<AppSettings>,
    targets_cache: Mutex<Option<TargetsCache>>,
}

impl AppState {
    fn get_config_targets(&self) -> Vec<path_detect::ConfigTarget> {
        let mut cache = self.targets_cache.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(ref cached) = *cache {
            if cached.fetched_at.elapsed() < TARGETS_CACHE_TTL {
                return cached.targets.clone();
            }
        }
        let targets = path_detect::find_config_targets();
        *cache = Some(TargetsCache {
            targets: targets.clone(),
            fetched_at: Instant::now(),
        });
        targets
    }

    fn refresh_config_targets(&self) -> Vec<path_detect::ConfigTarget> {
        let targets = path_detect::find_config_targets();
        let mut cache = self.targets_cache.lock().unwrap_or_else(|e| e.into_inner());
        *cache = Some(TargetsCache {
            targets: targets.clone(),
            fetched_at: Instant::now(),
        });
        targets
    }
}

fn get_backup_dir() -> PathBuf {
    let settings = load_settings();
    if !settings.backup_path.is_empty() {
        let dir = PathBuf::from(&settings.backup_path);
        fs::create_dir_all(&dir).ok();
        return dir;
    }
    let data_dir = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    let backup_dir = data_dir.join("cs2-backup").join("backups");
    fs::create_dir_all(&backup_dir).ok();
    backup_dir
}

fn validate_backup_name(name: &str) -> Result<(), String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("请输入备份名称".to_string());
    }
    if trimmed.len() > 80 {
        return Err("备份名称不能超过 80 个字符".to_string());
    }
    if trimmed == "." || trimmed == ".." {
        return Err("备份名称不能使用当前目录或上级目录".to_string());
    }
    if trimmed.ends_with('.') || trimmed.ends_with(' ') {
        return Err("备份名称不能以空格或句点结尾".to_string());
    }
    let invalid_chars = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
    if trimmed
        .chars()
        .any(|c| invalid_chars.contains(&c) || c.is_control())
    {
        return Err("备份名称包含 Windows 不允许的字符".to_string());
    }
    Ok(())
}

fn safe_child_path(base: &Path, relative: &str) -> Result<PathBuf, String> {
    let rel = Path::new(relative);
    if rel.is_absolute() || relative.contains("..") {
        return Err("非法文件路径".to_string());
    }
    Ok(base.join(rel))
}

fn source_path_key(path: &str) -> String {
    path.replace('/', "\\")
        .trim_end_matches(['\\', '/'])
        .to_ascii_lowercase()
}

#[tauri::command]
fn get_default_backup_path() -> String {
    let data_dir = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    data_dir
        .join("cs2-backup")
        .join("backups")
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    let folder = PathBuf::from(path);
    if !folder.exists() {
        return Err(format!("目录不存在: {}", folder.to_string_lossy()));
    }
    if !folder.is_dir() {
        return Err(format!("不是目录: {}", folder.to_string_lossy()));
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&folder)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&folder)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&folder)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn get_settings_path() -> PathBuf {
    let data_dir = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    let settings_dir = data_dir.join("cs2-backup");
    fs::create_dir_all(&settings_dir).ok();
    settings_dir.join("settings.json")
}

fn load_settings() -> AppSettings {
    let path = get_settings_path();
    if path.exists() {
        let data = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        AppSettings::default()
    }
}

fn save_settings(settings: &AppSettings) -> Result<(), String> {
    let path = get_settings_path();
    let data = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn detect_cs2_path() -> Result<String, String> {
    path_detect::find_cs2_cfg_path()
}

#[tauri::command]
fn detect_all_cs2_paths() -> Vec<String> {
    path_detect::find_cs2_cfg_paths()
}

#[tauri::command]
fn detect_config_targets(state: State<AppState>) -> Vec<path_detect::ConfigTarget> {
    state.refresh_config_targets()
}

#[tauri::command]
fn get_settings_cmd(state: State<AppState>) -> Result<AppSettings, String> {
    let settings = state.settings.lock().map_err(|e| e.to_string())?;
    Ok((*settings).clone())
}

#[tauri::command]
fn save_settings_cmd(state: State<AppState>, settings: AppSettings) -> Result<(), String> {
    save_settings(&settings)?;
    let mut current = state.settings.lock().map_err(|e| e.to_string())?;
    *current = settings;
    Ok(())
}

#[tauri::command]
fn list_backups(state: State<AppState>) -> Result<Vec<BackupInfo>, String> {
    let backup_dir = get_backup_dir();
    let mut backups = Vec::new();
    let detected_targets: HashMap<String, path_detect::ConfigTarget> = state
        .get_config_targets()
        .into_iter()
        .map(|target| (source_path_key(&target.path), target))
        .collect();

    if !backup_dir.exists() {
        return Ok(backups);
    }

    for entry in fs::read_dir(&backup_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let metadata_path = path.join("backup_meta.json");
        let meta = if metadata_path.exists() {
            let meta_data = fs::read_to_string(&metadata_path).unwrap_or_else(|_| "{}".to_string());
            serde_json::from_str::<serde_json::Value>(&meta_data).unwrap_or_default()
        } else {
            serde_json::Value::Null
        };

        let created_at = meta["created_at"]
            .as_str()
            .map(str::to_string)
            .unwrap_or_else(|| {
                fs::metadata(&path)
                    .and_then(|metadata| metadata.modified())
                    .map(|time| {
                        let dt: DateTime<Utc> = time.into();
                        dt.to_rfc3339()
                    })
                    .unwrap_or_else(|_| "unknown".to_string())
            });

        let mut file_count = 0;
        let mut total_size = 0u64;
        for e in WalkDir::new(&path).into_iter().flatten() {
            if e.file_type().is_file() && e.file_name() != "backup_meta.json" {
                file_count += 1;
                total_size += e.metadata().map(|m| m.len()).unwrap_or(0);
            }
        }

        let source_path = meta["source_path"].as_str().unwrap_or("").to_string();
        let detected_target = detected_targets.get(&source_path_key(&source_path));
        let source_kind = meta["source_kind"]
            .as_str()
            .map(str::to_string)
            .filter(|value| !value.is_empty())
            .or_else(|| detected_target.map(|target| target.kind.clone()))
            .unwrap_or_default();
        let source_label = meta["source_label"]
            .as_str()
            .map(str::to_string)
            .filter(|value| !value.is_empty())
            .or_else(|| detected_target.map(|target| target.label.clone()))
            .unwrap_or_default();
        let source_account_id = meta["source_account_id"]
            .as_str()
            .map(str::to_string)
            .or_else(|| detected_target.and_then(|target| target.account_id.clone()));
        let source_account_name = meta["source_account_name"]
            .as_str()
            .map(str::to_string)
            .or_else(|| detected_target.and_then(|target| target.account_name.clone()));
        let source_avatar_url = meta["source_avatar_url"]
            .as_str()
            .map(str::to_string)
            .or_else(|| detected_target.and_then(|target| target.avatar_url.clone()));

        backups.push(BackupInfo {
            name,
            path: path.to_string_lossy().to_string(),
            created_at,
            file_count,
            total_size,
            source_kind,
            source_label,
            source_path,
            source_account_id,
            source_account_name,
            source_avatar_url,
        });
    }

    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(backups)
}

#[tauri::command]
fn create_backup(
    name: String,
    source_path: String,
    source_kind: String,
    source_label: String,
    source_account_id: Option<String>,
    source_account_name: Option<String>,
    source_avatar_url: Option<String>,
) -> Result<BackupInfo, String> {
    create_backup_inner(
        name.trim(),
        &source_path,
        &source_kind,
        &source_label,
        source_account_id,
        source_account_name,
        source_avatar_url,
    )
}

#[tauri::command]
fn restore_backup(name: String, target_path: String) -> Result<(), String> {
    if target_path.is_empty() {
        return Err("目标路径未设置".to_string());
    }

    let backup_dir = get_backup_dir().join(&name);
    if !backup_dir.exists() {
        return Err(format!("备份 '{}' 不存在", name));
    }

    let cfg_dir = Path::new(&target_path);

    for entry in WalkDir::new(&backup_dir).into_iter().flatten() {
        let relative = entry
            .path()
            .strip_prefix(&backup_dir)
            .unwrap_or(entry.path());
        if relative.to_string_lossy() == "backup_meta.json" {
            continue;
        }
        let dest = cfg_dir.join(relative);
        if entry.file_type().is_dir() {
            fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
        } else if entry.file_type().is_file() {
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::copy(entry.path(), &dest).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
fn delete_backup(name: String) -> Result<(), String> {
    let backup_dir = get_backup_dir().join(&name);
    if !backup_dir.exists() {
        return Err(format!("备份 '{}' 不存在", name));
    }
    fs::remove_dir_all(&backup_dir).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn rename_backup(old_name: String, new_name: String) -> Result<(), String> {
    let next_name = new_name.trim();
    validate_backup_name(next_name)?;

    let backup_dir = get_backup_dir();
    let old_path = backup_dir.join(&old_name);
    let new_path = backup_dir.join(next_name);

    if !old_path.exists() {
        return Err(format!("备份 '{}' 不存在", old_name));
    }
    if new_path.exists() {
        return Err(format!("备份 '{}' 已存在", next_name));
    }

    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn read_cfg_file(cs2_path: String, file_name: String) -> Result<String, String> {
    let file_path = safe_child_path(Path::new(&cs2_path), &file_name)?;
    if !file_path.exists() {
        return Err(format!("文件不存在: {}", file_name));
    }
    fs::read_to_string(&file_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_cfg_file(cs2_path: String, file_name: String, content: String) -> Result<(), String> {
    let file_path = safe_child_path(Path::new(&cs2_path), &file_name)?;
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&file_path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_cfg_files(cs2_path: String) -> Result<Vec<String>, String> {
    let cfg_dir = Path::new(&cs2_path);
    if !cfg_dir.exists() {
        return Err(format!("CS2 cfg 目录不存在: {}", cs2_path));
    }

    let mut files = Vec::new();
    for entry in WalkDir::new(cfg_dir).into_iter().flatten() {
        if entry.file_type().is_file() {
            if entry.file_name() == "backup_meta.json" {
                continue;
            }
            let relative = entry.path().strip_prefix(cfg_dir).unwrap_or(entry.path());
            files.push(relative.to_string_lossy().to_string());
        }
    }

    files.sort();
    Ok(files)
}

#[tauri::command]
fn export_backup_zip(name: String, target_path: String) -> Result<String, String> {
    let backup_dir = get_backup_dir().join(&name);
    if !backup_dir.exists() {
        return Err(format!("备份 '{}' 不存在", name));
    }

    let target = PathBuf::from(&target_path);
    if let Some(parent) = target.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }

    let file = File::create(&target).map_err(|e| e.to_string())?;
    let mut writer = zip::ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o644);

    let mut buffer = Vec::with_capacity(64 * 1024);
    for entry in WalkDir::new(&backup_dir).into_iter().flatten() {
        let path = entry.path();
        let relative = match path.strip_prefix(&backup_dir) {
            Ok(rel) => rel,
            Err(_) => continue,
        };
        if relative.as_os_str().is_empty() {
            continue;
        }

        let archive_name = relative.to_string_lossy().replace('\\', "/");

        if entry.file_type().is_dir() {
            let dir_name = if archive_name.ends_with('/') {
                archive_name
            } else {
                format!("{}/", archive_name)
            };
            writer
                .add_directory(dir_name, options)
                .map_err(|e| e.to_string())?;
        } else if entry.file_type().is_file() {
            writer
                .start_file(archive_name, options)
                .map_err(|e| e.to_string())?;
            let mut f = File::open(path).map_err(|e| e.to_string())?;
            buffer.clear();
            f.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
            writer.write_all(&buffer).map_err(|e| e.to_string())?;
        }
    }

    writer.finish().map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

fn create_backup_inner(
    name: &str,
    source_path: &str,
    source_kind: &str,
    source_label: &str,
    source_account_id: Option<String>,
    source_account_name: Option<String>,
    source_avatar_url: Option<String>,
) -> Result<BackupInfo, String> {
    validate_backup_name(name)?;

    if source_path.is_empty() {
        return Err("源路径未设置".to_string());
    }

    let source_dir = Path::new(source_path);
    if !source_dir.exists() {
        return Err(format!("源目录不存在: {}", source_path));
    }

    let backup_dir = get_backup_dir().join(name);
    if backup_dir.exists() {
        return Err(format!("备份 '{}' 已存在", name));
    }

    fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;

    for entry in WalkDir::new(source_dir).into_iter().flatten() {
        let relative = entry
            .path()
            .strip_prefix(source_dir)
            .unwrap_or(entry.path());
        let dest = backup_dir.join(relative);
        if entry.file_type().is_dir() {
            fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
        } else if entry.file_type().is_file() {
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::copy(entry.path(), &dest).map_err(|e| e.to_string())?;
        }
    }

    let created_at = Utc::now().to_rfc3339();
    let meta = serde_json::json!({
        "created_at": created_at,
        "source_path": source_path,
        "source_kind": source_kind,
        "source_label": source_label,
        "source_account_id": source_account_id.clone(),
        "source_account_name": source_account_name.clone(),
        "source_avatar_url": source_avatar_url.clone(),
    });
    fs::write(
        backup_dir.join("backup_meta.json"),
        serde_json::to_string_pretty(&meta).unwrap(),
    )
    .ok();

    let mut file_count = 0;
    let mut total_size = 0u64;
    for e in WalkDir::new(&backup_dir).into_iter().flatten() {
        if e.file_type().is_file() && e.file_name() != "backup_meta.json" {
            file_count += 1;
            total_size += e.metadata().map(|m| m.len()).unwrap_or(0);
        }
    }

    Ok(BackupInfo {
        name: name.to_string(),
        path: backup_dir.to_string_lossy().to_string(),
        created_at,
        file_count,
        total_size,
        source_kind: source_kind.to_string(),
        source_label: source_label.to_string(),
        source_path: source_path.to_string(),
        source_account_id,
        source_account_name,
        source_avatar_url,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let settings = load_settings();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            settings: Mutex::new(settings),
            targets_cache: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            detect_cs2_path,
            detect_all_cs2_paths,
            detect_config_targets,
            get_settings_cmd,
            save_settings_cmd,
            get_default_backup_path,
            open_folder,
            list_backups,
            create_backup,
            restore_backup,
            delete_backup,
            rename_backup,
            read_cfg_file,
            save_cfg_file,
            list_cfg_files,
            export_backup_zip,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
