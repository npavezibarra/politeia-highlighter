<?php
if ( ! defined('ABSPATH') ) exit;

class Politeia_HL_Render {

    public function __construct() {
        add_action('wp_enqueue_scripts', [ $this, 'enqueue_assets' ]);
        add_filter('the_content', [ $this, 'append_container' ]);
    }

    public function enqueue_assets() {
        // Load only on single posts for logged-in users
        if ( ! is_singular('post') || ! is_user_logged_in() ) return;

        // CSS
        wp_enqueue_style(
            'politeia-hl-css',
            POLITEIA_HL_URL . 'assets/css/highlighter.css',
            [],
            POLITEIA_HL_VERSION
        );

        // JS
        wp_enqueue_script(
            'politeia-hl-js',
            POLITEIA_HL_URL . 'assets/js/highlighter.js',
            [],
            POLITEIA_HL_VERSION,
            true
        );

        // Data passed to the frontend
        wp_localize_script(
            'politeia-hl-js',
            'politeiaHL',
            [
                // Relative URL avoids mixed content and ensures same-origin cookies
                'rest_url'    => esc_url_raw( wp_make_link_relative( rest_url( 'politeia/v1/highlights' ) ) ),
                'nonce'       => wp_create_nonce('wp_rest'),
                'currentUser' => get_current_user_id(),
                'colors'      => [ '#ffe066','#ffda79','#c4f1be','#a0e7e5','#b4b4ff','#ffd6e0' ],
                'strings'     => [
                    'notePlaceholder'  => __( 'Optional note...', 'politeia-highlights' ),
                    'save'             => __( 'Save', 'politeia-highlights' ),
                    'cancel'           => __( 'Cancel', 'politeia-highlights' ),
                    'viewNote'         => __( 'View note', 'politeia-highlights' ),
                    'delete'           => __( 'Delete', 'politeia-highlights' ),
                    'edit'             => __( 'Edit', 'politeia-highlights' ),
                    'remove'           => __( 'Remove', 'politeia-highlights' ),
                    'noNote'           => __( '(No note)', 'politeia-highlights' ),
                    'errDelete'        => __( 'Could not delete highlight.', 'politeia-highlights' ),
                    'errSave'          => __( 'Could not save highlight.', 'politeia-highlights' ),
                    'errCreate'        => __( 'Could not create highlight.', 'politeia-highlights' ),
                    'errList'          => __( 'Could not fetch list.', 'politeia-highlights' ),
                    'errDeleteGeneric' => __( 'Could not delete.', 'politeia-highlights' ),
                ],
            ]
        );
    }

    public function append_container( $content ) {
        // Only add container on single posts and for logged-in users
        if ( is_singular('post') && is_user_logged_in() ) {
            $content .= '<div id="politeia-highlighter-root" data-post-id="' . esc_attr( get_the_ID() ) . '"></div>';
        }
        return $content;
    }
}
