import { File, Paths } from 'expo-file-system';
import type { AgendaEntry, AgendaExtraRest, AgendaMove } from './trainingAgenda';

export interface AgendaPreference { moves: AgendaMove[]; rests: AgendaExtraRest[]; removedRestIds?: string[] }
const fileFor = (owner: string, suffix = 'json') => new File(Paths.document, `vigor-agenda-${encodeURIComponent(owner)}.${suffix}`);
const validKey = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 512;

export function parseAgendaOrder(value: unknown): AgendaMove[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is AgendaMove => !!item && validKey(item.id) && validKey(item.anchor)
    && item.id !== item.anchor && (item.direction === -1 || item.direction === 1)).slice(-128);
}

export function parseAgendaPreference(value: unknown): AgendaPreference {
  if (Array.isArray(value)) return { moves: parseAgendaOrder(value), rests: [] };
  const parsed = value as Partial<AgendaPreference> | null;
  const rests = Array.isArray(parsed?.rests) ? parsed.rests.filter(item => item && validKey(item.id)
    && validKey(item.scope) && typeof item.checked === 'boolean') : [];
  const removedRestIds = Array.isArray(parsed?.removedRestIds) ? [...new Set(parsed.removedRestIds.filter(validKey))] : [];
  return { moves: parseAgendaOrder(parsed?.moves), rests: [...new Map(rests.map(item => [item.id, item])).values()].slice(-64),
    ...(removedRestIds.length ? { removedRestIds } : {}) };
}

export function removeAgendaRest(preference: AgendaPreference, entry: Extract<AgendaEntry, { kind: 'rest' }>): AgendaPreference {
  if (!entry.extra) return { ...preference, removedRestIds: [...new Set([...(preference.removedRestIds ?? []), entry.id])] };
  return { ...preference, rests: preference.rests.filter(rest => rest.id !== entry.id),
    moves: preference.moves.filter(move => move.id !== entry.id && move.anchor !== entry.id) };
}

export function readAgendaPreference(owner: string): AgendaPreference {
  try {
    const file = fileFor(owner);
    return parseAgendaPreference(file.exists ? JSON.parse(file.textSync()) : null);
  } catch { return parseAgendaPreference(null); }
}

export function writeAgendaPreference(owner: string, preference: AgendaPreference) {
  const next = parseAgendaPreference(preference);
  const temporary = fileFor(owner, 'pending');
  temporary.create({ overwrite: true });
  temporary.write(JSON.stringify(next));
  temporary.move(fileFor(owner), { overwrite: true });
  return next;
}
