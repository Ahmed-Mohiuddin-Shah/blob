@props([
    'name',
    'symbol',
    'color' => 'bg-accent-pink',
])

<a href="/stickers?category={{ urlencode($name) }}"
    {{ $attributes->class([
        'group relative overflow-hidden rounded-3xl border border-divider bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:border-accent-pink/30 hover:shadow-xl hover:shadow-accent-pink/5',
    ]) }}>
    <div
        class="mb-8 flex h-11 w-11 items-center justify-center rounded-[45%_55%_60%_40%/55%_45%_55%_45%] {{ $color }} text-lg font-semibold text-white transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110">
        {{ $symbol }}
    </div>

    <h3 class="font-semibold">{{ $name }}</h3>
    <p class="mt-1 text-xs text-secondary">Browse stickers</p>
</a>
