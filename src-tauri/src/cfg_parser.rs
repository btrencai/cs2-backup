use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CfgSection {
    pub name: String,
    pub header_lines: Vec<String>,
    pub entries: Vec<CfgEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CfgEntry {
    pub key: String,
    pub value: String,
    pub comment: String,
    pub value_type: String,
    pub min: Option<f64>,
    pub max: Option<f64>,
}

static SECTION_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"//═+\s*\d+\.\s*(.+?)\s*═+").unwrap()
});

static ENTRY_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^(\S+)\s+(\S.*?)(?:\s*//\s*(.*))?$").unwrap()
});

static RANGE_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"[-<]?\s*(\d+\.?\d*)\s*[~\-–]\s*(\d+\.?\d*)").unwrap()
});

fn detect_value_type(value: &str) -> String {
    if value == "0" || value == "1" {
        return "toggle".to_string();
    }
    if value.parse::<f64>().is_ok() {
        return "number".to_string();
    }
    "string".to_string()
}

fn parse_range(comment: &str) -> (Option<f64>, Option<f64>) {
    if let Some(caps) = RANGE_RE.captures(comment) {
        let min = caps.get(1).and_then(|m| m.as_str().parse::<f64>().ok());
        let max = caps.get(2).and_then(|m| m.as_str().parse::<f64>().ok());
        return (min, max);
    }
    (None, None)
}

pub fn parse_cfg(content: &str) -> Vec<CfgSection> {
    let mut sections: Vec<CfgSection> = Vec::new();
    let mut current_section: Option<CfgSection> = None;
    let mut pending_header: Vec<String> = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();

        if let Some(caps) = SECTION_RE.captures(trimmed) {
            if let Some(sec) = current_section.take() {
                sections.push(sec);
            }
            let name = caps.get(1).map(|m| m.as_str().trim().to_string()).unwrap_or_default();
            let mut header = pending_header.clone();
            header.push(line.to_string());
            pending_header.clear();
            current_section = Some(CfgSection {
                name,
                header_lines: header,
                entries: Vec::new(),
            });
            continue;
        }

        if let Some(ref mut sec) = current_section {
            if trimmed.is_empty() || trimmed.starts_with("//──") || trimmed.starts_with("//══") {
                sec.header_lines.push(line.to_string());
                continue;
            }
            if let Some(entry) = parse_entry(trimmed) {
                sec.entries.push(entry);
            } else {
                sec.header_lines.push(line.to_string());
            }
        } else {
            pending_header.push(line.to_string());
        }
    }

    if let Some(sec) = current_section {
        sections.push(sec);
    }

    sections
}

fn parse_entry(line: &str) -> Option<CfgEntry> {
    let stripped = line.strip_prefix("//").unwrap_or(line);

    if stripped.starts_with("exec ")
        || stripped.starts_with("alias ")
        || stripped.starts_with("bind ")
        || stripped.starts_with("echo ")
    {
        return None;
    }

    let caps = ENTRY_RE.captures(stripped)?;
    let key = caps.get(1)?.as_str().to_string();
    let value = caps.get(2)?.as_str().trim().to_string();
    let comment = caps.get(3).map(|m| m.as_str().trim().to_string()).unwrap_or_default();

    if key == "exec" || key == "alias" || key == "bind" || key == "echo" {
        return None;
    }

    let (min, max) = parse_range(&comment);
    let value_type = detect_value_type(&value);

    Some(CfgEntry {
        key,
        value,
        comment,
        value_type,
        min,
        max,
    })
}

pub fn serialize_cfg(sections: &[CfgSection]) -> String {
    let mut out = String::new();

    for (i, section) in sections.iter().enumerate() {
        if i > 0 {
            out.push_str("\n\n");
        }
        for hline in &section.header_lines {
            out.push_str(hline);
            out.push('\n');
        }

        let max_key_len = section
            .entries
            .iter()
            .map(|e| e.key.len())
            .max()
            .unwrap_or(0);

        for entry in &section.entries {
            let pad = " ".repeat(max_key_len.saturating_sub(entry.key.len()) + 4);
            if entry.comment.is_empty() {
                out.push_str(&format!("{}{}{}\n", entry.key, pad, entry.value));
            } else {
                out.push_str(&format!(
                    "{}{}{}// {}\n",
                    entry.key, pad, entry.value, entry.comment
                ));
            }
        }
    }

    out.push_str("\n\nhost_writeconfig;\n");
    out
}

pub fn read_cfg_file(dir: &str) -> Result<(String, Vec<CfgSection>), String> {
    let path = Path::new(dir).join("auto.cfg");
    if !path.exists() {
        return Err(format!("auto.cfg 不存在: {}", path.display()));
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let sections = parse_cfg(&content);
    Ok((content, sections))
}

pub fn write_cfg_file(dir: &str, sections: &[CfgSection]) -> Result<(), String> {
    let path = Path::new(dir).join("auto.cfg");
    let content = serialize_cfg(sections);
    fs::write(&path, content).map_err(|e| e.to_string())
}

pub fn parse_template(template_content: &str) -> Vec<CfgSection> {
    parse_cfg(template_content)
}

pub fn install_template(dir: &str, template_content: &str) -> Result<(), String> {
    let dest = Path::new(dir).join("auto.cfg");
    fs::write(&dest, template_content).map_err(|e| e.to_string())
}
