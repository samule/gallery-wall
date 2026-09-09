# Gallery wall

Probador de cuadros sobre la foto real de la pared del escritorio.

## Abrir

Doble clic en **`abrir.command`**. Levanta un servidor local y abre el navegador solo.
Dejá la ventana de Terminal abierta mientras usás la app y cerrala cuando termines.

También podés abrir `index.html` directo en Chrome, pero por `file://` Safari no deja
guardar el layout. Con `abrir.command` funciona en cualquier navegador.

## Cómo funciona

La foto está fija. Encima hay un plano de pared calibrado en centímetros reales, con la
perspectiva de la foto. Por eso un cuadro de 30×40 se ve más chico si lo ponés cerca del
escritorio y más grande cerca de la puerta: así se va a ver en la realidad.

## Otras paredes

Con **Subir foto…** cargás la foto de cualquier pared y la probás igual que la del
escritorio. Cada pared guarda su propia calibración, sus cuadros y sus versiones, y podés
alternar entre ellas con el selector de arriba.

Las imágenes de los cuadros son comunes a todas las paredes: subís una lámina una vez y la
probás donde quieras sin volver a cargarla.

Al crear una pared nueva se abre sola la calibración con las 4 esquinas puestas. Poné las
dos de abajo sobre la línea del piso y las dos de arriba en el techo, o a cualquier altura
que sepas medir, y después escribí el ancho y el alto reales de ese rectángulo. Sin eso las
medidas en cm no significan nada.

La luz de la pared se muestrea sola de cada foto, así que los cuadros toman la iluminación
de esa habitación sin que tengas que tocar nada.

Ojo con el espacio: el navegador guarda unos 5 MB y abajo de todo ves cuánto llevás usado.
Cada foto de pared pesa alrededor de 300 KB.

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
- **Deshacer**: Cmd+Z. Rehacer: Cmd+Shift+Z.
- **Versiones**: guardá varios layouts con nombre y alterná entre ellos.
- **Exportar PNG**: baja la foto con los cuadros puestos, con perspectiva y sombras.

Se guarda solo en el navegador. Si vaciás los datos del sitio, se pierde.

## Calibración de la pared del escritorio

Los valores por defecto son **300 × 260 cm**, las medidas reales de la pared, y las
cuatro esquinas del plano están marcadas sobre la foto. Con eso las medidas en cm ya
salen bien, no hace falta tocar nada.

Si querés otros números, escribí ancho y alto en el panel de Calibración y todo se
reajusta solo. "Volver a la calibración original" devuelve estos 300 × 260.

Si algo no calza (por ejemplo cambiás la foto), tildá "Mover las esquinas de la pared" y
arrastrá los cuatro puntos a las esquinas reales.

## Archivos

- `index.html`, `styles.css`, `app.js` — la app
- `pared.js` — la foto de la pared, embebida en base64
- `abrir.command` — lanzador
