<?php
if ( ! defined('ABSPATH') ) exit;

class Politeia_HL_Schema {

    // Base table name; $wpdb->prefix is added at runtime
    const TABLE = 'wp_user_highlights';

    /**
     * Return full table name with WordPress prefix.
     */
    public static function table_name() {
        global $wpdb;
        return $wpdb->prefix . 'user_highlights';
    }

    /**
     * Create database table to store highlights.
     */
    public static function create_table() {
        global $wpdb;

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $charset_collate = $wpdb->get_charset_collate();
        $table = self::table_name();

        $sql = "CREATE TABLE {$table} (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL,
            post_id BIGINT UNSIGNED NOT NULL,
            anchor_exact LONGTEXT NOT NULL,
            anchor_prefix VARCHAR(255) DEFAULT '' NOT NULL,
            anchor_suffix VARCHAR(255) DEFAULT '' NOT NULL,
            color VARCHAR(16) DEFAULT '#ffe066' NOT NULL,
            note LONGTEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY  (id),
            KEY user_post (user_id, post_id),
            KEY post_id (post_id)
        ) $charset_collate;";

        dbDelta( $sql );

        // Store version for future migrations
        add_option('politeia_hl_db_version', POLITEIA_HL_VERSION);
    }
}
