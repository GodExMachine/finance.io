// ========== STATE ==========




let DB = {
  contas: [], transacoes: [], categorias: [], cartoes: [],
  compras: [], metas: [], orcamentos: [], apagar: [], areceber: [],
  config: {}
};


let chartBar = null, chartPie = null;
let filterTransType = '';
let filterTransConta = '';
let filterTransOrdem = 'recente';
let chartBarMode = 6;
let currentPage = 'dashboard';

// ========== UTILS ==========
const uid = () => Math.random().toString(36).substr(2,9);
const fmt = v => 'R$ ' + Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const today = () => new Date().toISOString().split('T')[0];
const thisMonth = () => today().substr(0,7);
// Formata data ISO (yyyy-mm-dd) para padrão BR (dd/mm/aaaa)
const fmtDate = (iso) => {
  if(!iso) return '—';
  const [y,m,d] = iso.split('-');
  if(!y||!m||!d) return iso;
  return `${d}/${m}/${y}`;
};
const showToast = (msg, color='') => {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = color || 'var(--surface3)';
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2200);
};

// ========== STORAGE (LOCAL) ==========
const saveDB = () => {
  const email = sessionStorage.getItem('financcely_email') || 'local';
  localStorage.setItem(`financcely_db:${email}`, JSON.stringify(DB));
  clearTimeout(window.autoSyncTimer);
  window.autoSyncTimer = setTimeout(() => syncToCloud(), 800);
};

const loadDB = () => {
  const email = sessionStorage.getItem('financcely_email') || 'local';
  const d = localStorage.getItem(`financcely_db:${email}`);
  if (d) DB = JSON.parse(d);
  else initDefaultCategories();
};

// ========== CLOUD ==========
const WORKER_URL = 'https://financcely.alexjunkglaus.workers.dev/';

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': 'Bearer ' + (sessionStorage.getItem('financcely_token') || '')
});

const syncToCloud = async () => {
  try {
    const r = await fetch(WORKER_URL, {
      method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(DB)
    });
    if (r.ok) showToast('✅ Salvo!', 'var(--green)');
    else showToast('Erro ao salvar', 'var(--red)');
  } catch (e) {
    if (e.message === 'unauthorized') throw e;
    showToast('Erro de conexão', 'var(--red)');
  }
};

const syncFromCloud = async () => {
  try {
    const r = await fetch(WORKER_URL, { headers: getAuthHeaders() });
    if (r.status === 401) throw new Error('unauthorized');
    if (!r.ok) throw new Error('network');
    DB = await r.json();
    const email = sessionStorage.getItem('financcely_email') || 'local';
    localStorage.setItem(`financcely_db:${email}`, JSON.stringify(DB));
    navigate(currentPage || 'dashboard');
  } catch (e) {
    if (e.message === 'unauthorized') throw e;
    showToast('Erro ao sincronizar', 'var(--red)');
  }
};

// ========== AUTH TABS ==========
const showAuthTab = (tab) => {
  const isLogin = tab === 'login';
  document.getElementById('tabLogin').style.display = isLogin ? 'flex' : 'none';
  document.getElementById('tabCadastro').style.display = isLogin ? 'none' : 'flex';
  document.getElementById('tabLoginBtn').style.background = isLogin ? 'var(--accent)' : 'transparent';
  document.getElementById('tabLoginBtn').style.color = isLogin ? '#fff' : 'var(--text2)';
  document.getElementById('tabCadastroBtn').style.background = isLogin ? 'transparent' : 'var(--accent)';
  document.getElementById('tabCadastroBtn').style.color = isLogin ? 'var(--text2)' : '#fff';
};

// ========== CADASTRO ==========
const doRegister = async () => {
  const nome  = document.getElementById('cadNome').value.trim();
  const email = document.getElementById('cadEmail').value.trim();
  const senha = document.getElementById('cadSenha').value;
  const senha2= document.getElementById('cadSenha2').value;

  if (!nome || !email || !senha) { showToast('Preencha todos os campos', 'var(--red)'); return; }
  if (senha.length < 6) { showToast('Senha deve ter pelo menos 6 caracteres', 'var(--red)'); return; }
  if (senha !== senha2) { showToast('As senhas não conferem', 'var(--red)'); return; }

  showToast('Criando conta...');
  try {
    const r = await fetch(WORKER_URL + 'register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, senha })
    });
    const data = await r.json();
    if (!r.ok) { showToast(data.error || 'Erro ao criar conta', 'var(--red)'); return; }

    sessionStorage.setItem('financcely_token', data.token);
    sessionStorage.setItem('financcely_nome', data.nome);
    sessionStorage.setItem('financcely_email', data.email);
    localStorage.setItem('financcely_logged', 'true');

    initDefaultCategories();
    await syncToCloud();

    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').classList.add('visible');
    bootApp();
    showToast(`Bem-vindo(a), ${data.nome}! 🎉`, 'var(--green)');
  } catch(e) {
    showToast('Erro de conexão', 'var(--red)');
  }
};

// ========== LOGIN ==========
const doLogin = async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const senha = document.getElementById('loginPass').value;

  if (!email || !senha) { showToast('Preencha email e senha', 'var(--red)'); return; }

  showToast('Verificando...');
  try {
    const r = await fetch(WORKER_URL + 'auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });
    const data = await r.json();
    if (!r.ok) { showToast(data.error || 'Email ou senha incorretos', 'var(--red)'); return; }

    sessionStorage.setItem('financcely_token', data.token);
    sessionStorage.setItem('financcely_nome', data.nome);
    sessionStorage.setItem('financcely_email', data.email);
    localStorage.setItem('financcely_logged', 'true');

    try { await syncFromCloud(); } catch(e) { loadDB(); }

    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').classList.add('visible');
    bootApp();
    showToast(`Olá, ${data.nome}! 👋`, 'var(--green)');
  } catch(e) {
    showToast('Erro de conexão', 'var(--red)');
  }
};

document.getElementById('loginPass').addEventListener('keydown', e => {
  if(e.key === 'Enter') doLogin();
});
document.getElementById('loginEmail').addEventListener('keydown', e => {
  if(e.key === 'Enter') document.getElementById('loginPass').focus();
});

const doLogout = () => {
  localStorage.removeItem('financcely_logged');
  sessionStorage.removeItem('financcely_token');
  sessionStorage.removeItem('financcely_nome');
  sessionStorage.removeItem('financcely_email');
  document.getElementById('app').classList.remove('visible');
  document.getElementById('loginScreen').style.display = 'flex';
  showAuthTab('login');
};

// Auto Login
window.addEventListener('load', async () => {
  const logged = localStorage.getItem('financcely_logged');
  const token  = sessionStorage.getItem('financcely_token');
  if (logged !== 'true' || !token) {
    localStorage.removeItem('financcely_logged');
    return;
  }
  try {
    await syncFromCloud();
  } catch (e) {
    if (e.message === 'unauthorized') {
      localStorage.removeItem('financcely_logged');
      sessionStorage.clear();
      return;
    }
    loadDB();
  }
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').classList.add('visible');
  bootApp();
});
// ========== DEFAULT CATEGORIES ==========
const initDefaultCategories = () => {
  const cats = [
    {id:uid(),nome:'Alimentação',icone:'🍔',cor:'#ff6584',pai:''},
    {id:uid(),nome:'Mercado',icone:'🛒',cor:'#ff6584',pai:''},
    {id:uid(),nome:'Restaurante',icone:'🍽️',cor:'#ff9a3c',pai:''},
    {id:uid(),nome:'Transporte',icone:'🚗',cor:'#38b2f7',pai:''},
    {id:uid(),nome:'Combustível',icone:'⛽',cor:'#38b2f7',pai:''},
    {id:uid(),nome:'Moradia',icone:'🏠',cor:'#6c63ff',pai:''},
    {id:uid(),nome:'Aluguel',icone:'🔑',cor:'#6c63ff',pai:''},
    {id:uid(),nome:'Saúde',icone:'💊',cor:'#43e97b',pai:''},
    {id:uid(),nome:'Lazer',icone:'🎮',cor:'#f7c844',pai:''},
    {id:uid(),nome:'Educação',icone:'📚',cor:'#a78bfa',pai:''},
    {id:uid(),nome:'Salário',icone:'💼',cor:'#43e97b',pai:''},
    {id:uid(),nome:'Freelance',icone:'💻',cor:'#38b2f7',pai:''},
    {id:uid(),nome:'Outros',icone:'📦',cor:'#9898b0',pai:''},
  ];
  DB.categorias = cats;
  saveDB();
};

// ========== NAVIGATION ==========
const navPages = ['dashboard','contas','transacoes','cartoes','mais'];
const navigate = (page) => {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const pg = document.getElementById('page-'+page);
  if(pg) pg.classList.add('active');
  const nav = document.getElementById('nav-'+page);
  if(nav) nav.classList.add('active');
  else {
    // sub-pages highlight parent nav
    const parents = {categorias:'mais',metas:'mais',orcamento:'mais',apagar:'mais',areceber:'mais',relatorios:'mais',config:'mais'};
    const parent = parents[page];
    if(parent) { const pn = document.getElementById('nav-'+parent); if(pn) pn.classList.add('active'); }
  }
  currentPage = page;
  renderPage(page);
  document.getElementById('mainContent').scrollTo(0,0);
};

const renderPage = (page) => {
  if(page==='dashboard') {
    const dd = document.getElementById('dashDate');
    if(dd && !dd.value) dd.value = today();
    renderDashboard();
  }
  else if(page==='contas') {
    const cd = document.getElementById('contasDate');
    if(cd && !cd.value) cd.value = today();
    renderContas();
  }
  else if(page==='transacoes') {
    const tm = document.getElementById('filterTransMes');
    if(tm && !tm.value) tm.value = thisMonth();
    renderFilterContas(); renderTransacoes();
  }
  else if(page==='cartoes') {
    const cm = document.getElementById('filterCartoesMes');
    if(cm && !cm.value) cm.value = thisMonth();
    renderCartoes();
  }
  else if(page==='categorias') renderCategorias();
  else if(page==='metas') renderMetas();
  else if(page==='orcamento') renderOrcamento();
  else if(page==='apagar') renderApagar();
  else if(page==='areceber') renderAreceber();
  else if(page==='relatorios') initRelatorios();
  else if(page==='config') {}
};

// Retorna "YYYY-MM" da fatura em que a compra vai cair,
// baseado no dia de fechamento do cartão.
// Ex: fechamento=11, compra=06/jun → fatura jun (fecha dia 11/jun)
//     fechamento=11, compra=15/jun → fatura jul (já passou do fechamento de jun)
const getMesFatura = (dataCompra, diaFechamento) => {
  const d = new Date(dataCompra + 'T12:00:00');
  const fecha = Number(diaFechamento || 25);
  // Se a compra foi APÓS o fechamento deste mês, cai no próximo
  if (d.getDate() > fecha) {
    const prox = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return prox.toISOString().substr(0, 7);
  }
  return dataCompra.substr(0, 7);
};


// ========== MODAL ==========
const openModal = (id) => {
  document.getElementById(id).classList.add('open');
  populateSelects();
};
const closeModal = (id) => document.getElementById(id).classList.remove('open');
document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => { if(e.target===o) o.classList.remove('open'); });
});

// ========== POPULATE SELECTS ==========
const populateSelects = () => {
  const catOpts = DB.categorias.map(c=>`<option value="${c.id}">${c.icone||''} ${c.nome}</option>`).join('');
  const catOptsAll = '<option value="">— Categoria —</option>'+catOpts;
  ['transCat','compraCat','orcCat','apagarCat','areceberCat'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.innerHTML = catOptsAll;
  });

  const contaOpts = '<option value="">— Conta —</option>'+DB.contas.map(c=>`<option value="${c.id}">${c.nome}</option>`).join('');
  ['transConta','transContaDest'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=contaOpts;});

  // Cartões
  const cartOpts = '<option value="">— Cartão —</option>'+DB.cartoes.map(c=>`<option value="${c.id}">${c.nome}</option>`).join('');
  const cc = document.getElementById('compraCartao'); if(cc) cc.innerHTML=cartOpts;

  // Conta vinculada no cartão
  const cartaoContaEl = document.getElementById('cartaoContaId');
  if(cartaoContaEl) cartaoContaEl.innerHTML = contaOpts;

  const catPaiEl = document.getElementById('catPai');
  if(catPaiEl) catPaiEl.innerHTML='<option value="">— Nenhuma (raiz) —</option>'+DB.categorias.filter(c=>!c.pai).map(c=>`<option value="${c.id}">${c.icone||''} ${c.nome}</option>`).join('');
};

// ========== CONTAS ==========
const contaColors = {corrente:'linear-gradient(135deg,#1a1a3e,#2d1b69)',poupanca:'linear-gradient(135deg,#0d2e1c,#1a4731)',
  carteira:'linear-gradient(135deg,#2e1b00,#5c3c00)',digital:'linear-gradient(135deg,#1a1a2e,#16213e)',
  investimento:'linear-gradient(135deg,#0d1f2d,#1a3a4a)'};
const contaTypeLabel = {corrente:'Conta Corrente',poupanca:'Conta Poupança',carteira:'Carteira Física',digital:'Conta Digital',investimento:'Investimento'};

const getSaldoConta = (contaId, ateDia) => {
  const conta = DB.contas.find(c=>c.id===contaId);
  if(!conta) return 0;
  let saldo = Number(conta.saldoInicial||0);
  const limite = ateDia || today();
  DB.transacoes.forEach(t => {
    if(t.dataTransacao && t.dataTransacao > limite) return;
    if(t.tipo==='receita'&&t.contaId===contaId) saldo+=Number(t.valor||0);
    if(t.tipo==='despesa'&&t.contaId===contaId) saldo-=Number(t.valor||0);
    if(t.tipo==='transferencia'&&t.contaId===contaId) saldo-=Number(t.valor||0);
    if(t.tipo==='transferencia'&&t.contaDestId===contaId) saldo+=Number(t.valor||0);
  });
  return saldo;
};

const renderContas = () => {
  const el = document.getElementById('contasList');
  if(!DB.contas.length) { el.innerHTML='<div class="empty-state"><i class="fas fa-university"></i><p>Nenhuma conta cadastrada</p></div>'; return; }
  const contasDateEl = document.getElementById('contasDate');
  const ateDia = contasDateEl?.value || today();
  el.innerHTML = DB.contas.map(c => {
    const saldo = getSaldoConta(c.id, ateDia);
    const bg = c.cor ? `background:linear-gradient(135deg,${c.cor}33,${c.cor}66)` : contaColors[c.tipo]||'';
    return `<div class="account-card" style="${bg};border-color:${c.cor||'rgba(255,255,255,0.08)'}22">
      <div class="account-type">${contaTypeLabel[c.tipo]||c.tipo}</div>
      <div class="account-name">${c.nome}</div>
      <div class="account-balance">${fmt(saldo)}</div>
      <div class="account-actions">
        <button class="account-action-btn" onclick="editConta('${c.id}')">✏️ Editar</button>
        <button class="account-action-btn" onclick="deleteConta('${c.id}')">🗑️ Excluir</button>
      </div>
    </div>`;
  }).join('');
};

const openNewConta = () => {
  document.getElementById('contaEditId').value='';
  document.getElementById('modalContaTitulo').textContent='Nova Conta';
  document.getElementById('contaNome').value='';
  document.getElementById('contaTipo').value='corrente';
  document.getElementById('contaSaldo').value='';
  document.getElementById('contaCor').value='#6c63ff';
  openModal('modalConta');
};

const editConta = (id) => {
  const c = DB.contas.find(x=>x.id===id); if(!c) return;
  document.getElementById('contaEditId').value=id;
  document.getElementById('modalContaTitulo').textContent='Editar Conta';
  document.getElementById('contaNome').value=c.nome;
  document.getElementById('contaTipo').value=c.tipo;
  document.getElementById('contaSaldo').value=c.saldoInicial;
  document.getElementById('contaCor').value=c.cor||'#6c63ff';
  openModal('modalConta');
};

const salvarConta = () => {
  const id = document.getElementById('contaEditId').value;
  const obj = {
    id: id||uid(), nome: document.getElementById('contaNome').value,
    tipo: document.getElementById('contaTipo').value,
    saldoInicial: parseFloat(document.getElementById('contaSaldo').value)||0,
    cor: document.getElementById('contaCor').value
  };
  if(!obj.nome) { showToast('Informe o nome','var(--red)'); return; }
  if(id) { const i=DB.contas.findIndex(x=>x.id===id); DB.contas[i]=obj; }
  else DB.contas.push(obj);
  saveDB(); closeModal('modalConta'); renderContas();
  showToast(id?'Conta atualizada!':'Conta criada!','var(--green)');
};

const deleteConta = (id) => {
  if(!confirm('Excluir esta conta? As transações vinculadas continuarão existindo.')) return;
  DB.contas = DB.contas.filter(c=>c.id!==id);
  saveDB(); renderContas(); showToast('Conta excluída','var(--red)');
};

// ========== TRANSAÇÕES ==========
const setTipoTrans = (tipo) => {
  ['btnReceita','btnDespesa','btnTransf'].forEach(b=>document.getElementById(b).className='type-btn');
  document.getElementById('btnReceita').className='type-btn'+(tipo==='receita'?' active-receita':'');
  document.getElementById('btnDespesa').className='type-btn'+(tipo==='despesa'?' active-despesa':'');
  document.getElementById('btnTransf').className='type-btn'+(tipo==='transferencia'?' active-transferencia':'');
  document.getElementById('transContaDestinoGrp').style.display = tipo==='transferencia'?'flex':'none';
  document.getElementById('transContaDestinoGrp').style.flexDirection='column';
};

const setFilterTrans = (tipo, el) => {
  document.querySelectorAll('#filterTransType .filter-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  filterTransType = tipo;
  renderTransacoes();
};

const setFilterTransConta = (contaId, el) => {
  document.querySelectorAll('#filterTransConta .filter-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  filterTransConta = contaId;
  renderTransacoes();
};

const toggleOrdemTrans = () => {
  filterTransOrdem = filterTransOrdem === 'recente' ? 'antigo' : 'recente';
  const btn = document.getElementById('btnOrdemTrans');
  btn.textContent = filterTransOrdem === 'recente' ? 'Recente ↓' : 'Antigo ↑';
  renderTransacoes();
};

const renderFilterContas = () => {
  const bar = document.getElementById('filterTransConta');
  if(!bar) return;
  bar.innerHTML = `<div class="filter-chip active" onclick="setFilterTransConta('',this)">🏦 Todas</div>` +
    DB.contas.map(c=>`<div class="filter-chip" onclick="setFilterTransConta('${c.id}',this)">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c.cor||'var(--accent)'}"></span>
      ${c.nome}
    </div>`).join('');
  filterTransConta = '';
};

const getTransTipoAtual = () => {
  if(document.getElementById('btnReceita').classList.contains('active-receita')) return 'receita';
  if(document.getElementById('btnDespesa').classList.contains('active-despesa')) return 'despesa';
  return 'transferencia';
};

const getCatName = (id) => { const c=DB.categorias.find(x=>x.id===id); return c?`${c.icone||''} ${c.nome}`:'—'; };
const getContaName = (id) => { const c=DB.contas.find(x=>x.id===id); return c?c.nome:'—'; };

const renderTransacoes = () => {
  const el = document.getElementById('transList');
  const search = (document.getElementById('searchTrans')||{}).value?.toLowerCase()||'';
  const mes = document.getElementById('filterTransMes')?.value || thisMonth();
  let trans = [...DB.transacoes].sort((a,b)=>filterTransOrdem==='recente'?b.dataTransacao?.localeCompare(a.dataTransacao):a.dataTransacao?.localeCompare(b.dataTransacao));
  trans = trans.filter(t=>t.dataTransacao?.startsWith(mes));
  if(filterTransType) trans = trans.filter(t=>t.tipo===filterTransType);
  if(filterTransConta) trans = trans.filter(t=>t.contaId===filterTransConta||t.contaDestId===filterTransConta);
  if(search) trans = trans.filter(t=>t.descricao?.toLowerCase().includes(search)||getCatName(t.categoriaId).toLowerCase().includes(search));
  if(!trans.length) { el.innerHTML='<div class="empty-state"><i class="fas fa-receipt"></i><p>Nenhuma transação encontrada</p></div>'; return; }
  el.innerHTML = trans.map(t=>{
    const cor = t.tipo==='receita'?'var(--green)':t.tipo==='despesa'?'var(--red)':'var(--blue)';
    const sinal = t.tipo==='receita'?'+':t.tipo==='despesa'?'-':'⇄';
    const cat = DB.categorias.find(c=>c.id===t.categoriaId);
    return `<div class="list-item">
      <div class="item-icon" style="background:${cor}22;color:${cor};font-size:18px">${cat?.icone||'💰'}</div>
      <div class="item-info">
        <div class="item-name">${t.descricao||'Sem descrição'}</div>
        <div class="item-sub">${getCatName(t.categoriaId)} • ${fmtDate(t.dataTransacao)}${t.contaId?` • ${getContaName(t.contaId)}`:''}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <div class="item-amount" style="color:${cor}">${sinal} ${fmt(t.valor)}</div>
        <div class="item-actions">
          <button class="action-btn" onclick="editTransacao('${t.id}')">✏️</button>
          <button class="action-btn danger" onclick="deleteTransacao('${t.id}')">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');
};

const openNewTransacao = () => {
  document.getElementById('transEditId').value='';
  document.getElementById('modalTransTitulo').textContent='Nova Transação';
  document.getElementById('transValor').value='';
  document.getElementById('transDesc').value='';
  document.getElementById('transObs').value='';
  document.getElementById('transData').value=today();
  document.getElementById('transRecorrencia').value='nenhuma';
  setTipoTrans('despesa');
  populateSelects();
  openModal('modalTransacao');
};

const editTransacao = (id) => {
  const t=DB.transacoes.find(x=>x.id===id); if(!t) return;
  document.getElementById('transEditId').value=id;
  document.getElementById('modalTransTitulo').textContent='Editar Transação';
  document.getElementById('transValor').value=t.valor;
  document.getElementById('transDesc').value=t.descricao;
  document.getElementById('transObs').value=t.observacao||'';
  document.getElementById('transData').value=t.dataTransacao;
  document.getElementById('transRecorrencia').value=t.recorrencia||'nenhuma';
  setTipoTrans(t.tipo);
  openModal('modalTransacao');
  // set select values AFTER openModal (which calls populateSelects and resets selects)
  document.getElementById('transCat').value=t.categoriaId||'';
  document.getElementById('transConta').value=t.contaId||'';
  if(t.tipo==='transferencia') document.getElementById('transContaDest').value=t.contaDestId||'';
};

const salvarTransacao = () => {
  const id = document.getElementById('transEditId').value;
  const tipo = getTransTipoAtual();
  const obj = {
    id:id||uid(), tipo,
    valor: parseFloat(document.getElementById('transValor').value)||0,
    descricao: document.getElementById('transDesc').value,
    categoriaId: document.getElementById('transCat').value,
    contaId: document.getElementById('transConta').value,
    contaDestId: tipo==='transferencia'?document.getElementById('transContaDest').value:'',
    dataTransacao: document.getElementById('transData').value,
    observacao: document.getElementById('transObs').value,
    recorrencia: document.getElementById('transRecorrencia').value,
    status:'realizado'
  };
  if(!obj.valor) { showToast('Informe o valor','var(--red)'); return; }
  if(id) { const i=DB.transacoes.findIndex(x=>x.id===id); DB.transacoes[i]=obj; }
  else DB.transacoes.push(obj);
  // recorrência mensal automática
  if(!id && obj.recorrencia==='mensal') {
    const [anoBase, mesBase, diaBase] = (obj.dataTransacao||today()).split('-').map(Number);
    for(let m=1;m<12;m++){
      const anoAlvo = anoBase + Math.floor((mesBase - 1 + m) / 12);
      const mesAlvo = ((mesBase - 1 + m) % 12) + 1; // 1–12
      // clamp o dia ao último dia do mês alvo (ex: 31 em fevereiro → 28/29)
      const ultimoDia = new Date(anoAlvo, mesAlvo, 0).getDate();
      const diaAlvo = Math.min(diaBase, ultimoDia);
      const dataStr = `${anoAlvo}-${String(mesAlvo).padStart(2,'0')}-${String(diaAlvo).padStart(2,'0')}`;
      DB.transacoes.push({...obj, id:uid(), dataTransacao:dataStr});
    }
  }
  saveDB(); closeModal('modalTransacao'); renderTransacoes(); renderDashboard();
  showToast(id?'Transação atualizada!':'Transação criada!','var(--green)');
};

const deleteTransacao = (id) => {
  if(!confirm('Excluir esta transação?')) return;
  DB.transacoes = DB.transacoes.filter(t=>t.id!==id);
  saveDB(); renderTransacoes(); renderDashboard(); showToast('Excluída','var(--red)');
};

// ========== CATEGORIAS ==========
const renderCategorias = () => {
  const el = document.getElementById('categoriasList');
  const roots = DB.categorias.filter(c=>!c.pai);
  if(!DB.categorias.length) { el.innerHTML='<div class="empty-state"><i class="fas fa-tags"></i><p>Nenhuma categoria</p></div>'; return; }
  el.innerHTML = roots.map(r=>{
    const subs = DB.categorias.filter(c=>c.pai===r.id);
    return `<div class="card" style="margin-bottom:10px">
      <div class="list-item" style="padding-top:0">
        <div class="item-icon" style="background:${r.cor||'#6c63ff'}22;color:${r.cor||'#6c63ff'}">${r.icone||'📁'}</div>
        <div class="item-info"><div class="item-name">${r.nome}</div></div>
        <div class="item-actions">
          <button class="action-btn" onclick="editCategoria('${r.id}')">✏️</button>
          <button class="action-btn danger" onclick="deleteCategoria('${r.id}')">🗑️</button>
        </div>
      </div>
      ${subs.map(s=>`<div class="list-item" style="padding-left:20px">
        <div style="color:var(--text3);margin-right:4px">└</div>
        <div class="item-icon" style="background:${s.cor||'#6c63ff'}22;color:${s.cor||'#6c63ff'};width:32px;height:32px;font-size:13px">${s.icone||'📁'}</div>
        <div class="item-info"><div class="item-name" style="font-size:13px">${s.nome}</div></div>
        <div class="item-actions">
          <button class="action-btn" onclick="editCategoria('${s.id}')">✏️</button>
          <button class="action-btn danger" onclick="deleteCategoria('${s.id}')">🗑️</button>
        </div>
      </div>`).join('')}
    </div>`;
  }).join('');
};

const editCategoria = (id) => {
  const c=DB.categorias.find(x=>x.id===id); if(!c) return;
  document.getElementById('catEditId').value=id;
  document.getElementById('catNome').value=c.nome;
  document.getElementById('catIcone').value=c.icone||'';
  document.getElementById('catCor').value=c.cor||'#6c63ff';
  populateSelects();
  document.getElementById('catPai').value=c.pai||'';
  openModal('modalCategoria');
};

const salvarCategoria = () => {
  const id = document.getElementById('catEditId').value;
  const obj = {
    id:id||uid(), nome:document.getElementById('catNome').value,
    icone:document.getElementById('catIcone').value,
    cor:document.getElementById('catCor').value,
    pai:document.getElementById('catPai').value
  };
  if(!obj.nome) { showToast('Informe o nome','var(--red)'); return; }
  if(id) { const i=DB.categorias.findIndex(x=>x.id===id); DB.categorias[i]=obj; }
  else DB.categorias.push(obj);
  saveDB(); closeModal('modalCategoria'); renderCategorias();
  document.getElementById('catEditId').value='';
  showToast('Categoria salva!','var(--green)');
};

const deleteCategoria = (id) => {
  if(!confirm('Excluir categoria?')) return;
  DB.categorias = DB.categorias.filter(c=>c.id!==id&&c.pai!==id);
  saveDB(); renderCategorias(); showToast('Excluída','var(--red)');
};

// ========== CARTÕES ==========
const brandEmoji = {visa:'💳',mastercard:'💳',elo:'💳',hipercard:'💳',amex:'💳'};

const renderCartoes = () => {
  const el = document.getElementById('cartoesList');
  if(!DB.cartoes.length) { 
    el.innerHTML='<div class="empty-state"><i class="fas fa-credit-card"></i><p>Nenhum cartão cadastrado</p></div>'; 
    return; 
  }

  const mesSel = document.getElementById('filterCartoesMes')?.value || thisMonth();
  const [anoSel, mSel] = mesSel.split('-').map(Number);

  el.innerHTML = DB.cartoes.map(c => {
    const diaFecha = Number(c.diaFechamento || 25);
    const usado = DB.compras
      .filter(cp => cp.cartaoId === c.id && getMesFatura(cp.dataCompra, diaFecha) === mesSel)
      .reduce((s, cp) => s + Number(cp.valorTotal || 0), 0);
    const disp = Number(c.limiteTotal || 0) - usado;
    const pct = Math.min(100, (usado / Number(c.limiteTotal || 1)) * 100);

    return `<div class="credit-card-visual">
      <div class="card-brand">${brandEmoji[c.bandeira] || '💳'}</div>
      <div class="card-name">${c.nome}</div>
      <div style="font-size:11px;opacity:0.6;margin-bottom:8px">${c.bandeira?.toUpperCase() || ''}</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${pct>80?'var(--red)':'var(--accent)'}"></div></div>
      <div class="card-limit-row">
        <div><div class="card-limit-label">Usado</div><div class="card-limit-value">${fmt(usado)}</div></div>
        <div style="text-align:center"><div class="card-limit-label">Disponível</div><div class="card-limit-value" style="color:var(--green)">${fmt(disp)}</div></div>
        <div style="text-align:right"><div class="card-limit-label">Limite</div><div class="card-limit-value">${fmt(c.limiteTotal)}</div></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <div class="card-closing" style="flex:1">Fecha dia ${c.diaFechamento || '—'}</div>
        <div class="card-closing" style="flex:1;text-align:center">Vence dia ${c.diaVencimento || '—'}</div>
        <div style="display:flex;gap:6px">
          <button class="action-btn" onclick="editCartao('${c.id}')">✏️</button>
          <button class="action-btn danger" onclick="deleteCartao('${c.id}')">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');

  // ==================== FATURAS ====================
  const fEl = document.getElementById('faturasList');
  if(!DB.compras.length) { 
    fEl.innerHTML = '<div class="empty-state"><i class="fas fa-file-invoice"></i><p>Nenhuma compra cadastrada</p></div>'; 
    return; 
  }

  // Filtra compras cuja fatura cai no mês selecionado
  const comprasMes = DB.compras.filter(cp => {
    const cart = DB.cartoes.find(x => x.id === cp.cartaoId);
    const diaFecha = Number(cart?.diaFechamento || 25);
    return getMesFatura(cp.dataCompra, diaFecha) === mesSel;
  });

  if(!comprasMes.length) {
    fEl.innerHTML = '<div class="empty-state"><i class="fas fa-file-invoice"></i><p>Nenhuma compra neste mês</p></div>';
    return;
  }

  fEl.innerHTML = comprasMes.map(cp => {
    const cart = DB.cartoes.find(x => x.id === cp.cartaoId);
    return `<div class="card-sm list-item" style="padding:12px">
      <div class="item-info">
        <div class="item-name">${cp.descricao}</div>
        <div class="item-sub">${cart?.nome || '—'} • ${cp.parcelas}x • ${fmtDate(cp.dataCompra)}</div>
      </div>
      <div style="text-align:right">
        <div class="item-amount negative">${fmt(cp.valorTotal)}</div>
        <div style="font-size:11px;color:var(--text2)">${fmt(cp.valorTotal / cp.parcelas)}/mês</div>
        
        <button class="action-btn danger" onclick="deleteCompra('${cp.id}')" 
          style="margin-top:8px; font-size:12px; padding:5px 10px;">
          🗑️ Apagar Compra
        </button>
      </div>
    </div>`;
  }).join('');
};

const salvarCartao = () => {
  const id = document.getElementById('cartaoEditId').value;
  const obj = {
    id: id||uid(), 
    nome: document.getElementById('cartaoNome').value,
    bandeira: document.getElementById('cartaoBandeira').value,
    limiteTotal: parseFloat(document.getElementById('cartaoLimite').value)||0,
    diaFechamento: parseInt(document.getElementById('cartaoFechamento').value)||25,
    diaVencimento: parseInt(document.getElementById('cartaoVencimento').value)||5,
    contaId: document.getElementById('cartaoContaId').value   // ← NOVO
  };

  if(!obj.nome) { showToast('Informe o nome','var(--red)'); return; }
  if(id) { 
    const i=DB.cartoes.findIndex(x=>x.id===id); 
    DB.cartoes[i]=obj; 
  } else DB.cartoes.push(obj);

  saveDB(); 
  closeModal('modalCartao'); 
  renderCartoes(); 
  showToast('Cartão salvo!','var(--green)');
};

const editCartao = (id) => {
  const c=DB.cartoes.find(x=>x.id===id); 
  if(!c) return;
  document.getElementById('cartaoEditId').value=id;
  document.getElementById('cartaoNome').value=c.nome;
  document.getElementById('cartaoBandeira').value=c.bandeira;
  document.getElementById('cartaoLimite').value=c.limiteTotal;
  document.getElementById('cartaoFechamento').value=c.diaFechamento;
  document.getElementById('cartaoVencimento').value=c.diaVencimento;
  openModal('modalCartao'); // openModal chama populateSelects, então define contaId depois
  document.getElementById('cartaoContaId').value = c.contaId || '';
};

const deleteCartao = (id) => {
  if(!confirm('Excluir cartão?')) return;
  DB.cartoes = DB.cartoes.filter(c=>c.id!==id);
  saveDB(); renderCartoes(); showToast('Excluído','var(--red)');
};

const salvarCompra = () => {
  const cartao = DB.cartoes.find(c => c.id === document.getElementById('compraCartao').value);
  if(!cartao) {
    showToast('Selecione um cartão','var(--red)');
    return;
  }

  const obj = {
    id:uid(), 
    cartaoId: cartao.id,
    descricao:document.getElementById('compraDesc').value,
    valorTotal:parseFloat(document.getElementById('compraValor').value)||0,
    parcelas:parseInt(document.getElementById('compraParcelas').value)||1,
    categoriaId:document.getElementById('compraCat').value,
    dataCompra:document.getElementById('compraData').value
  };

  if(!obj.descricao) { showToast('Preencha os campos','var(--red)'); return; }

  DB.compras.push(obj);

  // Gerar parcelas vinculadas à conta do cartão
  // A 1ª parcela cai no mês da FATURA (baseado no fechamento), não no mês da compra
  const mesFatura1 = getMesFatura(obj.dataCompra, cartao.diaFechamento); // "YYYY-MM"
  const [anoF, mesF] = mesFatura1.split('-').map(Number);

  for(let p=0; p<obj.parcelas; p++){
    const anoAlvo = anoF + Math.floor((mesF - 1 + p) / 12);
    const mesAlvo = ((mesF - 1 + p) % 12) + 1;
    // dia de vencimento da fatura como data da transação
    const diaVenc = Number(cartao.diaVencimento || 5);
    const ultimoDia = new Date(anoAlvo, mesAlvo, 0).getDate();
    const diaAlvo = Math.min(diaVenc, ultimoDia);
    const dataStr = `${anoAlvo}-${String(mesAlvo).padStart(2,'0')}-${String(diaAlvo).padStart(2,'0')}`;

    DB.transacoes.push({
      id:uid(),
      tipo:'despesa',
      valor: obj.valorTotal / obj.parcelas,
      descricao: `${obj.descricao} (${p+1}/${obj.parcelas})`,
      categoriaId: obj.categoriaId,
      contaId: cartao.contaId || '',
      dataTransacao: dataStr,
      observacao: `Parcela cartão ${cartao.nome}`,
      status:'realizado',
      recorrencia:'nenhuma',
      compraId: obj.id
    });
  }

  saveDB(); 
  closeModal('modalCompra'); 
  renderCartoes(); 
  renderTransacoes(); 
  renderDashboard();
  showToast('Compra cadastrada!','var(--green)');
};



const deleteCompra = (id) => {
  if (!confirm('Tem certeza que deseja apagar esta compra?\n\nAs parcelas geradas também serão excluídas.')) return;

  // Remove a compra
  DB.compras = DB.compras.filter(cp => cp.id !== id);

  // Remove as transações (parcelas) vinculadas à compra pelo compraId
  DB.transacoes = DB.transacoes.filter(t => t.compraId !== id);

  saveDB();
  renderCartoes();
  renderTransacoes();
  renderDashboard();
  showToast('Compra e parcelas excluídas!', 'var(--red)');
};

// ========== METAS ==========
const renderMetas = () => {
  const el = document.getElementById('metasList');
  if(!DB.metas.length) { el.innerHTML='<div class="empty-state"><i class="fas fa-bullseye"></i><p>Nenhuma meta cadastrada</p></div>'; return; }
  el.innerHTML = DB.metas.map(m=>{
    const pct = Math.min(100, ((m.valorAtual||0)/(m.valorObjetivo||1))*100);
    const cor = pct>=100?'var(--green)':pct>=60?'var(--accent)':'var(--yellow)';
    return `<div class="goal-card">
      <div class="goal-header">
        <div>
          <div class="goal-name">${m.nome}</div>
          <div style="font-size:12px;color:var(--text2)">Até ${m.dataLimite||'—'}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="goal-pct" style="color:${cor}">${pct.toFixed(0)}%</div>
          <div class="item-actions">
            <button class="action-btn" onclick="editMeta('${m.id}')">✏️</button>
            <button class="action-btn danger" onclick="deleteMeta('${m.id}')">🗑️</button>
          </div>
        </div>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${cor}"></div></div>
      <div class="goal-values">
        <span>Atual: ${fmt(m.valorAtual||0)}</span>
        <span>Objetivo: ${fmt(m.valorObjetivo)}</span>
      </div>
    </div>`;
  }).join('');
};

const editMeta = (id) => {
  const m=DB.metas.find(x=>x.id===id); if(!m) return;
  document.getElementById('metaEditId').value=id;
  document.getElementById('metaNome').value=m.nome;
  document.getElementById('metaObjetivo').value=m.valorObjetivo;
  document.getElementById('metaAtual').value=m.valorAtual||0;
  document.getElementById('metaData').value=m.dataLimite||'';
  openModal('modalMeta');
};

const salvarMeta = () => {
  const id = document.getElementById('metaEditId').value;
  const obj = {
    id:id||uid(), nome:document.getElementById('metaNome').value,
    valorObjetivo:parseFloat(document.getElementById('metaObjetivo').value)||0,
    valorAtual:parseFloat(document.getElementById('metaAtual').value)||0,
    dataLimite:document.getElementById('metaData').value
  };
  if(!obj.nome) { showToast('Informe o nome','var(--red)'); return; }
  if(id) { const i=DB.metas.findIndex(x=>x.id===id); DB.metas[i]=obj; }
  else DB.metas.push(obj);
  document.getElementById('metaEditId').value='';
  saveDB(); closeModal('modalMeta'); renderMetas(); showToast('Meta salva!','var(--green)');
};

const deleteMeta = (id) => {
  DB.metas = DB.metas.filter(m=>m.id!==id);
  saveDB(); renderMetas(); showToast('Excluída','var(--red)');
};

// ========== ORÇAMENTO ==========
const renderOrcamento = () => {
  const el = document.getElementById('orcamentoList');
  if(!DB.orcamentos.length) { el.innerHTML='<div class="empty-state"><i class="fas fa-wallet"></i><p>Nenhum orçamento definido</p></div>'; return; }
  const mesAtual = thisMonth();
  el.innerHTML = '<div class="card">'+DB.orcamentos.map(o=>{
    const cat = DB.categorias.find(c=>c.id===o.categoriaId);
    const gasto = DB.transacoes.filter(t=>t.tipo==='despesa'&&t.categoriaId===o.categoriaId&&t.dataTransacao?.startsWith(o.mes||mesAtual))
      .reduce((s,t)=>s+Number(t.valor||0),0);
    const pct = Math.min(100, (gasto/(o.limite||1))*100);
    const cor = pct>=100?'var(--red)':pct>=80?'var(--yellow)':'var(--green)';
    return `<div class="budget-item">
      <div class="budget-row">
        <div class="budget-cat">${cat?.icone||''} ${cat?.nome||'—'}</div>
        <div class="budget-values">${fmt(gasto)} / ${fmt(o.limite)}</div>
        <button class="action-btn danger" onclick="deleteOrcamento('${o.id}')" style="width:24px;height:24px;font-size:10px">🗑️</button>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${cor}"></div></div>
      ${pct>=80?`<div style="font-size:11px;color:${cor};margin-top:4px">${pct>=100?'⚠️ Limite ultrapassado!':'⚠️ Quase no limite'}</div>`:''}
    </div>`;
  }).join('')+'</div>';
};

const salvarOrcamento = () => {
  const obj = {
    id:uid(), categoriaId:document.getElementById('orcCat').value,
    limite:parseFloat(document.getElementById('orcLimite').value)||0,
    mes:document.getElementById('orcMes').value||thisMonth()
  };
  DB.orcamentos.push(obj);
  saveDB(); closeModal('modalOrcamento'); renderOrcamento(); showToast('Orçamento salvo!','var(--green)');
};

const deleteOrcamento = (id) => {
  DB.orcamentos = DB.orcamentos.filter(o=>o.id!==id);
  saveDB(); renderOrcamento();
};

// ========== A PAGAR ==========
const renderApagar = () => {
  const el = document.getElementById('apagarList');
  if(!DB.apagar.length) { el.innerHTML='<div class="empty-state"><i class="fas fa-file-invoice-dollar"></i><p>Nenhuma conta a pagar</p></div>'; return; }
  const sorted = [...DB.apagar].sort((a,b)=>a.vencimento?.localeCompare(b.vencimento));
  el.innerHTML = sorted.map(a=>{
    const venc = new Date(a.vencimento);
    const hoje = new Date();
    const diff = Math.ceil((venc-hoje)/(1000*60*60*24));
    const chipCor = a.status==='pago'?'chip-green':diff<0?'chip-red':diff<=3?'chip-yellow':'chip-blue';
    const chipTxt = a.status==='pago'?'Pago':diff<0?'Vencido':diff===0?'Hoje':diff<=3?`${diff}d`:`${diff}d`;
    return `<div class="card-sm list-item" style="padding:12px">
      <div class="item-info">
        <div class="item-name">${a.descricao}</div>
        <div class="item-sub">Vence: ${fmtDate(a.vencimento)} ${a.recorrencia==='mensal'?'• Mensal':''}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <div class="item-amount negative">${fmt(a.valor)}</div>
        <div style="display:flex;gap:4px;align-items:center">
          <span class="chip ${chipCor}">${chipTxt}</span>
          ${a.status!=='pago'?`<button class="action-btn" onclick="marcarPago('apagar','${a.id}')" title="Marcar como pago">✅</button>`:''}
          <button class="action-btn danger" onclick="deleteApagar('${a.id}')">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');
};

const salvarApagar = () => {
  const id = document.getElementById('apagarEditId').value;
  const obj = {
    id:id||uid(), descricao:document.getElementById('apagarDesc').value,
    valor:parseFloat(document.getElementById('apagarValor').value)||0,
    vencimento:document.getElementById('apagarVenc').value,
    categoriaId:document.getElementById('apagarCat').value,
    recorrencia:document.getElementById('apagarRecorrencia').value,
    status:'pendente'
  };
  if(!obj.descricao) { showToast('Informe a descrição','var(--red)'); return; }
  DB.apagar.push(obj);
  saveDB(); closeModal('modalApagar'); renderApagar(); showToast('Salvo!','var(--green)');
};

const deleteApagar = (id) => { DB.apagar=DB.apagar.filter(a=>a.id!==id); saveDB(); renderApagar(); };
const marcarPago = (lista, id) => {
  const arr = lista==='apagar'?DB.apagar:DB.areceber;
  const item = arr.find(x=>x.id===id);
  if(item) { item.status='pago'; saveDB(); lista==='apagar'?renderApagar():renderAreceber(); showToast('Marcado como pago!','var(--green)'); }
};

// ========== A RECEBER ==========
const renderAreceber = () => {
  const el = document.getElementById('areceberList');
  if(!DB.areceber.length) { el.innerHTML='<div class="empty-state"><i class="fas fa-hand-holding-usd"></i><p>Nenhuma conta a receber</p></div>'; return; }
  el.innerHTML = [...DB.areceber].sort((a,b)=>a.vencimento?.localeCompare(b.vencimento)).map(a=>{
    const diff = Math.ceil((new Date(a.vencimento)-new Date())/(1000*60*60*24));
    const chipCor = a.status==='recebido'?'chip-green':diff<0?'chip-red':diff<=3?'chip-yellow':'chip-blue';
    return `<div class="card-sm list-item" style="padding:12px">
      <div class="item-info">
        <div class="item-name">${a.descricao}</div>
        <div class="item-sub">Vence: ${fmtDate(a.vencimento)}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <div class="item-amount positive">${fmt(a.valor)}</div>
        <div style="display:flex;gap:4px">
          <span class="chip ${chipCor}">${a.status==='recebido'?'Recebido':diff<0?'Atrasado':`${Math.max(0,diff)}d`}</span>
          ${a.status!=='recebido'?`<button class="action-btn" onclick="marcarPago('areceber','${a.id}')" title="Marcar recebido">✅</button>`:''}
          <button class="action-btn danger" onclick="deleteAreceber('${a.id}')">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');
};

const salvarAreceber = () => {
  const obj = {
    id:uid(), descricao:document.getElementById('areceberDesc').value,
    valor:parseFloat(document.getElementById('areceberValor').value)||0,
    vencimento:document.getElementById('areceberVenc').value,
    categoriaId:document.getElementById('areceberCat').value,
    status:'pendente'
  };
  if(!obj.descricao) { showToast('Informe a descrição','var(--red)'); return; }
  DB.areceber.push(obj);
  saveDB(); closeModal('modalAreceber'); renderAreceber(); showToast('Salvo!','var(--green)');
};

const deleteAreceber = (id) => { DB.areceber=DB.areceber.filter(a=>a.id!==id); saveDB(); renderAreceber(); };

// ========== DASHBOARD ==========
const onDashDateChange = () => { renderDashboard(); };

const renderDashboard = () => {
  const dashDateEl = document.getElementById('dashDate');
  const hj = dashDateEl?.value || today();
  const mes = hj.substr(0, 7);
  const transacoesMes = DB.transacoes.filter(t=>t.dataTransacao?.startsWith(mes));
  const receitas = transacoesMes.filter(t=>t.tipo==='receita').reduce((s,t)=>s+Number(t.valor||0),0);
  const despesas = transacoesMes.filter(t=>t.tipo==='despesa').reduce((s,t)=>s+Number(t.valor||0),0);
  const economia = receitas - despesas;
  const patrimonio = DB.contas.reduce((s,c)=>s+getSaldoConta(c.id, hj),0);
  const fatAberto = DB.cartoes.reduce((s,c)=>{
    const usado = DB.compras.filter(cp=>cp.cartaoId===c.id).reduce((x,cp)=>x+cp.valorTotal/cp.parcelas,0);
    return s+usado;
  },0);

  document.getElementById('heroBalance').textContent = fmt(patrimonio);
  document.getElementById('heroReceitas').textContent = fmt(receitas);
  document.getElementById('heroDespesas').textContent = fmt(despesas);
  document.getElementById('statReceitas').textContent = fmt(receitas);
  document.getElementById('statDespesas').textContent = fmt(despesas);
  document.getElementById('statEconomia').textContent = fmt(economia);
  document.getElementById('statEconomia').style.color = economia>=0?'var(--green)':'var(--red)';
  document.getElementById('statFaturas').textContent = fmt(fatAberto);

  renderBarChart();
  renderPieChart(mes);
  renderRecentTransactions();
};

const renderRecentTransactions = () => {
  const el = document.getElementById('recentTransactions');
  const recent = [...DB.transacoes].sort((a,b)=>b.dataTransacao?.localeCompare(a.dataTransacao)).slice(0,5);
  if(!recent.length) { el.innerHTML='<div class="empty-state"><i class="fas fa-receipt"></i><p>Nenhuma transação</p></div>'; return; }
  el.innerHTML = recent.map(t=>{
    const cor = t.tipo==='receita'?'var(--green)':t.tipo==='despesa'?'var(--red)':'var(--blue)';
    const sinal = t.tipo==='receita'?'+':t.tipo==='despesa'?'-':'⇄';
    const cat = DB.categorias.find(c=>c.id===t.categoriaId);
    return `<div class="list-item">
      <div class="item-icon" style="background:${cor}22;color:${cor}">${cat?.icone||'💰'}</div>
      <div class="item-info"><div class="item-name">${t.descricao||'Sem descrição'}</div><div class="item-sub">${fmtDate(t.dataTransacao)}</div></div>
      <div class="item-amount" style="color:${cor}">${sinal} ${fmt(t.valor)}</div>
    </div>`;
  }).join('');
};

let chartMode = 'prev';
const setChartMode = (mode) => {
  chartMode = mode;
  
  const btnPrev = document.getElementById('btnChartPrev');
  const btnNext = document.getElementById('btnChartNext');
  const btn12 = document.getElementById('btnChart12m');

  btnPrev.style.background = mode === 'prev' ? 'var(--accent)' : 'transparent';
  btnPrev.style.color = mode === 'prev' ? '#fff' : 'var(--text2)';
  btnPrev.style.borderColor = mode === 'prev' ? 'var(--accent)' : 'var(--border)';

  btnNext.style.background = mode === 'next' ? 'var(--accent)' : 'transparent';
  btnNext.style.color = mode === 'next' ? '#fff' : 'var(--text2)';
  btnNext.style.borderColor = mode === 'next' ? 'var(--accent)' : 'var(--border)';

  btn12.style.background = mode === 12 ? 'var(--accent)' : 'transparent';
  btn12.style.color = mode === 12 ? '#fff' : 'var(--text2)';
  btn12.style.borderColor = mode === 12 ? 'var(--accent)' : 'var(--border)';

  renderBarChart();
};


const renderBarChart = () => {
  const ctx = document.getElementById('chartBarras').getContext('2d');
  const months = [];
  const rec = [], desp = [];
  
  let startMonth;
  if (chartMode === 'prev') {
    startMonth = -5; // 5 meses atrás + atual
  } else if (chartMode === 'next') {
    startMonth = 0; // atual + 5 próximos
  } else {
    startMonth = -6; // 12M
  }

  const totalMonths = chartMode === 12 ? 12 : 6;

  for(let i = 0; i < totalMonths; i++){
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + startMonth + i);
    const m = d.toISOString().substr(0,7);
    const label = d.toLocaleDateString('pt-BR', {month:'short'}) + 
                 (startMonth + i < 0 ? ' «' : (startMonth + i > 0 ? ' ›' : ''));
    months.push(label);
    
    const trans = DB.transacoes.filter(t => t.dataTransacao?.startsWith(m));
    rec.push(trans.filter(t=>t.tipo==='receita').reduce((s,t)=>s+Number(t.valor||0),0));
    desp.push(trans.filter(t=>t.tipo==='despesa').reduce((s,t)=>s+Number(t.valor||0),0));
  }

  if(chartBar) chartBar.destroy();
  chartBar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        {label: 'Receitas', data: rec, backgroundColor: 'rgba(67,233,123,0.7)', borderRadius: 6},
        {label: 'Despesas', data: desp, backgroundColor: 'rgba(255,101,132,0.7)', borderRadius: 6}
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#9898b0', font: {size:11} } } },
      scales: {
        x: { ticks: { color: '#9898b0', font: {size:10} }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#9898b0', font: {size:10}, callback: v => 'R$' + v.toLocaleString('pt-BR') }, grid: { color: 'rgba(255,255,255,0.05)' }}
      }
    }
  });
};

const renderPieChart = (mes) => {
  mes = mes || thisMonth();
  const ctx = document.getElementById('chartPizza').getContext('2d');
  // Filtrar APENAS despesas do mês informado
  const despMes = DB.transacoes.filter(t =>
    t.tipo === 'despesa' && t.dataTransacao && t.dataTransacao.startsWith(mes)
  );

  // Total REAL = soma de TODAS as despesas do mês (denominador correto para %)
  const totalReal = despMes.reduce((s, t) => s + Number(t.valor || 0), 0);

  const bycat = {};
  despMes.forEach(t => {
    const cat = DB.categorias.find(c => c.id === t.categoriaId);
    const key = cat ? t.categoriaId : '__outros__';
    bycat[key] = (bycat[key] || 0) + Number(t.valor || 0);
  });

  // Ordenar por maior gasto e pegar top 6
  const cats = Object.keys(bycat).sort((a,b) => bycat[b] - bycat[a]).slice(0, 6);
  const labels = cats.map(id => {
    if (id === '__outros__') return '📦 Sem categoria';
    const c = DB.categorias.find(x => x.id === id);
    return c ? `${c.icone||''} ${c.nome}` : '📦 Outros';
  });
  const data = cats.map(id => bycat[id]);
  // Total é APENAS a soma das categorias exibidas (consistente com o gráfico)
  const total = totalReal;
  const colors = ['#6c63ff','#ff6584','#43e97b','#f7c844','#38b2f7','#f7971e'];

  if (chartPie) chartPie.destroy();
  const legend = document.getElementById('pizzaLegend');

  if (!data.length) {
    legend.innerHTML = '<span style="color:var(--text3)">Sem despesas no mês</span>';
    return;
  }

  chartPie = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${fmt(ctx.parsed)} (${((ctx.parsed / total) * 100).toFixed(1)}%)`
          }
        }
      },
      cutout: '65%'
    },
    plugins: [{
      id: 'centerText',
      afterDraw(chart) {
        const { ctx, chartArea: { top, bottom, left, right } } = chart;
        const cx = (left + right) / 2, cy = (top + bottom) / 2;
        ctx.save();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#9898b0'; ctx.font = '10px DM Sans';
        ctx.fillText('Total', cx, cy - 10);
        ctx.fillStyle = '#f0f0f5'; ctx.font = 'bold 13px DM Mono';
        ctx.fillText(fmt(total), cx, cy + 6);
        ctx.restore();
      }
    }]
  });

  legend.innerHTML = labels.map((l, i) => `
    <div style="display:flex;align-items:center;gap:6px">
      <div style="width:10px;height:10px;border-radius:50%;background:${colors[i]};flex-shrink:0"></div>
      <span style="flex:1;font-size:12px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l}</span>
      <span style="font-size:11px;color:var(--text3);flex-shrink:0">${((data[i] / total) * 100).toFixed(0)}%</span>
    </div>`).join('');
};

// ========== RELATÓRIOS ==========
const initRelatorios = () => {
  const now = new Date();
  const m6 = new Date(now); m6.setMonth(m6.getMonth()-5);
  document.getElementById('relDe').value = m6.toISOString().substr(0,7);
  document.getElementById('relAte').value = now.toISOString().substr(0,7);
  renderRelatorios();
};

const renderRelatorios = () => {
  const de = document.getElementById('relDe').value;
  const ate = document.getElementById('relAte').value;
  const trans = DB.transacoes.filter(t=>t.dataTransacao>=de+'-01'&&t.dataTransacao<=ate+'-31');
  const rec = trans.filter(t=>t.tipo==='receita').reduce((s,t)=>s+Number(t.valor||0),0);
  const desp = trans.filter(t=>t.tipo==='despesa').reduce((s,t)=>s+Number(t.valor||0),0);
  const bycat = {};
  trans.filter(t=>t.tipo==='despesa').forEach(t=>{ bycat[t.categoriaId]=(bycat[t.categoriaId]||0)+Number(t.valor||0); });
  const el = document.getElementById('relatorioContent');
  el.innerHTML = `
    <div class="card" style="margin-bottom:12px">
      <div class="section-title" style="margin-bottom:12px">Resumo do Período</div>
      <div class="report-row"><span>Total de Receitas</span><span style="color:var(--green);font-weight:700">${fmt(rec)}</span></div>
      <div class="report-row"><span>Total de Despesas</span><span style="color:var(--red);font-weight:700">${fmt(desp)}</span></div>
      <div class="report-row"><span>Saldo do Período</span><span style="color:${rec-desp>=0?'var(--green)':'var(--red)'};font-weight:700">${fmt(rec-desp)}</span></div>
      <div class="report-row"><span>Qtd. Transações</span><span>${trans.length}</span></div>
    </div>
    <div class="card">
      <div class="section-title" style="margin-bottom:12px">Despesas por Categoria</div>
      ${Object.keys(bycat).length?Object.keys(bycat).sort((a,b)=>bycat[b]-bycat[a]).map(id=>{
        const cat=DB.categorias.find(c=>c.id===id);
        const pct=(bycat[id]/desp*100).toFixed(1);
        return `<div class="budget-item">
          <div class="budget-row"><div class="budget-cat">${cat?.icone||''} ${cat?.nome||'Outros'}</div><div class="budget-values">${fmt(bycat[id])} (${pct}%)</div></div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${cat?.cor||'var(--accent)'}"></div></div>
        </div>`;
      }).join(''):'<div style="color:var(--text3);font-size:13px;text-align:center;padding:16px">Sem despesas no período</div>'}
    </div>
  `;
};

// ========== CONFIG ==========
const clearAll = () => {
  DB = { contas:[], transacoes:[], categorias:[], cartoes:[], compras:[], metas:[], orcamentos:[], apagar:[], areceber:[], config:{} };
  initDefaultCategories();
  saveDB(); renderAll(); showToast('Dados limpos','var(--yellow)');
};

// ========== INIT ==========
// Set default month for orcamento modal
document.getElementById('orcMes').value = thisMonth();
// Set default data for compra
document.getElementById('compraData').value = today();


const bootApp = () => {
  populateSelects();
  navigate('dashboard');
  renderDashboard();
};

// PWA: registrar Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('SW registrado'))
      .catch(err => console.log('SW erro:', err));
  });
}

// PWA: prompt de instalação
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('installBtn');
  if (btn) { btn.style.display = 'flex'; }
});
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  showToast('App instalado com sucesso! 🎉', 'var(--green)');
});
window.installApp = () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => { deferredPrompt = null; });
  }
};

