use reqwest::blocking::Client;
use semver::Version;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Emitter};

const VERSION_URL: &str = "https://cdn.jsdelivr.net/gh/btrencai/cs2-backup@main/version.json";
const DOWNLOAD_CDN: &str = "https://ghproxy.net/";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub version: String,
    pub tag: String,
    pub body: String,
    pub exe_url: String,
    pub published_at: String,
}

#[derive(Deserialize)]
struct VersionManifest {
    version: String,
    tag: String,
    body: String,
    published_at: String,
    assets: AssetUrls,
}

#[derive(Deserialize)]
struct AssetUrls {
    exe: String,
}

fn build_client(timeout_secs: u64) -> Result<Client, String> {
    Client::builder()
        .user_agent("cs2-backup-updater")
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| e.to_string())
}

fn fetch_manifest(client: &Client) -> Result<VersionManifest, String> {
    let resp = client
        .get(VERSION_URL)
        .send()
        .map_err(|e| format!("网络请求失败: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }

    resp.json::<VersionManifest>()
        .map_err(|e| format!("解析 version.json 失败: {e}"))
}

fn proxied_download_url(original: &str) -> String {
    if original.starts_with("https://github.com/")
        || original.starts_with("https://objects.githubusercontent.com/")
    {
        format!("{DOWNLOAD_CDN}{original}")
    } else {
        original.to_string()
    }
}

pub fn check_github_update(current_version: &str) -> Option<UpdateInfo> {
    let client = build_client(15).ok()?;
    let manifest = fetch_manifest(&client).ok()?;

    let tag_version = manifest.version.as_str();
    let latest = Version::parse(tag_version).ok()?;
    let current = Version::parse(current_version).ok()?;

    if latest <= current {
        return None;
    }

    Some(UpdateInfo {
        version: manifest.version,
        tag: manifest.tag,
        body: manifest.body,
        exe_url: proxied_download_url(&manifest.assets.exe),
        published_at: manifest.published_at,
    })
}

pub fn fetch_latest_version() -> Result<String, String> {
    let client = build_client(15)?;
    let manifest = fetch_manifest(&client)?;
    Ok(manifest.version)
}

pub fn download_update(url: &str, app: &AppHandle) -> Result<PathBuf, String> {
    let client = build_client(600)?;

    let download_url = proxied_download_url(url);
    let mut resp = client
        .get(&download_url)
        .send()
        .map_err(|e| format!("下载请求失败: {e}"))?;

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
