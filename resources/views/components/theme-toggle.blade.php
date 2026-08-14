@props([
    'modes' => ['light', 'system', 'dark'],
])

<div
    {{ $attributes->class(['inline-flex rounded-full border border-divider bg-surface/70 p-1']) }}
    role="group"
    aria-label="Color theme"
    data-theme-toggle
>
    @foreach ($modes as $mode)
        <button
            type="button"
            data-theme-set="{{ $mode }}"
            class="rounded-full px-2.5 py-1.5 text-secondary transition-colors hover:text-foreground data-[active=true]:bg-background data-[active=true]:text-foreground data-[active=true]:shadow-sm"
            aria-label="{{ ucfirst($mode) }} theme"
            title="{{ ucfirst($mode) }}"
        >
            @if ($mode === 'light')
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="1.8" class="h-4 w-4" aria-hidden="true">
                    <circle cx="12" cy="12" r="4" />
                    <path stroke-linecap="round"
                        d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41" />
                </svg>
            @elseif ($mode === 'dark')
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="1.8" class="h-4 w-4" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round"
                        d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5Z" />
                </svg>
            @else
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="1.8" class="h-4 w-4" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="14" rx="2" />
                    <path stroke-linecap="round" d="M8 20h8" />
                </svg>
            @endif
        </button>
    @endforeach
</div>

<script>
(() => {
    const root = document.documentElement;
    const sync = () => {
        const pref = window.__theme?.get() || 'system';
        document.querySelectorAll('[data-theme-toggle] [data-theme-set]').forEach((btn) => {
            btn.dataset.active = String(btn.dataset.themeSet === pref);
            btn.setAttribute('aria-pressed', btn.dataset.active);
        });
    };

    document.querySelectorAll('[data-theme-toggle]').forEach((el) => {
        if (el.dataset.bound) return;
        el.dataset.bound = '1';
        el.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-theme-set]');
            if (!btn || !window.__theme) return;
            window.__theme.set(btn.dataset.themeSet);
            sync();
        });
    });

    root.addEventListener('themechange', sync);
    sync();
})();
</script>
