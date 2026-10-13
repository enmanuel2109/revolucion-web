# Copia editable de R-evolución Estados Unidos

Capturada el 13 de octubre de 2026 desde https://www.revoluciongaledousa.com/.

## Subir al hosting

1. Descomprime este ZIP.
2. Sube **el contenido de `public_html/`** a la carpeta pública de tu hosting (`public_html`, `www`, `htdocs` o equivalente).
3. Debe quedar `index.html` directamente en la raíz pública, junto con las carpetas `assets/` y `videos/`.
4. Visita tu dominio. No necesita Node, PHP, base de datos, instalación ni compilación.

También funciona dentro de una subcarpeta porque los recursos usan rutas relativas.

Para verlo en tu ordenador, abre `public_html/index.html`. Si prefieres servirlo por HTTP: ejecuta `python -m http.server 8000 --directory public_html` desde esta carpeta y visita http://localhost:8000.

## Personalizar

| Archivo | Qué editar |
| --- | --- |
| `public_html/index.html` | Textos, títulos, precios, calendario, contactos, enlaces, etiquetas SEO y estructura |
| `public_html/assets/css/styles.css` | Colores en `:root`, tamaños, diseño y adaptación al móvil |
| `public_html/assets/js/main.js` | Cuenta atrás, animaciones y comportamiento al desplazarte |
| `public_html/assets/images/` | Las 9 imágenes distintas (10 apariciones) extraídas del HTML original, sin recomprimir |
| `public_html/videos/` | Los 3 testimonios MP4 y sus 3 imágenes de portada |
| `public_html/assets/css/fonts.css` y `assets/fonts/` | Tipografías descargadas y sus declaraciones locales |

La fecha de la cuenta atrás se encuentra en `main.js`, en `Date.UTC(2026,9,26,14,0,0)`. En JavaScript, enero es el mes 0 y octubre el 9. El original cuenta hasta el 26 de octubre de 2026 a las 14:00 UTC.

**Antes de utilizarla para tu negocio, cambia los enlaces de pago Square, WhatsApp, Instagram y el teléfono: actualmente conservan los destinos del sitio original.** Cambia también `og:url`, la marca, fechas, precios, nombres e imágenes según tu proyecto.

## Alcance de la copia

El sitio enlaza una sola página con secciones internas (`#programa`, `#experiencia`, `#calendario`, `#inversion`, `#reservar`), además de enlaces externos. No se encontraron subpáginas internas enlazadas. Las peticiones a `robots.txt` y `sitemap.xml` devolvieron la página principal en lugar de esos documentos; por ello no aportaron más rutas. Esto no permite descartar rutas no enlazadas.

Se conserva el HTML público, el CSS y JavaScript entregados al visitante, los SVG incrustados, imágenes, vídeos y fuentes. Las hojas de estilo y los scripts que estaban incrustados se separaron en archivos editables. Los enlaces internos mantienen sus destinos. El diseño y la lógica se conservaron, salvo el traslado de recursos a archivos locales.

Square, WhatsApp e Instagram siguen siendo enlaces externos. El ZIP no contiene el código ni datos privados de esos servicios, ni un backend del sitio original. No hay un formulario o backend propio visible en el HTML descargado.

`original-home.html.txt` conserva el HTML original exacto como referencia. No hace falta subirlo al hosting. `inventario.json` lista los recursos capturados con tamaño y hash SHA-256; `VERIFICACION.txt` documenta los controles realizados y sus límites.

La verificación del paquete comprueba archivos locales, anclas, recursos referenciados y sintaxis JavaScript. No se realizó una comparación visual automatizada en navegador.
