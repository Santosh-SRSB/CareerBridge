import type { WhatsAppEventLogItem } from './whatsapp.types';

/** In-memory ring buffer for the admin WhatsApp test console. */
export class WhatsAppEventLog {
  private readonly items: WhatsAppEventLogItem[] = [];
  private readonly max = 200;

  push(item: Omit<WhatsAppEventLogItem, 'id' | 'at'> & { at?: string }) {
    const entry: WhatsAppEventLogItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: item.at || new Date().toISOString(),
      kind: item.kind,
      summary: item.summary,
      detail: item.detail,
    };
    this.items.unshift(entry);
    if (this.items.length > this.max) this.items.length = this.max;
    return entry;
  }

  list(limit = 50) {
    return this.items.slice(0, Math.min(limit, this.max));
  }

  clear() {
    this.items.length = 0;
  }
}
