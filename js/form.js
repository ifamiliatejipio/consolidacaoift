(function () {
  const form = document.getElementById('ficha-form');
  const submitBtn = document.getElementById('submit-btn');
  const formCard = document.getElementById('form-card');
  const successScreen = document.getElementById('success-screen');
  const errorBanner = document.getElementById('form-error-banner');
  const newFormBtn = document.getElementById('new-form-btn');
  const toast = document.getElementById('toast');

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
        const especialInput = document.getElementById('qual_culto_especial');
        const bad = !especialInput.value.trim();
        markInvalid(especialInput, bad);
        if (bad) valid = false;
      }
    }

    // telefone: mínimo de dígitos
    const telDigits = telInput.value.replace(/\D/g, '');
    if (telDigits.length < 10) {
      markInvalid(telInput, true);
      valid = false;
    }

    return valid;
  }

  function collectData() {
    const fd = new FormData(form);
    const data = {};
    fd.forEach((value, key) => { data[key] = value; });
    return data;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    errorBanner.classList.remove('show');

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
      } else {
        throw new Error((result && result.message) || 'Erro desconhecido');
      }
    } catch (err) {
      console.error(err);
      showToast('Não foi possível enviar a ficha. Verifique sua internet e tente novamente.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar ficha';
    }
  });

  newFormBtn.addEventListener('click', () => {
    form.reset();
    form.querySelectorAll('.conditional.show').forEach(el => el.classList.remove('show'));
    form.querySelectorAll('.field.invalid').forEach(el => el.classList.remove('invalid'));
    form.style.display = '';
    successScreen.classList.remove('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();
