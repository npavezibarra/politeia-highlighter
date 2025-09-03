<?php
/**
 * Plugin Name: Politeia Highlights
 * Description: Permite a los usuarios resaltar texto en los posts y guardar sus highlights.
 * Version: 0.1.0
 * Author: Politeia
 * Text Domain: politeia-highlights
 */

if ( ! defined( 'ABSPATH' ) ) exit; // Evita acceso directo

// ===== Constantes =====
define( 'POLITEIA_HL_VERSION', '0.1.0' );
define( 'POLITEIA_HL_PATH', plugin_dir_path( __FILE__ ) );
define( 'POLITEIA_HL_URL', plugin_dir_url( __FILE__ ) );

// ===== Includes =====
require_once plugin_dir_path( __FILE__ ) . 'includes/class-politeia-hl-schema.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/class-politeia-hl-rest.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/class-politeia-hl-render.php';

// ===== Activación =====
function politeia_hl_activate() {
    require_once POLITEIA_HL_PATH . 'includes/class-politeia-hl-schema.php';
    Politeia_HL_Schema::create_table();
}
register_activation_hook( __FILE__, 'politeia_hl_activate' );

// ===== Init =====
function politeia_hl_init() {
    new Politeia_HL_REST();
    new Politeia_HL_Render();
}
add_action( 'plugins_loaded', 'politeia_hl_init' );
