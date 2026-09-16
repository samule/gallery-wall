/* ============================================================
   Tour de bienvenida  (driver.js)

   Dos recorridos, porque la app tiene dos momentos muy distintos:

   - "bienvenida": todavía no hay ninguna foto. El panel está casi todo
     apagado (body.empty), así que lo único que se puede contar es qué es
     esto y dónde se sube la primera pared.
   - "app": ya hay una pared. Recién ahí tienen sentido la calibración, los
     cuadros, las versiones y el resto.

   Cada uno se muestra una sola vez y queda anotado en su propia clave del
   localStorage, aparte de la de la app: una importación de copia de
   seguridad pisa el estado entero y no tiene por qué resetear el tutorial.
   El botón "?" del panel lo vuelve a abrir cuando se quiera.
   ============================================================ */

window.GWTour = (function () {
  const TOUR_KEY = 'gallerywall.tour.v1';

  /* Safari en file:// no deja tocar el storage: el tour se sigue viendo,
     nada más que no se acuerda de que ya lo viste. */
  function seen() {
    try { return JSON.parse(localStorage.getItem(TOUR_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function markSeen(name) {
    try {
      const s = seen(); s[name] = true;
      localStorage.setItem(TOUR_KEY, JSON.stringify(s));
    } catch (e) { /* sin storage: se muestra de nuevo la próxima vez */ }
  }

  const hasWall = () => !document.body.classList.contains('empty');
  const lib = () => (window.driver && window.driver.js && window.driver.js.driver) || null;

  /* ---------- pasos ---------- */

  const WELCOME = [
    {
      popover: {
        title: 'Gallery wall',
        description: 'Probá cómo quedan los cuadros sobre la foto real de tu pared, ' +
          'con las medidas en centímetros de verdad. Son treinta segundos de vuelta guiada.'
      }
    },
    {
      element: '#emptyState',
      popover: {
        title: 'Empezá por la foto',
        description: 'Sacale una foto de frente a la pared que querés diseñar y subila acá. ' +
          'Después marcás las esquinas y escribís cuánto mide en serio, y desde ese momento ' +
          'cada cuadro se ve del tamaño que va a tener colgado.',
        side: 'bottom', align: 'center'
      }
    },
    {
      element: '#wallSection',
      popover: {
        title: 'Todas las paredes que quieras',
        description: 'Con <b>Subir foto…</b> agregás más paredes y con el selector saltás ' +
          'entre ellas. Cada una guarda su calibración, sus cuadros y sus versiones.',
        side: 'right', align: 'start'
      }
    },
    {
      popover: {
        title: 'Dale',
        description: 'Subí la primera foto y te muestro el resto de las herramientas.',
        doneBtnText: 'Subir la foto',
        /* sólo este botón abre el selector de archivos: cerrar el tour con la X
           o con Escape no tiene por qué disparar un diálogo que nadie pidió.
           Va acá y no en onDestroyed porque el navegador exige el clic real. */
        onNextClick: () => {
          const btn = document.getElementById('emptyState');
          if (active) active.destroy();
          if (btn && !btn.hidden) btn.click();
        }
      }
    }
  ];

  const MAIN = [
    {
      popover: {
        title: 'Ya tenés tu pared',
        description: 'Te muestro en qué orden conviene usar las herramientas del panel.'
      }
    },
    {
      element: '#calSection',
      popover: {
        title: '1. Calibrá la pared',
        description: 'Esto va primero: sin calibrar, los centímetros no significan nada. ' +
          'Arrastrá las cuatro esquinas —las de abajo sobre la línea del piso, las de arriba ' +
          'al techo— y escribí el ancho y el alto reales de ese rectángulo.',
        side: 'right', align: 'start'
      }
    },
    {
      element: '#addSection',
      popover: {
        title: '2. Agregá cuadros',
        description: 'Subí las láminas con el botón, o arrastrá las imágenes directamente ' +
          'sobre la pared. Una lámina se sube una sola vez y después la probás en cualquier pared.',
        side: 'right', align: 'start'
      }
    },
    {
      element: '#viewport',
      popover: {
        title: '3. Movelos y estiralos',
        description: 'Arrastrá para mover; las flechas del teclado mueven 1 cm y con Shift 5 cm. ' +
          'Los ocho tiradores redimensionan. Al arrastrar aparecen guías rosas cuando el cuadro ' +
          'se alinea con otro, y hace snap: mantené Alt para desactivarlas. ' +
          '<b>Delete</b> borra y <b>Cmd+Z</b> deshace.',
        side: 'left', align: 'center'
      }
    },
    {
      element: '#itemSection',
      popover: {
        title: '4. Los números del cuadro',
        description: 'Este panel se enciende cuando seleccionás un cuadro. Ahí ponés la medida ' +
          'exacta de la lámina, el marco, el passepartout y la posición. Abajo de todo te dice ' +
          'la medida exterior, que es lo que el cuadro realmente ocupa en la pared.',
        side: 'right', align: 'start'
      }
    },
    {
      element: '#viewSection',
      popover: {
        title: 'Referencias',
        description: 'La línea de 150 cm es la altura de museo: el centro del conjunto suele ir ahí. ' +
          'La grilla de 10 cm ayuda a medir separaciones, y la luz de la pared se muestrea sola ' +
          'de la foto para que los cuadros tomen la iluminación de esa habitación.',
        side: 'right', align: 'start'
      }
    },
    {
      element: '#verSection',
      popover: {
        title: 'Guardá varias ideas',
        description: 'Una versión es un layout con nombre. Guardá dos o tres distribuciones y ' +
          'alterná entre ellas para comparar sin perder ninguna.',
        side: 'right', align: 'start'
      }
    },
    {
      element: '#exportSection',
      popover: {
        title: 'Llevátelo en PNG',
        description: 'Baja la foto con los cuadros puestos, con la perspectiva y las sombras, ' +
          'lista para mandar por mensaje o mostrar en la casa de marcos.',
        side: 'right', align: 'start'
      }
    },
    {
      element: '#backupSection',
      popover: {
        title: 'Ojo con esto',
        description: 'Todo vive en el localStorage de este navegador: no se sincroniza con ningún ' +
          'lado y si vaciás los datos del sitio se pierde. <b>Exportar .json</b> es la única copia ' +
          'que queda afuera, y es la forma de pasar tu trabajo a otra máquina u otro navegador.',
        side: 'right', align: 'start'
      }
    },
    {
      popover: {
        title: 'Listo',
        description: 'Cuando quieras volver a ver esto, tocá el <b>?</b> de arriba del panel.'
      }
    }
  ];

  /* ---------- motor ---------- */

  let active = null;

  function run(name, steps) {
    const driver = lib();
    if (!driver) return;                       // sin la librería, la app anda igual
    if (active) { active.destroy(); active = null; }

    /* Se anota como visto al abrirlo, no al cerrarlo: driver.js no avisa cuando
       el recorrido termina con el botón "Listo" (su onDestroyed sólo dispara al
       cerrar a mitad de camino), y de todos modos con haberlo ofrecido una vez
       alcanza. El que lo cierre en el primer paso lo tiene en el botón "?". */
    markSeen(name);

    active = driver({
      showProgress: steps.length > 1,
      progressText: '{{current}} de {{total}}',
      nextBtnText: 'Siguiente',
      prevBtnText: 'Atrás',
      doneBtnText: 'Listo',
      overlayColor: '#000',
      overlayOpacity: 0.6,
      stagePadding: 6,
      stageRadius: 8,
      smoothScroll: true,
      popoverClass: 'gw-popover',
      steps,
      onDestroyed: () => { active = null; }
    });
    active.drive();
  }

  const startWelcome = () => run('welcome', WELCOME);
  const startMain = () => run('main', MAIN);

  return {
    /* después de cargar el estado guardado, en el arranque */
    onBoot() {
      const s = seen();
      if (!hasWall()) { if (!s.welcome) setTimeout(startWelcome, 300); return; }
      if (!s.main) setTimeout(startMain, 300);
    },

    /* al crear una pared nueva: si es la primera, sigue el recorrido */
    onNewWall() {
      if (!seen().main) setTimeout(startMain, 500);
    },

    /* el botón "?": arranca el recorrido que corresponda al estado actual */
    start() {
      if (hasWall()) startMain(); else startWelcome();
    }
  };
})();

document.getElementById('btnTour').addEventListener('click', () => window.GWTour.start());
