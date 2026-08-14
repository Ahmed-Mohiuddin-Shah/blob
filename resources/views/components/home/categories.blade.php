@props([
    'categories' => [],
])

<section class="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
    <x-section-heading
        eyebrow="Explore"
        title="Browse the blob"
        href="/categories"
        link="All categories →"
        link-class="hidden sm:block"
    />

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        @foreach ($categories as $category)
            <x-category-card
                :name="$category['name']"
                :symbol="$category['symbol']"
                :color="$category['class']"
            />
        @endforeach
    </div>
</section>
