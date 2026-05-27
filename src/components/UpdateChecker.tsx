import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Icon, CsgoIcon } from "./Icons";
import {
  checkForUpdate,
  downloadUpdate,
  installUpdate,
  formatDate,
  type UpdateInfo,
} from "../lib/tauri-commands";

const APP_VERSION = "2.2.0";
const CHECK_DELAY_MS = 3000;
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

type UpdateState = "idle" | "downloading" | "ready";

export default function UpdateChecker() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [state, setState] = useState<UpdateState>("idle");
  const [progress, setProgress] = useState(0);
  const [downloadedPath, setDownloadedPath] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const doCheck = useCallback(async () => {
    try {
      const info = await checkForUpdate(APP_VERSION);
      if (info) {
        setUpdate(info);
        setDismissed(false);
      }
    } catch {
      /* 静默失败 */
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(doCheck, CHECK_DELAY_MS);
    timerRef.current = setInterval(doCheck, CHECK_INTERVAL_MS);
    return () => {
      clearTimeout(timeout);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [doCheck]);

  useEffect(() => {
    const unlisten = listen<number>("update-progress", (event) => {
      setProgress(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleDownload = useCallback(async () => {
    if (!update) return;
    setState("downloading");
    setProgress(0);
    try {
      const path = await downloadUpdate(update.exe_url);
      setDownloadedPath(path);
      setState("ready");
    } catch (e) {
      setState("idle");
      alert(`下载失败：${String(e)}`);
    }
  }, [update]);

  const handleInstall = useCallback(async () => {
    if (!downloadedPath) return;
    try {
      await installUpdate(downloadedPath);
    } catch (e) {
      alert(`启动安装器失败：${String(e)}`);
    }
  }, [downloadedPath]);

  const handleDismiss = useCallback(() => {
    setShowModal(false);
    setDismissed(true);
  }, []);

  if (!update || dismissed) return null;

  return (
    <>
      <button
        className="update-banner"
        type="button"
        onClick={() => setShowModal(true)}
      >
        <CsgoIcon className="update-banner-icon" alt="" />
        <span className="update-banner-text">
          发现新版本 <strong>{update.tag}</strong>，点击查看更新内容
        </span>
        <Icon path="m8.25 4.5 7.5 7.5-7.5 7.5" />
      </button>

      {showModal && (
        <div className="modal-layer">
          <div className="modal-backdrop" onClick={state === "idle" ? handleDismiss : undefined} />
          <div className="modal-panel update-modal">
            <div className="update-modal-header">
              <CsgoIcon className="update-modal-logo" alt="" />
              <div>
                <h3 className="modal-title">发现新版本</h3>
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  {update.tag} · 发布于 {formatDate(update.published_at)}
                </p>
              </div>
            </div>

            <div className="update-changelog">
              <p className="update-changelog-title">更新内容</p>
              <div className="update-changelog-body">
                {update.body.split("\n").map((line, i) => (
                  <p key={i} className={`update-line${line.startsWith("- ") ? " bullet" : ""}`}>
                    {line.startsWith("- ") ? line.slice(2) : line || " "}
                  </p>
                ))}
              </div>
            </div>

            {state === "idle" && (
              <div className="modal-actions">
                <button
                  className="button secondary"
                  type="button"
                  onClick={handleDismiss}
                >
                  稍后提醒
                </button>
                <button
                  className="button primary"
                  type="button"
                  onClick={handleDownload}
                >
                  <Icon path="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12M12 16.5V3" />
                  立即更新
                </button>
              </div>
            )}

            {state === "downloading" && (
              <div className="update-download">
                <p className="update-download-label">正在下载安装包…</p>
                <div className="update-progress-track">
                  <div
                    className="update-progress-bar"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="update-download-percent">{progress}%</p>
              </div>
            )}

            {state === "ready" && (
              <div className="modal-actions">
                <button
                  className="button primary"
                  type="button"
                  onClick={handleInstall}
                >
                  <Icon path="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                  重启并安装
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
