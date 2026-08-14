<x-layouts.app title="BLOB — Sticker Library">
    <x-home.hero :popular="$popular" />
    <x-home.categories :categories="$categories" />
    <x-home.featured :stickers="$stickers" />
    <x-home.prints-cta />
    <x-home.member-cta />
</x-layouts.app>
