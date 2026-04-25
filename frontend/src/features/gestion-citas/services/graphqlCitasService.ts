/**
 * OmniCitas — Conector GraphQL/HTTP (READ-ONLY)
 *
 * Usa el endpoint /graphql expuesto por medical-service (Strawberry).
 * Solo contiene Queries — sin Mutations ni Subscriptions.
 * Las operaciones de citas (agendar, cancelar, reagendar) usan REST
 * vía citasService.ts → appointment-service.
 *
 * Flujo:
 *   Browser → GET/POST https://localhost/graphql (Nginx)
 *          → Kong (valida JWT si aplica)
 *          → medical-service:8004/graphql (Strawberry schema)
 */

import { graphqlRequest } from '../../../api/apiClient';
import type { Cita } from '../../../types';

// ── Tipos de respuesta ────────────────────────────────────────────────────────

interface GQLCita {
  id: number;
  afiliadoId: number;
  beneficiarioId: number | null;
  pacienteNombre: string | null;
  medicoId: number;
  medicoNombre: string | null;
  especialidadId: number;
  especialidadNombre: string | null;
  sedeId: number;
  sedeNombre: string | null;
  horarioId: number;
  fecha: string;
  horaInicio: string;
  horaFin: string | null;
  estado: string;
  canal: string;
  notas: string | null;
}

function mapGQLCita(c: GQLCita): Cita {
  return {
    id: String(c.id),
    usuarioId: String(c.afiliadoId),
    medicoId: String(c.medicoId),
    medicoNombre: c.medicoNombre ?? '',
    especialidadId: String(c.especialidadId),
    especialidadNombre: c.especialidadNombre ?? '',
    sedeId: String(c.sedeId),
    sedeNombre: c.sedeNombre ?? '',
    pacienteNombre: c.pacienteNombre ?? undefined,
    fecha: c.fecha,
    hora: c.horaInicio,
    estado: c.estado as Cita['estado'],
    canal: (c.canal ?? 'web') as Cita['canal'],
  };
}

// ── Queries ───────────────────────────────────────────────────────────────────

const CITA_FIELDS = `
  id afiliadoId beneficiarioId pacienteNombre
  medicoId medicoNombre especialidadId especialidadNombre
  sedeId sedeNombre horarioId fecha horaInicio horaFin
  estado canal notas
`;

/**
 * Query GraphQL: citas activas del afiliado autenticado.
 * Equivalente REST: GET /api/citas/mis-citas
 */
export async function getMisCitasGraphQL(): Promise<Cita[]> {
  const data = await graphqlRequest<{ misCitas: GQLCita[] }>(`
    query {
      misCitas { ${CITA_FIELDS} }
    }
  `);
  return data.misCitas.map(mapGQLCita);
}

/**
 * Query GraphQL: historial completo del afiliado.
 * Equivalente REST: GET /api/citas/historial
 */
export async function getHistorialGraphQL(): Promise<Cita[]> {
  const data = await graphqlRequest<{ historial: GQLCita[] }>(`
    query {
      historial { ${CITA_FIELDS} }
    }
  `);
  return data.historial.map(mapGQLCita);
}

/**
 * Query GraphQL: obtener una cita por ID.
 * Equivalente REST: no existe en REST (solo vía admin o listados).
 */
export async function getCitaGraphQL(citaId: string): Promise<Cita | null> {
  const data = await graphqlRequest<{ cita: GQLCita | null }>(`
    query GetCita($citaId: Int!) {
      cita(citaId: $citaId) { ${CITA_FIELDS} }
    }
  `, { citaId: Number(citaId) });
  return data.cita ? mapGQLCita(data.cita) : null;
}

// Mutations removed — medical-service GraphQL is read-only.
// Use citasService.ts (REST → appointment-service) for:
//   agendarCita  → POST   /api/citas
//   cancelarCita → DELETE /api/citas/{id}/cancelar
//   reagendarCita → PUT   /api/citas/{id}/reagendar
