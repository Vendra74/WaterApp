// Teste de ponta a ponta do servidor de compartilhamento (login por código, convite, leitura pelo
// cuidador, aviso, revogação e exclusão) com duas contas temporárias, apagadas no fim.
// Uso: SB_URL=... SB_ANON=... SB_SERVICE=... node scripts/teste-servidor-cuidador.cjs
// A chave service_role é secreta: passe só por variável de ambiente, nunca grave no repositório.
const { createClient } = require('@supabase/supabase-js');
const url = process.env.SB_URL, anon = process.env.SB_ANON, service = process.env.SB_SERVICE;
const admin = createClient(url, service, { auth: { persistSession: false } });
const out = [];
const ok = (name, cond, extra = '') => { out.push(`${cond ? 'OK  ' : 'FALHA'} ${name}${extra ? ' — ' + extra : ''}`); };
async function login(email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw new Error('generateLink: ' + error.message);
  const otp = data.properties.email_otp;
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const bad = await c.auth.verifyOtp({ email, token: otp === '000000' ? '111111' : '000000', type: 'email' });
  const r = await c.auth.verifyOtp({ email, token: otp, type: 'email' });
  if (r.error) throw new Error('verifyOtp: ' + r.error.message);
  return { c, id: r.data.user.id, otpLen: otp.length, badRejected: !!bad.error };
}
(async () => {
  const tag = Date.now();
  const ea = `teste-titular-${tag}@example.com`, eb = `teste-cuidador-${tag}@example.com`;
  const A = await login(ea), B = await login(eb);
  ok('login por código (conta nova criada no primeiro acesso)', true, `código com ${A.otpLen} dígitos`);
  ok('código errado é recusado', A.badRejected);
  const acc = await A.c.from('accounts').select('id');
  ok('conta criada automaticamente em accounts', acc.data?.length === 1);
  // dados do titular
  const now = new Date();
  await A.c.from('shared_profiles').upsert({ owner_id: A.id, data: { preferredName: 'Titular Teste' } });
  const h = await A.c.from('hydration_logs').upsert({ id: 'h-' + tag, owner_id: A.id, at: now.toISOString(), volume_ml: 200, recorded_by: A.id });
  ok('titular grava água', !h.error, h.error?.message);
  await A.c.from('medications').upsert({ id: 'm-' + tag, owner_id: A.id, data: { name: 'Remédio teste' } });
  const o = await A.c.from('medication_occurrences').upsert({ id: 'o-' + tag, owner_id: A.id, medication_id: 'm-' + tag, planned_at: now.toISOString(), status: 'unconfirmed', recorded_by: A.id });
  ok('titular grava dose sem confirmação', !o.error, o.error?.message);
  // antes do vínculo B não vê nada
  const pre = await B.c.from('hydration_logs').select('id').eq('owner_id', A.id);
  ok('sem vínculo o cuidador não vê dados', (pre.data ?? []).length === 0);
  // convite
  const inv = await A.c.rpc('create_care_invite', { p_permission: 'view', p_consent_text: 'teste' });
  ok('titular gera convite', !inv.error, inv.error?.message);
  const row = Array.isArray(inv.data) ? inv.data[0] : inv.data;
  const code = row?.code ?? '';
  ok('código de convite tem 8 caracteres', code.length === 8);
  const self = await A.c.rpc('accept_care_invite', { p_code: code });
  ok('titular não aceita o próprio convite', !!self.error);
  const wrong = await B.c.rpc('accept_care_invite', { p_code: 'ZZZZZZZZ' });
  ok('código errado é recusado no convite', !!wrong.error && /invalid/.test(wrong.error.message), wrong.error?.message);
  const acc1 = await B.c.rpc('accept_care_invite', { p_code: code.toLowerCase() });
  ok('cuidador aceita o convite', !acc1.error, acc1.error?.message);
  const again = await B.c.rpc('accept_care_invite', { p_code: code });
  ok('convite não pode ser aceito duas vezes', !!again.error);
  const people = await B.c.rpc('my_cared_people');
  ok('cuidador vê a pessoa na lista com o nome', people.data?.[0]?.display_name === 'Titular Teste', JSON.stringify(people.data?.[0]?.display_name));
  const seeH = await B.c.from('hydration_logs').select('volume_ml').eq('owner_id', A.id);
  const seeO = await B.c.from('medication_occurrences').select('status').eq('owner_id', A.id);
  const seeM = await B.c.from('medications').select('data').eq('owner_id', A.id);
  ok('cuidador vê água, dose sem confirmação e nome do remédio', seeH.data?.length === 1 && seeO.data?.[0]?.status === 'unconfirmed' && seeM.data?.[0]?.data?.name === 'Remédio teste');
  // aviso
  const al = await A.c.from('care_alerts').insert({ owner_id: A.id, kind: 'medication_unconfirmed', message: '1 dose de medicamento sem confirmação no aplicativo.' });
  ok('titular registra aviso de dose sem confirmação', !al.error, al.error?.message);
  const seeA = await B.c.from('care_alerts').select('id, kind, acknowledged_at').eq('owner_id', A.id);
  ok('cuidador vê o aviso', seeA.data?.length === 1 && seeA.data[0].kind === 'medication_unconfirmed');
  const ack = await B.c.from('care_alerts').update({ acknowledged_at: new Date().toISOString(), acknowledged_by: B.id }).eq('id', seeA.data?.[0]?.id).select('id');
  ok('cuidador marca o aviso como visto', !ack.error && ack.data?.length === 1, ack.error?.message);
  // permissão "apenas ver": escrita negada
  const wr = await B.c.from('hydration_logs').insert({ id: 'hb-' + tag, owner_id: A.id, at: now.toISOString(), volume_ml: 100, recorded_by: B.id });
  ok('cuidador “apenas ver” não consegue registrar água', !!wr.error);
  const esc = await B.c.from('care_links').update({ permission: 'edit' }).eq('caregiver_id', B.id).select('id');
  ok('cuidador não consegue aumentar a própria permissão', !!esc.error || (esc.data ?? []).length === 0, esc.error?.message);
  // revogação
  const links = await A.c.from('care_links').select('id,status');
  const rv = await A.c.from('care_links').update({ status: 'revoked', revoked_at: new Date().toISOString() }).eq('id', links.data[0].id);
  ok('titular revoga o acesso', !rv.error, rv.error?.message);
  const post = await B.c.from('hydration_logs').select('id').eq('owner_id', A.id);
  const postA = await B.c.from('care_alerts').select('id').eq('owner_id', A.id);
  const postP = await B.c.rpc('my_cared_people');
  ok('depois de revogar o cuidador não vê mais nada', (post.data ?? []).length === 0 && (postA.data ?? []).length === 0 && (postP.data ?? []).length === 0);
  // apagar dados e contas de teste
  const del = await A.c.rpc('delete_my_data');
  ok('“apagar meus dados” remove os dados do servidor', !del.error, del.error?.message);
  const d1 = await admin.auth.admin.deleteUser(A.id), d2 = await admin.auth.admin.deleteUser(B.id);
  ok('contas de teste removidas', !d1.error && !d2.error, d1.error?.message || d2.error?.message);
  console.log(out.join('\n'));
})().catch((e) => { console.log(out.join('\n')); console.log('ERRO', e.message); process.exit(1); });
