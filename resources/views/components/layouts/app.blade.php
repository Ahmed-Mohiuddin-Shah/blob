@props([
    'title' => null,
])

<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title ?? config('app.name', 'Home') }}</title>

    <x-theme-script />
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>

<body class="bg-background font-sans text-foreground">
    <x-blob-background />

    {{-- overflow-hidden must live on a normal element, not <body>: body's overflow is
         propagated to the viewport, so off-canvas decorations would widen the page instead. --}}
    <div class="min-h-screen overflow-hidden">
        <x-header />

        <main>
            {{ $slot }}
        </main>

        <x-footer />
    </div>
</body>

</html>
