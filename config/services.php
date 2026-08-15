<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'zitadel' => [
        'client_id' => env('ZITADEL_CLIENT_ID'),
        'client_secret' => env('ZITADEL_CLIENT_SECRET'),
        'redirect' => env('ZITADEL_REDIRECT_URI'),
        'base_url' => env('ZITADEL_BASE_URL'),
        'organization_id' => env('ZITADEL_ORGANIZATION_ID'),                      // Optional
        'project_id' => env('ZITADEL_PROJECT_ID'),                                // Optional
        'post_logout_redirect_uri' => env('ZITADEL_POST_LOGOUT_REDIRECT_URI'),     // Optional
    ],

];
