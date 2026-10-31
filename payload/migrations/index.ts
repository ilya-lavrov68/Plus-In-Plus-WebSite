import * as migration_20261031_195142_initial from './20261031_195142_initial.ts';

export const migrations = [
  {
    up: migration_20261031_195142_initial.up,
    down: migration_20261031_195142_initial.down,
    name: '20261031_195142_initial'
  },
];
