import { type ArenaConfiguration } from './arena-settings.defaults.js';
export interface ArenaSettings {
    key: string;
    revision: number;
    config: ArenaConfiguration;
}
