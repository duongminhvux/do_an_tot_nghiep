import { ArenaModule } from '../modules/arena/arena.module.js';
import { bootstrapService } from '../platform/bootstrap.js';

void bootstrapService('arena', [ArenaModule]);
