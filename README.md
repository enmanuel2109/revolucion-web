# R-evolución — copia editable

La web está en `public_html/`. Incluye HTML, CSS, JavaScript, imágenes, fuentes locales y vídeos.

Consulta `LEEME.md` para personalizarla. Los contactos y enlaces de pago conservan los destinos originales.

## Panel de edición

Abre https://enmanuel2109.github.io/revolucion-web/admin/ para editar el contenido con formularios y vista previa de escritorio, tableta y móvil. Consulta `PANEL-DE-EDICION.md` para configurar el acceso limitado de GitHub y utilizar el editor. No se almacenan credenciales en este repositorio.

El contenido editable está en `content/site.json`; las plantillas están en `sources/`. GitHub Actions construye `public_html/` con `python scripts/build.py` antes de publicar. No cambies el HTML generado para editar contenido, porque se regenerará desde las plantillas y los datos.

## GitHub Pages

En el repositorio, abre **Settings → Pages → Build and deployment → Source → GitHub Actions**.
El flujo `.github/workflows/pages.yml` publica `public_html/` con cada cambio en `main`.
La dirección publicada aparecerá en la ejecución de Actions y en Settings → Pages.

La web publicada es accesible mediante su enlace. El ZIP y el HTML de referencia se conservan en el repositorio; el despliegue solo sirve los archivos de `public_html/`.
