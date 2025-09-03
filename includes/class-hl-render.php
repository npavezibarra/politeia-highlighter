<?php
if ( ! defined('ABSPATH') ) exit;

class Politeia_HL_Render {

    public function __construct() {
        add_action('wp_enqueue_scripts', [$this, 'enqueue_assets']);
        add_filter('the_content',        [$this, 'append_container']);
    }

    public function enqueue_assets() {
        // Carga solo en posts singulares y con usuario logueado
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

        // Variables para el frontend
        wp_localize_script('politeia-hl-js', 'politeiaHL', [
            'rest_url'    => rest_url('politeia/v1/highlights'),
            'nonce'       => wp_create_nonce('wp_rest'),
            'currentUser' => get_current_user_id(),
            'colors'      => ['#ffe066','#ffda79','#c4f1be','#a0e7e5','#b4b4ff','#ffd6e0'],
        ]);
    }

    public function append_container( $content ) {
        // Solo agregar contenedor en posts singulares y con usuario logueado
        if ( is_singular('post') && is_user_logged_in() ) {
            $content .= '<div id="politeia-highlighter-root" data-post-id="' . esc_attr( get_the_ID() ) . '"></div>';
        }
        return $content;
    }
}
