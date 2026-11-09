// Shared admin seed input validation. PostgreSQL remains the sole database.
export function isEnabled(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

export function parseSeedOptions(argv, env) {
  const positional = argv.filter((arg) => !arg.startsWith('--'));
  const email = String(positional[0] || env.DEFAULT_ADMIN_EMAIL || 'admin@gmail.com').trim().toLowerCase();
  const username = String(positional[1] || env.DEFAULT_ADMIN_USERNAME || 'admin').trim();
  const password = positional[2] || env.DEFAULT_ADMIN_PASSWORD;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid admin email');
  }
  if (!username || /[\s@]/.test(username)) {
    throw new Error('Admin username must be nonempty and contain no whitespace or @');
  }

  return {
    email,
    username,
    password,
    resetPassword: argv.includes('--reset-password'),
    reactivate: argv.includes('--reactivate'),
    allowWeakPassword: isEnabled(env.ADMIN_SEED_ALLOW_WEAK_PASSWORD),
  };
}


/**
 * SQL-only admin seed logic. Caller holds an explicit BEGIN/COMMIT transaction.
 * No destructive inserts and no silent password resets on repeated deployments.
 */
export async function seedAdminSql(client, options, hashPassword) {
  const {email,username,password,allowWeakPassword,resetPassword,reactivate}=options;
  const result=await client.query('SELECT * FROM public.admins WHERE email=$1 OR username=$2 FOR UPDATE',[email,username]);
  if(result.rows.length>1)throw new Error('Email and username belong to different admin accounts');
  const existing=result.rows[0];
  if(existing && (existing.email!==email || existing.username!==username))throw new Error('Admin identity differs from seed settings');
  if((!existing||resetPassword)&&(!password || password.length<12&&!allowWeakPassword))
    throw new Error('Admin password must contain at least 12 characters unless explicitly allowed for local development');
  if(!existing){
    const digest=await hashPassword(password,12);
    await client.query(`INSERT INTO public.admins(email,username,password_hash,is_deleted,status,auth_version,payload)
      VALUES ($1,$2,$3,false,'ACTIVE',1,$4::jsonb)`,[email,username,digest,JSON.stringify({email,username,isDeleted:false})]);
    return {status:'created',email};
  }
  if(resetPassword||reactivate){
    if(existing.status==='PENDING_ACTIVATION')throw new Error('Seed cannot activate or set a password for a pending invitation');
    const digest=resetPassword?await hashPassword(password,12):existing.password_hash;
    await client.query(`UPDATE public.admins SET password_hash=$2,is_deleted=$3,deleted_at=$4,
      status=$5,auth_version=auth_version+1,payload=payload - 'password' - 'isDeleted' WHERE id=$1`,
     [existing.id,digest,reactivate?false:existing.is_deleted,reactivate?null:existing.deleted_at,
      reactivate?'ACTIVE':existing.status]);
    return {status:'updated',email};
  }
  return {status:existing.is_deleted?'existing-disabled':'existing',email};
}
