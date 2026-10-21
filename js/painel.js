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
  const filterCategoria = document.getElementById('filter-categoria');
  const filterMes = document.getElementById('filter-mes');
  const filterDia = document.getElementById('filter-dia');
  const reportBtn = document.getElementById('report-btn');
  const tbody = document.getElementById('fichas-tbody');
  const emptyState = document.getElementById('empty-state');
  const toast = document.getElementById('toast');
  const selectAllCheckbox = document.getElementById('select-all-checkbox');
  const bulkBar = document.getElementById('bulk-bar');
  const bulkCount = document.getElementById('bulk-count');
  const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
  const bulkClearBtn = document.getElementById('bulk-clear-btn');
  const bulkPdfBtn = document.getElementById('bulk-pdf-btn');
  const perfilBadge = document.getElementById('perfil-badge');
  const fichasStatusBox = document.getElementById('fichas-status');
  const fichasStatusTexto = document.getElementById('fichas-status-texto');
  const liberarFichasBtn = document.getElementById('liberar-fichas-btn');
  const encerrarLiberacaoBtn = document.getElementById('encerrar-liberacao-btn');
  const fichasStatusHorarios = document.getElementById('fichas-status-horarios');
  const horariosBtn = document.getElementById('horarios-btn');
  const horariosOverlay = document.getElementById('horarios-overlay');
  const horariosClose = document.getElementById('horarios-close');
  const horariosBloqueio = document.getElementById('horarios-bloqueio');
  const horariosHoras = document.getElementById('horarios-horas');
  const horariosLista = document.getElementById('horarios-lista');
  const horariosAdd = document.getElementById('horarios-add');
  const horariosSalvar = document.getElementById('horarios-salvar');
  let horariosConfig = null;

  const modalOverlay = document.getElementById('modal-overlay');
  const modalClose = document.getElementById('modal-close');
  const modalNome = document.getElementById('modal-nome');
  const modalGrid = document.getElementById('modal-detail-grid');
  const modalRedeInput = document.getElementById('modal-rede-input');
  const modalRedeCategoria = document.getElementById('modal-rede-categoria');
  const modalSaveBtn = document.getElementById('modal-save-btn');
  const modalPdfBtn = document.getElementById('modal-pdf-btn');
  const modalDeleteBtn = document.getElementById('modal-delete-btn');

  let allFichas = [];
  let fichasFiltradasAtual = [];
  let currentFichaId = null;
  let currentFicha = null;
  let senhaAtual = '';
  let perfilAtual = '';
  let selectedIds = new Set();
  // Ordenação da tabela ao clicar no cabeçalho (padrão: mais recentes primeiro)
  let ordemCampo = 'data';
  let ordemDirecao = 'desc';
  const sortHeaders = document.querySelectorAll('th.sortable');

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

  // --- Perfil de acesso ---
  // Gestor: pode tudo, menos excluir fichas. Administrador: pode tudo.
  // A regra vale de verdade no backend; aqui só escondemos os botões de exclusão.
  function aplicarPerfil(perfil) {
    perfilAtual = perfil || '';
    document.body.classList.toggle('perfil-administrador', perfilAtual === 'administrador');
    perfilBadge.textContent = perfilAtual === 'administrador' ? 'Administrador'
      : perfilAtual === 'gestor' ? 'Gestor' : '';
  }

  function isAdministrador() {
    return perfilAtual === 'administrador';
  }

  // --- Sessão (mantém login apenas durante a aba aberta) ---
  senhaAtual = sessionStorage.getItem('consolidacao_senha') || '';
  aplicarPerfil(sessionStorage.getItem('consolidacao_perfil') || '');
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
        sessionStorage.setItem('consolidacao_perfil', result.perfil || '');
        aplicarPerfil(result.perfil);
        loginScreen.style.display = 'none';
        painelScreen.style.display = 'block';
        atualizarStatusFichas(result.fichas);
        horariosConfig = result.horarios_config || null;
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
    sessionStorage.removeItem('consolidacao_perfil');
    senhaAtual = '';
    aplicarPerfil('');
    painelScreen.style.display = 'none';
    loginScreen.style.display = 'flex';
    senhaInput.value = '';
  });

  refreshBtn.addEventListener('click', carregarFichas);

  async function carregarFichas() {
    if (!checkConfigured()) return;
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:24px; color:#6b5f5c;">Carregando...</td></tr>';
    try {
      const url = `${API_URL}?action=list&senha=${encodeURIComponent(senhaAtual)}`;
      const resp = await fetch(url);
      const result = await resp.json();
      if (result && result.status === 'ok') {
        sessionStorage.setItem('consolidacao_perfil', result.perfil || '');
        aplicarPerfil(result.perfil);
        atualizarStatusFichas(result.fichas);
        horariosConfig = result.horarios_config || null;
        renderFichas(result.data || []);
      } else {
        showToast((result && result.message) || 'Erro ao carregar fichas.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Erro de conexão ao carregar fichas.', 'error');
    }
  }

  // --- Status das fichas (horário dos cultos / liberação manual) ---
  function atualizarStatusFichas(fichas) {
    if (!fichas) { fichasStatusBox.style.display = 'none'; return; }
    let texto;
    if (fichas.motivo === 'liberacao') {
      const ate = new Date(fichas.liberadoAte).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      texto = '🟢 Fichas liberadas manualmente até as ' + ate;
    } else if (fichas.motivo === 'culto') {
      texto = '🟢 Fichas abertas — horário de culto' + (fichas.culto ? ' (' + fichas.culto + ')' : '');
    } else if (fichas.motivo === 'sem_bloqueio') {
      texto = '🟢 Fichas abertas (sem bloqueio de horário)';
    } else {
      texto = '🔒 Fichas fechadas — fora do horário dos cultos';
    }
    fichasStatusTexto.textContent = texto;
    fichasStatusHorarios.textContent = fichas.horarios ? 'Horários: ' + fichas.horarios : '';
    fichasStatusBox.className = 'fichas-status ' + (fichas.aberto ? 'aberto' : 'fechado');
    liberarFichasBtn.style.display = fichas.motivo === 'liberacao' || fichas.motivo === 'sem_bloqueio' ? 'none' : '';
    encerrarLiberacaoBtn.style.display = fichas.motivo === 'liberacao' ? '' : 'none';
    fichasStatusBox.style.display = 'flex';
  }

  async function alterarLiberacao(action, botao, textoOriginal) {
    botao.disabled = true;
    botao.innerHTML = '<span class="spinner"></span> Aguarde...';
    try {
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: action, senha: senhaAtual, horas: 4 })
      });
      const result = await resp.json();
      if (result && result.status === 'ok') {
        atualizarStatusFichas(result.fichas);
        showToast(action === 'liberar_fichas' ? 'Fichas liberadas por 4 horas.' : 'Liberação encerrada.', 'success');
      } else {
        showToast((result && result.message) || 'Erro ao alterar a liberação.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Erro de conexão.', 'error');
    } finally {
      botao.disabled = false;
      botao.textContent = textoOriginal;
    }
  }

  liberarFichasBtn.addEventListener('click', () => {
    if (!isAdministrador()) return;
    if (!window.confirm('Liberar o envio de fichas pelas próximas 4 horas (culto especial)?')) return;
    alterarLiberacao('liberar_fichas', liberarFichasBtn, '🔓 Liberar fichas por 4 horas');
  });

  encerrarLiberacaoBtn.addEventListener('click', () => {
    if (!isAdministrador()) return;
    alterarLiberacao('encerrar_liberacao', encerrarLiberacaoBtn, '🔒 Encerrar liberação');
  });

  // --- Editor dos horários dos cultos (Administrador) ---
  const NOMES_DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']; // índice + 1 = número do dia

  function adicionarLinhaCulto(culto) {
    const item = document.createElement('div');
    item.className = 'culto-item';
    item.innerHTML = `
      <div class="culto-linha">
        <input type="text" class="culto-nome" placeholder="Nome do culto (ex: Noite da Unção)">
        <button type="button" class="culto-remover" title="Remover culto">&times;</button>
      </div>
      <div class="culto-horas">
        <label>Início <input type="time" class="culto-inicio" required></label>
        <label>Fim <input type="time" class="culto-fim"></label>
        <span class="hint-fim">fim vazio = usa as horas padrão</span>
      </div>
      <div class="culto-dias">
        ${NOMES_DIAS.map((n, i) => `<label><input type="checkbox" value="${i + 1}">${n}</label>`).join('')}
      </div>`;
    item.querySelector('.culto-nome').value = culto.nome || '';
    item.querySelector('.culto-inicio').value = culto.inicio || '19:00';
    item.querySelector('.culto-fim').value = culto.fim || '';
    item.querySelectorAll('.culto-dias input').forEach(cb => {
      cb.checked = (culto.dias || []).includes(Number(cb.value));
    });
    item.querySelector('.culto-remover').addEventListener('click', () => item.remove());
    horariosLista.appendChild(item);
  }

  horariosBtn.addEventListener('click', () => {
    if (!isAdministrador()) return;
    if (!horariosConfig) {
      showToast('Não foi possível carregar os horários. Atualize o Apps Script e clique em Atualizar.', 'error');
      return;
    }
    horariosBloqueio.checked = horariosConfig.bloqueioAtivado !== false;
    horariosHoras.value = horariosConfig.horasPorCulto;
    horariosLista.innerHTML = '';
    (horariosConfig.cultos || []).forEach(adicionarLinhaCulto);
    horariosOverlay.classList.add('show');
  });

  horariosAdd.addEventListener('click', () => adicionarLinhaCulto({ nome: '', inicio: '19:00', dias: [] }));
  horariosClose.addEventListener('click', () => horariosOverlay.classList.remove('show'));
  horariosOverlay.addEventListener('click', (e) => { if (e.target === horariosOverlay) horariosOverlay.classList.remove('show'); });

  horariosSalvar.addEventListener('click', async () => {
    const cultos = Array.from(horariosLista.querySelectorAll('.culto-item')).map(item => ({
      nome: item.querySelector('.culto-nome').value.trim(),
      inicio: item.querySelector('.culto-inicio').value,
      fim: item.querySelector('.culto-fim').value,
      dias: Array.from(item.querySelectorAll('.culto-dias input:checked')).map(cb => Number(cb.value))
    }));
    const semDia = cultos.find(c => !c.dias.length);
    if (semDia) { showToast('Escolha pelo menos um dia para o culto "' + (semDia.nome || 'sem nome') + '".', 'error'); return; }
    if (cultos.some(c => !c.inicio)) { showToast('Preencha o horário de início de todos os cultos.', 'error'); return; }
    const fimIgual = cultos.find(c => c.fim && c.fim === c.inicio);
    if (fimIgual) { showToast('O horário final precisa ser diferente do início no culto "' + (fimIgual.nome || 'sem nome') + '".', 'error'); return; }

    horariosSalvar.disabled = true;
    horariosSalvar.innerHTML = '<span class="spinner"></span> Salvando...';
    try {
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'salvar_horarios',
          senha: senhaAtual,
          config: { bloqueioAtivado: horariosBloqueio.checked, horasPorCulto: Number(horariosHoras.value), cultos: cultos }
        })
      });
      const result = await resp.json();
      if (result && result.status === 'ok') {
        horariosConfig = result.horarios_config;
        atualizarStatusFichas(result.fichas);
        horariosOverlay.classList.remove('show');
        showToast('Horários salvos!', 'success');
      } else {
        showToast((result && result.message) || 'Erro ao salvar os horários.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Erro de conexão ao salvar os horários.', 'error');
    } finally {
      horariosSalvar.disabled = false;
      horariosSalvar.textContent = 'Salvar horários';
    }
  });

  function renderFichas(data) {
    allFichas = data.slice().sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    selectedIds.clear();
    atualizarStats(allFichas);
    popularFiltroMes(allFichas);
    popularFiltroDia(allFichas);
    aplicarFiltros();
  }

  // --- Filtro por dia de cadastro ---
  // O painel abre mostrando só as fichas de hoje ("Hoje" é calculado na hora,
  // então se o dia virar, a tela passa a mostrar só as do novo dia). A lista
  // traz apenas as datas que têm ficha cadastrada, e "Todas as datas" mostra tudo.
  function diaChave(iso) {
    if (!iso) return null;
    const d = iso instanceof Date ? iso : new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function diaLabel(chave) {
    const [ano, mes, dia] = chave.split('-');
    return dia + '/' + mes + '/' + ano;
  }

  function popularFiltroDia(data) {
    const contagem = {};
    data.forEach(f => {
      const c = diaChave(f.timestamp);
      if (c) contagem[c] = (contagem[c] || 0) + 1;
    });
    const hoje = diaChave(new Date());
    // A data de hoje já é coberta pela opção "Hoje", então não repete na lista.
    const chaves = Object.keys(contagem).filter(c => c !== hoje).sort((a, b) => b.localeCompare(a));

    const valorAtual = filterDia.value;
    const qtdHoje = contagem[hoje] || 0;
    filterDia.innerHTML =
      `<option value="hoje">Hoje (${diaLabel(hoje)}) — ${qtdHoje} ficha(s)</option>` +
      '<option value="">Todas as datas</option>' +
      chaves.map(c => `<option value="${c}">${diaLabel(c)} — ${contagem[c]} ficha(s)</option>`).join('');

    if (valorAtual === '' || valorAtual === 'hoje' || chaves.includes(valorAtual)) {
      filterDia.value = valorAtual;
    } else {
      filterDia.value = 'hoje';
    }
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
    const categoria = filterCategoria.value;
    const mes = filterMes.value;
    const dia = filterDia.value === 'hoje' ? diaChave(new Date()) : filterDia.value;

    let filtrado = allFichas.filter(f => {
      if (dia && diaChave(f.timestamp) !== dia) return false;
      if (decisao && f.decisao !== decisao) return false;
      if (mes && mesChave(f.timestamp) !== mes) return false;
      const temRede = !!(f.encaminhado_rede && f.encaminhado_rede.trim());
      if (rede === 'pendente' && temRede) return false;
      if (rede === 'feito' && !temRede) return false;
      if (categoria && f.rede_categoria !== categoria) return false;
      if (term) {
        const alvo = `${f.nome_completo || ''} ${f.bairro || ''} ${f.telefone || ''}`.toLowerCase();
        if (!alvo.includes(term)) return false;
      }
      return true;
    });

    fichasFiltradasAtual = ordenarFichas(filtrado);
    atualizarCabecalhosOrdem();
    renderTable(fichasFiltradasAtual);
  }

  // --- Ordenação por coluna ---
  // Valores vazios ficam sempre no fim, em qualquer direção.
  function valorOrdenacao(f, campo) {
    switch (campo) {
      case 'data': return f.timestamp || '';
      case 'nome': return f.nome_completo || '';
      case 'idade': {
        const n = parseInt(f.idade, 10);
        return isNaN(n) ? '' : n;
      }
      case 'telefone': return String(f.telefone || '').replace(/\D/g, '');
      case 'bairro': return f.bairro || '';
      case 'decisao': return f.decisao ? decisaoResumo(f.decisao) : '';
      case 'culto': return f.culto ? resumoCulto(f) : '';
      case 'rede': return (f.encaminhado_rede && f.encaminhado_rede.trim()) ? resumoRede(f).texto : '';
      default: return '';
    }
  }

  function ordenarFichas(lista) {
    const fator = ordemDirecao === 'asc' ? 1 : -1;
    return lista.slice().sort((a, b) => {
      const va = valorOrdenacao(a, ordemCampo);
      const vb = valorOrdenacao(b, ordemCampo);
      const vazioA = va === '';
      const vazioB = vb === '';
      if (vazioA || vazioB) return vazioA === vazioB ? 0 : (vazioA ? 1 : -1);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * fator;
      return String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base', numeric: true }) * fator;
    });
  }

  function atualizarCabecalhosOrdem() {
    sortHeaders.forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
      if (th.dataset.sort === ordemCampo) th.classList.add('sort-' + ordemDirecao);
    });
  }

  sortHeaders.forEach(th => {
    th.addEventListener('click', () => {
      const campo = th.dataset.sort;
      if (campo === ordemCampo) {
        ordemDirecao = ordemDirecao === 'asc' ? 'desc' : 'asc';
      } else {
        ordemCampo = campo;
        // Data começa pelos mais recentes; as outras colunas em ordem crescente (A→Z, menor idade).
        ordemDirecao = campo === 'data' ? 'desc' : 'asc';
      }
      aplicarFiltros();
    });
  });

  searchInput.addEventListener('input', aplicarFiltros);
  filterDecisao.addEventListener('change', aplicarFiltros);
  filterRede.addEventListener('change', aplicarFiltros);
  filterCategoria.addEventListener('change', aplicarFiltros);
  // Dia e mês não se combinam: escolher um volta o outro para "todos".
  filterMes.addEventListener('change', () => {
    if (filterMes.value) filterDia.value = '';
    aplicarFiltros();
  });
  filterDia.addEventListener('change', () => {
    if (filterDia.value) filterMes.value = '';
    aplicarFiltros();
  });

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
      emptyState.textContent = filterDia.value === 'hoje'
        ? 'Nenhuma ficha cadastrada hoje. Escolha outra data ou "Todas as datas" no filtro de dia.'
        : 'Nenhuma ficha encontrada.';
      emptyState.style.display = 'block';
      atualizarBarraSelecao();
      return;
    }
    emptyState.style.display = 'none';

    data.forEach(f => {
      const tr = document.createElement('tr');
      const rede = resumoRede(f);
      tr.innerHTML = `
        <td class="col-check"><input type="checkbox" class="row-checkbox" data-id="${escapeHtml(f.id)}"></td>
        <td>${formatarData(f.timestamp)}</td>
        <td>${escapeHtml(f.nome_completo || '–')}</td>
        <td>${escapeHtml(f.idade || '–')}</td>
        <td>${escapeHtml(f.telefone || '–')}</td>
        <td>${escapeHtml(f.bairro || '–')}</td>
        <td>${escapeHtml(decisaoResumo(f.decisao))}</td>
        <td>${escapeHtml(resumoCulto(f))}</td>
        <td><span class="tag ${rede.tag}">${escapeHtml(rede.texto)}</span></td>
      `;
      const checkbox = tr.querySelector('.row-checkbox');
      checkbox.checked = selectedIds.has(f.id);
      checkbox.addEventListener('click', (e) => e.stopPropagation());
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selectedIds.add(f.id);
        else selectedIds.delete(f.id);
        atualizarBarraSelecao();
      });
      tr.addEventListener('click', () => abrirModal(f));
      tbody.appendChild(tr);
    });

    atualizarBarraSelecao();
  }

  // --- Seleção em massa / exclusão em massa ---
  function atualizarBarraSelecao() {
    const visiveis = fichasFiltradasAtual.map(f => f.id);
    const selecionadosVisiveis = visiveis.filter(id => selectedIds.has(id));

    if (selectedIds.size > 0) {
      bulkBar.style.display = 'flex';
      bulkCount.textContent = selectedIds.size + ' selecionada(s)';
    } else {
      bulkBar.style.display = 'none';
    }

    if (visiveis.length === 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    } else if (selecionadosVisiveis.length === visiveis.length) {
      selectAllCheckbox.checked = true;
      selectAllCheckbox.indeterminate = false;
    } else if (selecionadosVisiveis.length === 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    } else {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = true;
    }
  }

  selectAllCheckbox.addEventListener('change', () => {
    const visiveis = fichasFiltradasAtual.map(f => f.id);
    if (selectAllCheckbox.checked) {
      visiveis.forEach(id => selectedIds.add(id));
    } else {
      visiveis.forEach(id => selectedIds.delete(id));
    }
    renderTable(fichasFiltradasAtual);
  });

  bulkClearBtn.addEventListener('click', () => {
    selectedIds.clear();
    renderTable(fichasFiltradasAtual);
  });

  bulkDeleteBtn.addEventListener('click', async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length || !isAdministrador()) return;

    const confirmado = window.confirm(
      'Tem certeza que deseja excluir ' + ids.length + ' cadastro(s) selecionado(s)?\n\nEssa ação não pode ser desfeita.'
    );
    if (!confirmado) return;

    bulkDeleteBtn.disabled = true;
    bulkClearBtn.disabled = true;
    bulkDeleteBtn.innerHTML = '<span class="spinner"></span> Excluindo...';

    let sucesso = 0;
    let falha = 0;

    for (const id of ids) {
      try {
        const resp = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'delete', senha: senhaAtual, id: id })
        });
        const result = await resp.json();
        if (result && result.status === 'ok') {
          sucesso++;
          selectedIds.delete(id);
        } else {
          falha++;
        }
      } catch (err) {
        console.error(err);
        falha++;
      }
    }

    // remove da lista local todas as fichas que foram excluídas com sucesso
    // (as que falharam continuam em selectedIds, então permanecem na lista)
    allFichas = allFichas.filter(f => !(ids.includes(f.id) && !selectedIds.has(f.id)));

    atualizarStats(allFichas);
    popularFiltroMes(allFichas);
    popularFiltroDia(allFichas);
    aplicarFiltros();

    bulkDeleteBtn.disabled = false;
    bulkClearBtn.disabled = false;
    bulkDeleteBtn.innerHTML = '🗑 Excluir selecionadas';

    if (falha === 0) {
      showToast(sucesso + ' cadastro(s) excluído(s) com sucesso.', 'success');
    } else {
      showToast(sucesso + ' excluído(s), ' + falha + ' falharam. Tente novamente.', 'error');
    }
  });

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

  // --- Excluir ficha ---
  modalDeleteBtn.addEventListener('click', async () => {
    if (!currentFichaId || !isAdministrador()) return;

    const nome = (currentFicha && currentFicha.nome_completo) || 'esta ficha';
    const confirmado = window.confirm(
      'Tem certeza que deseja excluir o cadastro de "' + nome + '"?\n\nEssa ação não pode ser desfeita.'
    );
    if (!confirmado) return;

    const idParaExcluir = currentFichaId;
    modalDeleteBtn.disabled = true;
    modalDeleteBtn.innerHTML = '<span class="spinner"></span> Excluindo...';

    try {
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'delete',
          senha: senhaAtual,
          id: idParaExcluir
        })
      });
      const result = await resp.json();
      if (result && result.status === 'ok') {
        showToast('Ficha excluída com sucesso.', 'success');
        allFichas = allFichas.filter(x => x.id !== idParaExcluir);
        atualizarStats(allFichas);
        popularFiltroMes(allFichas);
        popularFiltroDia(allFichas);
        aplicarFiltros();
        fecharModal();
      } else {
        showToast((result && result.message) || 'Erro ao excluir.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Erro de conexão ao excluir.', 'error');
    } finally {
      modalDeleteBtn.disabled = false;
      modalDeleteBtn.innerHTML = '🗑 Excluir';
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

  function gerarCorpoFicha(f, logoUrl, geradoEm) {
    const { filhos, chegou, redeAnterior, endereco, culto } = construirDetalhes(f);

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

    return `<section class="ficha">
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
</section>`;
  }

  // Gera um único documento com uma ou mais fichas, cada uma em sua própria página.
  function gerarHtmlImpressao(fichas) {
    const logoUrl = new URL('assets/logo.png', window.location.href).href;
    const geradoEm = formatarDataCurta(new Date().toISOString());
    const titulo = fichas.length === 1
      ? 'Ficha - ' + (fichas[0].nome_completo || '')
      : 'Fichas de Consolidação (' + fichas.length + ')';
    const corpo = fichas.map(f => gerarCorpoFicha(f, logoUrl, geradoEm)).join('');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(titulo)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color:#2b2320; margin:0; padding: 6px; }
  .header { display:flex; align-items:center; gap:14px; margin-bottom: 16px; }
  .logo-box { width:52px; height:52px; min-width:52px; background:#b52e28; border-radius:12px; display:flex; align-items:center; justify-content:center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .logo-box img { width:32px; height:32px; }
  .header h1 { margin:0; font-size:19px; color:#8f221d; }
  .header .meta { font-size:11px; color:#6b5f5c; margin-top:3px; }
  hr { border:none; border-top:1px solid #e7dcda; margin:18px 0; }
  .nome { font-size:21px; font-weight:700; margin:0 0 16px; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:12px 24px; margin-bottom:16px; }
  .grid .full { grid-column: 1 / -1; }
  .item .k { font-size:9px; text-transform:uppercase; letter-spacing:.03em; color:#6b5f5c; margin-bottom:2px; }
  .item .v { font-size:13px; }
  .rede-box { background:#fbf3f2; border:1px solid #f7e6e5; border-radius:10px; padding:14px 16px; margin-top:8px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .rede-box .k { font-size:10px; text-transform:uppercase; letter-spacing:.03em; color:#8f221d; font-weight:700; margin-bottom:5px; }
  .rede-box .v { font-size:14px; }
  .footer { margin-top:22px; font-size:9px; color:#b7aba7; }
  .ficha { break-inside: avoid; page-break-inside: avoid; }
  .ficha + .ficha { break-before: page; page-break-before: always; }
</style>
</head>
<body>
  ${corpo}
  <script>
    window.onload = function () {
      setTimeout(function () { window.print(); }, 200);
    };
    window.onafterprint = function () { window.close(); };
  <\/script>
</body>
</html>`;
  }

  function abrirImpressaoFichas(fichas) {
    const janela = window.open('', '_blank', 'width=850,height=1000');
    if (!janela) {
      showToast('Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.', 'error');
      return;
    }
    janela.document.open();
    janela.document.write(gerarHtmlImpressao(fichas));
    janela.document.close();
  }

  modalPdfBtn.addEventListener('click', () => {
    if (!currentFicha) return;
    abrirImpressaoFichas([currentFicha]);
  });

  // Fichas individuais das selecionadas, todas juntas num único PDF
  // (uma ficha por página), na mesma ordenação escolhida na tabela.
  bulkPdfBtn.addEventListener('click', () => {
    const selecionadas = ordenarFichas(allFichas.filter(f => selectedIds.has(f.id)));
    if (!selecionadas.length) return;
    abrirImpressaoFichas(selecionadas);
  });

  // --- Relatório em PDF (lista de fichas, com ou sem filtro aplicado) ---
  // Usa a mesma técnica de impressão nativa do navegador da ficha individual.
  // O relatório sempre reflete o que está sendo exibido na tabela no momento
  // do clique: se algum filtro (mês, decisão, rede, busca) estiver ativo, o
  // relatório sai filtrado; se estiver tudo em "Todos", sai completo.

  function montarResumoFiltrosAtivos() {
    const partes = [];
    if (filterDia.value === 'hoje') partes.push('Dia: ' + diaLabel(diaChave(new Date())));
    else if (filterDia.value) partes.push('Dia: ' + diaLabel(filterDia.value));
    if (filterMes.value) partes.push('Mês: ' + filterMes.options[filterMes.selectedIndex].textContent);
    if (filterDecisao.value) partes.push('Decisão: ' + filterDecisao.options[filterDecisao.selectedIndex].textContent);
    if (filterRede.value) partes.push('Rede: ' + filterRede.options[filterRede.selectedIndex].textContent);
    if (filterCategoria.value) partes.push('Categoria: ' + filterCategoria.value);
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
        <td>${escapeHtml(f.idade || '–')}</td>
        <td>${escapeHtml(f.telefone || '–')}</td>
        <td>${escapeHtml(f.bairro || '–')}</td>
        <td>${escapeHtml(decisaoResumo(f.decisao))}</td>
        <td>${escapeHtml(resumoCulto(f))}</td>
        <td>${escapeHtml(rede.texto)}</td>
      </tr>`;
    }).join('');

    const corpo = dados.length
      ? `<table>
          <thead><tr><th>Data</th><th>Nome</th><th>Idade</th><th>Telefone</th><th>Bairro</th><th>Decisão</th><th>Culto</th><th>Rede</th></tr></thead>
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
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color:#2b2320; margin:0; padding: 6px; }
  .header { display:flex; align-items:center; gap:14px; margin-bottom: 14px; }
  .logo-box { width:48px; height:48px; min-width:48px; background:#b52e28; border-radius:11px; display:flex; align-items:center; justify-content:center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .logo-box img { width:28px; height:28px; }
  .header h1 { margin:0; font-size:18px; color:#8f221d; }
  .header .meta { font-size:11px; color:#6b5f5c; margin-top:3px; }
  hr { border:none; border-top:1px solid #e7dcda; margin:14px 0; }
  table { width:100%; border-collapse:collapse; font-size:11px; }
  thead th { text-align:left; background:#fbf3f2; color:#8f221d; padding:8px 10px; font-weight:600; border-bottom:1px solid #f7e6e5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
