/** Collection names (05; khung chung mục 3). Technical collections start with `_`. Each session adds its own. */
export const C = {
  migrations: '_migrations',
  jobLocks: '_job_locks',
} as const;

export type CollectionName = (typeof C)[keyof typeof C];
