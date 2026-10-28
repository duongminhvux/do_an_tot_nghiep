import {publicationScope} from '../../publication/publication-scope.js';
import {sql} from '../../../postgres/sql.js';
/** Public catalog SQL must use the publisher's columns, including detail reads. */
export function learnerExamVisibility(){
  return publicationScope.getStore()?sql`publication_status='PUBLISHED' AND is_active IS NOT FALSE AND is_deleted IS NOT TRUE`:sql`TRUE`;
}
