# R-evolución — copia editable

La web está en `public_html/`. Incluye HTML, CSS, JavaScript, imágenes, fuentes locales y vídeos.

Consulta `LEEME.md` para personalizarla. Los contactos y enlaces de pago conservan los destinos originales.

## GitHub Pages

En el repositorio, abre **Settings → Pages → Build and deployment → Source → GitHub Actions**.
El flujo `.github/workflows/pages.yml` publica `public_html/` con cada cambio en `main`.
La dirección publicada aparecerá en la ejecución de Actions y en Settings → Pages.

La web publicada es accesible mediante su enlace. El ZIP y el HTML de referencia se conservan en el repositorio; el despliegue solo sirve los archivos de `public_html/`.
