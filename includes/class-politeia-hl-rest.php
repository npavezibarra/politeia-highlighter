<?php
/**
 * REST endpoints for Politeia Highlights.
 *
 * @package Politeia_Highlights
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Politeia_HL_REST {

	const NS = 'politeia/v1';

	public function __construct() {
		add_action( 'rest_api_init', [ $this, 'register_routes' ] );
	}

	public function register_routes() {
		register_rest_route(
			self::NS,
			'/highlights',
			[
				[
					'methods'             => WP_REST_Server::CREATABLE, // POST.
					'callback'            => [ $this, 'create_highlight' ],
					'permission_callback' => [ $this, 'auth_required' ],
					'args'                => [
						'post_id'       => [ 'type' => 'integer', 'required' => true ],
						'anchor_exact'  => [ 'type' => 'string',  'required' => true ],
						'anchor_prefix' => [ 'type' => 'string',  'required' => false, 'default' => '' ],
						'anchor_suffix' => [ 'type' => 'string',  'required' => false, 'default' => '' ],
						'color'         => [ 'type' => 'string',  'required' => false, 'default' => '#ffe066' ],
						'note'          => [ 'type' => 'string',  'required' => false, 'default' => '' ],
					],
				],
				[
					'methods'             => WP_REST_Server::READABLE, // GET.
					'callback'            => [ $this, 'list_highlights' ],
					'permission_callback' => [ $this, 'auth_required' ],
					'args'                => [
						'post_id' => [ 'type' => 'integer', 'required' => true ],
					],
				],
			]
		);

		register_rest_route(
			self::NS,
			'/highlights/(?P<id>\d+)',
			[
				'methods'             => WP_REST_Server::DELETABLE, // DELETE.
				'callback'            => [ $this, 'delete_highlight' ],
				'permission_callback' => [ $this, 'auth_required' ],
				'args'                => [
					'id' => [ 'type' => 'integer', 'required' => true ],
				],
			]
		);
	}

	/** -------- Helpers -------- */
	public function auth_required( WP_REST_Request $request ) {
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'rest_forbidden', 'Debes iniciar sesión.', [ 'status' => 401 ] );
		}

		// Verificación de nonce REST (el frontend enviará X-WP-Nonce).
		$nonce = $request->get_header( 'x-wp-nonce' );
		if ( ! $nonce || ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
			return new WP_Error( 'rest_invalid_nonce', 'Nonce inválido.', [ 'status' => 403 ] );
		}

		return current_user_can( 'read' );
	}

	/** -------- Handlers -------- */
	public function create_highlight( WP_REST_Request $request ) {
		if ( ! function_exists( 'sanitize_text_field' ) ) {
			require_once ABSPATH . 'wp-includes/formatting.php';
		}

		global $wpdb;

		$user_id = get_current_user_id();
		$post_id = (int) $request->get_param( 'post_id' );

		$anchor_exact  = wp_unslash( (string) $request->get_param( 'anchor_exact' ) );
		$anchor_prefix = wp_unslash( (string) $request->get_param( 'anchor_prefix' ) );
		$anchor_suffix = wp_unslash( (string) $request->get_param( 'anchor_suffix' ) );
		$color         = sanitize_text_field( (string) $request->get_param( 'color' ) );
                $note          = sanitize_textarea_field( wp_unslash( (string) $request->get_param( 'note' ) ) );

		// Límites razonables.
		$anchor_prefix = mb_substr( $anchor_prefix, 0, 255 );
		$anchor_suffix = mb_substr( $anchor_suffix, 0, 255 );
		$color         = mb_substr( $color, 0, 16 );
		$note          = mb_substr( $note, 0, 10000 ); // por si acaso

		if ( empty( $anchor_exact ) || empty( $post_id ) ) {
			return new WP_Error( 'rest_invalid', 'Faltan datos requeridos.', [ 'status' => 400 ] );
		}

		$table = Politeia_HL_Schema::table_name();

		$inserted = $wpdb->insert(
			$table,
			[
				'user_id'       => $user_id,
				'post_id'       => $post_id,
				'anchor_exact'  => $anchor_exact,
				'anchor_prefix' => $anchor_prefix,
				'anchor_suffix' => $anchor_suffix,
				'color'         => $color ? $color : '#ffe066',
				'note'          => $note,
				'created_at'    => current_time( 'mysql' ),
				'updated_at'    => current_time( 'mysql' ),
			],
			[ '%d', '%d', '%s', '%s', '%s', '%s', '%s', '%s', '%s' ]
		);

		if ( false === $inserted ) {
			// Log para desarrollo (WP_DEBUG_LOG debe estar habilitado).
			error_log( '[Politeia HL] Insert error: ' . $wpdb->last_error . ' | SQL: ' . $wpdb->last_query );
			// Devuelve razón para depurar en entorno local.
			return new WP_Error(
				'db_insert_error',
				'No se pudo guardar el highlight.',
				[
					'status'   => 500,
					'db_error' => $wpdb->last_error,
				]
			);
		}

		$id = (int) $wpdb->insert_id;

		return new WP_REST_Response(
			[
				'id'            => $id,
				'user_id'       => $user_id,
				'post_id'       => $post_id,
				'anchor_exact'  => $anchor_exact,
				'anchor_prefix' => $anchor_prefix,
				'anchor_suffix' => $anchor_suffix,
				'color'         => $color ? $color : '#ffe066',
				'note'          => $note,
				'created_at'    => current_time( 'mysql' ),
				'updated_at'    => current_time( 'mysql' ),
			],
			201
		);
	}

	public function list_highlights( WP_REST_Request $request ) {
		global $wpdb;

		$user_id = get_current_user_id();
		$post_id = (int) $request->get_param( 'post_id' );

		if ( empty( $post_id ) ) {
			return new WP_Error( 'rest_invalid', 'post_id es requerido.', [ 'status' => 400 ] );
		}

		$table = Politeia_HL_Schema::table_name();

		// Query segura: nombre de tabla por concatenación, valores con placeholders.
		$sql  = 'SELECT id, user_id, post_id, anchor_exact, anchor_prefix, anchor_suffix, color, note, created_at, updated_at ';
		$sql .= 'FROM ' . $table . ' ';
		$sql .= 'WHERE user_id = %d AND post_id = %d ';
		$sql .= 'ORDER BY id DESC';

		$rows = $wpdb->get_results(
			/* phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Primer argumento es $wpdb->prepare() con placeholders; el nombre de tabla se concatena de forma determinística. */
			$wpdb->prepare( $sql, $user_id, $post_id ),
			ARRAY_A
		);

		return rest_ensure_response( $rows ? $rows : [] );
	}

	public function delete_highlight( WP_REST_Request $request ) {
		global $wpdb;

		$user_id = get_current_user_id();
		$id      = (int) $request['id'];
		$table   = Politeia_HL_Schema::table_name();

		// Verifica propiedad.
		$owner_sql = 'SELECT user_id FROM ' . $table . ' WHERE id = %d';

		$owner = $wpdb->get_var(
			/* phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Primer argumento es $wpdb->prepare() con placeholders; el nombre de tabla se concatena de forma determinística. */
			$wpdb->prepare( $owner_sql, $id )
		);

		if ( ! $owner ) {
			return new WP_Error( 'rest_not_found', 'No existe.', [ 'status' => 404 ] );
		}

		if ( (int) $owner !== (int) $user_id ) {
			return new WP_Error( 'rest_forbidden', 'No puedes borrar este highlight.', [ 'status' => 403 ] );
		}

		$deleted = $wpdb->delete( $table, [ 'id' => $id ], [ '%d' ] );

		if ( false === $deleted ) {
			return new WP_Error( 'db_delete_error', 'No se pudo borrar.', [ 'status' => 500 ] );
		}

		return new WP_REST_Response( null, 204 );
	}
}
