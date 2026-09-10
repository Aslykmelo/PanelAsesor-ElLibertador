// Cliente de escritura para las APIs de Conversations (CCaaS) y People de
// Infobip — usado exclusivamente por el flujo "Redirigir a NGSO": busca la
// conversación y envía el mensaje de aviso al cliente por Conversations, y
// consulta/quita las etiquetas y el atributo de campaña del contacto por
// People (ahí es donde realmente viven, no en la conversación). Usa
// INFOBIP_API_KEY/INFOBIP_BASE_URL (variables de entorno — nunca
// hardcodeadas), con el header "Authorization: App <key>" que exige el
// esquema de "API key header" de Infobip. Solo se importa desde código de
// servidor (server.ts, api/index.ts) — nunca desde src/, para que la key no
// termine en el bundle del cliente.

function baseUrl(): string {
  const raw = process.env.INFOBIP_BASE_URL ?? "";
  const host = raw.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return `https://${host}`;
}

function requireApiKey(): string {
  const apiKey = process.env.INFOBIP_API_KEY;
  if (!apiKey || !process.env.INFOBIP_BASE_URL) {
    throw new Error("Falta configurar INFOBIP_API_KEY / INFOBIP_BASE_URL en el servidor");
  }
  return apiKey;
}

// Infobip aplica un límite de peticiones por segundo a nivel de cuenta —
// confirmado en producción: con solo 40 búsquedas simultáneas, la mitad
// volvió 429 "Too Many Requests" (no es cosa nuestra, es el límite de
// Infobip). En vez de fallarle al asesor, se reintenta unas pocas veces con
// espera creciente antes de rendirse.
const MAX_RETRIES_ON_429 = 3;
const RETRY_BASE_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchInfobipWithRetry(url: string, init: RequestInit, apiKey: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `App ${apiKey}`,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers || {}),
      },
    });
    if (res.status !== 429 || attempt >= MAX_RETRIES_ON_429) return res;
    await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt + Math.random() * 200);
  }
}

async function infobipFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiKey = requireApiKey();
  const res = await fetchInfobipWithRetry(`${baseUrl()}${path}`, init, apiKey);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Infobip ${init.method || "GET"} ${path} respondió ${res.status}${body ? `: ${body}` : ""}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Las etiquetas de asesor/compañía (p. ej. "ASESOR135_HEIDY.MEDINA") no viven
// en la conversación de CCaaS sino en el perfil del contacto en el módulo
// "People" de Infobip — confirmado viendo el perfil real en el portal. El
// contacto se identifica por el teléfono del último mensaje entrante de la
// conversación (mismo número que aparece en "contactInformation.phone" del
// perfil de People).
export type InfobipPerson = {
  id: number;
  firstName?: string;
  tags: string[];
  customAttributes: Record<string, unknown>;
  contactInformation?: { phone?: { number: string; isPrimary?: boolean }[] };
};

// Junto con la etiqueta, el perfil trae un atributo personalizado que
// duplica el mismo valor — se vacía al redirigir, igual que la etiqueta.
const CAMPAIGN_ATTRIBUTE = "Agente_campaña";

export async function getPersonByPhone(phone: string): Promise<InfobipPerson | null> {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const apiKey = requireApiKey();
  const res = await fetchInfobipWithRetry(
    `${baseUrl()}/people/2/persons?identifier=${encodeURIComponent(digits)}&type=PHONE`,
    {},
    apiKey
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Infobip GET /people/2/persons respondió ${res.status}${body ? `: ${body}` : ""}`);
  }
  return res.json() as Promise<InfobipPerson>;
}

// Quita una etiqueta puntual del contacto (no borra la etiqueta del catálogo
// global ni afecta otros contactos que también la tengan).
export async function removePersonTag(personId: number, tagName: string): Promise<void> {
  await infobipFetch(`/people/2/tags/${encodeURIComponent(tagName)}/persons`, {
    method: "DELETE",
    body: JSON.stringify({ people: [{ query: { type: "ID", identifier: String(personId) } }] }),
  });
}

export async function clearCampaignAttribute(personId: number): Promise<void> {
  await infobipFetch(`/people/2/persons?identifier=${personId}&type=ID`, {
    method: "PATCH",
    body: JSON.stringify({ customAttributes: { [CAMPAIGN_ATTRIBUTE]: "" } }),
  });
}

// Perfiles de People cuyo nombre incluye el número de solicitud (Infobip
// nombra el contacto como "<solicitud> <nombre> <rol>", p. ej. "10946175
// NESTOR ALEXANDER CASANOVA PEÑA Codeudor") — un mismo caso puede tener
// varios (deudor, codeudor(es), arrendador...), cada uno con su propio
// contacto y su propia conversación.
export async function getPersonsByRequestNumber(requestNumber: string): Promise<InfobipPerson[]> {
  const filter = JSON.stringify({ "#contains": { firstName: requestNumber } });
  const data = await infobipFetch<{ persons: InfobipPerson[] }>(
    `/people/2/persons?filter=${encodeURIComponent(filter)}&limit=50`
  );
  return data.persons ?? [];
}

export type ConversationContactTags = {
  personId: number | null;
  tags: string[];
  campaignAgent: string | null;
};

// Etiquetas y atributo de campaña del contacto asociado a esta conversación
// (para que el asesor vea/elija qué quitar antes de redirigir).
export async function getConversationContactTags(conversationId: string): Promise<ConversationContactTags> {
  const lastInbound = await getLastInboundMessage(conversationId);
  if (!lastInbound) return { personId: null, tags: [], campaignAgent: null };
  const person = await getPersonByPhone(lastInbound.from);
  const campaignAgent = person?.customAttributes?.[CAMPAIGN_ATTRIBUTE];
  return {
    personId: person?.id ?? null,
    tags: person?.tags ?? [],
    campaignAgent: typeof campaignAgent === "string" && campaignAgent.trim() ? campaignAgent : null,
  };
}

export type InfobipMessage = {
  id: string;
  from: string;
  to: string;
  channel: string;
  direction: "INBOUND" | "OUTBOUND";
  contentType: string;
  createdAt: string;
};

// El endpoint de "Create message" exige from/to/channel explícitos — no los
// infiere solo del conversationId. Los sacamos del último mensaje entrante
// del cliente: para responderle, from/to quedan invertidos respecto a ese
// mensaje, y se usa el mismo canal por el que escribió.
export async function getLastInboundMessage(conversationId: string): Promise<InfobipMessage | null> {
  const data = await infobipFetch<{ messages: InfobipMessage[] }>(
    `/ccaas/1/conversations/${encodeURIComponent(conversationId)}/messages?direction=INBOUND&limit=1&orderBy=createdAt:desc`
  );
  return data.messages?.[0] ?? null;
}

// Infobip exige saber qué agente firma el mensaje cuando la conversación
// está asignada a alguien ("x-agent-id"); si no se manda, responde 400
// aunque from/to/channel estén bien. Se usa el agente ya asignado a la
// conversación (consultado en el momento, no el que se vio al buscar —
// puede haber cambiado).
async function getConversationAgentId(conversationId: string): Promise<string | null> {
  const data = await infobipFetch<{ agentId: string | null }>(
    `/ccaas/1/conversations/${encodeURIComponent(conversationId)}`
  );
  return data.agentId ?? null;
}

async function sendMessageUsingInbound(
  conversationId: string,
  lastInbound: InfobipMessage,
  text: string,
  agentId: string | null
): Promise<void> {
  await infobipFetch(`/ccaas/1/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: "POST",
    headers: agentId ? { "x-agent-id": agentId } : undefined,
    body: JSON.stringify({
      from: lastInbound.to,
      to: lastInbound.from,
      channel: lastInbound.channel,
      contentType: "TEXT",
      content: { text },
    }),
  });
}

export type InfobipConversationSummary = {
  id: string;
  status: string;
  agentId: string | null;
  contactName: string | null;
};

type RawConversation = { id: string; status: string; agentId: string | null };

async function listConversationsByStatus(status: "OPEN" | "WAITING"): Promise<RawConversation[]> {
  const out: RawConversation[] = [];
  for (let page = 0; ; page++) {
    const data = await infobipFetch<{
      conversations: RawConversation[];
      pagination: { totalItems: number };
    }>(`/ccaas/1/conversations?status=${status}&limit=999&page=${page}`);
    out.push(...data.conversations);
    if (data.conversations.length === 0 || out.length >= data.pagination.totalItems) break;
  }
  return out;
}

// El "topic" de la conversación (campo de CCaaS) no lo está usando esta
// cuenta — siempre viene null — así que no sirve para identificar el caso.
// El nombre del contacto en People sí trae el número de solicitud (p. ej.
// "10946175 NESTOR ALEXANDER CASANOVA PEÑA Codeudor"), y un mismo caso puede
// tener varios contactos (deudor, codeudor(es), arrendador...), cada uno con
// su propia conversación. Como CCaaS no permite filtrar conversaciones por
// contacto/teléfono, primero se busca en People por el número de solicitud
// y luego se cruza cada contacto encontrado contra las conversaciones
// activas (OPEN/WAITING) comparando el teléfono del último mensaje entrante
// de cada una — en lotes, para no disparar cientos de llamadas a la vez.
export async function findConversationsByRequestNumber(
  requestNumber: string
): Promise<InfobipConversationSummary[]> {
  const needle = requestNumber.trim();
  if (!needle) return [];

  const persons = await getPersonsByRequestNumber(needle);
  if (persons.length === 0) return [];

  const phoneToPerson = new Map<string, InfobipPerson>();
  for (const person of persons) {
    for (const phone of person.contactInformation?.phone ?? []) {
      phoneToPerson.set(phone.number.replace(/\D/g, ""), person);
    }
  }
  if (phoneToPerson.size === 0) return [];

  const [open, waiting] = await Promise.all([
    listConversationsByStatus("OPEN"),
    listConversationsByStatus("WAITING"),
  ]);
  const seen = new Set<string>();
  const candidates = [...open, ...waiting].filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  const matches: InfobipConversationSummary[] = [];
  const BATCH_SIZE = 15;
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (c): Promise<InfobipConversationSummary | null> => {
        const lastInbound = await getLastInboundMessage(c.id).catch(() => null);
        if (!lastInbound) return null;
        const person = phoneToPerson.get(lastInbound.from.replace(/\D/g, ""));
        if (!person) return null;
        return { id: c.id, status: c.status, agentId: c.agentId, contactName: person.firstName ?? null };
      })
    );
    matches.push(...batchResults.filter((m): m is InfobipConversationSummary => m !== null));
  }
  return matches;
}

// Busca el agente de CCaaS por correo (filtro exacto de la API). No todos
// los agentes tienen el correo poblado en Infobip (confirmado con un caso
// real que sí tiene conversaciones abiertas pero no aparece por email), así
// que si no hay resultado se cae a buscar por nombre con "displayName"
// (substring, insensible a mayúsculas) — el nombre completo del asesor
// siempre queda dentro de ese campo, aunque venga con un código y a veces la
// cédula pegados, p. ej. "5YM ALEXANDRA SANCHEZ SARAY-1010208898".
async function getAgentByEmail(email: string): Promise<{ id: string } | null> {
  const data = await infobipFetch<{ agents: { id: string }[] }>(
    `/ccaas/1/agents?email=${encodeURIComponent(email)}&limit=1`
  );
  return data.agents?.[0] ?? null;
}

async function getAgentByName(name: string): Promise<{ id: string } | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const data = await infobipFetch<{ agents: { id: string }[] }>(
    `/ccaas/1/agents?displayName=${encodeURIComponent(trimmed)}&limit=1`
  );
  return data.agents?.[0] ?? null;
}

async function countConversationsByStatus(
  agentId: string,
  status: "OPEN" | "WAITING" | "CLOSED",
  extraQuery: string = ""
): Promise<number> {
  const data = await infobipFetch<{ pagination: { totalItems: number } }>(
    `/ccaas/1/conversations?agentId=${encodeURIComponent(agentId)}&status=${status}&limit=1&page=0${extraQuery}`
  );
  return data.pagination.totalItems;
}

// Colombia no tiene horario de verano (UTC-5 fijo todo el año), así que
// basta con restar 5 horas a la hora del servidor (Vercel corre en UTC)
// para saber qué día es "hoy" en Bogotá — sin esto, "cerradas hoy" quedaría
// desfasado 5 horas respecto al día real del asesor.
function bogotaStartOfDayIso(): string {
  const bogota = new Date(Date.now() - 5 * 60 * 60 * 1000);
  const y = bogota.getUTCFullYear();
  const m = String(bogota.getUTCMonth() + 1).padStart(2, "0");
  const d = String(bogota.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}T00:00:00.000-0500`;
}

export type MyConversationStats = { active: number; closedToday: number };

// Conversaciones que este asesor tiene abiertas ahora mismo (OPEN + WAITING)
// y las que ha cerrado hoy (CLOSED, desde medianoche hora de Bogotá) —
// usado en su perfil/tablero para mostrar la carga y el avance del día.
// Devuelve ceros si no se encuentra ningún agente de CCaaS (en vez de
// fallar), ya que no todos los usuarios de la app tienen agente en Infobip.
export async function getMyConversationStats(email: string, name: string): Promise<MyConversationStats> {
  const agent = (await getAgentByEmail(email)) ?? (await getAgentByName(name));
  if (!agent) return { active: 0, closedToday: 0 };
  const closedAfter = encodeURIComponent(bogotaStartOfDayIso());
  const [open, waiting, closedToday] = await Promise.all([
    countConversationsByStatus(agent.id, "OPEN"),
    countConversationsByStatus(agent.id, "WAITING"),
    countConversationsByStatus(agent.id, "CLOSED", `&closedAfter=${closedAfter}`),
  ]);
  return { active: open + waiting, closedToday };
}

export type TagRemovalResult = { tag: string; ok: boolean; error?: string };
export type ConversationRedirectResult = {
  conversationId: string;
  ok: boolean;
  error?: string;
  tagResults?: TagRemovalResult[];
};

// Flujo completo de "Redirigir a NGSO" para un lote de conversaciones (todas
// las que pertenezcan a la misma solicitud). Por cada conversación: primero
// avisa al cliente (si esto falla, no se toca su perfil — no tiene sentido
// quitarle las etiquetas de asesor si el cliente nunca se enteró del cambio)
// y luego, en el contacto de People asociado, quita solo las etiquetas
// seleccionadas que realmente tiene puestas y vacía el atributo
// "Agente_campaña". Una conversación fallida no detiene el resto del lote.
export async function redirectConversationsToNgso(
  conversationIds: string[],
  message: string,
  tagNamesToRemove: string[]
): Promise<ConversationRedirectResult[]> {
  const results: ConversationRedirectResult[] = [];

  for (const conversationId of conversationIds) {
    try {
      const [lastInbound, agentId] = await Promise.all([
        getLastInboundMessage(conversationId),
        getConversationAgentId(conversationId),
      ]);
      if (!lastInbound) {
        throw new Error(
          "No se encontró un mensaje entrante del cliente en esta conversación; no fue posible determinar a quién responder."
        );
      }
      await sendMessageUsingInbound(conversationId, lastInbound, message, agentId);

      const tagResults: TagRemovalResult[] = [];
      const person = await getPersonByPhone(lastInbound.from);
      if (person) {
        const currentTags = new Set(person.tags);
        for (const tagName of tagNamesToRemove) {
          if (!currentTags.has(tagName)) continue; // este contacto no tiene esa etiqueta puesta
          try {
            await removePersonTag(person.id, tagName);
            tagResults.push({ tag: tagName, ok: true });
          } catch (e: any) {
            tagResults.push({ tag: tagName, ok: false, error: e?.message || "Error desconocido" });
          }
        }
        try {
          await clearCampaignAttribute(person.id);
        } catch (e: any) {
          tagResults.push({ tag: CAMPAIGN_ATTRIBUTE, ok: false, error: e?.message || "Error desconocido" });
        }
      }

      results.push({ conversationId, ok: true, tagResults });
    } catch (e: any) {
      results.push({ conversationId, ok: false, error: e?.message || "Error desconocido" });
    }
  }

  return results;
}
