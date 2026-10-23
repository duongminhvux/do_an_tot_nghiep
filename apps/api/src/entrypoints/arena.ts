import { bootstrapService } from '../platform/bootstrap.js';
import { ArenaModule } from '../modules/arena/arena.module.js';

void bootstrapService('arena', [ArenaModule]);
