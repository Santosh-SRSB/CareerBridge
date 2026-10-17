type Role = 'candidate' | 'interviewer';

type RoomState = {
  offer?: unknown;
  answer?: unknown;
  ice: Record<Role, unknown[]>;
  updatedAt: number;
};

const rooms = new Map<string, RoomState>();

function room(id: string): RoomState {
  const existing = rooms.get(id);
  if (existing) return existing;
  const next: RoomState = { ice: { candidate: [], interviewer: [] }, updatedAt: Date.now() };
  rooms.set(id, next);
  return next;
}

export function putSignal(id: string, role: Role, kind: 'offer' | 'answer' | 'ice', payload: unknown) {
  const state = room(id);
  state.updatedAt = Date.now();
  if (kind === 'offer') state.offer = payload;
  if (kind === 'answer') state.answer = payload;
  if (kind === 'ice') state.ice[role].push(payload);
}

export function takeSignal(id: string, role: Role) {
  const state = room(id);
  const other: Role = role === 'candidate' ? 'interviewer' : 'candidate';
  const ice = state.ice[other];
  state.ice[other] = [];
  return {
    offer: state.offer ?? null,
    answer: state.answer ?? null,
    ice,
  };
}

export function clearRoom(id: string) {
  rooms.delete(id);
}
