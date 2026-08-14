@props([
    'size' => 'md',
    'dot' => false,
])

@php
    $sizes = [
        'xs' => 'h-7 w-7 text-[10px]',
        'sm' => 'h-10 w-10 text-lg',
        'md' => 'h-14 w-14 text-xl',
        'lg' => 'h-28 w-28 text-3xl',
    ];
@endphp

<div
    {{ $attributes->class([
        'relative flex items-center justify-center rounded-[42%_58%_61%_39%/48%_41%_59%_52%] bg-accent-gradient font-bold text-white',
        $sizes[$size] ?? $sizes['md'],
    ]) }}
>
    B

    @if ($dot)
        <span class="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-accent-orange ring-2 ring-background"></span>
    @endif
</div>
