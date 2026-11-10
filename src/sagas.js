// Saga de cada cultura (etapa 6 del rediseño del héroe, decisión D6.1 de Ander). Los 9 capítulos mantienen sus
// requisitos, niveles, pruebas y premios; cambian la historia y el jefe, sacados de la mitología o de la historia naval
// de cada clase. Reglas: los dioses de culturas vivas no son enemigos (se cruza su tormenta o se visita su palacio,
// no se les vence), y la saga polinesia espera a la revisión cultural, igual que sus títulos: usa la historia común.
// Cada entrada: [historia, jefe]. Los premios propios de cada clase (D6.2) llegan con su dibujo.
export const SAGAS = {
  vikingo: [
    ['Tu drakkar despierta en un muelle de piedra. Entre las tablas se arrastra un muerto que no quiere descansar.', 'El draugr del muelle'],
    ['Remas río arriba hacia el interior. En los remolinos canta el nøkk, que ahoga a quien se queda escuchando.', 'El nøkk del río'],
    ['La tormenta levanta olas como montañas. Las sagas hablan de una bestia tan grande que parece una isla.', 'La hafgufa'],
    ['Mar abierto, sin costa a la vista. Rán tiende su red para atrapar a los que se hunden: no te dejes atrapar.', 'La red de Rán'],
    ['Una niebla helada sube del norte, la de Niflheim. Dentro, el rumbo se pierde y el frío se mete en los huesos.', 'La niebla de Niflheim'],
    ['Las islas arden. Desde Muspelheim, Surtr agita su espada de fuego sobre el mar.', 'Surtr'],
    ['El hielo cruje bajo la quilla. Los gigantes de escarcha bajan a la orilla a cerrarte el paso.', 'Los gigantes de escarcha'],
    ['En el fondo del mar se enrosca la serpiente que rodea el mundo. Su lomo levanta el agua bajo tu drakkar.', 'Jörmungandr'],
    ['Al final de los tiempos zarpa un barco hecho con uñas de muertos. Tu drakkar debe ganarle la carrera.', 'Naglfar'],
  ],
  pirata: [
    ['Tu balandro sale a escondidas de un puerto olvidado. En la bocana espera una fragata cazapiratas.', 'La fragata cazapiratas'],
    ['Río arriba hay plata, y un fuerte español vigila el paso con sus cañones.', 'El fuerte español del río'],
    ['El cielo del Caribe se vuelve negro. Llega la estación de los huracanes y no hay puerto cerca.', 'El huracán del Caribe'],
    ['Ni un soplo de viento: calma chicha. Las velas cuelgan y solo los remos mueven el barco.', 'La calma chicha'],
    ['La niebla tapa los arrecifes. Un mal golpe de remo y el casco se abre.', 'Los arrecifes de la niebla'],
    ['Un fuerte en la ladera de un volcán guarda el botín de la flota. Hay que llegar antes que la lava.', 'El fuerte del volcán'],
    ['Aguas frías del norte. En 1720, Bartholomew Roberts entró en el puerto de Trepassey, en Terranova, con la bandera negra izada.', 'El puerto de Trepassey'],
    ['En el fondo del mar está el cofre de Davy Jones, donde acaban los marinos ahogados. Él te reclama.', 'Davy Jones'],
    ['1718: Woodes Rogers llega a las Bahamas como gobernador con el perdón del rey y la orden de acabar con los piratas.', 'Woodes Rogers, el cazapiratas'],
  ],
  samurai: [
    ['Tu barca despierta en un puerto de pescadores. Un rōnin sin señor pide peaje a quien quiere zarpar.', 'El rōnin del puerto'],
    ['Río arriba vive el kappa, que arrastra al agua a los descuidados. Dicen que es muy cortés: saluda antes que él.', 'El kappa del río'],
    ['Los tambores de Raijin retumban en el cielo. No se le vence: se cruza su tormenta sin soltar el remo.', 'La tormenta de Raijin'],
    ['En mar abierto y en calma, de pronto surge el umibōzu, una sombra gigante que vuelca a quien se queda quieto mirándolo.', 'El umibōzu'],
    ['En la niebla aparecen los funayūrei, espíritus de ahogados que llenan de agua las barcas con cucharones. Los marinos les daban uno sin fondo.', 'Los funayūrei'],
    ['De noche, en el mar de Yatsushiro, brillan los shiranui, fuegos que se mueven sobre el agua y confunden el rumbo.', 'Los fuegos shiranui'],
    ['Nieve sobre el agua helada. La yuki-onna aparece en la ventisca y congela a quien se detiene.', 'La yuki-onna'],
    ['Bajo el mar está el palacio de Ryūjin, el dios dragón. No se le vence: se llega hasta él con respeto y se vuelve a la superficie.', 'El viaje al palacio de Ryūjin'],
    ['Ocho cabezas, ocho colas: Yamata no Orochi se extiende por ocho valles. Susanoo lo venció con astucia; ahora te toca a ti.', 'Yamata no Orochi'],
  ],
  romano: [
    ['Tu liburna sale del puerto. Los piratas cilicios cortan las rutas del grano que alimenta a Roma.', 'Los piratas cilicios'],
    ['Río arriba, en el Rin. El año 69, los bátavos de Julio Civil se rebelaron y capturaron barcos de la flota romana.', 'Los bátavos de Civil'],
    ['El mar se embravece. Los marinos ofrecían a Neptuno antes de zarpar; hoy toca cruzar su tempestad.', 'La tempestad de Neptuno'],
    ['Rumbo a Britania. En el 55 a. C., las mareas del Canal sorprendieron a la flota de César, que no las conocía.', 'Las mareas del Canal'],
    ['El estrecho de Mesina, entre Escila y Caribdis: de un lado el monstruo, del otro el remolino.', 'Escila y Caribdis'],
    ['Las islas Eolias humean. En Vulcano, decían, estaba la fragua del dios del fuego.', 'Los fuegos de Vulcano'],
    ['El año 16, una tormenta del mar del Norte dispersó la flota de Germánico. Hay que remar de vuelta a casa.', 'La tormenta de Germánico'],
    ['Proteo, el viejo del mar, cambia de forma cuando lo atrapas. Solo responde a quien no lo suelta.', 'Proteo'],
    ['Año 31 a. C., Accio. La flota de Marco Antonio y Cleopatra espera en la boca del golfo.', 'La flota de Antonio en Accio'],
  ],
};

// Capítulo de una clase: el común con la historia y el jefe de su cultura (o el común si no tiene saga).
export function capituloDeClase(capitulos, i, clase) {
  const c = capitulos[i];
  const s = SAGAS[clase]?.[i];
  return s ? { ...c, historia: s[0], jefe: { ...c.jefe, nombre: s[1] } } : c;
}

// «al draugr», «a la tormenta», «a los piratas», «a Surtr»: el jefe con la preposición a.
export const aJefe = (nombre) => (/^El /.test(nombre) ? nombre.replace(/^El /, 'al ') : /^(La|Los|Las) /.test(nombre) ? `a ${nombre.charAt(0).toLowerCase()}${nombre.slice(1)}` : `a ${nombre}`);
