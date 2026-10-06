export type ManagementType = 'Mensaje (Transferencia de llamada)' | 'Regalo (Generación de link de pago)';

export const MANAGEMENT_TYPES: ManagementType[] = [
  'Mensaje (Transferencia de llamada)',
  'Regalo (Generación de link de pago)'
];

export const TRANSFER_STATUSES = [
  { value: 'pendiente', label: 'Pendiente', color: '#EAB308' },
  { value: 'gestionado', label: 'Gestionado', color: '#22C55E' }
] as const;

export type UserRole = 'asesor' | 'supervisor' | 'admin';

// Únicos correos que pueden ver y usar el módulo "Validación NGSO"
// (aprobar/rechazar solicitudes redirigidas), sin importar su rol.
export const NGSO_VALIDATOR_EMAILS = [
  'aldair.avila@segurosbolivar.com',
  'helen.pantoja@segurosbolivar.com',
  'asly.camelo@segurosbolivar.com'
];

// Correos del equipo Controller: pueden usar "Buscar Asesor" en su perfil y
// ver las conversaciones de cualquier asesor, sin importar su rol.
export const CONTROLLER_EMAILS = [
  'helen.pantoja@segurosbolivar.com',
  'sergio.llanos@segurosbolivar.com',
  'luis.padilla@segurosbolivar.com',
  'doris.benavides@segurosbolivar.com',
  'asly.camelo@segurosbolivar.com'
];

// Único correo que carga el reporte de bitácoras (desde su perfil); cada
// asesor ve solo las suyas. Debe coincidir con isBitacoraUploader() en
// firestore.rules.
export const BITACORA_UPLOADER_EMAILS = ['asly.camelo@segurosbolivar.com'];

export interface Advisor {
  nombre: string;
  correo: string;
  correo_supervisor: string;
  supervisor: string;
  cartera: string;
  // Extensión de ITBX y nombre tal como sale en el reporte de bitácoras
  // (roster oficial) — opcionales.
  extension?: string;
  nombreBitacoras?: string;
}

// Roster oficial de asesores (octubre 2026). Es solo el listado de respaldo y
// de arranque: la lista viva es la colección `asesores` de Firestore, que se
// edita en "Gestión Asesores".
export const ADVISORS: Advisor[] = [
  { nombre: "Estrella Ramirez Barreto", correo: "estrella.ramirez@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico", extension: "2507", nombreBitacoras: "ESTRELLA RAMIREZ BARRETO" },
  { nombre: "Dora Marlen Molina Camargo", correo: "dora.molina@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico", extension: "2515", nombreBitacoras: "DORA MARLEN MOLINA CAMARGO" },
  { nombre: "Deisy Alexandra Higuera Diaz", correo: "deisy.alexandra.higuera@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico", extension: "2525", nombreBitacoras: "DEISY HIGUERA" },
  { nombre: "Jeniffer Alexandra Riveros Pineda", correo: "jeniffer.riveros@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico", extension: "2530", nombreBitacoras: "JENIFFER ALEXANDRA RIVEROS PINEDA" },
  { nombre: "Leidy Natalia Zorro Velandia", correo: "leidy.zorro.velandia@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico", extension: "2533", nombreBitacoras: "LEIDY ZORRO" },
  { nombre: "Luis Eduardo Meriño Escorcia", correo: "luis.merino@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico", extension: "2535", nombreBitacoras: "LUIS EDUARDO MERINO ESCORCIA" },
  { nombre: "Luz Helena Rodriguez Infante", correo: "luz.rodriguez.infante@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico", extension: "2537", nombreBitacoras: "LUZ HELENA RODRIGUEZ INFANTE" },
  { nombre: "Maria Fernanda Patiño Camacho", correo: "maria.patino@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico", extension: "2542", nombreBitacoras: "MARIA FERNANDA PATIÑO CAMACHO" },
  { nombre: "Maria Angelica Baquero Triana", correo: "maria.baquero@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico", extension: "2544", nombreBitacoras: "MARIA ANGELICA BAQUERO TRIANA" },
  { nombre: "Felipe Antonio Barrero Cortes", correo: "felipe.barrero@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico", extension: "2550", nombreBitacoras: "FELIPE ANTONIO BARRERO CORTES" },
  { nombre: "Juliana Catalina Padilla Mesa", correo: "juliana.padilla@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico", extension: "2552", nombreBitacoras: "JULIANA CATALINA PADILLA MESA" },
  { nombre: "Johann Orlando Enciso Parra", correo: "johann.enciso@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico", extension: "2573", nombreBitacoras: "JOHANN ORLANDO ENCISO PARRA" },
  { nombre: "Jhon Jairo Pineda Gamba", correo: "jhon.pineda@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico", extension: "2580", nombreBitacoras: "JHON JAIRO PINEDA GAMBA" },
  { nombre: "Jaime Eugenio Herrera Bermeo", correo: "jaime.herrera.bermeo@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico", extension: "2589", nombreBitacoras: "JAIME EUGENIO HERRERA BERMEO" },
  { nombre: "Harold David Barragan Delgado", correo: "harold.barragan@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico", extension: "2618", nombreBitacoras: "HAROLD BARRAGAN" },
  { nombre: "Laura Catalina Vanegas Almeyda", correo: "laura.vanegas@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico", extension: "2510", nombreBitacoras: "LAURA VANEGAS" },
  { nombre: "Maria Fernanda Duarte Mape", correo: "maria.duarte@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico", extension: "2511", nombreBitacoras: "MARIA FERNANDA DUARTE MAPE" },
  { nombre: "Nicol Dallan Dominguez Carrasco", correo: "nicol.dominguez@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico", extension: "2612", nombreBitacoras: "NICOL DALLAN DOMINGUEZ CARRASCO" },
  { nombre: "Yuli Capera Acosta", correo: "yuli.capera@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico", extension: "2564", nombreBitacoras: "YULI CAPERA ACOSTA" },
  { nombre: "Johana Alexandra Arenas Molina", correo: "johana.arenas@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico", extension: "2505", nombreBitacoras: "JOHANA ALEXANDRA ARENAS MOLINA" },
  { nombre: "Alexandra Sanchez Saray", correo: "alexandra.sanchez@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico", extension: "2518", nombreBitacoras: "ALEXANDRA SANCHEZ SARAY" },
  { nombre: "Ingrid Johanna Lopez Carreño", correo: "ingrid.johanna.lopez@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico", extension: "2524", nombreBitacoras: "INGRID JOHANNA LOPEZ CARREÑO" },
  { nombre: "Gabriel Steven Arevalo Garcia", correo: "gabriel.arevalo@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico", extension: "2526", nombreBitacoras: "GABRIEL AREVALO" },
  { nombre: "Wilson Armando Contreras Sanchez", correo: "wilson.contreras@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico", extension: "2532", nombreBitacoras: "WILSON CONTRERAS" },
  { nombre: "Minta Rocio Barrera Sierra", correo: "minta.barrera@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico", extension: "2538", nombreBitacoras: "MINTA BARRERA" },
  { nombre: "Esmeralda Montealegre Murillo", correo: "esmeralda.montealegre@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico", extension: "2541", nombreBitacoras: "ESMERALDA MONTEALEGRE MURILLO" },
  { nombre: "Dolly Viviana Carranza Aguirre", correo: "dolly.carranza@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico", extension: "2565", nombreBitacoras: "DOLLY CARRANZA" },
  { nombre: "Angie Alexandra Forero Torres", correo: "angie.forero@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico", extension: "2566", nombreBitacoras: "ANGIE FORERO" },
  { nombre: "Angie Lorena Ladino Beltran", correo: "angie.ladino@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico", extension: "2592", nombreBitacoras: "ANGIE LORENA LADINO BELTRAN" },
  { nombre: "Olga Lucia Sarasti Leon", correo: "olga.sarasti@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico", extension: "2599", nombreBitacoras: "OLGA LUCIA SARASTI LEON" },
  { nombre: "Guendy Lorena Rodríguez Fuentes", correo: "guendy.rodriguez@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico", extension: "2601", nombreBitacoras: "GUENDY RODRIGUEZ FUENTES" },
  { nombre: "Erika Yineth Saavedra Torres", correo: "erika.saavedra@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico", extension: "2621", nombreBitacoras: "ERIKA SAAVEDRA" },
  { nombre: "Laura Vanessa Morales Pulido", correo: "laura.morales.1@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico", extension: "2639", nombreBitacoras: "LAURA VANESSA MORALES PULIDO" },
  { nombre: "Sandra Nayibe Gaitan Carranza", correo: "sandra.gaitan@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico", extension: "2657", nombreBitacoras: "SANDRA NAYIBE GAITAN CARRANZA" },
  { nombre: "Andres Mauricio Moreno Alvarez", correo: "andres.moreno@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico", extension: "2521", nombreBitacoras: "ANDRES MAURICIO MORENO ALVAREZ" },
  { nombre: "Maria Camila Millan Cadeno", correo: "maria.millan@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico", extension: "2593", nombreBitacoras: "MARIA CAMILA MILLAN CADENO" },
  { nombre: "Ginna Alejandra Perez Cifuentes", correo: "ginna.perez@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico", extension: "2596", nombreBitacoras: "GINNA ALEJANDRA PEREZ CIFUENTES" },
  { nombre: "Alexandra Mayorga Rivera", correo: "alexandra.mayorga@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico", extension: "2512", nombreBitacoras: "ALEXANDRA MAYORGA RIVERA" },
  { nombre: "Jeannette Andrea Alvarez Zabala", correo: "jeannette.alvarez.zabala@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico", extension: "2529", nombreBitacoras: "JEANNETTE ALVAREZ" },
  { nombre: "Angie Marcela Rincon Naranjo", correo: "angie.rincon@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico", extension: "2540", nombreBitacoras: "ANGIE MARCELA RINCON NARANJO" },
  { nombre: "Sergio Camilo Perez Hernandez", correo: "sergio.perez.hernandez@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico", extension: "2546", nombreBitacoras: "SERGIO CAMILO PEREZ HERNANDEZ" },
  { nombre: "Paula Camila Jimenez Campuzano", correo: "paula.jimenez.campuzano@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico", extension: "2557", nombreBitacoras: "PAULA CAMILA JIMENEZ CAMPUZANO" },
  { nombre: "Ana Catalina Avila Giraldo", correo: "ana.avila@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico", extension: "2561", nombreBitacoras: "ANA CATALINA AVILA GIRALDO" },
  { nombre: "Gloria Johanna Velandia Montenegro", correo: "johanna.velandia@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico", extension: "2563", nombreBitacoras: "GLORIA JOHANNA VELANDIA MONTENEGRO" },
  { nombre: "Jonh Erwin Lopez", correo: "jonh.lopez@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico", extension: "2567", nombreBitacoras: "JONH ERWIN LOPEZ" },
  { nombre: "Yadira Andrea Velandia Torres", correo: "yadira.velandia@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico", extension: "2570", nombreBitacoras: "YADIRA ANDREA VELANDIA TORRES" },
  { nombre: "Jeimy Andrea Benavides Florez", correo: "yeimy.benavides@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico", extension: "2575", nombreBitacoras: "JEIMY ANDREA BENAVIDES FLOREZ" },
  { nombre: "Maritza Pachon Pachon", correo: "maritza.pachon@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico", extension: "2551", nombreBitacoras: "MARITZA PACHON PACHON" },
  { nombre: "Angie Katherine Galvis Cancelado", correo: "angie.galvis@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico", extension: "2584", nombreBitacoras: "ANGIE KATHERINE GALVIS CANCELADO" },
  { nombre: "Yenifer Paola Diaz Rodriguez", correo: "yenifer.diaz@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico", extension: "2590", nombreBitacoras: "YENIFER PAOLA DIAZ RODRIGUEZ" },
  { nombre: "Michel Natalia Santana Tellez", correo: "michel.santana@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico", extension: "2611", nombreBitacoras: "MICHEL NATALIA SANTANA TELLEZ" },
  { nombre: "Leidy Lline Soriano Herrera", correo: "leidy.soriano@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico", extension: "2627", nombreBitacoras: "LEIDY LLINE SORIANO HERRERA" },
  { nombre: "Angie Lorena Orozco Duque", correo: "angie.orozco@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico", extension: "2646", nombreBitacoras: "ANGIE LORENA OROZCO DUQUE" },
  { nombre: "Andres Felipe Sandoval Rodriguez", correo: "andres.sandoval@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico", extension: "2501", nombreBitacoras: "ANDRES SANDOVAL" },
  { nombre: "Angie Paola Alba Rivera", correo: "angie.alba@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico", extension: "2598", nombreBitacoras: "ANGIE PAOLA ALBA RIVERA" },
  { nombre: "Diana Emilse Ortiz Orozco", correo: "diana.ortiz@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico", extension: "2553", nombreBitacoras: "DIANA EMILSE ORTIZ OROZCO" },
  { nombre: "Cyntia Dayanna Gomez Contreras", correo: "cyntia.gomez@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados", extension: "2531", nombreBitacoras: "CYNTIA DAYANNA GOMEZ CONTRERAS" },
  { nombre: "Lady Andrea Garcia Ariza", correo: "lady.garcia@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados", extension: "2514", nombreBitacoras: "LADY ANDREA GARCIA ARIZA" },
  { nombre: "Maria Fernanda Palacios Rodriguez", correo: "maria.palacios@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados", extension: "2554", nombreBitacoras: "MARIA FERNANDA PALACIOS RODRIGUEZ" },
  { nombre: "Laura Marcela Daza Varela", correo: "laura.daza@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados", extension: "2604", nombreBitacoras: "LAURA MARCELA DAZA VARELA" },
  { nombre: "Maira Alejandra Cepeda Montealegre", correo: "maira.cepeda.montealegre@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados", extension: "2607", nombreBitacoras: "MAIRA ALEJANDRA CEPEDA MONTEALEGRE" },
  { nombre: "Mayra Alejandra Rangel Perez", correo: "mayra.rangel@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados", extension: "2608", nombreBitacoras: "MAYRA ALEJANDRA RANGEL PEREZ" },
  { nombre: "Zaida Lizeth Lopez Mariño", correo: "zaida.lopez@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados", extension: "2609", nombreBitacoras: "ZAIDA LIZETH LOPEZ MARIÑO" },
  { nombre: "Silvia Janneth Zocadagui Estupiñan", correo: "silvia.zocadagui@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados", extension: "2613", nombreBitacoras: "SILVIA JANNETH ZOCADAGUI ESTUPIAN" },
  { nombre: "Brenda Bibiana Ardila Cruz", correo: "brenda.ardila@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados", extension: "2614", nombreBitacoras: "BRENDA ARDILA" },
  { nombre: "Leydy Johanna Carballo Romero", correo: "leydy.carballo@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados", extension: "2615", nombreBitacoras: "LEYDY JOHANNA CARBALLO ROMERO" },
  { nombre: "Anyi Paola Urrea Saenz", correo: "anyi.urrea@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados", extension: "2616", nombreBitacoras: "ANYI URREA" },
  { nombre: "Diana Milena Casallas Macias", correo: "diana.casallas@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados", extension: "2620", nombreBitacoras: "DIANA CASALLAS" },
  { nombre: "Cindy Tatiana Ramirez Chavez", correo: "cindy.ramirez@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados", extension: "2626", nombreBitacoras: "CINDY TATIANA RAMIREZ CHAVEZ" },
  { nombre: "Diana Elizabeth De La Cuadra Garcia", correo: "diana.delacuadra@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados", extension: "2631", nombreBitacoras: "DIANA ELIZABETH DE LA CUADRA GARCIA" },
  { nombre: "Ruiz Velasco Julieth Estefania", correo: "julieth.ruiz@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados", extension: "2650", nombreBitacoras: "JULIETH RUIZ" },
  { nombre: "Camila Villada Vera", correo: "camila.villada@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados", extension: "2653", nombreBitacoras: "MARIA CAMILA VILLADA VERA" },
  { nombre: "Heidy Yohana Londoño Castrillon", correo: "heidy.londono@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados", extension: "2577", nombreBitacoras: "HEIDY YOHANA LONDOÑO CASTRILLON" },
  { nombre: "Daniela Ramirez Piñeros", correo: "daniela.ramirez@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma", cartera: "Cuotas al día Copropiedades", extension: "2602", nombreBitacoras: "DANIELA RAMIREZ" },
  { nombre: "Yulieth Paola Ladino Castro", correo: "yulieth.ladino@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma", cartera: "Cuotas al día Copropiedades", extension: "2597", nombreBitacoras: "YULIETH LADINO" },
  { nombre: "Jeslly Faviara Mejia Porras", correo: "jeslly.mejia@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma", cartera: "Cuotas al día", extension: "2585", nombreBitacoras: "JESLLY FAVIARA MEJIA PORRAS" },
  { nombre: "Yesica Neyid Capera Verjan", correo: "yesica.capera@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma", cartera: "Cuotas al día", extension: "2659", nombreBitacoras: "YESICA NEYID CAPERA VERJAN" },
  { nombre: "Andrea Paola Vargas Arias", correo: "andrea.vargas.arias@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma", cartera: "Cuotas al día", extension: "2660", nombreBitacoras: "ANDREA PAOLA VARGAS ARIAS" },
  { nombre: "Carlos Steven Torres Vallejo", correo: "carlos.torres.vallejo@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma", cartera: "Cuotas al día", extension: "2662", nombreBitacoras: "CARLOS STIVEN TORRES VALLEJO" },
  { nombre: "Jennifer Andrea Garcia Sanchez", correo: "jennifer.andrea.garcia@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma", cartera: "Cuotas al día", extension: "2664", nombreBitacoras: "JENNIFER ANDREA GARCIA SANCHEZ" },
  { nombre: "Leidy Marcela Jimenez Barrera", correo: "leidy.jimenez.1@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma", cartera: "Cuotas al día", extension: "2522", nombreBitacoras: "LEIDY MARCELA JIMENEZ BARRERA" },
  { nombre: "Samary Alexandra Moreno Garcia", correo: "samary.alexandra.moreno@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma", cartera: "Cuotas al día", extension: "2624", nombreBitacoras: "SAMARY ALEXANDRA MORENO GARCIA" },
  { nombre: "Daniela Valentina Cabezas Correcha", correo: "daniela.cabezas@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma", cartera: "Cuotas al día", extension: "2603", nombreBitacoras: "DANIELA VALENTINA CABEZAS CORRECHA" },
  { nombre: "Jorge Andrés Avila Jimenez", correo: "jorge.avila@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma", cartera: "Cuotas al día", extension: "2666", nombreBitacoras: "JORGE ANDRÉS AVILA JIMENEZ" },
  { nombre: "Eduardo Alejandro Depablos Gutierrez", correo: "eduardo.depablos@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma", cartera: "Cuotas al día", extension: "2661", nombreBitacoras: "EDUARDO ALEJANDRO DEPABLOS GUTIERREZ" },
];
