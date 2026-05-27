import { useEffect, useMemo, useState } from "react";
import { toast } from "@heroui/react";
import { Icon } from "./Icons";
import { listCfgFiles, readCfgFile, saveCfgFile } from "../lib/tauri-commands";

interface CfgEditorProps {
  isOpen: boolean;
  onClose: () => void;
  cs2Path: string;
}

export default function CfgEditor({ isOpen, onClose, cs2Path }: CfgEditorProps) {
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modified, setModified] = useState(false);
  const [query, setQuery] = useState("");
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || !cs2Path) return;
    setLoading(true);
    setSelectedFile("");
    setContent("");
    setModified(false);
    listCfgFiles(cs2Path)
      .then((nextFiles) => {
        setFiles(nextFiles);
        setSelectedFile(nextFiles[0] || "");
      })
      .catch((e) => {
        setFiles([]);
        toast.danger("读取文件列表失败", { description: String(e) });
      })
      .finally(() => setLoading(false));
  }, [isOpen, cs2Path]);

  useEffect(() => {
    if (!selectedFile || !cs2Path) return;
    setLoading(true);
    readCfgFile(cs2Path, selectedFile)
      .then((nextContent) => {
        setContent(nextContent);
        setModified(false);
      })
      .catch((e) => {
        setContent("// 读取文件失败");
        toast.danger("读取 CFG 失败", { description: String(e) });
      })
      .finally(() => setLoading(false));
  }, [selectedFile, cs2Path]);

  const filteredFiles = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? files.filter((file) => file.toLowerCase().includes(normalized)) : files;
  }, [files, query]);

  const lineCount = useMemo(() => (content ? content.split(/\r\n|\r|\n/).length : 0), [content]);

  const handleSave = async (): Promise<boolean> => {
    if (!selectedFile || !cs2Path || saving) return false;
    setSaving(true);
    try {
      await saveCfgFile(cs2Path, selectedFile, content);
      setModified(false);
      toast.success("CFG 已保存", { description: selectedFile });
      return true;
    } catch (e) {
      toast.danger("保存失败", { description: String(e) });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const requestClose = () => {
    if (modified) {
      setCloseConfirmOpen(true);
      return;
    }
    onClose();
  };

  const selectFile = (file: string) => {
    if (file === selectedFile) return;
    if (modified) {
      const ok = window.confirm("当前文件有未保存修改，切换文件会丢失这些修改。继续吗？");
      if (!ok) return;
    }
    setSelectedFile(file);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      requestClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-layer" onKeyDown={handleKeyDown}>
        <div className="modal-backdrop" onClick={requestClose} />
        <div className="editor-panel">
          <header className="editor-header">
            <div style={{ minWidth: 0 }}>
              <h2 className="editor-title">CFG 编辑器</h2>
              <p className="muted truncate" style={{ margin: "4px 0 0" }}>
                {cs2Path}
              </p>
            </div>
            <div className="toolbar-actions">
              {modified && <span className="badge accent">未保存</span>}
              <button className="button primary" type="button" disabled={!modified || saving} onClick={handleSave}>
                {saving ? <span className="spinner" /> : <Icon path="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0h-9A2.25 2.25 0 0 0 5.25 6v14.25l6.75-3.375 6.75 3.375V6a2.25 2.25 0 0 0-2.25-2.25Z" />}
                保存
              </button>
              <button className="button secondary" type="button" onClick={requestClose}>
                关闭
              </button>
            </div>
          </header>

          <div className="editor-body">
            <aside className="editor-sidebar">
              <div className="editor-sidebar-tools">
                <input
                  className="input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索 cfg 文件"
                />
              </div>
              <div className="file-list">
                {filteredFiles.length === 0 && !loading && (
                  <p className="muted" style={{ padding: 14, margin: 0 }}>
                    没有 cfg 文件
                  </p>
                )}
                {filteredFiles.map((file) => (
                  <button
                    key={file}
                    className={`file-item${selectedFile === file ? " active" : ""}`}
                    type="button"
                    title={file}
                    onClick={() => selectFile(file)}
                  >
                    <span className="truncate">{file}</span>
                  </button>
                ))}
              </div>
            </aside>

            <main className="editor-main">
              <div className="editor-status">
                <span className="truncate">{selectedFile || "未选择文件"}</span>
                <span>{lineCount} 行</span>
              </div>
              {loading ? (
                <div className="loading-screen">
                  <div className="spinner" />
                </div>
              ) : (
                <textarea
                  className="code-editor"
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    setModified(true);
                  }}
                  spellCheck={false}
                  disabled={!selectedFile}
                />
              )}
            </main>
          </div>
        </div>
      </div>

      {closeConfirmOpen && (
        <div className="modal-layer">
          <div className="modal-backdrop" onClick={() => setCloseConfirmOpen(false)} />
          <div className="modal-panel">
            <h3 className="modal-title">有未保存修改</h3>
            <p className="muted" style={{ margin: 0 }}>
              关闭编辑器会丢失当前文件未保存的修改。
            </p>
            <div className="modal-actions">
              <button className="button secondary" type="button" onClick={() => setCloseConfirmOpen(false)}>
                继续编辑
              </button>
              <button
                className="button danger-soft"
                type="button"
                onClick={() => {
                  setCloseConfirmOpen(false);
                  setModified(false);
                  onClose();
                }}
              >
                放弃修改
              </button>
              <button
                className="button primary"
                type="button"
                onClick={async () => {
                  const saved = await handleSave();
                  if (saved) {
                    setCloseConfirmOpen(false);
                    onClose();
                  }
                }}
              >
                保存并关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
