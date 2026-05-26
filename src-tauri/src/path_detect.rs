use base64::Engine;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use winreg::enums::*;
use winreg::RegKey;

const STEAM_ID64_BASE: u64 = 76_561_197_960_265_728;

#[derive(Debug, Serialize, Clone)]
pub struct ConfigTarget {
    pub id: String,
    pub kind: String,
    pub label: String,
    pub path: String,
    pub steam_id: Option<String>,
    pub account_id: Option<String>,
    pub account_name: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Default)]
struct SteamUser {
    steam_id64: String,
    account_id: String,
    account_name: Option<String>,
    persona_name: Option<String>,
    avatar_url: Option<String>,
}

impl SteamUser {
    fn display_name(&self) -> String {
        self.persona_name
            .clone()
            .or_else(|| self.account_name.clone())
            .unwrap_or_else(|| format!("Steam 用户 {}", self.account_id))
    }
}

pub fn find_config_targets() -> Vec<ConfigTarget> {
    let mut targets = Vec::new();

    for (index, path) in find_global_cfg_paths().into_iter().enumerate() {
        targets.push(ConfigTarget {
            id: format!("global-{index}"),
            kind: "global".to_string(),
            label: if index == 0 {
                "全局 cfg".to_string()
            } else {
                format!("全局 cfg {}", index + 1)
            },
            path,
            steam_id: None,
            account_id: None,
            account_name: None,
            avatar_url: None,
        });
    }

    targets.extend(find_userdata_cfg_targets());
    targets
}

pub fn find_cs2_cfg_paths() -> Vec<String> {
    find_config_targets()
        .into_iter()
        .map(|target| target.path)
        .collect()
}

pub fn find_cs2_cfg_path() -> Result<String, String> {
    find_global_cfg_paths()
        .into_iter()
        .next()
        .or_else(|| {
            find_userdata_cfg_targets()
                .into_iter()
                .next()
                .map(|target| target.path)
        })
        .ok_or_else(|| "未找到 CS2 配置目录，请在设置中手动配置路径。".to_string())
}

fn get_steam_install_path() -> Option<String> {
    let registry_roots = [
        (RegKey::predef(HKEY_CURRENT_USER), r"Software\Valve\Steam"),
        (
            RegKey::predef(HKEY_LOCAL_MACHINE),
            r"SOFTWARE\WOW6432Node\Valve\Steam",
        ),
        (RegKey::predef(HKEY_LOCAL_MACHINE), r"SOFTWARE\Valve\Steam"),
    ];

    for (root, reg_path) in registry_roots {
        if let Ok(key) = root.open_subkey_with_flags(reg_path, KEY_READ) {
            if let Ok(install_path) = key.get_value::<String, _>("SteamPath") {
                return Some(normalize_steam_path(&install_path));
            }
            if let Ok(install_path) = key.get_value::<String, _>("InstallPath") {
                return Some(normalize_steam_path(&install_path));
            }
        }
    }

    common_steam_paths()
        .into_iter()
        .find(|path| PathBuf::from(path).exists())
        .map(str::to_string)
}

fn normalize_steam_path(path: &str) -> String {
    path.replace('/', "\\")
        .trim_end_matches(['\\', '/'])
        .to_string()
}

fn path_key(path: &str) -> String {
    normalize_steam_path(path).to_ascii_lowercase()
}

fn common_steam_paths() -> Vec<&'static str> {
    vec![
        r"C:\Program Files (x86)\Steam",
        r"C:\Program Files\Steam",
        r"D:\Steam",
        r"D:\SteamLibrary",
        r"E:\Steam",
        r"E:\SteamLibrary",
    ]
}

fn find_global_cfg_paths() -> Vec<String> {
    let mut results = Vec::new();
    let mut seen = HashSet::new();

    for library in find_steam_library_folders() {
        let candidates = [
            PathBuf::from(&library)
                .join("steamapps")
                .join("common")
                .join("Counter-Strike Global Offensive")
                .join("game")
                .join("csgo")
                .join("cfg"),
            PathBuf::from(&library)
                .join("steamapps")
                .join("common")
                .join("Counter-Strike Global Offensive")
                .join("game")
                .join("cs2")
                .join("cfg"),
        ];

        for cfg_path in candidates {
            if cfg_path.exists() {
                let path = cfg_path.to_string_lossy().to_string();
                if seen.insert(path_key(&path)) {
                    results.push(path);
                }
            }
        }
    }

    for path in common_global_cfg_paths() {
        let cfg_path = PathBuf::from(path);
        if cfg_path.exists() {
            let path = cfg_path.to_string_lossy().to_string();
            if seen.insert(path_key(&path)) {
                results.push(path);
            }
        }
    }

    results
}

fn common_global_cfg_paths() -> Vec<&'static str> {
    vec![
        r"C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg",
        r"C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\cs2\cfg",
        r"D:\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg",
        r"D:\Steam\steamapps\common\Counter-Strike Global Offensive\game\cs2\cfg",
        r"D:\SteamLibrary\steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg",
        r"D:\SteamLibrary\steamapps\common\Counter-Strike Global Offensive\game\cs2\cfg",
        r"E:\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg",
        r"E:\Steam\steamapps\common\Counter-Strike Global Offensive\game\cs2\cfg",
        r"E:\SteamLibrary\steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg",
        r"E:\SteamLibrary\steamapps\common\Counter-Strike Global Offensive\game\cs2\cfg",
    ]
}

fn find_userdata_cfg_targets() -> Vec<ConfigTarget> {
    let install_path = match get_steam_install_path() {
        Some(path) => path,
        None => return Vec::new(),
    };

    let userdata_dir = PathBuf::from(&install_path).join("userdata");
    if !userdata_dir.exists() {
        return Vec::new();
    }

    let users = read_steam_users(&install_path);
    let mut results = Vec::new();

    if let Ok(entries) = std::fs::read_dir(&userdata_dir) {
        for entry in entries.flatten() {
            if !entry
                .file_type()
                .map(|file_type| file_type.is_dir())
                .unwrap_or(false)
            {
                continue;
            }

            let account_id = entry.file_name().to_string_lossy().to_string();
            let cfg_path = entry.path().join("730").join("local").join("cfg");
            if !cfg_path.exists() {
                continue;
            }

            let user = users.get(&account_id);
            let label = user
                .map(SteamUser::display_name)
                .unwrap_or_else(|| format!("Steam 用户 {}", account_id));
            let steam_id = user.map(|u| u.steam_id64.clone());
            let account_name = user.and_then(|u| u.account_name.clone());
            let avatar_url = user.and_then(|u| u.avatar_url.clone());

            results.push(ConfigTarget {
                id: format!("userdata-{account_id}"),
                kind: "userdata".to_string(),
                label,
                path: cfg_path.to_string_lossy().to_string(),
                steam_id,
                account_id: Some(account_id),
                account_name,
                avatar_url,
            });
        }
    }

    results.sort_by(|a, b| a.label.cmp(&b.label));
    results
}

fn find_steam_library_folders() -> Vec<String> {
    let install_path = match get_steam_install_path() {
        Some(path) => path,
        None => return Vec::new(),
    };

    let mut paths = vec![install_path.clone()];
    let vdf_path = PathBuf::from(&install_path)
        .join("steamapps")
        .join("libraryfolders.vdf");

    if let Ok(content) = std::fs::read_to_string(&vdf_path) {
        for line in content.lines() {
            if let Some((key, value)) = parse_vdf_pair(line) {
                if key == "path" {
                    paths.push(normalize_steam_path(&value.replace("\\\\", "\\")));
                }
            }
        }
    }

    let mut seen = HashSet::new();
    paths.retain(|path| seen.insert(path_key(path)));
    paths
}

fn read_steam_users(install_path: &str) -> HashMap<String, SteamUser> {
    let path = PathBuf::from(install_path)
        .join("config")
        .join("loginusers.vdf");
    let content = match std::fs::read_to_string(path) {
        Ok(content) => content,
        Err(_) => return HashMap::new(),
    };

    let mut users_by_account_id = HashMap::new();
    let mut current_user: Option<SteamUser> = None;

    for line in content.lines() {
        let trimmed = line.trim();

        if trimmed == "}" {
            if let Some(user) = current_user.take() {
                users_by_account_id.insert(user.account_id.clone(), user);
            }
            continue;
        }

        if current_user.is_none() {
            if let Some(id) = parse_single_quoted_value(trimmed) {
                if id.chars().all(|ch| ch.is_ascii_digit()) {
                    let account_id = steam_id64_to_account_id(&id).unwrap_or_else(|| id.clone());
                    current_user = Some(SteamUser {
                        steam_id64: id.clone(),
                        account_id,
                        avatar_url: cached_avatar_data_url(install_path, &id),
                        ..Default::default()
                    });
                }
            }
            continue;
        }

        if let Some((key, value)) = parse_vdf_pair(trimmed) {
            if let Some(user) = current_user.as_mut() {
                match key.as_str() {
                    "AccountName" => user.account_name = Some(value),
                    "PersonaName" => user.persona_name = Some(value),
                    "Avatar" => {
                        if user.avatar_url.is_none() {
                            user.avatar_url = steam_avatar_url(&value);
                        }
                    }
                    _ => {}
                }
            }
        }
    }

    if let Some(user) = current_user {
        users_by_account_id.insert(user.account_id.clone(), user);
    }

    users_by_account_id
}

fn cached_avatar_data_url(install_path: &str, steam_id64: &str) -> Option<String> {
    let avatar_dir = PathBuf::from(install_path)
        .join("config")
        .join("avatarcache");
    let candidates = [
        (avatar_dir.join(format!("{steam_id64}.png")), "image/png"),
        (avatar_dir.join(format!("{steam_id64}.jpg")), "image/jpeg"),
        (avatar_dir.join(format!("{steam_id64}.jpeg")), "image/jpeg"),
    ];

    for (path, mime) in candidates {
        if path.exists() {
            let bytes = std::fs::read(path).ok()?;
            let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
            return Some(format!("data:{mime};base64,{encoded}"));
        }
    }

    None
}

fn steam_avatar_url(hash: &str) -> Option<String> {
    let hash = hash.trim();
    if hash.is_empty() {
        return None;
    }
    Some(format!(
        "https://avatars.akamai.steamstatic.com/{hash}_medium.jpg"
    ))
}

fn steam_id64_to_account_id(steam_id: &str) -> Option<String> {
    let id = steam_id.parse::<u64>().ok()?;
    if id < STEAM_ID64_BASE {
        return None;
    }
    Some((id - STEAM_ID64_BASE).to_string())
}

fn parse_single_quoted_value(line: &str) -> Option<String> {
    let values = quoted_values(line);
    if values.len() == 1 {
        return values.into_iter().next();
    }
    None
}

fn parse_vdf_pair(line: &str) -> Option<(String, String)> {
    let values = quoted_values(line);
    if values.len() >= 2 {
        Some((values[0].clone(), values[1].clone()))
    } else {
        None
    }
}

fn quoted_values(line: &str) -> Vec<String> {
    let mut values = Vec::new();
    let mut current = String::new();
    let mut in_quote = false;
    let mut escaped = false;

    for ch in line.chars() {
        if escaped {
            current.push(ch);
            escaped = false;
            continue;
        }
        if ch == '\\' && in_quote {
            escaped = true;
            current.push(ch);
            continue;
        }
        if ch == '"' {
            if in_quote {
                values.push(current.clone());
                current.clear();
            }
            in_quote = !in_quote;
            continue;
        }
        if in_quote {
            current.push(ch);
        }
    }

    values
}
