# Gallery wall

Probador de cuadros sobre la foto real de una pared, con medidas en centímetros.

## Abrir

Doble clic en **`index.html`** y se abre en el navegador. No hay que instalar ni
compilar nada.

Si está publicado con GitHub Pages, también anda desde la URL y no hace falta bajarse
los archivos.

Usá Chrome o Firefox. Safari no guarda nada cuando la app se abre como archivo local
(bloquea el almacenamiento en `file://`); si querés usar Safari, entrá por la URL.

Ojo: el archivo local y la URL son dos instalaciones separadas. No comparten paredes ni
cuadros, porque el navegador guarda los datos por origen. Para pasar de una a la otra
está la copia de seguridad.

## Cómo funciona

La foto está fija. Encima hay un plano de pared calibrado en centímetros reales, con la
perspectiva de la foto. Por eso un cuadro de 30×40 se ve más chico si lo ponés al fondo
y más grande si lo ponés cerca: así se va a ver en la realidad.

La luz de la pared se muestrea sola de cada foto, así que los cuadros toman la
iluminación de esa habitación sin que tengas que tocar nada.

## Paredes

La primera vez la app arranca vacía, con un cartel para subir la foto de tu pared. Con
**Subir foto…** agregás las que quieras y alternás entre ellas con el selector de arriba.

Al crear una pared se abre sola la calibración con las 4 esquinas puestas. Poné las dos
de abajo sobre la línea del piso y las dos de arriba en el techo, o a cualquier altura
que sepas medir, y después escribí el ancho y el alto reales de ese rectángulo. Sin eso
las medidas en cm no significan nada.

Cada pared guarda su propia calibración, sus cuadros y sus versiones. Las imágenes de los
cuadros son comunes a todas: subís una lámina una vez y la probás donde quieras sin
volver a cargarla.

Ojo con el espacio: el navegador guarda unos 5 MB y abajo de todo ves cuánto llevás
usado. Cada foto de pared pesa alrededor de 300 KB. Si subís láminas, en JPEG rinden
mucho más que en PNG.

## Uso

- **Agregar cuadro**: botón, o arrastrá imágenes desde el Finder a la pared.
- **Mover**: arrastrar. Flechas del teclado mueven 1 cm, con Shift 5 cm.
- **Redimensionar**: los 8 tiradores, o escribí la medida de la lámina en el panel.
  Los botones de presets (30×40, 50×70, …) ponen medidas de marco estándar.
- **Marco**: color, grosor y passepartout. El panel muestra abajo la medida exterior,
  que es lo que realmente ocupa en la pared.
- **Guías**: al arrastrar aparecen líneas rosas cuando el cuadro se alinea con otro por
  borde o por centro, y hace snap. Mantené Alt para desactivarlas.
- **Línea de 150 cm**: la altura de museo, el centro del conjunto suele ir ahí.
- **Borrar**: tecla Delete o el botón.
- **Deshacer**: Cmd+Z. Rehacer: Cmd+Shift+Z. Cubre cuadros y calibración, no el borrado
  de una pared entera.
- **Versiones**: guardá varios layouts con nombre y alterná entre ellos.
- **Exportar PNG**: baja la foto con los cuadros puestos, con perspectiva y sombras.

## Calibración

Una pared nueva arranca en 300 × 260 cm con las esquinas en un rectángulo cualquiera. Los
dos números que importan son el ancho y el alto reales del rectángulo que marcaste: es lo
único que hace falta para que las medidas sean exactas.

Si algo no calza, tildá "Mover las esquinas de la pared" y arrastrá los cuatro puntos.
"Volver a la calibración original" devuelve esa pared a como estaba cuando la creaste.

## Copia de seguridad

Todo se guarda solo en este navegador. Si vaciás los datos del sitio, se pierde, y no se
sincroniza con ningún lado.

**Exportar .json** baja un archivo con todas las paredes, los cuadros y las versiones.
Es la única copia que vive fuera del navegador, y es la forma de llevar tu trabajo a otra
máquina, a otro navegador o entre el archivo local y la URL publicada.

**Importar** reemplaza todo lo que tengas guardado por el contenido de la copia. Pide
confirmación antes.

Guardá la copia **fuera de la carpeta del proyecto**: lleva las fotos adentro y no tiene
por qué terminar en el repositorio.

## Archivos

- `index.html`, `styles.css`, `app.js` — la app entera, sin dependencias
