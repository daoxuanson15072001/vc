import { Injectable } from '@nestjs/common';
import type { CatalogType } from '@vc/contracts';
import type { ClientSession } from 'mongodb';
import type { CatalogDoc } from './types';

export interface CatalogEvent {
  type: CatalogType;
  code: string;
  action: 'create' | 'update' | 'deactivate' | 'activate' | 'delete' | 'rename';
  before: CatalogDoc | null;
  after: CatalogDoc | null;
}

export type CatalogHook = (session: ClientSession, e: CatalogEvent) => Promise<void>;

/**
 * Runs after each catalog write, in the same transaction. B-08 registers "a job title or legal entity was renamed:
 * push the new claims of the people holding it to VC ID" (04 VH-ORG-02 bước 3, VH-ORG-07 bước 6).
 */
@Injectable()
export class CatalogHooks {
  private readonly hooks: CatalogHook[] = [];

  register(h: CatalogHook): void {
    this.hooks.push(h);
  }

  async run(session: ClientSession, e: CatalogEvent): Promise<void> {
    for (const h of this.hooks) await h(session, e);
  }
}
