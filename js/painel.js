(function () {
  const loginScreen = document.getElementById('login-screen');
  const painelScreen = document.getElementById('painel-screen');
  const senhaInput = document.getElementById('senha');
  const loginBtn = document.getElementById('login-btn');
  const loginError = document.getElementById('login-error');
  const logoutBtn = document.getElementById('logout-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  const searchInput = document.getElementById('search-input');
  const filterDecisao = document.getElementById('filter-decisao');
  const filterRede = document.getElementById('filter-rede');
  const filterMes = document.getElementById('filter-mes');
  const reportBtn = document.getElementById('report-btn');
  const tbody = document.getElementById('fichas-tbody');
  const emptyState = document.getElementById('empty-state');
  const toast = document.getElementById('toast');

  const modalOverlay = document.getElementById('modal-overlay');
  const modalClose = document.getElementById('modal-close');
  const modalNome = document.getElementById('modal-nome');
  const modalGrid = document.getElementById('modal-detail-grid');
  const modalRedeInput = document.getElementById('modal-rede-input');
  const modalRedeCategoria = document.getElementById('modal-rede-categoria');
  const modalSaveBtn = document.getElementById('modal-save-btn');
  const modalPdfBtn = document.getElementById('modal-pdf-btn');

  let allFichas = [];
  let fichasFiltradasAtual = [];
  let currentFichaId = null;
  let currentFicha = null;
  let senhaAtual = '';

  function showToast(msg, type) {
    toast.textContent = msg;
    toast.className = 'toast show' + (type ? ' ' + type : '');
    setTimeout(() => { toast.className = 'toast'; }, 3500);
  }

  function checkConfigured() {
    if (!API_URL || API_URL.indexOf('COLE_AQUI') !== -1) {
      showToast('Sistema ainda não configurado: falta a URL do backend em js/config.js', 'error');
      return false;
    }
    return true;
  }

  // --- Sessão (mantém login apenas durante a aba aberta) ---
  senhaAtual = sessionStorage.getItem('consolidacao_senha') || '';
  if (senhaAtual) {
    loginScreen.style.display = 'none';
    painelScreen.style.display = 'block';
    carregarFichas();
  }

  loginBtn.addEventListener('click', tentarLogin);
  senhaInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') tentarLogin(); });

  async function tentarLogin() {
    if (!checkConfigured()) return;
    const senha = senhaInput.value.trim();
    if (!senha) return;

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner"></span> Entrando...';
    loginError.style.display = 'none';

    try {
      const url = `${API_URL}?action=list&senha=${encodeURIComponent(senha)}`;
      const resp = await fetch(url);
      const result = await resp.json();

      if (result && result.status === 'ok') {
        senhaAtual = senha;
        sessionStorage.setItem('consolidacao_senha', senha);
        loginScreen.style.display = 'none';
        painelScreen.style.display = 'block';
        renderFichas(result.data || []);
      } else {
        loginError.textContent = (result && result.message) || 'Senha incorreta. Tente novamente.';
        loginError.style.display = 'block';
      }
    } catch (err) {
      console.error(err);
      loginError.textContent = 'Não foi possível conectar ao servidor.';
      loginError.style.display = 'block';
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Entrar';
    }
  }

  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('consolidacao_senha');
    senhaAtual = '';
    painelScreen.style.display = 'none';
    loginScreen.style.display = 'flex';
    senhaInput.value = '';
  });

  refreshBtn.addEventListener('click', carregarFichas);

  async function carregarFichas() {
    if (!checkConfigured()) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:#6b5f5c;">Carregando...</td></tr>';
    try {
      const url = `${API_URL}?action=list&senha=${encodeURIComponent(senhaAtual)}`;
      const resp = await fetch(url);
      const result = await resp.json();
      if (result && result.status === 'ok') {
        renderFichas(result.data || []);
      } else {
        showToast((result && result.message) || 'Erro ao carregar fichas.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Erro de conexão ao carregar fichas.', 'error');
    }
  }

  function renderFichas(data) {
    allFichas = data.slice().sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    atualizarStats(allFichas);
    popularFiltroMes(allFichas);
    aplicarFiltros();
  }

  function mesChave(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function mesLabel(chave) {
    const [ano, mes] = chave.split('-').map(Number);
    const d = new Date(ano, mes - 1, 1);
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function popularFiltroMes(data) {
    const chaves = Array.from(new Set(data.map(f => mesChave(f.timestamp)).filter(Boolean)));
    chaves.sort((a, b) => b.localeCompare(a));

    const valorAtual = filterMes.value;
    filterMes.innerHTML = '<option value="">Todos os meses</option>' +
      chaves.map(c => `<option value="${c}">${mesLabel(c)}</option>`).join('');

    if (chaves.includes(valorAtual)) {
      filterMes.value = valorAtual;
    }
  }

  function atualizarStats(data) {
    document.getElementById('stat-total').textContent = data.length;
    document.getElementById('stat-primeira').textContent = data.filter(f => f.decisao === 'Entregando pela primeira vez a vida para Jesus').length;
    document.getElementById('stat-voltando').textContent = data.filter(f => f.decisao === 'Voltando para Jesus').length;
    document.getElementById('stat-pendentes').textContent = data.filter(f => !f.encaminhado_rede || !f.encaminhado_rede.trim()).length;
  }

  function aplicarFiltros() {
    const term = searchInput.value.trim().toLowerCase();
    const decisao = filterDecisao.value;
    const rede = filterRede.value;
    const mes = filterMes.value;

    let filtrado = allFichas.filter(f => {
      if (decisao && f.decisao !== decisao) return false;
      if (mes && mesChave(f.timestamp) !== mes) return false;
      const temRede = !!(f.encaminhado_rede && f.encaminhado_rede.trim());
      if (rede === 'pendente' && temRede) return false;
      if (rede === 'feito' && !temRede) return false;
      if (term) {
        const alvo = `${f.nome_completo || ''} ${f.bairro || ''} ${f.telefone || ''}`.toLowerCase();
        if (!alvo.includes(term)) return false;
      }
      return true;
    });

    fichasFiltradasAtual = filtrado;
    renderTable(filtrado);
  }

  searchInput.addEventListener('input', aplicarFiltros);
  filterDecisao.addEventListener('change', aplicarFiltros);
  filterRede.addEventListener('change', aplicarFiltros);
  filterMes.addEventListener('change', aplicarFiltros);

  function formatarData(iso) {
    if (!iso) return '–';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function decisaoResumo(d) {
    if (d === 'Entregando pela primeira vez a vida para Jesus') return '1ª vez com Jesus';
    return d || '–';
  }

  function renderTable(data) {
    tbody.innerHTML = '';
    if (!data.length) {
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';

    data.forEach(f => {
      const tr = document.createElement('tr');
      const rede = resumoRede(f);
      tr.innerHTML = `
        <td>${formatarData(f.timestamp)}</td>
        <td>${escapeHtml(f.nome_completo || '–')}</td>
        <td>${escapeHtml(f.telefone || '–')}</td>
        <td>${escapeHtml(f.bairro || '–')}</td>
        <td>${escapeHtml(decisaoResumo(f.decisao))}</td>
        <td>${escapeHtml(resumoCulto(f))}</td>
        <td><span class="tag ${rede.tag}">${escapeHtml(rede.texto)}</span></td>
      `;
      tr.addEventListener('click', () => abrirModal(f));
      tbody.appendChild(tr);
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[s]));
  }

  function detailItem(label, value, full) {
    return `<div class="detail-item${full ? ' full' : ''}"><div class="k">${label}</div><div class="v">${escapeHtml(value || '–')}</div></div>`;
  }

  function resumoRede(f) {
    const temRede = !!(f.encaminhado_rede && f.encaminhado_rede.trim());
    if (!temRede) return { texto: 'Pendente', tag: 'pending' };
    const categoria = f.rede_categoria ? ` (${f.rede_categoria})` : '';
    return { texto: f.encaminhado_rede.trim() + categoria, tag: 'done' };
  }

  function resumoCulto(f) {
    if (f.culto === 'Noite da Unção') return `Noite da Unção (${f.dia_uncao || '–'})`;
    if (f.culto === 'Domingo') return `Domingo (${f.horario_domingo || '–'})`;
    if (f.culto === 'Culto especial') return `Culto especial (${f.qual_culto_especial || '–'})`;
    return f.culto || '–';
  }

  function construirDetalhes(f) {
    const filhos = f.tem_filhos === 'Sim' ? `Sim (${f.quantos_filhos || '?'})` : 'Não';
    const chegou = f.como_chegou === 'Foi convidado por alguém' ? `Convidado por: ${f.quem_convidou || '–'}` : f.como_chegou;
    const redeAnterior = f.participou_rede === 'Sim' ? `Sim (${f.qual_rede || '–'})` : 'Não';
    const endereco = `${f.endereco || ''}${f.numero ? ', ' + f.numero : ''}`;
    const culto = resumoCulto(f);
    return { filhos, chegou, redeAnterior, endereco, culto };
  }

  function abrirModal(f) {
    currentFichaId = f.id;
    currentFicha = f;
    modalNome.textContent = f.nome_completo || 'Detalhes da ficha';

    const { filhos, chegou, redeAnterior, endereco, culto } = construirDetalhes(f);

    modalGrid.innerHTML = [
      detailItem('Telefone', f.telefone),
      detailItem('Idade', f.idade),
      detailItem('Instagram', f.instagram),
      detailItem('Profissão', f.profissao),
      detailItem('Endereço', endereco, true),
      detailItem('Bairro', f.bairro),
      detailItem('Cidade', f.cidade),
      detailItem('Ponto de referência', f.ponto_referencia, true),
      detailItem('Estado civil', f.estado_civil),
      detailItem('Tem filhos', filhos),
      detailItem('Decisão hoje', f.decisao, true),
      detailItem('Qual culto', culto, true),
      detailItem('Como chegou', chegou, true),
      detailItem('Já participou de rede', redeAnterior, true),
      detailItem('Preenchido por', f.preenchido_por),
      detailItem('Data de cadastro', formatarData(f.timestamp)),
    ].join('');

    modalRedeInput.value = f.encaminhado_rede || '';
    modalRedeCategoria.value = f.rede_categoria || '';
    modalOverlay.classList.add('show');
  }

  function fecharModal() {
    modalOverlay.classList.remove('show');
    currentFichaId = null;
    currentFicha = null;
  }

  modalClose.addEventListener('click', fecharModal);
  modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) fecharModal(); });

  modalSaveBtn.addEventListener('click', async () => {
    if (!currentFichaId) return;
    modalSaveBtn.disabled = true;
    modalSaveBtn.innerHTML = '<span class="spinner"></span> Salvando...';

    try {
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'update_rede',
          senha: senhaAtual,
          id: currentFichaId,
          encaminhado_rede: modalRedeInput.value.trim(),
          rede_categoria: modalRedeCategoria.value
        })
      });
      const result = await resp.json();
      if (result && result.status === 'ok') {
        showToast('Atualizado com sucesso!', 'success');
        const f = allFichas.find(x => x.id === currentFichaId);
        if (f) {
          f.encaminhado_rede = modalRedeInput.value.trim();
          f.rede_categoria = modalRedeCategoria.value;
        }
        if (currentFicha) {
          currentFicha.encaminhado_rede = modalRedeInput.value.trim();
          currentFicha.rede_categoria = modalRedeCategoria.value;
        }
        atualizarStats(allFichas);
        aplicarFiltros();
        fecharModal();
      } else {
        showToast((result && result.message) || 'Erro ao salvar.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Erro de conexão ao salvar.', 'error');
    } finally {
      modalSaveBtn.disabled = false;
      modalSaveBtn.textContent = 'Salvar';
    }
  });

  // --- Exportar ficha em PDF (via impressão nativa do navegador) ---
  // Não depende de nenhuma biblioteca externa: abre uma janela com a ficha
  // formatada e aciona o diálogo de impressão do navegador, onde a pessoa
  // escolhe "Salvar como PDF".

  function formatarDataCurta(iso) {
    if (!iso) return '–';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function itemHtml(label, value, full) {
    return `<div class="item${full ? ' full' : ''}"><div class="k">${escapeHtml(label)}</div><div class="v">${escapeHtml(value || '–')}</div></div>`;
  }

  function gerarHtmlImpressao(f) {
    const { filhos, chegou, redeAnterior, endereco, culto } = construirDetalhes(f);
    const logoUrl = new URL('assets/logo.png', window.location.href).href;
    const geradoEm = formatarDataCurta(new Date().toISOString());

    const itens = [
      itemHtml('Telefone', f.telefone),
      itemHtml('Idade', f.idade),
      itemHtml('Instagram', f.instagram),
      itemHtml('Profissão', f.profissao),
      itemHtml('Endereço', endereco, true),
      itemHtml('Bairro', f.bairro),
      itemHtml('Cidade', f.cidade),
      itemHtml('Ponto de referência', f.ponto_referencia, true),
      itemHtml('Estado civil', f.estado_civil),
      itemHtml('Tem filhos', filhos),
      itemHtml('Decisão hoje', f.decisao, true),
      itemHtml('Qual culto', culto, true),
      itemHtml('Como chegou à igreja', chegou, true),
      itemHtml('Já participou de alguma rede', redeAnterior, true),
      itemHtml('Preenchido por', f.preenchido_por),
      itemHtml('Data de cadastro', formatarDataCurta(f.timestamp)),
    ].join('');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Ficha - ${escapeHtml(f.nome_completo || '')}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color:#2b2320; margin:0; padding: 6px; }
  .header { display:flex; align-items:center; gap:14px; margin-bottom: 16px; }
  .logo-box { width:52px; height:52px; min-width:52px; background:#b52e28; border-radius:12px; display:flex; align-items:center; justify-content:center; }
  .logo-box img { width:32px; height:32px; }
  .header h1 { margin:0; font-size:19px; color:#8f221d; }
  .header .meta { font-size:11px; color:#6b5f5c; margin-top:3px; }
  hr { border:none; border-top:1px solid #e7dcda; margin:18px 0; }
  .nome { font-size:21px; font-weight:700; margin:0 0 16px; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:12px 24px; margin-bottom:16px; }
  .grid .full { grid-column: 1 / -1; }
  .item .k { font-size:9px; text-transform:uppercase; letter-spacing:.03em; color:#6b5f5c; margin-bottom:2px; }
  .item .v { font-size:13px; }
  .rede-box { background:#fbf3f2; border:1px solid #f7e6e5; border-radius:10px; padding:14px 16px; margin-top:8px; }
  .rede-box .k { font-size:10px; text-transform:uppercase; letter-spacing:.03em; color:#8f221d; font-weight:700; margin-bottom:5px; }
  .rede-box .v { font-size:14px; }
  .footer { margin-top:22px; font-size:9px; color:#b7aba7; }
</style>
</head>
<body>
  <div class="header">
    <div class="logo-box"><img src="${logoUrl}" alt="Logo"></div>
    <div>
      <h1>Ficha de Consolidação</h1>
      <div class="meta">Documento gerado em ${geradoEm}</div>
    </div>
  </div>
  <hr>
  <div class="nome">${escapeHtml(f.nome_completo || 'Sem nome')}</div>
  <div class="grid">${itens}</div>
  <div class="rede-box">
    <div class="k">Encaminhado(a) à rede</div>
    <div class="v">${escapeHtml(f.encaminhado_rede ? f.encaminhado_rede + (f.rede_categoria ? ' — ' + f.rede_categoria : '') : 'Ainda não encaminhado(a)')}</div>
  </div>
  <div class="footer">Documento de uso interno — dados usados apenas para acompanhamento pastoral.</div>
  <script>
    window.onload = function () {
      setTimeout(function () { window.print(); }, 200);
    };
    window.onafterprint = function () { window.close(); };
  <\/script>
</body>
</html>`;
  }

  modalPdfBtn.addEventListener('click', () => {
    if (!currentFicha) return;
    const janela = window.open('', '_blank', 'width=850,height=1000');
    if (!janela) {
      showToast('Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.', 'error');
      return;
    }
    janela.document.open();
    janela.document.write(gerarHtmlImpressao(currentFicha));
    janela.document.close();
  });

  // --- Relatório em PDF (lista de fichas, com ou sem filtro aplicado) ---
  // Usa a mesma técnica de impressão nativa do navegador da ficha individual.
  // O relatório sempre reflete o que está sendo exibido na tabela no momento
  // do clique: se algum filtro (mês, decisão, rede, busca) estiver ativo, o
  // relatório sai filtrado; se estiver tudo em "Todos", sai completo.

  function montarResumoFiltrosAtivos() {
    const partes = [];
    if (filterMes.value) partes.push('Mês: ' + filterMes.options[filterMes.selectedIndex].textContent);
    if (filterDecisao.value) partes.push('Decisão: ' + filterDecisao.options[filterDecisao.selectedIndex].textContent);
    if (filterRede.value) partes.push('Rede: ' + filterRede.options[filterRede.selectedIndex].textContent);
    if (searchInput.value.trim()) partes.push('Busca: "' + searchInput.value.trim() + '"');
    return partes.length ? partes.join(' · ') : 'Nenhum filtro aplicado (todos os registros)';
  }

  function gerarHtmlRelatorio(dados, resumoFiltros) {
    const logoUrl = new URL('assets/logo.png', window.location.href).href;
    const geradoEm = formatarDataCurta(new Date().toISOString());

    const linhas = dados.map(f => {
      const rede = resumoRede(f);
      return `<tr>
        <td>${escapeHtml(formatarData(f.timestamp))}</td>
        <td>${escapeHtml(f.nome_completo || '–')}</td>
        <td>${escapeHtml(f.telefone || '–')}</td>
        <td>${escapeHtml(f.bairro || '–')}</td>
        <td>${escapeHtml(decisaoResumo(f.decisao))}</td>
        <td>${escapeHtml(resumoCulto(f))}</td>
        <td>${escapeHtml(rede.texto)}</td>
      </tr>`;
    }).join('');

    const corpo = dados.length
      ? `<table>
          <thead><tr><th>Data</th><th>Nome</th><th>Telefone</th><th>Bairro</th><th>Decisão</th><th>Culto</th><th>Rede</th></tr></thead>
          <tbody>${linhas}</tbody>
        </table>`
      : `<p class="vazio">Nenhuma ficha encontrada com os filtros aplicados.</p>`;

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório de Fichas de Consolidação</title>
<style>
  @page { size: A4 landscape; margin: 14mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color:#2b2320; margin:0; padding: 6px; }
  .header { display:flex; align-items:center; gap:14px; margin-bottom: 14px; }
  .logo-box { width:48px; height:48px; min-width:48px; background:#b52e28; border-radius:11px; display:flex; align-items:center; justify-content:center; }
  .logo-box img { width:28px; height:28px; }
  .header h1 { margin:0; font-size:18px; color:#8f221d; }
  .header .meta { font-size:11px; color:#6b5f5c; margin-top:3px; }
  hr { border:none; border-top:1px solid #e7dcda; margin:14px 0; }
  table { width:100%; border-collapse:collapse; font-size:11px; }
  thead th { text-align:left; background:#fbf3f2; color:#8f221d; padding:8px 10px; font-weight:600; border-bottom:1px solid #f7e6e5; }
  tbody td { padding:7px 10px; border-bottom:1px solid #f1e9e8; }
  tbody tr:nth-child(even) { background:#fdfaf9; }
  .vazio { color:#6b5f5c; font-size:13px; padding:20px 0; }
  .footer { margin-top:18px; font-size:9px; color:#b7aba7; }
</style>
</head>
<body>
  <div class="header">
    <div class="logo-box"><img src="${logoUrl}" alt="Logo"></div>
    <div>
      <h1>Relatório de Fichas de Consolidação</h1>
      <div class="meta">Gerado em ${geradoEm} · ${dados.length} ficha(s) · ${escapeHtml(resumoFiltros)}</div>
    </div>
  </div>
  <hr>
  ${corpo}
  <div class="footer">Documento de uso interno — dados usados apenas para acompanhamento pastoral.</div>
  <script>
    window.onload = function () {
      setTimeout(function () { window.print(); }, 200);
    };
    window.onafterprint = function () { window.close(); };
  <\/script>
</body>
</html>`;
  }

  reportBtn.addEventListener('click', () => {
    const janela = window.open('', '_blank', 'width=1100,height=800');
    if (!janela) {
      showToast('Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.', 'error');
      return;
    }
    janela.document.open();
    janela.document.write(gerarHtmlRelatorio(fichasFiltradasAtual, montarResumoFiltrosAtivos()));
    janela.document.close();
  });
})();
