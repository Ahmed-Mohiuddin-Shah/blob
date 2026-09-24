# BLOB — 控件列表

> Platform: Web · Source: reference.png (+ Zune light/dark) · Extracted: 2026-09-23

## 汇总

| 指标 | 数量 |
|------|------|
| 控件类别总数 | 24 |
| 从截图提取 | 12 |
| 推断补全 | 22 |
| 变体总数 | 34 |

## 完整控件表

| # | 类别 | 变体 | 来源 | CSS 类名 | 状态覆盖 | 依赖 token |
|---|------|------|------|----------|----------|------------|
| 1 | Button | primary | screenshot | `.ds-button--primary` | default, hover, active, disabled | `--button-primary-*`, `--gradient-accent` |
| 2 | Button | busy / pending | inferred | `.ds-button--busy` / `.btn-busy` | pending | `--gradient-accent`, `blob-busy` |
| 2 | Button | secondary | inferred | `.ds-button--secondary` | default, hover, disabled | `--color-accent-pink` |
| 3 | Button | ghost | inferred | `.ds-button--ghost` | default, hover, disabled | `--button-ghost-text` |
| 4 | Button | icon | inferred | `.ds-button--icon` | default, hover, disabled | `--button-primary-*`, Lucide |
| 5 | Input | search | screenshot | `.ds-search` | default, focus | `--input-*`, `--radius-full` |
| 6 | Input | text | inferred | `.ds-input` | default, focus, disabled | `--input-*` |
| 7 | Textarea | default | inferred | `.ds-textarea` | default, focus, disabled | `--input-*`, `--radius-xl` |
| 8 | Select | default | inferred | `.ds-select` | default, focus, disabled | `--input-*` |
| 9 | Card | category | screenshot | `.ds-card` | default, hover | `--card-*`, Lucide well |
| 10 | Card | sticker | screenshot | `.ds-card--sticker` | default, hover | `--radius-2xl`, `--radius-blob` |
| 11 | Card | elevated | inferred | `.ds-card--elevated` | default | `--shadow-lg` |
| 12 | ListItem | default | screenshot | `.ds-list-item` | default, active | `--color-border` |
| 13 | ListItem | with-icon | inferred | `.ds-list-item` + placeholder | default | `--color-border` |
| 14 | ListItem | with-action | inferred | `.ds-list-item` + chevron | default | Lucide |
| 15 | Tab | default | screenshot | `.ds-tab` | default, selected | Zune uppercase |
| 16 | SegmentedControl | theme | screenshot | `.ds-segmented` | default, selected | Lucide sun/monitor/moon |
| 17 | NavBar | default | screenshot | `.ds-navbar` | default | `--radius-blob` mark |
| 18 | TabBar | default | inferred | `.ds-tabbar` | default, selected | Lucide |
| 19 | Badge | media | screenshot | `.ds-badge` | default | `--badge-bg` |
| 20 | Badge | eyebrow / dot | screenshot | `.ds-badge--eyebrow`, `--dot` | default | `--color-accent-pink` |
| 21 | Chip | default / selected | screenshot | `.ds-chip` | default, selected | `--chip-*` |
| 22 | Chip | removable | inferred | `.ds-chip` + x | default | Lucide x |
| 23 | Switch | default | inferred | `.ds-switch` | off, on, disabled | `--gradient-accent` |
| 24 | Checkbox | default | inferred | `.ds-checkbox` | unchecked, checked, disabled | accent-color |
| 25 | Radio | default | inferred | `.ds-radio` | unchecked, checked, disabled | accent-color |
| 26 | Avatar | sm / md / lg | screenshot | `.ds-avatar--*` | default | blobatar in app |
| 27 | Divider | horizontal | inferred | `.ds-divider` | default | `--color-border` |
| 28 | Alert | info/success/warning/error | inferred | `.ds-alert--*` | default | semantic colors |
| 29 | Toast | default | inferred | `.ds-toast` | default | pill surface |
| 30 | Modal | default | inferred | `.ds-modal` | default | `--radius-2xl` |
| 31 | Sheet | default | inferred | `.ds-sheet` | default | top radii only |
| 32 | Progress | bar | screenshot | `.ds-progress` | default | thin Zune track |
| 33 | Progress | circular | inferred | `.ds-progress--circle` | indeterminate | `--color-accent-pink` |
| 34 | Slider | default | inferred | `.ds-slider` | default, disabled | accent-color |
| 35 | Tooltip | default | inferred | `.ds-tooltip` | default | `--color-surface` |

## 截图提取详情

| 类别 | 变体 | 截图位置 | 提取的关键属性 |
|------|------|----------|----------------|
| Button | primary | Hero Search | gradient pink→orange, pill, white text, pink shadow |
| Input | search | Hero | surface `#1A1A1A`, full pill, embedded CTA |
| Chip | tags | under search | surface pill, border divider, secondary text |
| Badge | media | sticker cards | `#383838`, uppercase xs, pill |
| Badge | eyebrow | hero top | surface pill + pink dot |
| Card | category | Explore row | surface, radius ~24px, circular gradient icon well |
| Card | sticker | Featured | radius ~32px, blob mark, corner badge |
| Segmented | theme | header right | full pill track, selected solid bg |
| NavBar | default | top | brand mark + muted links + ghost logout |
| Avatar | sm | header | circular gradient container |
| Tab | caps | Zune light | uppercase thin, selected solid |
| ListItem | text | Zune light | plain rows, subtle active |
| Progress | bar | Zune player | thin 2–3px track |

## 推断补全说明

| 类别 | 变体 | 推断依据 |
|------|------|----------|
| Button | secondary/ghost/icon | primary 描边 / 透明 / 圆形缩小 |
| Textarea / Select | — | input surface + 略小圆角 |
| TabBar | — | Lucide + accent selected |
| Switch / Checkbox / Radio | — | accent-pink / gradient track |
| Alert / Toast / Modal / Sheet | — | surface + semantic tints |
| Slider / Tooltip | — | accent + surface chip |

## 设计强制项

- **Bloby**: pills、card 大圆角、`--radius-blob` 品牌形
- **Zune overflow**: 超大细字重标题 baseline 贴 margin；溢出可见、禁止裁切；eyebrow 紧贴 title
- **Lucide**: 全站线图标，`stroke-width ≈ 1.75`
