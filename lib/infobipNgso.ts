// Cliente de escritura para la API de Conversations (CCaaS) de Infobip —
// usado exclusivamente por el flujo "Redirigir a NGSO": consulta las
// etiquetas de una conversación, quita las que el asesor marque, y envía el
// mensaje de aviso al cliente. Usa INFOBIP_API_KEY/INFOBIP_BASE_URL
// (variables de entorno — nunca hardcodeadas), con el header
// "Authorization: App <key>" que exige el esquema de "API key header" de
// Infobip. Solo se importa desde código de servidor (server.ts, api/index.ts)
// — nunca desde src/, para que la key no termine en el bundle del cliente.

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

async function infobipFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiKey = requireApiKey();
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `App ${apiKey}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Infobip ${init.method || "GET"} ${path} respondió ${res.status}${body ? `: ${body}` : ""}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type InfobipTag = { id: string; name: string };

// Etiquetas actualmente puestas en una conversación puntual (no el catálogo
// global de etiquetas de la cuenta).
export async function getConversationTags(conversationId: string): Promise<InfobipTag[]> {
  const data = await infobipFetch<{ tags: InfobipTag[] }>(
    `/ccaas/1/tags?conversationId=${encodeURIComponent(conversationId)}&limit=200`
  );
  return data.tags ?? [];
}

// Quita una etiqueta puntual de la conversación (no borra la etiqueta del
// catálogo global ni afecta otras conversaciones que también la tengan).
export async function removeConversationTag(conversationId: string, tagName: string): Promise<void> {
  await infobipFetch(
    `/ccaas/1/conversations/${encodeURIComponent(conversationId)}/tags/${encodeURIComponent(tagName)}`,
    { method: "DELETE" }
  );
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

export async function sendConversationTextMessage(conversationId: string, text: string): Promise<void> {
  const lastInbound = await getLastInboundMessage(conversationId);
  if (!lastInbound) {
    throw new Error(
      "No se encontró un mensaje entrante del cliente en esta conversación; no fue posible determinar a quién responder."
    );
  }
  await infobipFetch(`/ccaas/1/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: "POST",
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
  topic: string | null;
  status: string;
  agentId: string | null;
};

async function listConversationsByStatus(status: "OPEN" | "WAITING"): Promise<InfobipConversationSummary[]> {
  const out: InfobipConversationSummary[] = [];
  for (let page = 0; ; page++) {
    const data = await infobipFetch<{
      conversations: InfobipConversationSummary[];
      pagination: { totalItems: number };
    }>(`/ccaas/1/conversations?status=${status}&limit=999&page=${page}`);
    out.push(...data.conversations);
    if (data.conversations.length === 0 || out.length >= data.pagination.totalItems) break;
  }
  return out;
}

// Infobip no permite buscar conversaciones por texto libre — no hay filtro
// de "topic" en el listado (ver docs de Get conversations). Los asesores
// identifican el caso por el número de solicitud que aparece dentro del
// tópico de la conversación en la interfaz de Infobip (p. ej. "Hablando con
// 11898285 Juan Pérez Arrendatario"), y como un mismo número de solicitud
// puede tener varias conversaciones abiertas a la vez (llamada + WhatsApp,
// hilos reabiertos, etc.), se listan todas las conversaciones activas
// (OPEN/WAITING) y se filtra del lado del servidor por ese número.
export async function findConversationsByRequestNumber(
  requestNumber: string
): Promise<InfobipConversationSummary[]> {
  const needle = requestNumber.trim();
  if (!needle) return [];

  const [open, waiting] = await Promise.all([
    listConversationsByStatus("OPEN"),
    listConversationsByStatus("WAITING"),
  ]);

  const seen = new Set<string>();
  return [...open, ...waiting].filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return (c.topic || "").includes(needle);
  });
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
// avisa al cliente (si esto falla, no se tocan sus etiquetas — no tiene
// sentido dejarla sin etiquetas de asesor si el cliente nunca se enteró del
// cambio) y luego quita, una por una, solo las etiquetas seleccionadas que
// esa conversación realmente tiene puestas. Una conversación fallida no
// detiene el resto del lote.
export async function redirectConversationsToNgso(
  conversationIds: string[],
  message: string,
  tagNamesToRemove: string[]
): Promise<ConversationRedirectResult[]> {
  const results: ConversationRedirectResult[] = [];

  for (const conversationId of conversationIds) {
    try {
      await sendConversationTextMessage(conversationId, message);

      const currentTags = await getConversationTags(conversationId);
      const currentNames = new Set(currentTags.map((t) => t.name));

      const tagResults: TagRemovalResult[] = [];
      for (const tagName of tagNamesToRemove) {
        if (!currentNames.has(tagName)) continue; // esta conversación no tiene esa etiqueta puesta
        try {
          await removeConversationTag(conversationId, tagName);
          tagResults.push({ tag: tagName, ok: true });
        } catch (e: any) {
          tagResults.push({ tag: tagName, ok: false, error: e?.message || "Error desconocido" });
        }
      }

      results.push({ conversationId, ok: true, tagResults });
    } catch (e: any) {
      results.push({ conversationId, ok: false, error: e?.message || "Error desconocido" });
    }
  }

  return results;
}
