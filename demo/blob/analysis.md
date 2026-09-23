# BLOB Design System — Analysis

## 输入检测

- 输入类型：App 截图（BLOB 落地页）+ 设计语言参考（Zune light / Zune dark）
- 分析模式：逐控件区域（非整页）
- 平台：Web
- 控件区域数：18（纳入提取）
- 排除区域：页面纯黑背景、装饰性 blob glow、插画内容、icon 图形本身、logo 图形内容
- 质量限制：主参考为 JPEG 1024×904；Zune 图仅作排版/字重/overflow 语言参考
- 设计目标（用户）：**bloby** 圆角/有机形 + **Zune** 字重溢出标题 + **Lucide** 线图标

## 控件区域清单

| # | 类别 | 变体 | 位置描述 | 是否纳入提取 |
|---|------|------|----------|--------------|
| 1 | Button | primary (gradient pill) | Hero Search CTA | ✅ |
| 2 | Button | ghost / text | Nav links, Log out, “All categories →” | ✅ |
| 3 | Input | search capsule | Hero 搜索框 | ✅ |
| 4 | Chip / Tag | default | Popular tags（cat, angry…） | ✅ |
| 5 | Badge | media type pill | Sticker 卡角 GIF/IMAGE/VIDEO | ✅ |
| 6 | Badge | eyebrow pill | “A PUBLIC STICKER LIBRARY” | ✅ |
| 7 | Card | category | Explore 分类卡 | ✅ |
| 8 | Card | sticker | Featured stickers | ✅ |
| 9 | Avatar | sm circular | Header 用户头像容器 | ✅（仅容器） |
| 10 | SegmentedControl | theme toggle | Header sun/monitor/moon | ✅ |
| 11 | NavBar | default | 顶栏 Logo + links + actions | ✅ |
| 12 | Typography | section eyebrow + title | EXPLORE / Browse the blob | ✅ |
| 13 | Typography | Zune overflow header | Zune oversized nav; baseline on margin, visible overflow | ✅（语言） |
| 14 | ListItem | text list | Zune artists / songs | ✅（语言） |
| 15 | Progress | thin bar | Zune playback progress | ✅（语言） |
| 16 | Icon container | circular gradient | Category icon wells | ✅（容器；icon→Lucide） |
| 17 | 背景 glow | 装饰 | 右上 blob glow | ❌ 排除 |
| 18 | Logo mark | brand | 叠圆 B | ❌ 排除图形；保留半径语言 |

## 取色摘要（控件内采样）

| 用途 | Hex | 采样点（约） |
|------|-----|--------------|
| Background | `#000000` | 画布大量区域 |
| Surface | `#1A1A1A` | 分类卡 / 搜索胶囊 `153,524` |
| Accent pink | `#F10EA0` | 分类 icon / 渐变起点 `96,528` |
| Accent orange | `#E95214` | 渐变终点 / Search btn `232,528` |
| Metro pink | `#E8217E` | Logo 区 `80,8` |
| Foreground | `#FFFFFF` | Hero 标题字 |
| Secondary text | `rgba(255,255,255,0.70)` | 副文案 |
| Inactive | `rgba(255,255,255,0.38)` | 未选 nav |
| Divider | `rgba(255,255,255,0.20)` | 卡边 |
| Badge surface | `#383838` | GIF badge `225,614` |

Light theme（Zune light + 现有 globals）：bg `#FFFFFF`，surface `#F5F5F5`，fg `#000000`，secondary `#808080`，inactive `#B0B0B0`。

## 形状语言（Bloby）

- Pill CTA / chips / search：`border-radius: 9999px`
- Cards：`24px`–`32px`（`rounded-3xl` / `2rem`）
- 大面板：`3rem`
- 有机 blob：`border-radius: 42% 58% 61% 39% / 48% 41% 59% 52%`（及变体）
- Icon well：正圆 + 粉橙渐变底

## Zune 标题 Overflow

- 超大、偏细字重的小写标题；**baseline 贴内容区上沿/分隔线**
- Ascender / descender 可越过 margin，但必须完整可见（`overflow: visible`）
- **禁止**顶裁切或底裁切（不要 `overflow: hidden` + 固定矮盒子）
- Section：彩色全大写 eyebrow（紧贴）+ 紧字距 h2
- Nav：活跃实色 / 非活跃 inactive 灰

## Lucide

- 全站线图标统一 Lucide（`stroke-width: 1.5`–`2`）
- Demo 用 CDN；App 用 `lucide-react`
- Icon Button / Avatar / ListItem 的图标区：灰色占位或 Lucide，不还原参考图具体图形

## 推断假设

- Secondary / Ghost / Icon button：由 primary pill + 描边/透明推导
- Textarea / Select：search capsule 表面色 + 略小圆角
- Switch / Checkbox / Radio / Alert / Modal / Sheet / Toast / Tooltip / Slider：主色 + surface 体系推断
- TabBar：底部播放条语言（Zune）+ 深色 surface
- Light/Dark 双主题 token（与现有 `html.dark` 一致）

## 走查后可接受差异（不改代码）

- 推断控件无截图像素对照
- Avatar 内容用 blobatar/占位，不还原参考头像
- Lucide 替代参考图内自定义符号（用户要求）
- 整页布局与背景 glow 不在本技能范围内
