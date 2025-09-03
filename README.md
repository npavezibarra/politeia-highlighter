# Politeia Highlights (WordPress Plugin)

Guarda **highlights** de usuario sobre el contenido de un post, con color y **nota** opcional. Rehidrata los highlights al volver a la página y permite ver la nota en un popover. CRUD vía REST.

## Características
- Tabla personalizada `wp_user_highlights` (`exact`, `prefix`, `suffix`, `color`, `note`)
- REST: **POST** create, **GET** list, **DELETE** delete (por dueño)
- Frontend: selección de texto, toolbar (color + nota), render persistente, popover de nota
- Seguridad: Nonce REST, ownership, sanitización básica

## Endpoints
- `POST   /wp-json/politeia/v1/highlights`
- `GET    /wp-json/politeia/v1/highlights?post_id=ID`
- `DELETE /wp-json/politeia/v1/highlights/{id}`
- (Objetivo siguiente) `PATCH /wp-json/politeia/v1/highlights/{id}` → editar `note` y `color`

## Cómo probar local
1. Instala WP (Local by Flywheel) y activa el plugin.
2. En un **post** logueado, selecciona texto → guarda highlight con color/nota.
3. Recarga: se rehidrata y aparece un **badge** que abre la nota.

## Guía de contribución (pensado para Codex/PRs pequeños)
- Rama por feature (`feature/patch-endpoint`).
- Commits descriptivos y PRs **pequeños**.
- Checklist PR:
  - [ ] Nonce + `current_user_can` + ownership
  - [ ] Sanitización/escape (`sanitize_textarea_field`, validación de color)
  - [ ] Tests o al menos plan manual de prueba en README/PR
  - [ ] Sin cambios directos en `main`; siempre vía PR

## Roadmap inmediato (Definition of Done para Codex)
1) Agregar `PATCH` (`note`, `color`) + validaciones y límites.
2) Endurecer sanitización backend y validación de color hex.
3) A11y del popover (focus trap, aria).
4) CI básico (PHP lint + PHPCS). Tests PHPUnit (opcional).

