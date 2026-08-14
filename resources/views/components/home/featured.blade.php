@props([
    'stickers' => [],
])

<section class="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
    <x-section-heading
        class="mb-8"
        eyebrow="Fresh from the blob"
        title="Featured stickers"
        href="/stickers"
        link="Browse all →"
        accent="orange"
    />

    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        @foreach ($stickers as $index => $sticker)
            <x-sticker-card
                :title="$sticker['title']"
                :author="$sticker['author']"
                :type="$sticker['type']"
                :color="$sticker['color']"
                :href="'/stickers/' . ($index + 1)"
            />
        @endforeach
    </div>
</section>
