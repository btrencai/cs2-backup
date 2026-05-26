# CS2 Config Backup

CS2 Config Backup 是一个基于 Tauri + React + TypeScript 的桌面工具，用于备份和恢复 CS2 配置文件。

## 功能

- 自动检测 CS2 全局 cfg 目录和 Steam userdata 用户目录。
- 按全局目录、用户目录分类管理备份。
- 支持备份恢复、重命名、删除、CFG 编辑和 ZIP 导出。
- 首次启动引导设置备份保存位置。
- Windows 安装包支持 EXE 和中文 MSI。

## 开发

```bash
npm install
npm run tauri dev
```

## 构建

```bash
npm run tauri build
```

构建产物位于：

- `src-tauri/target/release/bundle/nsis`
- `src-tauri/target/release/bundle/msi`

## 版权

Copyright (c) 2026 CS2 Config Backup. All rights reserved.
