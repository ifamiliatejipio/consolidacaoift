(function () {
  const form = document.getElementById('ficha-form');
  const submitBtn = document.getElementById('submit-btn');
  const formCard = document.getElementById('form-card');
  const successScreen = document.getElementById('success-screen');
  const errorBanner = document.getElementById('form-error-banner');
  const newFormBtn = document.getElementById('new-form-btn');
  const toast = document.getElementById('toast');
  const closedScreen = document.getElementById('closed-screen');
  const closedHorarios = document.getElementById('closed-horarios');
  const closedRetryBtn = document.getElementById('closed-retry-btn');

  function showToast(msg, type) {
    toast.textContent = msg;
    toast.className = 'toast show' + (type ? ' ' + type : '');
    setTimeout(() => { toast.className = 'toast'; }, 3500);
  }

  // --- Máscara simples de telefone ---
  const telInput = document.getElementById('telefone');
  telInput.addEventListener('input', () => {
    let v = telInput.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 10) {
      v = v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (v.length > 6) {
      v = v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    } else if (v.length > 2) {
      v = v.replace(/(\d{2})(\d{0,5})/, '($1) $2');
    } else if (v.length > 0) {
      v = v.replace(/(\d{0,2})/, '($1');
    }
    telInput.value = v;
    // Assim que ficar certo, já tira a marcação de erro.
    if (celularValido(telInput.value)) markInvalid(telInput, false);
  });

  // Celular precisa ter DDD + 9 dígitos começando com 9 (ex: (11) 98765-4321).
  function celularValido(valor) {
    const digitos = valor.replace(/\D/g, '');
    return digitos.length === 11 && digitos.charAt(2) === '9';
  }

  // Avisa já ao sair do campo, sem esperar o envio da ficha.
  telInput.addEventListener('blur', () => {
    if (telInput.value.trim()) markInvalid(telInput, !celularValido(telInput.value));
  });

  // --- Primeira letra de cada palavra em maiúscula ---
  // Vale para os campos de texto livre (nome, bairro, endereço...), menos os
  // que não fazem sentido em maiúscula. Conectivos como "de", "da", "dos" e "e"
  // ficam em minúscula no meio do texto (ex: "Maria da Silva", "Rua das Flores").
  const CAMPOS_SEM_MAIUSCULA = ['instagram', 'numero'];
  const CONECTIVOS = /(\s)(de|da|do|das|dos|e)(?=\s)/gi;

  function capitalizarPalavras(texto) {
    return texto
      .replace(/(^|\s)(\S)/g, (m, espaco, letra) => espaco + letra.toLocaleUpperCase('pt-BR'))
      .replace(CONECTIVOS, (m, espaco, palavra) => espaco + palavra.toLocaleLowerCase('pt-BR'));
  }

  form.querySelectorAll('input[type="text"]').forEach(input => {
    if (CAMPOS_SEM_MAIUSCULA.includes(input.name)) return;
    input.setAttribute('autocapitalize', 'words'); // teclado do celular já sugere maiúscula
    input.addEventListener('input', () => {
      const novo = capitalizarPalavras(input.value);
      if (novo === input.value) return;
      // O tamanho do texto não muda, então dá pra manter o cursor no mesmo lugar.
      const inicio = input.selectionStart;
      const fim = input.selectionEnd;
      input.value = novo;
      input.setSelectionRange(inicio, fim);
    });
  });

  // --- Campos condicionais ---
  function setupConditional(groupName, condId, triggerValue, innerInput) {
    const wrap = document.getElementById(condId);
    const radios = form.querySelectorAll(`input[name="${groupName}"]`);
    radios.forEach(r => {
      r.addEventListener('change', () => {
        const show = r.value === triggerValue && r.checked;
        if (show) {
          wrap.classList.add('show');
        } else if (r.checked) {
          wrap.classList.remove('show');
          if (innerInput) document.getElementById(innerInput).value = '';
          wrap.querySelectorAll('.field.invalid').forEach(f => f.classList.remove('invalid'));
        }
      });
    });
  }

  setupConditional('tem_filhos', 'cond-quantos-filhos', 'Sim', 'quantos_filhos');
  setupConditional('como_chegou', 'cond-quem-convidou', 'Foi convidado por alguém', 'quem_convidou');
  setupConditional('participou_rede', 'cond-qual-rede', 'Sim', 'qual_rede');
  setupConditional('opcao_culto_especial', 'cond-culto-especial-outros', 'Outros', 'qual_culto_especial');

  // --- Qual culto (3 opções, cada uma com seu próprio bloco condicional) ---
  const cultoBlocks = {
    'Noite da Unção': document.getElementById('cond-culto-uncao'),
    'Domingo': document.getElementById('cond-culto-domingo'),
    'Culto especial': document.getElementById('cond-culto-especial')
  };
  form.querySelectorAll('input[name="culto"]').forEach(r => {
    r.addEventListener('change', () => {
      Object.entries(cultoBlocks).forEach(([valor, bloco]) => {
        if (!bloco) return;
        if (r.checked && r.value === valor) {
          bloco.classList.add('show');
        } else {
          bloco.classList.remove('show');
          bloco.querySelectorAll('input[type="radio"]').forEach(radio => { radio.checked = false; });
          bloco.querySelectorAll('input[type="text"]').forEach(text => { text.value = ''; });
          bloco.querySelectorAll('.field.invalid').forEach(f => f.classList.remove('invalid'));
          bloco.querySelectorAll('.conditional.show').forEach(c => c.classList.remove('show'));
        }
      });
    });
  });

  // --- Validação ---
  function markInvalid(fieldEl, invalid) {
    const wrapper = fieldEl.closest('.field');
    if (!wrapper) return;
    wrapper.classList.toggle('invalid', invalid);
  }

  function validate() {
    let valid = true;

    // campos de texto/number/select required nativos
    form.querySelectorAll('input[required], select[required]').forEach(el => {
      if (el.type === 'radio') return; // tratado abaixo por grupo
      const val = el.value.trim();
      const bad = !val;
      markInvalid(el, bad);
      if (bad) valid = false;
    });

    // grupos de rádio obrigatórios
    const radioGroups = ['tem_filhos', 'decisao', 'como_chegou', 'participou_rede', 'culto'];
    radioGroups.forEach(name => {
      const radios = form.querySelectorAll(`input[name="${name}"]`);
      const checked = Array.from(radios).some(r => r.checked);
      const groupWrap = radios[0] ? radios[0].closest('.field') : null;
      if (groupWrap) groupWrap.classList.toggle('invalid', !checked);
      if (!checked) valid = false;
    });

    // campos condicionais que agora também são obrigatórios quando aparecem
    const temFilhosSim = form.querySelector('input[name="tem_filhos"]:checked');
    if (temFilhosSim && temFilhosSim.value === 'Sim') {
      const el = document.getElementById('quantos_filhos');
      const bad = !el.value.trim();
      markInvalid(el, bad);
      if (bad) valid = false;
    }

    const comoChegouSelecionado = form.querySelector('input[name="como_chegou"]:checked');
    if (comoChegouSelecionado && comoChegouSelecionado.value === 'Foi convidado por alguém') {
      const el = document.getElementById('quem_convidou');
      const bad = !el.value.trim();
      markInvalid(el, bad);
      if (bad) valid = false;
    }

    const participouRedeSim = form.querySelector('input[name="participou_rede"]:checked');
    if (participouRedeSim && participouRedeSim.value === 'Sim') {
      const el = document.getElementById('qual_rede');
      const bad = !el.value.trim();
      markInvalid(el, bad);
      if (bad) valid = false;
    }

    // sub-opção do culto, conforme o que foi selecionado
    const cultoSelecionado = form.querySelector('input[name="culto"]:checked');
    if (cultoSelecionado) {
      if (cultoSelecionado.value === 'Noite da Unção') {
        const radios = form.querySelectorAll('input[name="dia_uncao"]');
        const checked = Array.from(radios).some(r => r.checked);
        const wrap = radios[0] ? radios[0].closest('.field') : null;
        if (wrap) wrap.classList.toggle('invalid', !checked);
        if (!checked) valid = false;
      } else if (cultoSelecionado.value === 'Domingo') {
        const radios = form.querySelectorAll('input[name="horario_domingo"]');
        const checked = Array.from(radios).some(r => r.checked);
        const wrap = radios[0] ? radios[0].closest('.field') : null;
        if (wrap) wrap.classList.toggle('invalid', !checked);
        if (!checked) valid = false;
      } else if (cultoSelecionado.value === 'Culto especial') {
        const radios = form.querySelectorAll('input[name="opcao_culto_especial"]');
        const opcao = Array.from(radios).find(r => r.checked);
        const wrap = radios[0] ? radios[0].closest('.field') : null;
        if (wrap) wrap.classList.toggle('invalid', !opcao);
        if (!opcao) valid = false;
        if (opcao && opcao.value === 'Outros') {
          const especialInput = document.getElementById('qual_culto_especial');
          const bad = !especialInput.value.trim();
          markInvalid(especialInput, bad);
          if (bad) valid = false;
        }
      }
    }

    // telefone: mínimo de dígitos
    if (!celularValido(telInput.value)) {
      markInvalid(telInput, true);
      valid = false;
    }

    return valid;
  }

  function collectData() {
    const fd = new FormData(form);
    const data = {};
    fd.forEach((value, key) => { data[key] = value; });
    // Culto especial: a opção escolhida (ou o texto digitado em "Outros")
    // vai para a coluna qual_culto_especial da planilha.
    if (data.opcao_culto_especial && data.opcao_culto_especial !== 'Outros') {
      data.qual_culto_especial = data.opcao_culto_especial;
    }
    delete data.opcao_culto_especial;
    return data;
  }

  // --- Horário das fichas ---
  // O servidor decide se a ficha está aberta (horário dos cultos ou liberação
  // do Administrador). Fora disso, a página mostra o aviso de fichas fechadas.
  // Se a consulta falhar, o formulário continua visível — o servidor ainda
  // recusa envios fora do horário.
  let timerVerificacao = null;

  function mostrarFechado(fichas) {
    closedHorarios.textContent = (fichas && fichas.horarios) || '';
    form.style.display = 'none';
    successScreen.classList.remove('show');
    errorBanner.classList.remove('show');
    closedScreen.classList.add('show');
    // Enquanto estiver fechada, confere de novo a cada minuto (abre sozinha no horário).
    if (!timerVerificacao) timerVerificacao = setInterval(verificarHorario, 60000);
  }

  function mostrarAberto() {
    if (!closedScreen.classList.contains('show')) return;
    closedScreen.classList.remove('show');
    form.style.display = '';
    clearInterval(timerVerificacao);
    timerVerificacao = null;
  }

  async function verificarHorario() {
    if (!API_URL || API_URL.indexOf('COLE_AQUI') !== -1) return;
    try {
      const resp = await fetch(`${API_URL}?action=status`);
      const result = await resp.json();
      if (!result || result.status !== 'ok' || !result.fichas) return;
      if (result.fichas.aberto) mostrarAberto();
      else mostrarFechado(result.fichas);
    } catch (err) {
      console.error(err);
    }
  }

  closedRetryBtn.addEventListener('click', async () => {
    closedRetryBtn.disabled = true;
    await verificarHorario();
    closedRetryBtn.disabled = false;
  });

  verificarHorario();

  // --- Código de envio ---
  // Cada ficha preenchida ganha um código único. Se ela for enviada de novo
  // (toque duplo, ou a pessoa tenta outra vez porque a resposta demorou), o
  // servidor reconhece o código e não grava a mesma ficha duas vezes.
  function novoEnvioId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }
  let envioId = novoEnvioId();
  const textoPadraoBanner = errorBanner.textContent;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    errorBanner.classList.remove('show');
    errorBanner.textContent = textoPadraoBanner;

    if (!validate()) {
      errorBanner.classList.add('show');
      const firstInvalid = form.querySelector('.field.invalid');
      if (firstInvalid) firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!API_URL || API_URL.indexOf('COLE_AQUI') !== -1) {
      showToast('Sistema ainda não configurado: falta a URL do backend em js/config.js', 'error');
      return;
    }

    const data = collectData();
    data.action = 'create';
    data.envio_id = envioId;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Enviando...';

    try {
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(data)
      });
      const result = await resp.json();

      if (result && result.status === 'ok') {
        formCard.querySelector('form').style.display = 'none';
        successScreen.classList.add('show');
      } else if (result && result.code === 'fichas_fechadas') {
        mostrarFechado(result.fichas);
      } else if (result && result.code === 'ficha_duplicada') {
        // Mesmo telefone já cadastrado hoje: mostra o aviso no topo da ficha.
        errorBanner.textContent = result.message;
        errorBanner.classList.add('show');
        errorBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        throw new Error((result && result.message) || 'Erro desconhecido');
      }
    } catch (err) {
      console.error(err);
      // A ficha pode ter chegado mesmo assim (resposta lenta); reenviar é seguro,
      // pois o código de envio impede que ela seja gravada duas vezes.
      showToast('Não foi possível confirmar o envio. Tente enviar de novo — se a ficha já tiver chegado, ela não será duplicada.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar ficha';
    }
  });

  newFormBtn.addEventListener('click', () => {
    envioId = novoEnvioId(); // nova ficha, novo código
    form.reset();
    form.querySelectorAll('.conditional.show').forEach(el => el.classList.remove('show'));
    form.querySelectorAll('.field.invalid').forEach(el => el.classList.remove('invalid'));
    form.style.display = '';
    successScreen.classList.remove('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();
