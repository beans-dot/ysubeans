import { Injectable, OnModuleInit } from '@nestjs/common';
import { AnnualEventsService } from '../annual-events/annual-events.service';
import { factsFromLogs, formatOrgAnnualContent } from './org-annual-event';
import { OrgVersioningService } from './org-versioning.service';

@Injectable()
export class OrgAnnualSyncService implements OnModuleInit {
  constructor(
    private readonly versioning: OrgVersioningService,
    private readonly annualEvents: AnnualEventsService,
  ) {}

  async onModuleInit() {
    try {
      const years = await this.versioning.listLoggedYears();
      for (const year of years) {
        await this.sync(year);
      }
    } catch (err) {
      console.warn('[org-annual-sync] startup rebuild skipped', err);
    }
  }

  async sync(year: number) {
    const logs = await this.versioning.listYearFacts(year);
    const facts = factsFromLogs(logs);
    const generated = formatOrgAnnualContent(facts);
    await this.annualEvents.upsertOrgEvent(year, generated);
  }
}
