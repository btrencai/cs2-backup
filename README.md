<div align="center">
  <img src="./public/csgo-icon.svg" width="92" height="92" alt="CS2 Config Backup" />

  <h1>CS2 Config Backup</h1>

  <p>面向 Counter-Strike 2 的本地配置备份、恢复、编辑与导出工具。</p>

  <p>
    <img alt="version" src="https://img.shields.io/badge/version-v2.1.1-f59e0b?style=for-the-badge" />
    <img alt="status" src="https://img.shields.io/badge/status-active-22c55e?style=for-the-badge" />
    <img alt="platform" src="https://img.shields.io/badge/platform-Windows-38bdf8?style=for-the-badge" />
    <img alt="stack" src="https://img.shields.io/badge/Tauri_2-React_19-111827?style=for-the-badge" />
  </p>
</div>

## 它解决什么问题

CS2 的配置分散在全局游戏目录和 Steam `userdata` 目录里，多账号环境下尤其容易混淆。这个工具把检测、备份、恢复和导出集中在一个桌面应用里，让配置管理更直观、更稳定。

## 功能

| 能力 | 说明 |
| --- | --- |
| 自动检测配置目录 | 从 Steam 注册表、库目录和本地登录记录定位 CS2 配置路径 |
| 全局与用户目录分组 | 备份管理页按"全局目录"和"用户目录"两类组织 |
| Steam 用户头像 | userdata 账号列表和备份条目会显示本地缓存头像 |
| 首次启动引导 | 首次进入软件会要求设置备份保存位置，也可使用默认目录 |
| 快速恢复 | 备份记录来源路径，可直接恢复到对应 cfg 目录 |
| CFG 编辑器 | 查看和编辑备份里的 cfg 文件，支持 Ctrl+S 保存 |
| ZIP 导出 | 任意备份可导出为 zip 压缩包 |

## 界面结构

```
CS2 Config Backup
├─ 仪表盘
│  ├─ 全局 cfg 备份入口
│  ├─ userdata 用户选择与备份入口
│  └─ 最近备份概览（含总大小统计）
├─ 备份管理
│  ├─ 全局目录备份 / 用户目录备份
│  ├─ 恢复 / 编辑 / 导出 ZIP
│  └─ 重命名 / 删除 / 打开目录
└─ 设置
   ├─ 备份保存位置
   └─ 自动检测结果
```

## 技术架构

| 层级 | 技术 |
| --- | --- |
| 桌面容器 | Tauri 2 |
| 后端 | Rust（Windows 注册表读取、文件系统操作、ZIP 打包、配置目标缓存） |
| 前端 | React 19 + TypeScript |
| 构建 | Vite 7 + Cargo |
| UI | CSS 变量主题、HeroUI Toast |
| 路由 | React Router |
| 安装包 | NSIS `.exe`、WiX 中文 `.msi` |

## 快速开始

| 工具 | 版本 |
| --- | --- |
| Node.js | 22+ |
| Rust | stable |
| Windows | 10 / 11（内置 WebView2） |

```bash
# 安装依赖
npm install

# 启动开发模式
npm run tauri dev

# 构建 Windows 安装包
npm run tauri build
```

构建产物位于：

```
src-tauri/target/release/bundle/nsis/CS2 Config Backup_2.1.1_x64-setup.exe
src-tauri/target/release/bundle/msi/CS2 Config Backup_2.1.1_x64_zh-CN.msi
```

## 目录结构

```
.
├─ src/                          # React 前端
│  ├─ components/                 # 通用组件（Icons、BackupCard、CfgEditor 等）
│  ├─ pages/                      # 页面（Dashboard、BackupList、Settings）
│  └─ lib/                        # Tauri 命令封装、工具函数
├─ src-tauri/                     # Tauri / Rust 后端
│  ├─ src/
│  │  ├─ lib.rs                   # Tauri 命令、备份/恢复/导出逻辑、配置目标缓存
│  │  └─ path_detect.rs           # Steam 路径检测、VDF 解析、用户信息读取
│  ├─ icons/                      # 应用图标资源
│  ├─ wix/                        # 中文 MSI 本地化配置
│  └─ capabilities/               # Tauri 权限配置
├─ public/                        # 前端静态资源
├─ CHANGELOG.md                   # 更新日志
└─ .github/workflows/             # CI + Release 工作流
```

## CI / CD

| 工作流 | 触发条件 | 内容 |
| --- | --- | --- |
| `ci.yml` | `main` push / PR | `npm ci` → `npm run build` → `cargo check` |
| `release.yml` | 推送 `v*` 标签 / 手动触发 | 构建 NSIS + WiX → 创建 GitHub Release → 上传安装包 |

## 质量检查

```bash
# 前端构建（含 TypeScript 类型检查）
npm run build

# Rust 编译检查
cd src-tauri && cargo check

# Rust 格式化
cd src-tauri && cargo fmt
```

## 版本记录

| 版本 | 重点 |
| --- | --- |
| `v2.1.1` | 修复编辑器"保存并关闭"bug、提取共享组件、仪表盘总大小统计、list_backups 性能优化 |
| `v2.1.0` | 首次启动引导、中文 MSI、备份头像展示 |
| `v2.0.0` | 全局/用户目录分类、备份管理重构、ZIP 导出 |

详见 [CHANGELOG.md](./CHANGELOG.md)。

## 路线图

- [ ] 备份差异对比
- [ ] 自动备份计划
- [ ] 恢复前自动创建安全快照
- [ ] 多语言界面配置

## 版权

Copyright (c) 2026 CS2 Config Backup. All rights reserved.

本项目当前未声明开源许可证。未经授权，不得分发、转售或用于商业集成。
