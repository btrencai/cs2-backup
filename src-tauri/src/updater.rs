use reqwest::blocking::Client;
use semver::Version;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Emitter};

const REPO: &str = "btrencai/cs2-backup";
const DIRECT_API: &str = "https://api.github.com";

/// CDN proxies for GitHub — tried in order, first success wins.
const CDN_PROXIES: &[&str] = &[
    "https://ghproxy.cn/",
    "https://mirror.ghproxy.com/",
    "https://ghfast.top/",
];

fn api_urls() -> Vec<String> {
    let direct = format!("{DIRECT_API}/repos/{REPO}/releases/latest");
    let mut urls: Vec<String> = CDN_PROXIES
        .iter()
        .map(|cdn| format!("{cdn}{direct}"))
        .collect();
    urls.push(direct);
    urls
}

fn asset_urls(original: &str) -> Vec<String> {
    if !original.starts_with("https://github.com/")
        && !original.starts_with("https://objects.githubusercontent.com/")
    {
        return vec![original.to_string()];
    }
    let mut urls: Vec<String> = CDN_PROXIES
        .iter()
        .map(|cdn| format!("{cdn}{original}"))
        .collect();
    urls.push(original.to_string());
    urls
}

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

fn build_client(timeout_secs: u64) -> Result<Client, String> {
    Client::builder()
        .user_agent("cs2-backup-updater")
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| e.to_string())
}

/// Try each URL in order; return the first successful response.
fn try_get(client: &Client, urls: &[String]) -> Result<reqwest::blocking::Response, String> {
    let mut last_err = String::new();
    for url in urls {
        match client.get(url).send() {
            Ok(resp) if resp.status().is_success() => return Ok(resp),
            Ok(resp) => last_err = format!("HTTP {}", resp.status()),
            Err(e) => last_err = e.to_string(),
        }
    }
    Err(format!("所有连接均失败: {last_err}"))
}

fn fetch_latest_release(client: &Client) -> Result<GhRelease, String> {
    let urls = api_urls();
    let resp = try_get(client, &urls)?;
    resp.json::<GhRelease>()
        .map_err(|e| format!("解析响应失败: {e}"))
}

pub fn check_github_update(current_version: &str) -> Option<UpdateInfo> {
    let client = build_client(15).ok()?;
    let release = fetch_latest_release(&client).ok()?;

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

    let raw_url = exe_asset.browser_download_url.clone();
    let cdn_url = asset_urls(&raw_url).into_iter().next().unwrap_or(raw_url);

    Some(UpdateInfo {
        version: tag_version.to_string(),
        tag: tag.to_string(),
        body: release.body,
        exe_url: cdn_url,
        published_at: release.published_at,
    })
}

pub fn fetch_latest_version() -> Result<String, String> {
    let client = build_client(15)?;
    let release = fetch_latest_release(&client)?;

    let tag = &release.tag_name;
    let tag_version = tag.strip_prefix('v').unwrap_or(tag).to_string();
    Ok(tag_version)
}

pub fn download_update(url: &str, app: &AppHandle) -> Result<PathBuf, String> {
    let client = build_client(600)?;

    let urls = asset_urls(url);
    let mut resp = try_get(&client, &urls)?;

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
