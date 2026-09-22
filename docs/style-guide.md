# BLOB UI style guide

Ported from the Laravel Blade/Tailwind UI. Keep this look — blobby, interactive, pink→orange accents. No shadcn unless explicitly requested.

## Fonts

- Family: **Segoe UI** (self-hosted TTFs in `public/fonts/`)
- Weights: 300, 350, 400, 600, 700 (+ italics)
- Body: `font-sans`; headlines `font-semibold` + tight tracking
- Eyebrows: `uppercase tracking-[0.18em|0.2em] text-xs font-semibold`

## Colors (CSS tokens)

Surfaces (`:root` / `html.dark`):

| Token | Light | Dark |
|-------|-------|------|
| `--background` | `#ffffff` | `#000000` |
| `--surface` | `#f5f5f5` | `#1a1a1a` |
| `--foreground` | `#000000` | `#ffffff` |
| `--secondary` | `#808080` | `white/70` |
| `--inactive` | `#b0b0b0` | `white/38` |
| `--divider` | `black/20` | `white/20` |

Fixed accents (both themes):

- `accent-pink` `#f10ea0`, `accent-orange` `#e95214`
- `metro-pink` `#e8117f`, `metro-pink-deep` `#e41b58`, `metro-orange` `#f26d21`
- `quickplay` `#11090f`, `quickplay-faded` `#3b373a`
- Signature: `bg-accent-gradient` = pink → orange diagonal

Theme: `html.dark` from localStorage / system (`light` | `dark` | `system`).

## Layout

- Shell: `max-w-7xl` + `px-5 sm:px-8`
- Header height: `h-20`
- Section padding: `pb-20`–`pb-28`
- Hero: centered `max-w-4xl`
- Profile: `max-w-lg` centered

## Radii

- Pills / CTAs: `rounded-full`
- Cards: `rounded-3xl` / `rounded-[2rem]`
- Big panels: `rounded-[3rem]`
- Blob motif: organic e.g. `rounded-[42%_58%_61%_39%/48%_41%_59%_52%]`

## Motion

Hover/focus only (no noise):

- CTAs: `hover:scale-105` / `hover:scale-[1.03]`, `duration-200`
- Logo: `group-hover:rotate-6 group-hover:scale-105`
- Cards: `-translate-y-1`, slight rotate, pink-tinted shadow
- Category icons: `rotate-12 scale-110`
- Search: focus-within pink border + pink shadow

## Components

| Pattern | Look |
|---------|------|
| Shell | `bg-background`, fixed blurred accent orbs |
| Header | Logo + wordmark, muted nav, theme toggle, inverted Login pill |
| Hero | Eyebrow pill, huge tight headline, gradient word, search |
| Search | Soft surface capsule + gradient Search btn + chip tags |
| Section heading | Colored uppercase eyebrow + tight h2 + “→” link |
| Category card | Surface tile, blob icon, lift on hover |
| Sticker card | Soft gradient tile, organic blob mark, type chip, hover overlay |
| Prints CTA | Dark `quickplay` panel, floating gradient blob, white pill |
| Member CTA | Large surface rounded panel, logo, CTA |
| Profile | Centered **blobatar** (never Zitadel picture), name/@, divider dl |
| Logo | Gradient organic square with “B” (+ optional orange dot) |

## Avatars

Always [blobatar](https://blobatar.dev/) from `username` (`animate="hover"`). Never render Zitadel `picture` / profile image URLs.
