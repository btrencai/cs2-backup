use reqwest::blocking::Client;
use semver::Version;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Emitter};

const GITHUB_API_URL: &str =
    "https://api.github.com/repos/btrencai/cs2-backup/releases/latest";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub version: String,
    pub tag: String,
    pub body: String,
    pub exe_url: String,
    pub published_at: String,
}

#[derive(Deserialize)]
struct GhRelease {
    tag_name: String,
    body: String,
    published_at: String,
    assets: Vec<GhAsset>,
}

#[derive(Deserialize)]
struct GhAsset {
    name: String,
    browser_download_url: String,
}

pub fn check_github_update(current_version: &str) -> Option<UpdateInfo> {
    let client = Client::builder()
        .user_agent("cs2-backup-updater")
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .ok()?;

    let resp = client.get(GITHUB_API_URL).send().ok()?;
    let release: GhRelease = resp.json().ok()?;

    let tag = &release.tag_name;
    let tag_version = tag.strip_prefix('v').unwrap_or(tag);

    let latest = Version::parse(tag_version).ok()?;
    let current = Version::parse(current_version).ok()?;

    if latest <= current {
        return None;
    }

    let exe_asset = release.assets.iter().find(|asset| {
        let lower = asset.name.to_lowercase();
        lower.contains("setup") && lower.ends_with(".exe")
    })?;

    Some(UpdateInfo {
        version: tag_version.to_string(),
        tag: tag.to_string(),
        body: release.body,
        exe_url: exe_asset.browser_download_url.clone(),
        published_at: release.published_at,
    })
}

pub fn download_update(url: &str, app: &AppHandle) -> Result<PathBuf, String> {
    let client = Client::builder()
        .user_agent("cs2-backup-updater")
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| e.to_string())?;

    let mut resp = client.get(url).send().map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("下载失败，HTTP {}", resp.status()));
    }

    let total_size = resp.content_length().unwrap_or(0);

    let filename = url
        .rsplit('/')
        .next()
        .filter(|s| !s.is_empty())
        .unwrap_or("cs2-backup-update.exe")
        .to_string();

    let dest = std::env::temp_dir().join(&filename);
    let mut file = File::create(&dest).map_err(|e| e.to_string())?;

    let mut downloaded: u64 = 0;
    let mut buffer = [0u8; 64 * 1024];

    loop {
        let bytes_read = resp.read(&mut buffer).map_err(|e| e.to_string())?;
        if bytes_read == 0 {
            break;
        }

        file.write_all(&buffer[..bytes_read])
            .map_err(|e| e.to_string())?;

        downloaded += bytes_read as u64;

        if total_size > 0 {
            let percent = ((downloaded as f64 / total_size as f64) * 100.0).min(100.0) as u32;
            let _ = app.emit("update-progress", percent);
        }
    }

    let _ = app.emit("update-progress", 100u32);
    Ok(dest)
}

pub fn install_and_restart(exe_path: &std::path::Path) -> Result<(), String> {
    Command::new(exe_path)
        .arg("/S")
        .spawn()
        .map_err(|e| format!("启动安装器失败: {}", e))?;

    std::process::exit(0);
}
