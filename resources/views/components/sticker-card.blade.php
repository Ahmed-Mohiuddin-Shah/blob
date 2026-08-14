@props([
    'title',
    'author',
    'type',
    'color',
    'href',
])

<a href="{{ $href }}" {{ $attributes->class(['group']) }}>
    <div
        class="relative aspect-square overflow-hidden rounded-[2rem] border border-divider bg-gradient-to-br {{ $color }} transition-all duration-300 group-hover:-translate-y-1 group-hover:rotate-[1deg] group-hover:shadow-2xl group-hover:shadow-accent-pink/10">
        <div class="absolute inset-0 flex items-center justify-center">
            <div
                class="relative flex h-28 w-28 items-center justify-center rounded-[52%_48%_43%_57%/45%_53%_47%_55%] bg-accent-gradient shadow-xl transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6">
                <span class="text-3xl font-bold text-white">B</span>
                <div class="absolute -right-3 top-2 h-7 w-7 rounded-full bg-accent-orange"></div>
                <div class="absolute -bottom-2 left-3 h-4 w-4 rounded-full bg-accent-pink"></div>
            </div>
        </div>

        <div
            class="absolute right-3 top-3 rounded-full bg-background/80 px-2.5 py-1 text-[10px] font-bold tracking-wide text-foreground backdrop-blur">
            {{ $type }}
        </div>

        <div
            class="absolute inset-0 flex items-end bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span class="p-4 text-xs font-semibold text-white">View sticker →</span>
        </div>
    </div>

    <div class="px-1 pt-3">
        <h3 class="truncate text-sm font-semibold">{{ $title }}</h3>
        <p class="mt-0.5 truncate text-xs text-secondary">by {{ $author }}</p>
    </div>
</a>
