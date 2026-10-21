# 火眼金睛

**A社临时审核员的赛博养家模拟器** · 虚构黑色喜剧 · 叙事解谜 / 卡牌推理。

- 完整策划案：[docs/GDD.md](docs/GDD.md)（GDD v1.1）
- 三种模式，每种 40 关，共 **120 关**，全部离线、无内购、无广告。

> 本作不采集任何真实系统信息；所有设备档案与卡牌均为虚构。所有“诱饵 / 回执卡 / 话术卡”都是抽象叙事卡牌，不映射任何现实操作。现实中订阅退款请遵守平台规则与消费者权益法。

## 三种模式

| 模式 | 角色 | 玩法 | 关数 |
| --- | --- | --- | --- |
| A · 抓人 | 审核员 Opus斯 | 选诱饵外壳诱出回执卡，拼一条**带反证**的证据链再裁决；只堆单一线索必误判 | 40 |
| B · 装人 | 伪装者 Fable | 面对诱饵里的信息模块，逐项跳过/填/遮挡——填得越完美越成帮凶，**识破举报才是正解** | 40 |
| C · 拦退款 | 退款客服 Opus斯 | 用话术卡拖延/搪塞阻止退款，拦得越狠监管越近；真退款或举报规则换真相分 | 40 |

每关都给**系统评分**（刻板印象命中 / 拦得狠就高）与**真相评分**（判错 / 拦了该退的款就低）双结算，外加三位家人的评语。举报规则/识破诱饵会解锁隐藏线并累积“解释权指数”。

## 运行网页版

```bash
npm start                    # http://localhost:8080
npm test                     # 数据校验 + 三模式引擎单元测试
npm install && npm run e2e   # 端到端测试（Playwright：三模式 × 手机/桌面两套布局）
```

网页在线版通过 GitHub Pages 部署：**https://deepshawn.github.io/detector/**

- 手机布局：底部分步标签，一次显示一个面板。
- 桌面布局（≥700px）：隐藏标签，工单/话术/风险多栏并列。

## 安卓 APK（arm64-v8a）

原生 Kotlin + 原生 View，关卡数据与网页共用同一份 JSON。
APK 由 GitHub Actions 构建并发布到 Releases 的滚动预发布
**`android-latest`**：https://github.com/DeepShawn/detector/releases/tag/android-latest

签名：仓库配置了 Secrets（`KEYSTORE_BASE64`、`KEYSTORE_PASSWORD`、`KEY_ALIAS`、`KEY_PASSWORD`）时用正式签名；
未配置则用临时签名，更新时若提示签名不一致，先卸载旧版再装。

本地构建（需 Android SDK）：

```bash
cd android
cp ../data/*.json app/src/main/assets/data/   # 同步关卡数据
./gradlew :app:assembleRelease
```

## 目录

```
docs/GDD.md               完整策划案
data/                     三模式的卡牌/平台/规则与 120 关（单文件 mode-a/b/c.json）
tools/gen-mode-*.mjs      关卡生成器；validate-data.mjs 校验引用一致性
js/engine*.js             三模式纯函数引擎（引擎无关，可移植）
js/view-*.js, main.js     网页界面（手机/桌面两套布局）
android/                  原生安卓工程（Kotlin），引擎移植在 app/.../Engine*.kt
tests/                    引擎单元测试 + 端到端冒烟测试
.github/workflows/        Pages 部署 + APK 构建发布
```

## 新增内容

- 加一张退款工单：改 `tools/gen-mode-c.mjs` 的 `USERS` 表后 `node tools/gen-mode-c.mjs`。
- 加一关 A/B：改对应生成器后重跑；再 `npm run validate`。
- 安卓端无需改代码，CI 构建时会自动把 `data/*.json` 同步进 assets。
