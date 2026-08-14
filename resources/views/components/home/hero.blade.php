@props([
    'popular' => [],
])

<section class="relative mx-auto max-w-7xl px-5 pb-20 pt-12 sm:px-8 sm:pb-28 sm:pt-20 lg:pt-24">
    <div
        class="pointer-events-none absolute right-[-10rem] top-[-4rem] hidden h-[30rem] w-[30rem] rotate-12 rounded-[46%_54%_38%_62%/58%_39%_61%_42%] bg-accent-gradient opacity-[0.08] blur-sm xl:block">
    </div>

    <div class="relative mx-auto max-w-4xl text-center">
        <div
            class="mb-7 inline-flex items-center gap-2 rounded-full border border-divider bg-surface/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-secondary backdrop-blur">
            <span class="h-2 w-2 rounded-full bg-accent-pink"></span>
            A public sticker library
        </div>

        <h1 class="text-balance text-5xl font-semibold leading-[0.95] tracking-[-0.04em] sm:text-6xl md:text-7xl xl:text-8xl">
            Find something
            <span class="bg-accent-gradient bg-clip-text text-transparent">sticky.</span>
        </h1>

        <p class="mx-auto mt-7 max-w-2xl text-base leading-7 text-secondary sm:text-lg">
            A growing library of stickers, reactions, weird little things, and other perfectly reasonable uses of the
            internet.
        </p>

        <x-search-form class="mt-10" :popular="$popular" />
    </div>
</section>
