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
    }

    public function render_shortcode() {
        if ( ! is_user_logged_in() ) return '';

        global $wpdb;
        $table   = Politeia_HL_Schema::table_name();
        $user_id = get_current_user_id();

        $query   = $wpdb->prepare( "SELECT * FROM {$table} WHERE user_id = %d ORDER BY created_at DESC", $user_id ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $results = $wpdb->get_results( $query ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared

        if ( empty( $results ) ) {
            return '<p>' . esc_html__( 'No highlights found.', 'politeia-highlights' ) . '</p>';
        }

        $rows  = '';
        $index = 1;
        foreach ( $results as $row ) {
            $date       = mysql2date( get_option( 'date_format' ), $row->created_at );
            $timestamp  = strtotime( $row->created_at );
            $note       = $row->note ? esc_html( $row->note ) : '';
            $color      = esc_attr( $row->color );
            $post_title = esc_html( get_the_title( $row->post_id ) );

            $rows .= '<tr>';
            $rows .= '<td class="hl-index">' . intval( $index ) . '</td>';
            $rows .= '<td class="hl-text">' . esc_html( $row->anchor_exact ) . '</td>';
            $rows .= '<td class="hl-date" data-timestamp="' . intval( $timestamp ) . '">' . esc_html( $date ) . '</td>';
            $rows .= '<td class="hl-note">' . $note . '</td>';
            $rows .= '<td class="hl-color" data-color="' . $color . '" style="background-color:' . $color . ';"></td>';
            $rows .= '<td class="hl-post">' . $post_title . '</td>';
            $rows .= '</tr>';
            ++$index;
        }

        $html  = '<table class="politeia-hl-table">';
        $html .= '<thead><tr>';
        $html .= '<th data-sort="index">' . esc_html__( 'Index', 'politeia-highlights' ) . '</th>';
        $html .= '<th>' . esc_html__( 'Text', 'politeia-highlights' ) . '</th>';
        $html .= '<th data-sort="date">' . esc_html__( 'Date', 'politeia-highlights' ) . '</th>';
        $html .= '<th>' . esc_html__( 'Note', 'politeia-highlights' ) . '</th>';
        $html .= '<th data-sort="color">' . esc_html__( 'Color', 'politeia-highlights' ) . '</th>';
        $html .= '<th>' . esc_html__( 'Post', 'politeia-highlights' ) . '</th>';
        $html .= '</tr></thead>';
        $html .= '<tbody>' . $rows . '</tbody>';
        $html .= '</table>';

        return $html;
    }
}
