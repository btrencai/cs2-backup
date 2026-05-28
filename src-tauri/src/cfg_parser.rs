use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CfgSection {
    pub name: String,
    pub raw_content: String,
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

/// Matches: key  value  // comment  OR  key  value (no comment)
/// Group 1 = key, Group 2 = value, Group 3 = comment (optional)
static ENTRY_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^(\S+)\s+(\S.*?)\s*(?://\s*(.*))?$").unwrap()
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

fn try_parse_entry(line: &str) -> Option<CfgEntry> {
    let stripped = line.strip_prefix("//").unwrap_or(line);

    if stripped.starts_with("bind ")
        || stripped.starts_with("alias ")
        || stripped.starts_with("exec ")
        || stripped.starts_with("echo")
        || stripped.starts_with("binddefaults")
    {
        return None;
    }

    let caps = ENTRY_RE.captures(stripped)?;
    let key = caps.get(1)?.as_str().to_string();
    let value = caps.get(2)?.as_str().trim().to_string();
    let comment = caps.get(3).map(|m| m.as_str().trim().to_string()).unwrap_or_default();

    if key == "bind" || key == "alias" || key == "exec" || key == "echo" {
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

pub fn parse_cfg(content: &str) -> Vec<CfgSection> {
    let mut sections: Vec<CfgSection> = Vec::new();
    let mut current_name: Option<String> = None;
    let mut current_lines: Vec<String> = Vec::new();
    let mut current_entries: Vec<CfgEntry> = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();

        if let Some(caps) = SECTION_RE.captures(trimmed) {
            // Flush previous section
            if let Some(name) = current_name.take() {
                sections.push(CfgSection {
                    name,
                    raw_content: current_lines.join("\n"),
                    entries: current_entries,
                });
                current_lines = Vec::new();
                current_entries = Vec::new();
            }

            let name = caps.get(1).map(|m| m.as_str().trim().to_string()).unwrap_or_default();
            current_name = Some(name);
            current_lines.push(line.to_string());

            // Try to parse the section header line itself as an entry (unlikely, but safe)
            if let Some(entry) = try_parse_entry(trimmed) {
                current_entries.push(entry);
            }
            continue;
        }

        if current_name.is_some() {
            current_lines.push(line.to_string());
            if let Some(entry) = try_parse_entry(trimmed) {
                current_entries.push(entry);
            }
        }
        // Lines before the first section are discarded (header comments)
    }

    // Flush last section
    if let Some(name) = current_name {
        sections.push(CfgSection {
            name,
            raw_content: current_lines.join("\n"),
            entries: current_entries,
        });
    }

    sections
}

/// Line-preserving serialization: only replace values of entries that exist
/// in the parsed data, keeping every other line (bind, exec, alias, echo,
/// comments, formatting) completely untouched.
pub fn serialize_cfg(sections: &[CfgSection]) -> String {
    let mut output_sections: Vec<String> = Vec::new();

    for section in sections {
        let mut result = section.raw_content.clone();

        for entry in &section.entries {
            result = replace_entry_value(&result, &entry.key, &entry.value);
        }

        output_sections.push(result);
    }

    output_sections.join("\n")
}

/// Replace the value of a specific key in the raw text, preserving
/// all other content on the line (spacing, comment, etc.)
fn replace_entry_value(text: &str, key: &str, new_value: &str) -> String {
    let escaped = regex::escape(key);
    let pattern = format!(r"(?m)^(\s*{}\s+)(\S.*?)(\s*//.*)?$", escaped);
    let re = Regex::new(&pattern).unwrap();

    re.replace_all(text, |caps: &regex::Captures| {
        let prefix = caps.get(1).map_or("", |m| m.as_str());
        let after = caps.get(2).map_or("", |m| m.as_str()).trim_end();
        let comment_part = caps.get(3).map_or("", |m| m.as_str());

        // If the value part still contains "//", the comment was inline
        // (e.g., "value // comment" without leading spaces before //)
        if let Some(idx) = after.find("//") {
            let _actual_value = after[..idx].trim_end();
            let inline_comment = &after[idx..];
            if comment_part.is_empty() {
                format!("{}{} {}", prefix, new_value, inline_comment)
            } else {
                format!("{}{} {}{}", prefix, new_value, inline_comment, comment_part)
            }
        } else if comment_part.is_empty() {
            format!("{}{}", prefix, new_value)
        } else {
            format!("{}{}{}", prefix, new_value, comment_part)
        }
    })
    .to_string()
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
