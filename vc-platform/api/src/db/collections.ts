/** Collection names (05; khung chung mục 3). Technical collections start with `_`. Each session adds its own. */
export const C = {
  migrations: '_migrations',
  jobLocks: '_job_locks',
  auditLog: 'audit_log',
  /** Written from B-08; read by the Viewer to find the person behind a `sub`. */
  accounts: 'accounts',
  settings: 'system_settings',
  scheduledChanges: 'scheduled_changes',
  jobTitles: 'job_titles',
  jobFunctions: 'job_functions',
  legalEntities: 'legal_entities',
  workLocations: 'work_locations',
  /** Written from B-05 (org units), B-06 (people), B-07 (positions); catalogs read them to count use (05 field names). */
  orgUnits: 'org_units',
  people: 'people',
  positions: 'positions',
} as const;

export type CollectionName = (typeof C)[keyof typeof C];
