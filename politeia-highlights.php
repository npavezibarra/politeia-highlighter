<?php
/**
 * Plugin Name: Politeia Highlights
 * Description: Allows users to highlight text in posts and save their notes.
 * Version: 0.1.0
 * Author: Politeia
 * Text Domain: politeia-highlights
 */

if ( ! defined( 'ABSPATH' ) ) exit; // Prevent direct access

// ===== Constants =====
define( 'POLITEIA_HL_VERSION', '0.1.0' );
define( 'POLITEIA_HL_PATH', plugin_dir_path( __FILE__ ) );
define( 'POLITEIA_HL_URL', plugin_dir_url( __FILE__ ) );

// ===== Includes =====
require_once plugin_dir_path( __FILE__ ) . 'includes/class-politeia-hl-schema.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/class-politeia-hl-rest.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/class-politeia-hl-render.php';
require_once plugin_dir_path( __FILE__ ) . 'modules/highlight-table/class-politeia-hl-highlights-table.php';

// ===== Activation =====
function politeia_hl_activate() {
    // Create database table on plugin activation
    require_once POLITEIA_HL_PATH . 'includes/class-politeia-hl-schema.php';
    Politeia_HL_Schema::create_table();
}
register_activation_hook( __FILE__, 'politeia_hl_activate' );

// ===== Init =====
function politeia_hl_init() {
    // Register REST routes and front-end renderer
    new Politeia_HL_REST();
    new Politeia_HL_Render();
    new Politeia_HL_Highlights_Table();
}
add_action( 'plugins_loaded', 'politeia_hl_init' );
