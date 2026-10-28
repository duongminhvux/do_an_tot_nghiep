import { Body,Controller,Headers,Post } from '@nestjs/common';
import { Public } from '../modules/auth/decorators/public.decorator.js';
import { readLearnedCounts,readLearningFeed,readLearningSnapshot,type ActivityFeedRead } from '../modules/learning/learning-reader.js';
import { InjectPgConnection,type PgConnection } from '../postgres/connection.js';
import { authorizeInternal } from './authorize.js';
@Controller('_internal/learning')
export class LearningReadsController {
 constructor(@InjectPgConnection() private readonly db:PgConnection){}
 @Public() @Post('user-snapshot') snapshot(@Headers('x-internal-token') token:string,@Body() input:{userId:string}){authorizeInternal(token,['learning']);return readLearningSnapshot(this.db,input?.userId);}
 @Public() @Post('learned-counts') counts(@Headers('x-internal-token') token:string,@Body() input:{ids:string[]}){authorizeInternal(token,['learning']);return readLearnedCounts(this.db,input?.ids);}
 @Public() @Post('activity-feed') feed(@Headers('x-internal-token') token:string,@Body() input:ActivityFeedRead){authorizeInternal(token,['learning']);return readLearningFeed(this.db,input);}
}
