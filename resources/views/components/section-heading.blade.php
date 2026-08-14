@props([
    'eyebrow',
    'title',
    'href' => null,
    'link' => null,
    'accent' => 'pink',
    'linkClass' => '',
])

@php
    $accents = [
        'pink' => 'text-accent-pink',
        'orange' => 'text-accent-orange',
    ];
@endphp

<div {{ $attributes->class(['mb-7 flex items-end justify-between']) }}>
    <div>
        <p class="text-xs font-semibold uppercase tracking-[0.18em] {{ $accents[$accent] ?? $accents['pink'] }}">
            {{ $eyebrow }}
        </p>
        <h2 class="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {{ $title }}
        </h2>
    </div>

    @if ($href && $link)
        <a href="{{ $href }}"
            class="text-sm font-semibold text-secondary transition-colors hover:text-foreground {{ $linkClass }}">
            {{ $link }}
        </a>
    @endif
</div>
