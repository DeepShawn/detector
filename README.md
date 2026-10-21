# 一分钟谜案

> 你能 60 秒看出谁在说谎吗？

竖屏、离线、单局 60 秒的轻量解谜游戏原型。每关一张场景图 / 聊天记录 / 监控时间线，找出其中的矛盾点。

当前是 **可玩原型（v0.1）**，用于验证“找矛盾”是否有趣：纯 HTML/CSS/JS，无构建步骤，PWA 可安装、可离线，之后可用 Capacitor 打包为安卓 App。

## 快速开始

```bash
npm start          # 本地服务 http://localhost:8080 ，手机同一局域网也可访问
npm test           # 关卡校验 + 判定单元测试
npm install && npm run e2e   # 端到端冒烟测试（Playwright，手机尺寸通关全部关卡）
```

> 浏览器开发者工具切到手机模式体验最佳。注意：Service Worker 采用缓存优先，修改资源后请在开发者工具中勾选 “Update on reload” 或提升 `sw.js` 中的 `CACHE` 版本号。

## 关卡

| # | 关卡 | 类型 | 玩法 |
| --- | --- | --- | --- |
| 01 | 雨夜访客 | 物品不合理 | 在场景图上标记 2 处破绽 |
| 02 | 开了一周末的空调 | 聊天记录找谎 | 点选前后矛盾的 2 条消息 |
| 03 | 便利店的 500 元 | 时间线矛盾 | 对照监控，找出说谎的证词 |
| 04 | 停电的十分钟 | 排序推理 | 拖拽还原事件经过 |

## 目录

```
index.html            入口
css/style.css         样式（移动优先，竖屏）
js/main.js            页面路由：首页 / 案件列表 / 调查 / 档案 / 设置
js/play.js            单局流程：案情 → 计时 → 判定 → 结算
js/judge.js           判定与星级（纯函数）
js/modes/             三种交互：scene 场景标记、pick 点选、order 排序
js/share.js           成绩卡生成与分享
js/storage.js         本地存档
js/feedback.js        音效与震动
levels/               关卡 JSON 与图片
tools/validate-levels.mjs  关卡校验
docs/DESIGN.md        设计文档：关卡 JSON 结构、第一关设计、页面流程图
```

## 新增一关

1. 在 `levels/` 新建 `case-xxx.json`（结构见 [docs/DESIGN.md](docs/DESIGN.md#1-关卡数据-json-结构)），场景图放 `levels/assets/`
2. 把 id 加到 `levels/index.json`，并把新文件加入 `sw.js` 的离线缓存列表
3. 运行 `npm run validate`
