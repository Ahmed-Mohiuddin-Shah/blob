<?php

use Illuminate\Support\Facades\Route;
use Laravel\Socialite\Socialite;

Route::get('/auth/redirect', function () {
    return Socialite::driver('zitadel')->redirect();
});

Route::get('/auth/callback', function () {
    // just dump the stuff received from the callback
    // dd(Socialite::driver('zitadel'));
});

Route::get('/', function () {
    return view('home.index', [
        'popular' => ['cat', 'angry', 'happy', 'bruh'],
        'categories' => [
            ['name' => 'Reactions', 'symbol' => '!', 'class' => 'bg-accent-pink'],
            ['name' => 'Animals', 'symbol' => '◉', 'class' => 'bg-accent-orange'],
            ['name' => 'Memes', 'symbol' => '⌁', 'class' => 'bg-metro-pink'],
            ['name' => 'Gaming', 'symbol' => '✦', 'class' => 'bg-metro-orange'],
            ['name' => 'Anime', 'symbol' => '✧', 'class' => 'bg-accent-pink'],
            ['name' => 'Random', 'symbol' => '⊙', 'class' => 'bg-accent-orange'],
        ],
        'stickers' => [
            [
                'title' => 'Excited blob',
                'author' => 'Ahmed',
                'type' => 'GIF',
                'color' => 'from-accent-pink/30 to-accent-orange/20',
            ],
            [
                'title' => 'Absolutely not',
                'author' => 'Maya',
                'type' => 'IMAGE',
                'color' => 'from-accent-orange/30 to-metro-pink/20',
            ],
            [
                'title' => 'Confused',
                'author' => 'Sam',
                'type' => 'VIDEO',
                'color' => 'from-metro-pink/30 to-accent-pink/20',
            ],
            [
                'title' => 'Tiny victory',
                'author' => 'Ahmed',
                'type' => 'GIF',
                'color' => 'from-metro-orange/30 to-accent-orange/20',
            ],
            [
                'title' => 'Why',
                'author' => 'Maya',
                'type' => 'IMAGE',
                'color' => 'from-accent-pink/30 to-metro-pink/20',
            ],
            [
                'title' => 'Bonk',
                'author' => 'Sam',
                'type' => 'VIDEO',
                'color' => 'from-accent-orange/30 to-metro-orange/20',
            ],
        ],
    ]);
});
