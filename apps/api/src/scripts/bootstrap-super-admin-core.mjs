import { randomUUID } from 'node:crypto';

export function parseBootstrapOptions(argv) {
  const known = new Set(['--admin-id','--expected-email','--expected-username','--dry-run','--apply']);
  const values = {};
  for (let i=0;i<argv.length;i++) {
    const key=argv[i];
    if (!known.has(key) || Object.hasOwn(values,key)) throw new Error('Unknown or repeated bootstrap option');
    if (['--dry-run','--apply'].includes(key)) values[key]=true;
    else {
      const value=argv[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
      values[key]=value;
    }
  }
  const adminId=values['--admin-id'];
  if (!adminId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(adminId)) throw new Error('Explicit valid --admin-id is required');
  const expectedEmail=values['--expected-email'],expectedUsername=values['--expected-username'];
  if (!expectedEmail || !expectedUsername) throw new Error('Explicit --expected-email and --expected-username are required');
  if (values['--apply'] && values['--dry-run']) throw new Error('Choose --apply or --dry-run, not both');
  return {adminId:adminId.toLowerCase(),expectedEmail,expectedUsername,dryRun:!values['--apply']};
}

/** Owns one transaction; never creates accounts or changes a credential. */
export async function bootstrapSuperAdmin(client, options) {
  const {adminId,expectedEmail,expectedUsername,dryRun=true}=options;
  if (typeof dryRun !== 'boolean') throw new Error('dryRun must be boolean');
  // The exported core enforces the same explicit-identity contract as the CLI.
  parseBootstrapOptions(['--admin-id',adminId,'--expected-email',expectedEmail,'--expected-username',expectedUsername,dryRun?'--dry-run':'--apply']);
  await client.query(dryRun?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN');
  try {
    if (!dryRun) await client.query("SELECT pg_advisory_xact_lock(hashtextextended('vocalearn.admin-iam',0))");
    const {rows:[admin]}=await client.query(`SELECT id,email,username,status,is_deleted,auth_version,
      password_hash IS NOT NULL AND btrim(password_hash)<>'' AS has_password
      FROM public.admins WHERE id=$1::uuid ${dryRun?'':'FOR UPDATE'}`,[adminId]);
    if (!admin || admin.email!==expectedEmail || admin.username!==expectedUsername) throw new Error('Admin ID/expected identity mismatch');
    if (admin.status!=='ACTIVE' || admin.is_deleted || !admin.has_password) throw new Error('Bootstrap requires an already ACTIVE admin with a password');
    if (!Number.isInteger(admin.auth_version) || admin.auth_version<1 || admin.auth_version>=2147483647) throw new Error('Invalid or exhausted admin auth_version');
    const {rows:[role]}=await client.query(`SELECT id,is_system FROM public.roles WHERE code='SUPER_ADMIN' ${dryRun?'':'FOR UPDATE'}`);
    if (!role?.is_system) throw new Error('Protected SUPER_ADMIN role is missing');
    const {rows:memberships}=await client.query('SELECT role_id FROM public.admin_roles WHERE admin_id=$1::uuid AND role_id=$2::uuid',[adminId,role.id]);
    const snapshot={adminId:admin.id,email:admin.email,username:admin.username,accountStatus:admin.status,authVersion:admin.auth_version};
    if (memberships.length) {
      await client.query(dryRun?'ROLLBACK':'COMMIT');
      return {status:'already-assigned',dryRun,...snapshot};
    }
    const {rows:activeSuperAdmins}=await client.query(`SELECT a.id FROM public.admins a
      JOIN public.admin_roles ar ON ar.admin_id=a.id WHERE ar.role_id=$1::uuid
      AND a.status='ACTIVE' AND NOT a.is_deleted AND a.password_hash IS NOT NULL AND btrim(a.password_hash)<>''`,[role.id]);
    if (activeSuperAdmins.length) throw new Error('Initial bootstrap refused: an ACTIVE Super Admin already exists');
    if (dryRun) {
      await client.query('ROLLBACK');
      return {status:'would-assign',dryRun:true,...snapshot,nextAuthVersion:admin.auth_version+1};
    }
    await client.query('INSERT INTO public.admin_roles(admin_id,role_id) VALUES($1::uuid,$2::uuid)',[adminId,role.id]);
    await client.query('UPDATE public.admins SET auth_version=auth_version+1 WHERE id=$1::uuid',[adminId]);
    const eventId=randomUUID();
    await client.query(`INSERT INTO public.outbox_events(event_id,event_type,aggregate_type,aggregate_id,payload)
      VALUES($1,'identity.admin.super_admin_bootstrapped.v1','admin',$2::uuid,$3::jsonb)`,
      [eventId,adminId,JSON.stringify({actor:{type:'OPERATOR',source:'explicit-bootstrap'},targetAdminId:adminId,
        action:'SUPER_ADMIN_BOOTSTRAPPED',before:{superAdmin:false,authVersion:admin.auth_version},
        after:{superAdmin:true,authVersion:admin.auth_version+1}})]);
    await client.query('COMMIT');
    return {status:'assigned',dryRun:false,...snapshot,authVersion:admin.auth_version+1,eventId};
  } catch(error) {await client.query('ROLLBACK');throw error;}
}
