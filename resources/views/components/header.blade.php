<header class="mx-auto w-full max-w-7xl px-5 sm:px-8">
    <nav class="flex h-20 items-center justify-between">
        <a href="/" class="group flex items-center gap-3" aria-label="BLOB home">
            <x-logo size="sm" :dot="true"
                class="shadow-lg shadow-accent-pink/20 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105" />
            <span class="text-xl font-semibold tracking-tight">BLOB</span>
        </a>

        <div class="hidden items-center gap-8 text-sm font-semibold sm:flex">
            <a href="/stickers" class="text-secondary transition-colors hover:text-foreground">Stickers</a>
            <a href="/prints" class="text-secondary transition-colors hover:text-foreground">Prints</a>
            <a href="/collections" class="text-secondary transition-colors hover:text-foreground">Collections</a>
        </div>

        <div class="flex items-center gap-3">
            <x-theme-toggle />

            <a href="https://devzitadel.mamajees.com/oauth/v2/authorize?client_id=386074152420769795&redirect_uri=https://devstickers.mamajees.com/auth/callback&response_type=code&scope=openid profile email"
                class="hidden rounded-full px-4 py-2 text-sm font-semibold text-secondary transition-colors hover:text-foreground sm:block">
                Log in
            </a>
            @if ($isAuthenticated)
                <a href="/logout"
                    class="hidden rounded-full px-4 py-2 text-sm font-semibold text-secondary transition-colors hover:text-foreground sm:block">
                    Log out
                </a>
            @endif
            <a href="/register"
                class="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-transform duration-200 hover:scale-105">
                Join BLOB
            </a>
        </div>
    </nav>
</header>
