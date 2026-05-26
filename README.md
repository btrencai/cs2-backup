<div align="center">
  <img src="./public/csgo-icon.svg" width="92" height="92" alt="CS2 Config Backup" />

  <h1>CS2 Config Backup</h1>

  <p>
    面向 Counter-Strike 2 的本地配置备份、恢复、编辑与导出工具。
  </p>

  <p>
    <img alt="version" src="https://img.shields.io/badge/version-v2.1.0-f59e0b?style=for-the-badge" />
    <img alt="status" src="https://img.shields.io/badge/status-active-22c55e?style=for-the-badge" />
    <img alt="platform" src="https://img.shields.io/badge/platform-Windows-38bdf8?style=for-the-badge" />
    <img alt="stack" src="https://img.shields.io/badge/Tauri_2-React_19-111827?style=for-the-badge" />
    <img alt="license" src="https://img.shields.io/badge/license-Proprietary-64748b?style=for-the-badge" />
  </p>
</div>

## 项目状态

| 项目 | 状态 |
| --- | --- |
| 当前版本 | `v2.1.0` |
| 主分支 | `main` |
| 目标平台 | Windows x64 |
| 安装包 | NSIS `.exe`，中文 WiX `.msi` |
| 前端构建 | Vite + React + TypeScript |
| 桌面运行时 | Tauri 2 + Rust |
| 备份范围 | CS2 全局 cfg，Steam userdata cfg |
| 发布状态 | 本地可构建，可通过 GitHub Actions 做 CI |

## 它解决什么问题

CS2 的配置分散在全局游戏目录和 Steam `userdata` 目录里，多账号环境下尤其容易混淆。这个工具把检测、备份、恢复和导出集中在一个桌面应用里，目标是让配置管理更直观、更稳、更适合长期维护。

## 功能亮点

| 能力 | 说明 |
| --- | --- |
| 自动检测配置目录 | 从 Steam 注册表、Steam 库目录和本地登录记录定位 CS2 配置路径 |
| 全局与用户目录分组 | 备份管理页按“全局目录”和“用户目录”两类组织 |
| 用户选择带头像 | Steam userdata 账号列表和备份条目会显示本地缓存头像 |
| 首次启动引导 | 首次进入软件会要求设置备份保存位置，也可使用默认目录 |
| 长条式备份管理 | 最近三条优先展示，其余内容可展开 |
| 快速恢复 | 备份会记录来源路径，可直接恢复到对应 cfg 目录 |
| CFG 编辑器 | 可以直接查看和编辑备份里的 cfg 文件 |
| ZIP 导出 | 任意备份可导出为 zip 压缩包 |
| 专业打包 | 生成 Windows 安装 EXE 和中文 MSI，应用图标统一使用 CS2 图标 |

## 界面结构

```text
CS2 Config Backup
├─ 仪表盘
│  ├─ 全局 cfg 备份入口
│  ├─ userdata 用户选择与备份入口
│  └─ 最近备份概览
├─ 备份管理
│  ├─ 全局目录备份
│  ├─ 用户目录备份
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
| 后端能力 | Rust，Windows 注册表读取，文件系统操作，ZIP 打包 |
| 前端框架 | React 19 |
| 语言 | TypeScript，Rust |
| 构建工具 | Vite，Cargo |
| UI 基础 | CSS 变量主题，HeroUI Toast |
| 路由 | React Router |
| 安装包 | NSIS，WiX MSI |

## 目录结构

```text
.
├─ src/                         # React 前端
│  ├─ components/                # 通用组件
│  ├─ pages/                     # 页面
│  └─ lib/                       # Tauri 命令封装、主题工具
├─ src-tauri/                    # Tauri / Rust 后端
│  ├─ src/                       # Rust 命令与路径检测
│  ├─ icons/                     # 应用图标资源
│  ├─ wix/                       # 中文 MSI 本地化配置
│  └─ capabilities/              # Tauri 权限配置
├─ public/                       # 前端静态资源
├─ output/                       # 本地打包产物，已被 Git 忽略
└─ .github/workflows/ci.yml      # GitHub Actions CI
```

## 开发环境

建议环境：

| 工具 | 版本建议 |
| --- | --- |
| Node.js | 22+ |
| Rust | stable |
| Windows | 10/11 |
| WebView2 Runtime | Windows 现代系统通常已内置 |

安装依赖：

```bash
npm install
```

启动开发模式：

```bash
npm run tauri dev
```

## 质量检查

前端构建：

```bash
npm run build
```

Rust 检查：

```bash
cd src-tauri
cargo check
```

格式化 Rust：

```bash
cd src-tauri
cargo fmt
```

## 打包发布

生成 Windows 安装包：

```bash
npm run tauri build
```

构建完成后，产物位于：

```text
src-tauri/target/release/bundle/nsis/
src-tauri/target/release/bundle/msi/
```

当前发布产物命名示例：

```text
CS2 Config Backup_2.1.0_x64-setup.exe
CS2 Config Backup_2.1.0_x64_zh-CN.msi
```

## GitHub 工作流

仓库内置 GitHub Actions：

```text
.github/workflows/ci.yml
```

CI 会在 `main` 分支 push 和 pull request 时执行：

- `npm ci`
- `npm run build`
- `cargo check`

## 版本记录

| 版本 | 重点 |
| --- | --- |
| `v2.1.0` | 首次启动备份目录引导、中文 MSI、版权信息、备份头像展示 |
| `v2.0.0` | 全局目录与用户目录分类、备份管理重构、ZIP 导出 |

## 路线图

- [ ] GitHub Release 自动上传 `.exe` 和 `.msi`
- [ ] 备份差异对比
- [ ] 自动备份计划
- [ ] 恢复前自动创建安全快照
- [ ] 多语言界面配置

## 版权

Copyright (c) 2026 CS2 Config Backup. All rights reserved.

本项目当前未声明开源许可证。未经授权，不得分发、转售或用于商业集成。
