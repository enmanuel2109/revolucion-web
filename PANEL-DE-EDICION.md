# Editar la web sin código

Panel: https://enmanuel2109.github.io/revolucion-web/admin/

La web pública mantiene el diseño original. El panel permite editar 360 campos de texto, precios, enlaces, imágenes, vídeos, descripciones y la cuenta atrás. El contenido se construye al publicar mediante Python, sin dependencias de terceros.

## Uso diario

1. Abre el panel y selecciona una sección. También puedes buscar una palabra o pulsar el texto o imagen en la vista previa.
2. Cambia los campos. Los textos que tienen varios estilos se muestran como campos separados para conservar las negritas, cursivas y tamaños.
3. Usa los botones Escritorio, Tableta, Móvil y Móvil pequeño para revisar el resultado. Las vistas tienen 1280, 768, 390 y 320 píxeles de anchura respectivamente; la zona de vista previa tiene su propia barra de desplazamiento.
4. Para imágenes y vídeos, utiliza el botón de seleccionar archivo. Se admite JPG, PNG, WebP o GIF hasta 10 MB; MP4 o WebM hasta 20 MB, con un máximo conjunto de 30 MB por publicación. Los archivos se suben al publicar. Con vídeos mayores, utiliza un servicio de vídeo o reduce su tamaño.
5. Pulsa Conectar acceso, introduce tu clave limitada de GitHub dentro del panel y pulsa Publicar cambios.
6. Espera al mensaje de publicación confirmada. El guardado crea un commit y GitHub Actions reconstruye y publica la web. Un guardado en GitHub no equivale a una publicación terminada: si tarda o falla, consulta Actions en el repositorio.

La fecha de la cuenta atrás se introduce en hora de Miami. El panel también actualiza las dos fechas escritas junto a ella. Otras fechas del calendario o de reservas son textos independientes y deben revisarse al cambiarlas.

Los campos se guardan en `content/site.json`. El HTML y los estilos se generan desde `sources/`. Para cambios de contenido, no edites directamente `public_html/index.html` o `public_html/assets/css/styles.css`: la próxima construcción los regenera.

## Acceso para publicar: configuración inicial del propietario

El panel funciona sobre GitHub Pages, que no tiene un servidor de inicio de sesión propio. Para publicar necesita una clave personal de acceso granular de GitHub. No existe una contraseña compartida del panel ni se crean claves públicas dentro del código.

1. En GitHub, abre https://github.com/settings/personal-access-tokens/new.
2. Escribe un nombre como Editor Revolución y elige una caducidad adecuada. Cuando caduque, tendrás que renovarla.
3. Selecciona el propietario `enmanuel2109`.
4. Marca Only select repositories y elige únicamente `revolucion-web`.
5. En permisos de repositorio concede Contents: Read and write. No se necesitan permisos de administración ni de workflows para editar contenido.
6. Genera la clave y guárdala en tu gestor de contraseñas. Introdúcela únicamente en Conectar acceso dentro del panel.

La clave permanece en memoria mientras el panel está abierto. No se guarda en cookies, localStorage, sessionStorage, archivos de contenido ni commits. Se elimina al cerrar sesión o salir de la página. Será necesario volver a conectarla al abrir el panel en otra sesión.

Para que tu tío publique desde su cuenta, añádelo como colaborador de este repositorio con permiso de escritura. Podrá generar su propio acceso; no compartáis la contraseña de GitHub. La gestión de colaboradores y la generación de credenciales se realizan en la cuenta de GitHub, no desde este editor.

Sin conectar acceso puedes editar y comprobar la vista previa, pero no publicar. El contenido público se puede consultar por ser un repositorio público; las escrituras requieren autorización de GitHub.

## Borradores y cambios simultáneos

Los borradores de texto se conservan en sessionStorage dentro de la sesión del navegador. Los archivos pendientes no se guardan automáticamente allí, para evitar límites de tamaño: antes de cerrar con archivos pendientes, publica o descarga el borrador completo.

Descargar borrador produce un respaldo JSON con contenido y archivos pendientes, sin la clave. Su recuperación manual está destinada al propietario o a quien mantenga la web; el panel no importa ese respaldo automáticamente.

Si otra persona cambia el contenido mientras editas, la publicación se bloquea antes de actualizar la rama. Descarga tu borrador, recarga la última versión y revisa qué cambios necesitas volver a aplicar. El panel nunca fuerza la rama ni ignora conflictos.

## Qué se conserva y qué no cambia

Se conservan el contenido inicial, los 9 archivos de imagen distintos, 3 vídeos, 3 portadas, las fuentes locales, SVG, anclas, precios y enlaces originales. Solo se añaden atributos invisibles para vincular los campos al editor y una función de vista previa de la cuenta atrás.

La revisión visual corrigió las fuentes locales para utilizar las variantes WOFF2 equivalentes a las del navegador del original. También se añadió `assets/css/mobile-fixes.css`, limitado a pantallas de 360 píxeles o menos, para corregir un desbordamiento del encabezado y contenido que ya existía en pantallas muy estrechas. El CSS principal original permanece intacto.

El editor cambia contenido dentro del diseño existente. No es un constructor para mover bloques, añadir páginas o cambiar libremente la estructura. Los botones de contacto y pago conservan sus destinos originales hasta que los sustituyas desde el panel.

## Comprobaciones

`python scripts/build.py` construye el contenido.
`python -m unittest discover -s tests -p 'test_*.py'` verifica la web, recursos y construcción.
`node --test tests/editor.test.mjs` verifica validación, fechas y operaciones de guardado con una API simulada, sin publicar contenido de prueba.

GitHub Actions ejecuta estas comprobaciones antes de publicar. Las pruebas de la API simulada no sustituyen la comprobación de acceso con tu propia clave; esa comprobación se realiza cuando la conectas en el panel y publicas.
