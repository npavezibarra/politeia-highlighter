<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class Politeia_HL_Highlights_Table {

    public function __construct() {
        add_shortcode( 'politeia_highlights_table', [ $this, 'render_shortcode' ] );
        add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_assets' ] );
    }

    public function enqueue_assets() {
        if ( ! is_user_logged_in() ) return;
        if ( ! is_singular() || ! has_shortcode( get_post()->post_content ?? '', 'politeia_highlights_table' ) ) return;

        wp_enqueue_style(
            'politeia-hl-table-css',
            POLITEIA_HL_URL . 'modules/highlight-table/assets/css/highlight-table.css',
            [],
            POLITEIA_HL_VERSION
        );

        wp_enqueue_script(
            'politeia-hl-table-js',
            POLITEIA_HL_URL . 'modules/highlight-table/assets/js/highlight-table.js',
            [],
            POLITEIA_HL_VERSION,
            true
        );

        wp_localize_script(
            'politeia-hl-table-js',
            'politeiaHLTable',
            [
                'restUrl'  => esc_url_raw( wp_make_link_relative( rest_url( 'politeia/v1/user-highlights' ) ) ),
                'nonce'    => wp_create_nonce( 'wp_rest' ),
                'colors'   => [ '#ffe066','#ffda79','#c4f1be','#a0e7e5','#b4b4ff','#ffd6e0' ],
                'allLabel' => esc_html__( 'All', 'politeia-highlights' ),
            ]
        );
    }

    public function render_shortcode() {
        if ( ! is_user_logged_in() ) return '';

        $html  = '<div class="politeia-hl-filter">';
        $html .= '<div class="politeia-hl-title">' . esc_html__( 'My highlights', 'politeia-highlights' ) . '</div>';
        $html .= '<div id="politeia-hl-color" class="hl-colors" style="display:flex; gap:6px; flex-wrap:wrap;"></div>';
        $html .= '</div>';

        $html .= '<table class="politeia-hl-table">';
        $html .= '<thead><tr>';
        $html .= '<th>' . esc_html__( 'Highlighted Text', 'politeia-highlights' ) . '</th>';
        $html .= '<th>' . esc_html__( 'Note', 'politeia-highlights' ) . '</th>';
        $html .= '</tr></thead>';
        $html .= '<tbody></tbody>';
        $html .= '</table>';

        return $html;
    }
}
