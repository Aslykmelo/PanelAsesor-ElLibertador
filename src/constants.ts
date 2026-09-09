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

// Únicos correos del equipo Controller que pueden subir el CSV de totales de
// llamadas por asesor, sin importar su rol.
export const CONTROLLER_EMAILS = [
  'helen.pantoja@segurosbolivar.com',
  'sergio.llanos@segurosbolivar.com',
  'luis.padilla@segurosbolivar.com',
  'doris.benavides@segurosbolivar.com'
];

export interface Advisor {
  nombre: string;
  correo: string;
  correo_supervisor: string;
  supervisor: string;
  cartera: string;
}

export const ADVISORS: Advisor[] = [
  { nombre: "Estrella Ramirez Barreto", correo: "estrella.ramirez@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico" },
  { nombre: "Dora Marlen Molina Camargo", correo: "dora.molina@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico" },
  { nombre: "Deisy Alexandra Higuera Diaz", correo: "deisy.alexandra.higuera@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico" },
  { nombre: "Jeniffer Alexandra Riveros Pineda", correo: "jeniffer.riveros@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico" },
  { nombre: "Leidy Natalia Zorro Velandia", correo: "leidy.zorro.velandia@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico" },
  { nombre: "Luis Eduardo Meriño Escorcia", correo: "luis.merino@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico" },
  { nombre: "Luz Helena Rodriguez Infante", correo: "luz.rodriguez.infante@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico" },
  { nombre: "Maria Fernanda Patiño Camacho", correo: "maria.patino@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico" },
  { nombre: "Maria Angelica Baquero Triana", correo: "maria.baquero@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico" },
  { nombre: "Felipe Antonio Barrero Cortes", correo: "felipe.barrero@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico" },
  { nombre: "Juliana Catalina Padilla Mesa", correo: "juliana.padilla@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico" },
  { nombre: "Johann Orlando Enciso Parra", correo: "johann.enciso@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico" },
  { nombre: "Jhon Jairo Pineda Gamba", correo: "jhon.pineda@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico" },
  { nombre: "Carmen Virginia Liliana Manrique Pabon", correo: "carmen.manrique@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico" },
  { nombre: "Jaime Eugenio Herrera Bermeo", correo: "jaime.herrera.bermeo@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico" },
  { nombre: "Diana Carolina Arias Mosquera", correo: "diana.arias.mosquera@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico" },
  { nombre: "Harold David Barragan Delgado", correo: "harold.barragan@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico" },
  { nombre: "Laura Catalina Vanegas Almeyda", correo: "laura.vanegas@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico" },
  { nombre: "Johana Alexandra Arenas Molina", correo: "johana.arenas@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico" },
  { nombre: "Alexandra Sanchez Saray", correo: "alexandra.sanchez@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico" },
  { nombre: "Ingrid Johanna Lopez Carreño", correo: "ingrid.johanna.lopez@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico" },
  { nombre: "Gabriel Steven Arevalo Garcia", correo: "gabriel.arevalo@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico" },
  { nombre: "Jennifer Rocio Castro Torres", correo: "jennifer.castro@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico" },
  { nombre: "Wilson Armando Contreras Sanchez", correo: "wilson.contreras@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico" },
  { nombre: "Minta Rocio Barrera Sierra", correo: "minta.barrera@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico" },
  { nombre: "Esmeralda Montealegre Murillo", correo: "esmeralda.montealegre@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico" },
  { nombre: "Dolly Viviana Carranza Aguirre", correo: "dolly.carranza@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico" },
  { nombre: "Angie Alexandra Forero Torres", correo: "angie.forero@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico" },
  { nombre: "Angie Lorena Ladino Beltran", correo: "angie.ladino@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico" },
  { nombre: "Olga Lucia Sarasti Leon", correo: "olga.sarasti@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico" },
  { nombre: "Guendy Lorena Rodríguez Fuentes", correo: "guendy.rodriguez@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico" },
  { nombre: "Erika Yineth Saavedra Torres", correo: "erika.saavedra@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico" },
  { nombre: "Laura Vanessa Morales Pulido", correo: "laura.morales.1@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico" },
  { nombre: "Sandra Nayibe Gaitan Carranza", correo: "Sandra.gaitan@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico" },
  { nombre: "Yuli Maritza Beltran Ibañez", correo: "yuli.beltran@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico" },
  { nombre: "Laura Vaneza Medellin Rincon", correo: "laura.medellin@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico" },
  { nombre: "Andres Mauricio Moreno Alvarez", correo: "andres.moreno@segurosbolivar.com", correo_supervisor: "yulieth.moreno@segurosbolivar.com", supervisor: "Yulieth Moreno", cartera: "Pre Jurídico" },
  { nombre: "Alexandra Mayorga Rivera", correo: "alexandra.mayorga@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico" },
  { nombre: "Lady Andrea Garcia Ariza", correo: "lady.garcia@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico" },
  { nombre: "Jeannette Andrea Alvarez Zabala", correo: "jeannette.alvarez.zabala@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico" },
  { nombre: "Angie Marcela Rincon Naranjo", correo: "angie.rincon@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico" },
  { nombre: "Sergio Camilo Perez Hernandez", correo: "sergio.perez.hernandez@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico" },
  { nombre: "Ronald Garcia Padilla", correo: "ronald.garcia@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico" },
  { nombre: "Maritza Pachon Pachon", correo: "maritza.pachon@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico" },
  { nombre: "Paula Camila Jimenez Campuzano", correo: "paula.jimenez.campuzano@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico" },
  { nombre: "Ana Catalina Avila Giraldo", correo: "ana.avila@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico" },
  { nombre: "Gloria Johanna Velandia Montenegro", correo: "johanna.velandia@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico" },
  { nombre: "Jonh Erwin Lopez", correo: "jonh.lopez@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico" },
  { nombre: "Yadira Andrea Velandia Torres", correo: "yadira.velandia@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico" },
  { nombre: "Jeimy Andrea Benavides Florez", correo: "yeimy.benavides@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico" },
  { nombre: "Angie Katherine Galvis Cancelado", correo: "angie.galvis@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico" },
  { nombre: "Yenifer Paola Diaz Rodriguez", correo: "yenifer.diaz@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico" },
  { nombre: "Yeimer Enrique Palmera Calvo", correo: "yeimer.palmera@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico" },
  { nombre: "Michel Natalia Santana Tellez", correo: "michel.santana@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico" },
  { nombre: "Leidy Lline Soriano Herrera", correo: "leidy.soriano@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico" },
  { nombre: "Angie Lorena Orozco Duque", correo: "angie.orozco@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico" },
  { nombre: "Andres Felipe Sandoval Rodriguez", correo: "andres.sandoval@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico" },
  { nombre: "Angie Paola Alba Rivera", correo: "angie.alba@segurosbolivar.com", correo_supervisor: "ana.gutierrez@segurosbolivar.com", supervisor: "Ana María Gutiérrez", cartera: "Jurídico" },
  { nombre: "Cyntia Dayanna Gomez Contreras", correo: "cyntia.gomez@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados" },
  { nombre: "Diana Emilse Ortiz Orozco", correo: "diana.ortiz@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados" },
  { nombre: "Maria Fernanda Palacios Rodriguez", correo: "maria.palacios@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados" },
  { nombre: "Laura Marcela Daza Varela", correo: "laura.daza@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados" },
  { nombre: "Maira Alejandra Cepeda Montealegre", correo: "maira.cepeda.montealegre@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados" },
  { nombre: "Mayra Alejandra Rangel Perez", correo: "mayra.rangel@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados" },
  { nombre: "Zaida Lizeth Lopez Mariño", correo: "zaida.lopez@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados" },
  { nombre: "Silvia Janneth Zocadagui Estupiñan", correo: "Silvia.zocadagui@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados" },
  { nombre: "Brenda Bibiana Ardila Cruz", correo: "brenda.ardila@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados" },
  { nombre: "Leydy Johanna Carballo Romero", correo: "leydy.carballo@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados" },
  { nombre: "Anyi Paola Urrea Saenz", correo: "anyi.urrea@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados" },
  { nombre: "Nayibe Tatiana Lara Garzon", correo: "nayibe.lara@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados" },
  { nombre: "Diana Milena Casallas Macias", correo: "diana.casallas@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados" },
  { nombre: "Cindy Tatiana Ramirez Chavez", correo: "cindy.ramirez@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados" },
  { nombre: "Diana Elizabeth De La Cuadra Garcia", correo: "diana.delacuadra@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados" },
  { nombre: "Ruiz Velasco Julieth Estefania", correo: "julieth.ruiz@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados" },
  { nombre: "Camila Villada Vera", correo: "camila.villada@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados" },
  { nombre: "Heidy Julieth Medina Bustos", correo: "heidy.medina@segurosbolivar.com", correo_supervisor: "mabel.elizabeth.andrade@segurosbolivar.com", supervisor: "Mabel Andrade", cartera: "Desocupados" },
  { nombre: "Heidy Yohana Londoño Castrillon", correo: "heidy.londono@segurosbolivar.com", correo_supervisor: "luis.mondragon@segurosbolivar.com", supervisor: "Luis Alejandro González", cartera: "Pre Jurídico" },
  { nombre: "Liz Valeria Solano Lopez", correo: "liz.solano@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma Copropiedades", cartera: "Cuotas al día Copropiedades" },
  { nombre: "Tamara Ochoa Valencia", correo: "tamara.valencia@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma Copropiedades", cartera: "Cuotas al día Copropiedades" },
  { nombre: "Daniela Ramirez Piñeros", correo: "daniela.ramirez@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma Copropiedades", cartera: "Cuotas al día Copropiedades" },
  { nombre: "Yulieth Paola Ladino Castro", correo: "yulieth.ladino@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma Copropiedades", cartera: "Cuotas al día Copropiedades" },
  { nombre: "Maria Lorena Zuluaga", correo: "maria.zuluaga@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma", cartera: "Cuotas al día" },
  { nombre: "Maria Esther Herrera", correo: "maria.herrera@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma", cartera: "Cuotas al día" },
  { nombre: "Jeslly Faviara Mejia Porras", correo: "jeslly.mejia@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma", cartera: "Cuotas al día" },
  { nombre: "Camilo Andres Otavo Duran", correo: "camilo.otavo@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma", cartera: "Cuotas al día" },
  { nombre: "Nayim Viviana Díaz López", correo: "nayim.díaz@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma", cartera: "Cuotas al día" },
  { nombre: "Angie Natalia Montañez Morales", correo: "angi.montanez@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma", cartera: "Cuotas al día" },
  { nombre: "Willinton Fabian Mosquera Rodriguez", correo: "willinton.mosquera@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma", cartera: "Cuotas al día" },
  { nombre: "Yesica Neyid Capera Verjan", correo: "yesica.capera@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma", cartera: "Cuotas al día" },
  { nombre: "Andrea Paola Vargas Arias", correo: "andrea.vargas.arias@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma", cartera: "Cuotas al día" },
  { nombre: "Carlos Steven Torres Vallejo", correo: "carlos.torres.vallejo@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma", cartera: "Cuotas al día" },
  { nombre: "Jennifer Andrea Garcia Sanchez", correo: "jennifer.garcia@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma", cartera: "Cuotas al día" },
  { nombre: "Leidy Marcela Jimenez Barrera", correo: "leidy.jimenez.barrera@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma", cartera: "Cuotas al día" },
  { nombre: "Samary Alexandra Moreno Garcia", correo: "samary.moreno@segurosbolivar.com", correo_supervisor: "lizeth.osma@segurosbolivar.com", supervisor: "Lizeth Osma", cartera: "Cuotas al día" },
  { nombre: "Taliana Moreno Guzman", correo: "taliana.moreno@segurosbolivar.com", correo_supervisor: "juliana.garcia@segurosbolivar.com", supervisor: "Juliana Garcia", cartera: "Cartera Administrativa" }
];
