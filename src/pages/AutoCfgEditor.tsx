import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@heroui/react";
import { Icon, CsgoIcon } from "../components/Icons";
import {
  detectConfigTargets,
  installAutoCfgTemplate,
  readAutoCfg,
  writeAutoCfg,
  type CfgEntry,
  type CfgSection,
  type ConfigTarget,
} from "../lib/tauri-commands";

function CfgToggle({
  entry,
  onChange,
}: {
  entry: CfgEntry;
  onChange: (value: string) => void;
}) {
  const isOn = entry.value === "1";
  return (
    <button
      className={`cfg-toggle${isOn ? " on" : ""}`}
      type="button"
      onClick={() => onChange(isOn ? "0" : "1")}
    >
      <span className="cfg-toggle-knob" />
      <span className="cfg-toggle-label">{isOn ? "ON" : "OFF"}</span>
    </button>
  );
}

function CfgSlider({
  entry,
  onChange,
}: {
  entry: CfgEntry;
  onChange: (value: string) => void;
}) {
  const min = entry.min ?? 0;
  const max = entry.max ?? 100;
  const numVal = Number(entry.value) || 0;
  const step = max - min <= 5 ? 0.01 : max - min <= 50 ? 0.1 : 1;

  return (
    <div className="cfg-slider">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={numVal}
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        className="cfg-slider-input"
        type="number"
        min={min}
        max={max}
        step={step}
        value={entry.value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function CfgNumberInput({
  entry,
  onChange,
}: {
  entry: CfgEntry;
  onChange: (value: string) => void;
}) {
  const step = entry.key.includes("sensitivity") || entry.key.includes("volume") || entry.key.includes("alpha") || entry.key.includes("scale") ? 0.01 : 1;
  return (
    <input
      className="cfg-number-input"
      type="number"
      step={step}
      value={entry.value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function CfgStringInput({
  entry,
  onChange,
}: {
  entry: CfgEntry;
  onChange: (value: string) => void;
}) {
  return (
    <input
      className="cfg-string-input"
      type="text"
      value={entry.value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function CfgEntryRow({
  entry,
  onChange,
}: {
  entry: CfgEntry;
  onChange: (value: string) => void;
}) {
  return (
    <div className="cfg-entry-row">
      <span className="cfg-entry-key" title={entry.key}>
        {entry.key}
      </span>
      <div className="cfg-entry-control">
        {entry.value_type === "toggle" && <CfgToggle entry={entry} onChange={onChange} />}
        {entry.value_type === "number" && entry.min != null && entry.max != null && (
          <CfgSlider entry={entry} onChange={onChange} />
        )}
        {entry.value_type === "number" && (entry.min == null || entry.max == null) && (
          <CfgNumberInput entry={entry} onChange={onChange} />
        )}
        {entry.value_type === "string" && <CfgStringInput entry={entry} onChange={onChange} />}
      </div>
      {entry.comment && (
        <span className="cfg-entry-comment" title={entry.comment}>
          {entry.comment}
        </span>
      )}
    </div>
  );
}

function CfgSectionCard({
  section,
  index,
  onEntryChange,
}: {
  section: CfgSection;
  index: number;
  onEntryChange: (sectionIndex: number, entryIndex: number, value: string) => void;
}) {
  if (section.entries.length === 0) return null;

  return (
    <section className="card pad auto-cfg-section">
      <div className="card-title-row">
        <h2 className="card-title">
          <CsgoIcon />
          {section.name}
        </h2>
        <span className="badge accent">{section.entries.length} 项</span>
      </div>
      <div className="cfg-entries">
        {section.entries.map((entry, ei) => (
          <CfgEntryRow
            key={`${section.name}-${entry.key}`}
            entry={entry}
            onChange={(value) => onEntryChange(index, ei, value)}
          />
        ))}
      </div>
    </section>
  );
}

export default function AutoCfgEditor() {
  const [targets, setTargets] = useState<ConfigTarget[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [sections, setSections] = useState<CfgSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modified, setModified] = useState(false);
  const [rawView, setRawView] = useState(false);
  const [rawContent, setRawContent] = useState("");
  const [noFile, setNoFile] = useState(false);

  const globalTargets = useMemo(() => targets.filter((t) => t.kind === "global"), [targets]);
  const selectedTarget = useMemo(
    () => globalTargets.find((t) => t.id === selectedTargetId) || globalTargets[0],
    [selectedTargetId, globalTargets],
  );

  useEffect(() => {
    detectConfigTargets()
      .then(setTargets)
      .catch((e) => toast.danger("检测配置失败", { description: String(e) }));
  }, []);

  useEffect(() => {
    if (globalTargets.length > 0 && !globalTargets.some((t) => t.id === selectedTargetId)) {
      setSelectedTargetId(globalTargets[0].id);
    }
  }, [selectedTargetId, globalTargets]);

  const loadCfg = useCallback(async () => {
    if (!selectedTarget) return;
    setLoading(true);
    setNoFile(false);
    try {
      const data = await readAutoCfg(selectedTarget.path);
      setSections(data);
      setModified(false);
    } catch (e: unknown) {
      const msg = String(e);
      if (msg.includes("不存在")) {
        setNoFile(true);
        setSections([]);
      } else {
        toast.danger("读取 auto.cfg 失败", { description: msg });
      }
    } finally {
      setLoading(false);
    }
  }, [selectedTarget]);

  useEffect(() => {
    loadCfg();
  }, [loadCfg]);

  const handleEntryChange = useCallback(
    (sectionIndex: number, entryIndex: number, value: string) => {
      setSections((prev) => {
        const next = prev.map((s) => ({ ...s, entries: [...s.entries] }));
        next[sectionIndex].entries[entryIndex] = {
          ...next[sectionIndex].entries[entryIndex],
          value,
        };
        return next;
      });
      setModified(true);
    },
    [],
  );

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!selectedTarget || saving) return false;
    setSaving(true);
    try {
      await writeAutoCfg(selectedTarget.path, sections);
      setModified(false);
      toast.success("auto.cfg 已保存");
      return true;
    } catch (e) {
      toast.danger("保存失败", { description: String(e) });
      return false;
    } finally {
      setSaving(false);
    }
  }, [selectedTarget, sections, saving]);

  const handleInstallTemplate = useCallback(async () => {
    if (!selectedTarget) return;
    setLoading(true);
    try {
      await installAutoCfgTemplate(selectedTarget.path);
      toast.success("模板已创建", { description: `已写入 ${selectedTarget.path}` });
      await loadCfg();
    } catch (e) {
      toast.danger("创建失败", { description: String(e) });
    } finally {
      setLoading(false);
    }
  }, [selectedTarget, loadCfg]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave],
  );

  const toggleRawView = useCallback(() => {
    if (!rawView) {
      const lines: string[] = [];
      for (const sec of sections) {
        for (const hl of sec.header_lines) lines.push(hl);
        const maxKey = Math.max(...sec.entries.map((e) => e.key.length), 0);
        for (const entry of sec.entries) {
          const pad = " ".repeat(maxKey - entry.key.length + 4);
          const comment = entry.comment ? ` // ${entry.comment}` : "";
          lines.push(`${entry.key}${pad}${entry.value}${comment}`);
        }
        lines.push("");
      }
      setRawContent(lines.join("\n"));
    }
    setRawView((v) => !v);
  }, [rawView, sections]);

  const handleTargetChange = useCallback(
    (id: string) => {
      if (modified) {
        const ok = window.confirm("有未保存的修改，切换目录会丢失。继续吗？");
        if (!ok) return;
      }
      setSelectedTargetId(id);
    },
    [modified],
  );

  const selectOptions = useMemo(
    () =>
      globalTargets.map((t) => (
        <option key={t.id} value={t.id}>
          {t.label} — {t.path}
        </option>
      )),
    [globalTargets],
  );

  const GRID_ICON =
    "M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z";
  const RAW_ICON =
    "M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15";

  return (
    <div className="page-stack" onKeyDown={handleKeyDown}>
      <div className="page-header">
        <div>
          <p className="eyebrow">Auto.cfg</p>
          <h1 className="page-title">配置编辑器</h1>
          <p className="page-description">
            可视化编辑全局 cfg 目录下的 auto.cfg，按分组调整鼠标、准星、键位、音量等设置，保存后立即生效。
          </p>
        </div>
        <div className="toolbar-actions">
          {modified && <span className="badge accent">未保存</span>}
          <button
            className="button secondary"
            type="button"
            onClick={toggleRawView}
          >
            <Icon path={rawView ? GRID_ICON : RAW_ICON} />
            {rawView ? "可视化" : "原始视图"}
          </button>
          <button
            className="button primary"
            type="button"
            disabled={!modified || saving || sections.length === 0}
            onClick={() => handleSave()}
          >
            {saving ? <span className="spinner" /> : <Icon path="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0h-9A2.25 2.25 0 0 0 5.25 6v14.25l6.75-3.375 6.75 3.375V6a2.25 2.25 0 0 0-2.25-2.25Z" />}
            保存
          </button>
        </div>
      </div>

      <div className="card pad" style={{ padding: "14px 18px" }}>
        <div className="toolbar" style={{ gap: 12, flexWrap: "wrap" }}>
          <label className="form-label" style={{ margin: 0, whiteSpace: "nowrap" }}>
            全局 cfg 目录
          </label>
          <select
            className="select"
            style={{ flex: 1, minWidth: 260 }}
            value={selectedTarget?.id || ""}
            onChange={(e) => handleTargetChange(e.target.value)}
          >
            {globalTargets.length === 0 && <option>未检测到全局 cfg 目录</option>}
            {selectOptions}
          </select>
          <button
            className="button secondary"
            type="button"
            onClick={loadCfg}
          >
            <Icon path="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            刷新
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen">
          <div className="spinner" />
        </div>
      ) : noFile ? (
        <div className="empty-state">
          <CsgoIcon className="empty-csgo-icon" alt="CS2" />
          <p className="empty-title">该目录下没有 auto.cfg</p>
          <p className="empty-text">可以从内置模板创建一份，再按需修改。</p>
          <button
            className="button primary"
            type="button"
            style={{ marginTop: 16 }}
            onClick={handleInstallTemplate}
          >
            <Icon path="M12 4.5v15m7.5-7.5h-15" />
            从模板创建
          </button>
        </div>
      ) : rawView ? (
        <div className="card pad" style={{ padding: 0 }}>
          <textarea
            className="code-editor"
            style={{ minHeight: 520, borderRadius: "var(--radius)", border: "none" }}
            value={rawContent}
            spellCheck={false}
            readOnly
          />
        </div>
      ) : (
        <div className="auto-cfg-grid">
          {sections.map((section, i) => (
            <CfgSectionCard
              key={section.name || i}
              section={section}
              index={i}
              onEntryChange={handleEntryChange}
            />
          ))}
          {sections.length === 0 && (
            <div className="empty-state">
              <p className="empty-title">没有可编辑的设置</p>
              <p className="empty-text">auto.cfg 文件为空或格式不正确。</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
