/**
 * SISTEMA DE CONSOLIDAÇÃO — BACKEND (Google Apps Script)
 * ---------------------------------------------------------
 * Este script transforma uma Planilha Google em um banco de dados
 * simples para a Ficha de Consolidação e o Painel Administrativo.
 *
 * COMO CONFIGURAR (veja também INSTRUCOES.md):
 * 1. Crie uma Planilha Google nova (pode deixar em branco).
 * 2. Menu Extensões > Apps Script.
 * 3. Apague o conteúdo padrão e cole este arquivo inteiro.
 * 4. Rode a função "configurarSenha" uma vez (veja abaixo) para
 *    definir as senhas de acesso do painel (Gestor e Administrador) — ou
 *    configure direto em Configurações do projeto > Propriedades do script
 *    > GESTOR_PASSWORD e ADMINISTRADOR_PASSWORD.
 * 5. Publique como Web App (Implantar > Nova implantação > App da Web):
 *      - Executar como: Eu (seu e-mail)
 *      - Quem pode acessar: Qualquer pessoa
 * 6. Copie a URL gerada (termina em /exec) e cole em js/config.js
 *    nos dois arquivos (index.html e painel.html usam o mesmo config.js).
 * 7. (Opcional) Configure as notificações no Telegram logo abaixo, na seção
 *    "NOTIFICAÇÃO NO TELEGRAM" — veja o passo a passo no INSTRUCOES.md.
 */

const SHEET_NAME = 'Fichas';

// =================================================================
// NOTIFICAÇÃO NO TELEGRAM (opcional)
// -----------------------------------------------------------------
// Assim que uma ficha é enviada, o sistema pode avisar automaticamente
// no Telegram de uma ou mais pessoas — ou até num grupo (ao contrário do
// WhatsApp, o Telegram permite bot postando direto num grupo, então todo
// mundo vê o aviso na mesma conversa).
//
// Como habilitar (veja o passo a passo completo no INSTRUCOES.md):
// 1. No Telegram, converse com @BotFather e crie um bot novo (/newbot).
//    Ele te dá um "token" (algo como 123456:ABC-DEF...).
// 2. Guarde esse token em Configurações do projeto > Propriedades do script,
//    com o nome TELEGRAM_BOT_TOKEN (recomendado: assim ele não se perde quando
//    o código for colado de novo). Também funciona colar em TELEGRAM_BOT_TOKEN abaixo.
// 3. Cada pessoa (ou o grupo) que vai receber os avisos precisa mandar
//    QUALQUER mensagem pro bot (ou o bot precisa ser adicionado ao grupo
//    e alguém mandar uma mensagem lá).
// 4. Acesse no navegador: https://api.telegram.org/bot<TOKEN>/getUpdates
//    (troque <TOKEN> pelo token do passo 2) e procure por "chat":{"id":...
//    — esse número é o chat_id. Adicione em TELEGRAM_CHAT_IDS abaixo.
// 5. Rode a função "testarNotificacaoTelegram" uma vez para conferir se
//    chegou a mensagem de teste.
// =================================================================

// Só envia se houver token (na propriedade do script ou na linha abaixo).
const TELEGRAM_NOTIFICACOES_ATIVADO = true; // true para ligar, false para desligar

// Deixe vazio para usar a propriedade do script TELEGRAM_BOT_TOKEN (recomendado).
const TELEGRAM_BOT_TOKEN = '';

const TELEGRAM_CHAT_IDS = [
  // Adicione um chat_id para cada pessoa OU grupo que deve ser avisado.
  // Pessoas: número positivo. Grupos: número negativo (ex: -123456789).
  '-1004387820436', // grupo de envio no Telegram
];

// =================================================================
// HORÁRIO DAS FICHAS
// -----------------------------------------------------------------
// A ficha só aceita envios durante os cultos (no fuso horário do projeto —
// confira em Configurações do projeto > Fuso horário). Fora disso, a página
// mostra que as fichas estão fechadas. Para cultos especiais em outros dias/
// horários, o Administrador libera as fichas pelo painel.
//
// Os horários são editados pelo Administrador no painel (botão "Horários dos
// cultos") e ficam guardados na propriedade do script HORARIOS_CONFIG. Os
// valores abaixo são só o padrão, usado enquanto nada for salvo pelo painel.
// =================================================================
const BLOQUEIO_HORARIO_ATIVADO = true; // padrão: false = ficha aberta o tempo todo

const HORAS_POR_CULTO = 4; // padrão: quanto tempo a ficha fica aberta nos cultos sem horário final

// Dias: 1 = segunda, 2 = terça, 3 = quarta, 4 = quinta, 5 = sexta, 6 = sábado, 7 = domingo
// "fim" é opcional (ex: fim: '22:00'); sem ele, a ficha fica aberta por HORAS_POR_CULTO.
const HORARIOS_CULTOS = [
  { nome: 'Noite da Unção', dias: [2, 3, 4], inicio: '19:30' },
  { nome: 'Domingo 10h', dias: [7], inicio: '10:00' },
  { nome: 'Domingo 15h', dias: [7], inicio: '15:00' },
  { nome: 'Domingo 17h', dias: [7], inicio: '17:00' },
  { nome: 'Domingo 19h', dias: [7], inicio: '19:00' },
];

// Ordem das colunas na planilha — não mude a ordem sem atualizar o front-end.
const COLUMNS = [
  'id',
  'timestamp',
  'nome_completo',
  'telefone',
  'idade',
  'instagram',
  'endereco',
  'numero',
  'bairro',
  'cidade',
  'ponto_referencia',
  'profissao',
  'estado_civil',
  'tem_filhos',
  'quantos_filhos',
  'decisao',
  'culto',
  'dia_uncao',
  'horario_domingo',
  'qual_culto_especial',
  'como_chegou',
  'quem_convidou',
  'participou_rede',
  'qual_rede',
  'encaminhado_rede',
  'rede_categoria',
  'preenchido_por',
  'envio_id' // código único gerado pela página a cada ficha preenchida (evita gravar a mesma ficha 2x)
];

// Campos obrigatórios ao criar uma nova ficha (validação também existe no front-end).
// Praticamente todos os campos do formulário são obrigatórios agora — os únicos
// que ficam de fora daqui são os condicionais, que só existem dependendo de outra
// resposta (esses são checados separadamente em validarCondicionais_).
const REQUIRED_FIELDS = [
  'nome_completo', 'telefone', 'idade', 'instagram', 'profissao',
  'endereco', 'numero', 'bairro', 'cidade', 'ponto_referencia',
  'estado_civil', 'tem_filhos', 'decisao', 'culto', 'como_chegou', 'participou_rede',
  'preenchido_por'
];

// Campos que só são obrigatórios dependendo da resposta de outro campo
// (mesma regra usada na validação do formulário em js/form.js).
function validarCondicionais_(body) {
  if (body.tem_filhos === 'Sim' && (!body.quantos_filhos || String(body.quantos_filhos).trim() === '')) {
    return 'quantos_filhos';
  }
  if (body.como_chegou === 'Foi convidado por alguém' && (!body.quem_convidou || String(body.quem_convidou).trim() === '')) {
    return 'quem_convidou';
  }
  if (body.participou_rede === 'Sim' && (!body.qual_rede || String(body.qual_rede).trim() === '')) {
    return 'qual_rede';
  }
  if (body.culto === 'Noite da Unção' && (!body.dia_uncao || String(body.dia_uncao).trim() === '')) {
    return 'dia_uncao';
  }
  if (body.culto === 'Domingo' && (!body.horario_domingo || String(body.horario_domingo).trim() === '')) {
    return 'horario_domingo';
  }
  if (body.culto === 'Culto especial' && (!body.qual_culto_especial || String(body.qual_culto_especial).trim() === '')) {
    return 'qual_culto_especial';
  }
  return null;
}

// Perfis de acesso ao painel:
// - Gestor: pode fazer tudo (ver fichas, encaminhar à rede, gerar PDFs),
//   MENOS excluir fichas.
// - Administrador: pode fazer tudo, inclusive excluir fichas.
const PERFIL_GESTOR = 'gestor';
const PERFIL_ADMINISTRADOR = 'administrador';

// Texto provisório da senha do Administrador — enquanto ele não for trocado,
// configurarSenha NÃO grava a senha do Administrador (para ninguém conseguir
// entrar com uma senha conhecida).
const SENHA_ADMIN_PROVISORIA = 'TROQUE_AQUI_A_SENHA_DO_ADMINISTRADOR';

/**
 * Rode esta função manualmente (Executar > configurarSenha) para definir
 * as senhas do painel. Troque os textos abaixo pelas senhas desejadas.
 * As duas senhas precisam ser DIFERENTES.
 */
function configurarSenha() {
  const senhaGestor = 'Consolidacao@#2021';
  const senhaAdministrador = SENHA_ADMIN_PROVISORIA; // TROQUE pela senha do Administrador

  const props = PropertiesService.getScriptProperties();
  props.setProperty('GESTOR_PASSWORD', senhaGestor);

  if (senhaAdministrador && senhaAdministrador !== SENHA_ADMIN_PROVISORIA) {
    if (senhaAdministrador === senhaGestor) {
      throw new Error('A senha do Administrador precisa ser diferente da senha do Gestor.');
    }
    props.setProperty('ADMINISTRADOR_PASSWORD', senhaAdministrador);
  } else {
    console.warn('Senha do Administrador não configurada: troque o texto em configurarSenha e rode de novo.');
  }
}

// ---------------------------------------------------------------
// Rotas HTTP
// ---------------------------------------------------------------

function doGet(e) {
  const action = e.parameter.action;

  if (action === 'list') {
    const usuario = usuarioDaSenha_(e.parameter.senha || '');
    if (!usuario) {
      return jsonOutput_({ status: 'error', message: 'Senha incorreta.' });
    }
    const data = lerFichas_();
    return jsonOutput_({ status: 'ok', perfil: usuario.perfil, nome: usuario.nome, data: data, fichas: statusFichas_(), horarios_config: configHorarios_() });
  }

  // Público: a ficha consulta se está aberta antes de mostrar o formulário.
  if (action === 'status') {
    return jsonOutput_({ status: 'ok', fichas: statusFichas_() });
  }

  return jsonOutput_({ status: 'error', message: 'Ação inválida.' });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOutput_({ status: 'error', message: 'Corpo da requisição inválido.' });
  }

  const action = body.action;

  if (action === 'create') {
    return criarFicha_(body);
  }

  if (action === 'update_rede') {
    if (!perfilDaSenha_(body.senha || '')) {
      return jsonOutput_({ status: 'error', message: 'Senha incorreta.' });
    }
    return atualizarRede_(body);
  }

  if (action === 'delete') {
    const perfil = perfilDaSenha_(body.senha || '');
    if (!perfil) {
      return jsonOutput_({ status: 'error', message: 'Senha incorreta.' });
    }
    if (perfil !== PERFIL_ADMINISTRADOR) {
      return jsonOutput_({ status: 'error', message: 'Apenas o Administrador pode excluir fichas.' });
    }
    return excluirFicha_(body);
  }

  // Liberar / encerrar a liberação das fichas fora do horário (culto especial).
  if (action === 'liberar_fichas' || action === 'encerrar_liberacao') {
    const perfil = perfilDaSenha_(body.senha || '');
    if (!perfil) {
      return jsonOutput_({ status: 'error', message: 'Senha incorreta.' });
    }
    if (perfil !== PERFIL_ADMINISTRADOR) {
      return jsonOutput_({ status: 'error', message: 'Apenas o Administrador pode liberar as fichas.' });
    }
    const props = PropertiesService.getScriptProperties();
    if (action === 'liberar_fichas') {
      const horas = Math.min(Math.max(Number(body.horas) || configHorarios_().horasPorCulto, 1), 12);
      props.setProperty('FICHAS_LIBERADAS_ATE', String(Date.now() + horas * 3600 * 1000));
    } else {
      props.deleteProperty('FICHAS_LIBERADAS_ATE');
    }
    return jsonOutput_({ status: 'ok', fichas: statusFichas_() });
  }

  // Salvar os horários dos cultos editados no painel.
  if (action === 'salvar_horarios') {
    const perfil = perfilDaSenha_(body.senha || '');
    if (!perfil) {
      return jsonOutput_({ status: 'error', message: 'Senha incorreta.' });
    }
    if (perfil !== PERFIL_ADMINISTRADOR) {
      return jsonOutput_({ status: 'error', message: 'Apenas o Administrador pode alterar os horários.' });
    }
    const resultado = validarConfigHorarios_(body.config);
    if (resultado.erro) {
      return jsonOutput_({ status: 'error', message: resultado.erro });
    }
    PropertiesService.getScriptProperties().setProperty('HORARIOS_CONFIG', JSON.stringify(resultado.config));
    return jsonOutput_({ status: 'ok', fichas: statusFichas_(), horarios_config: configHorarios_() });
  }

  return jsonOutput_({ status: 'error', message: 'Ação inválida.' });
}

// ---------------------------------------------------------------
// Lógica
// ---------------------------------------------------------------

/**
 * Configuração de horários em uso: a salva pelo painel (propriedade
 * HORARIOS_CONFIG) ou, se não houver, os padrões do topo deste arquivo.
 */
function configHorarios_() {
  const salvo = PropertiesService.getScriptProperties().getProperty('HORARIOS_CONFIG');
  if (salvo) {
    try {
      const resultado = validarConfigHorarios_(JSON.parse(salvo));
      if (!resultado.erro) return resultado.config;
    } catch (err) {
      console.error('HORARIOS_CONFIG inválido, usando o padrão: ' + err);
    }
  }
  return {
    bloqueioAtivado: BLOQUEIO_HORARIO_ATIVADO,
    horasPorCulto: HORAS_POR_CULTO,
    cultos: HORARIOS_CULTOS.map(c => ({ nome: c.nome, dias: c.dias.slice(), inicio: c.inicio, fim: c.fim || '' }))
  };
}

function validarConfigHorarios_(config) {
  if (!config || typeof config !== 'object') return { erro: 'Configuração de horários inválida.' };
  const horas = Number(config.horasPorCulto);
  if (!(horas >= 1 && horas <= 12)) return { erro: 'O tempo de cada culto precisa ser entre 1 e 12 horas.' };
  if (!Array.isArray(config.cultos)) return { erro: 'Lista de cultos inválida.' };
  if (config.cultos.length > 30) return { erro: 'Máximo de 30 cultos.' };

  const cultos = [];
  for (let i = 0; i < config.cultos.length; i++) {
    const c = config.cultos[i] || {};
    const nome = String(c.nome || '').trim().slice(0, 60) || ('Culto ' + (i + 1));
    const dias = Array.isArray(c.dias)
      ? c.dias.map(Number).filter(d => d >= 1 && d <= 7).filter((d, j, arr) => arr.indexOf(d) === j).sort()
      : [];
    if (!dias.length) return { erro: 'Escolha pelo menos um dia para o culto "' + nome + '".' };
    const inicio = normalizarHora_(c.inicio);
    if (!inicio) return { erro: 'Horário de início inválido no culto "' + nome + '".' };
    let fim = '';
    if (c.fim && String(c.fim).trim()) {
      fim = normalizarHora_(c.fim);
      if (!fim) return { erro: 'Horário final inválido no culto "' + nome + '".' };
      if (fim === inicio) return { erro: 'O horário final precisa ser diferente do início no culto "' + nome + '".' };
    }
    cultos.push({ nome: nome, dias: dias, inicio: inicio, fim: fim });
  }
  return { config: { bloqueioAtivado: config.bloqueioAtivado !== false, horasPorCulto: horas, cultos: cultos } };
}

// "9:5" / "09:05" -> "09:05"; inválido -> null
function normalizarHora_(valor) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(valor || '').trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return ('0' + Number(m[1])).slice(-2) + ':' + m[2];
}

/**
 * Janela da ficha de um culto, em minutos desde a meia-noite do dia do culto:
 * do início até o horário final (se houver) ou até início + horas padrão.
 * Um fim menor que o início significa que passa da meia-noite (ex: 22h às 1h).
 */
function janelaCulto_(c, horasPorCulto) {
  const ini = c.inicio.split(':');
  const inicio = Number(ini[0]) * 60 + Number(ini[1]);
  if (c.fim) {
    const f = c.fim.split(':');
    let fim = Number(f[0]) * 60 + Number(f[1]);
    if (fim <= inicio) fim += 1440;
    return [inicio, fim];
  }
  return [inicio, inicio + horasPorCulto * 60];
}

/**
 * Monta o texto dos horários mostrado na ficha fechada, juntando dias com os
 * mesmos horários. Ex: "Terça, quarta e quinta: 19h30 às 23h30 · Domingo: 10h às 14h e 15h às 23h".
 */
function textoHorarios_(config) {
  const NOMES = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  const hora = min => {
    const t = ((min % 1440) + 1440) % 1440;
    const h = Math.floor(t / 60), m = Math.round(t % 60);
    return h + 'h' + (m ? ('0' + m).slice(-2) : '');
  };

  // Janelas de cada dia, juntando as que se sobrepõem.
  const porDia = {};
  for (let dia = 1; dia <= 7; dia++) {
    const janelas = config.cultos
      .filter(c => c.dias.indexOf(dia) !== -1)
      .map(c => janelaCulto_(c, config.horasPorCulto))
      .sort((a, b) => a[0] - b[0]);
    const juntas = [];
    janelas.forEach(j => {
      const ultima = juntas[juntas.length - 1];
      if (ultima && j[0] <= ultima[1]) ultima[1] = Math.max(ultima[1], j[1]);
      else juntas.push(j.slice());
    });
    if (juntas.length) porDia[dia] = juntas.map(j => hora(j[0]) + ' às ' + hora(j[1])).join(' e ');
  }

  // Agrupa os dias que têm exatamente o mesmo horário.
  const grupos = [];
  Object.keys(porDia).forEach(dia => {
    const g = grupos.filter(x => x.texto === porDia[dia])[0];
    if (g) g.dias.push(Number(dia));
    else grupos.push({ texto: porDia[dia], dias: [Number(dia)] });
  });
  return grupos.map(g => {
    const nomes = g.dias.map((d, i) => i === 0 ? NOMES[d] : NOMES[d].toLowerCase());
    const lista = nomes.length > 1 ? nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1] : nomes[0];
    return lista + ': ' + g.texto;
  }).join(' · ');
}

/**
 * Diz se a ficha está aberta agora: por estar no horário de algum culto
 * (configHorarios_) ou por uma liberação manual do Administrador.
 */
function statusFichas_() {
  const agora = new Date();
  const config = configHorarios_();
  const liberadoAteMs = Number(PropertiesService.getScriptProperties().getProperty('FICHAS_LIBERADAS_ATE')) || 0;
  const liberado = liberadoAteMs > agora.getTime();
  const base = {
    horarios: textoHorarios_(config),
    liberadoAte: liberado ? new Date(liberadoAteMs).toISOString() : null
  };

  if (!config.bloqueioAtivado) return Object.assign(base, { aberto: true, motivo: 'sem_bloqueio' });
  if (liberado) return Object.assign(base, { aberto: true, motivo: 'liberacao' });

  const culto = cultoEmAndamento_(agora, config);
  if (culto) return Object.assign(base, { aberto: true, motivo: 'culto', culto: culto.nome });
  return Object.assign(base, { aberto: false, motivo: 'fechado' });
}

function cultoEmAndamento_(data, config) {
  const fuso = Session.getScriptTimeZone();
  const diaHoje = Number(Utilities.formatDate(data, fuso, 'u')); // 1 = segunda ... 7 = domingo
  const diaOntem = diaHoje === 1 ? 7 : diaHoje - 1;
  const minutosAgora = Number(Utilities.formatDate(data, fuso, 'H')) * 60 + Number(Utilities.formatDate(data, fuso, 'm'));

  for (let i = 0; i < config.cultos.length; i++) {
    const c = config.cultos[i];
    const janela = janelaCulto_(c, config.horasPorCulto);
    const inicio = janela[0];
    const fim = janela[1];
    if (c.dias.indexOf(diaHoje) !== -1 && minutosAgora >= inicio && minutosAgora < fim) return c;
    // Culto que começou ontem e passa da meia-noite.
    if (fim > 1440 && c.dias.indexOf(diaOntem) !== -1 && minutosAgora < fim - 1440) return c;
  }
  return null;
}

function criarFicha_(body) {
  const statusFichas = statusFichas_();
  if (!statusFichas.aberto) {
    return jsonOutput_({
      status: 'error',
      code: 'fichas_fechadas',
      message: 'As fichas estão fechadas fora do horário dos cultos.',
      fichas: statusFichas
    });
  }

  for (let i = 0; i < REQUIRED_FIELDS.length; i++) {
    const campo = REQUIRED_FIELDS[i];
    if (!body[campo] || String(body[campo]).trim() === '') {
      return jsonOutput_({ status: 'error', message: 'Campo obrigatório ausente: ' + campo });
    }
  }

  const campoCondicionalFaltando = validarCondicionais_(body);
  if (campoCondicionalFaltando) {
    return jsonOutput_({ status: 'error', message: 'Campo obrigatório ausente: ' + campoCondicionalFaltando });
  }

  const sheet = getSheet_();
  const id = Utilities.getUuid();
  // Grava como objeto Date de verdade (não texto), assim a coluna na planilha
  // fica com data/hora nativa: dá pra ordenar, filtrar e formatar direto no Sheets.
  const timestamp = new Date();

  // Monta a linha na ORDEM FÍSICA real do cabeçalho da planilha (não na ordem
  // de COLUMNS aqui no código) — assim, se colunas novas tiverem sido
  // adicionadas no final por adicionarColunasFaltantes_ (planilhas antigas
  // sendo atualizadas), os valores continuam caindo na coluna certa.
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = header.map(col => {
    if (col === 'id') return id;
    if (col === 'timestamp') return timestamp;
    if (col === 'encaminhado_rede' || col === 'rede_categoria') return ''; // preenchido depois pela consolidação
    return body[col] !== undefined ? body[col] : '';
  });

  // A trava garante que duas fichas enviadas ao mesmo tempo não recebam o
  // mesmo número do dia, nem passem as duas pela checagem de repetidas.
  const lock = LockService.getScriptLock();
  let numeroDoDia = null;
  lock.waitLock(20000);
  try {
    const repetida = verificarFichaRepetida_(sheet, body, timestamp);
    if (repetida && repetida.mesmoEnvio) {
      // A mesma ficha chegou de novo (toque duplo ou reenvio após demora/erro de
      // conexão): ela já está gravada, então só confirma, sem gravar nem avisar de novo.
      return jsonOutput_({ status: 'ok', id: repetida.id, repetida: true });
    }
    if (repetida) {
      return jsonOutput_({
        status: 'error',
        code: 'ficha_duplicada',
        message: 'Já existe uma ficha para este telefone, cadastrada hoje às ' + repetida.hora +
          ' (' + repetida.nome + '). Se precisar corrigir algo, fale com a equipe de consolidação.'
      });
    }
    sheet.appendRow(row);
    SpreadsheetApp.flush();
    numeroDoDia = contarFichasDoDia_(sheet, timestamp);
  } finally {
    lock.releaseLock();
  }

  // Não deixa uma falha no Telegram impedir o cadastro da ficha.
  try {
    enviarNotificacoesTelegram_(body, numeroDoDia, timestamp);
  } catch (err) {
    console.error('Falha ao enviar notificações no Telegram: ' + err);
  }

  return jsonOutput_({ status: 'ok', id: id });
}

/**
 * Procura uma ficha já gravada que seja a mesma desta:
 * - mesmo envio_id (a mesma ficha enviada de novo) -> { mesmoEnvio: true, id }
 * - mesmo telefone cadastrado no mesmo dia          -> { nome, hora }
 * Retorna null se não houver repetição.
 */
function verificarFichaRepetida_(sheet, body, data) {
  if (sheet.getLastRow() < 2) return null;
  const valores = sheet.getDataRange().getValues();
  const header = valores[0];
  const col = nome => header.indexOf(nome);
  const iId = col('id'), iTs = col('timestamp'), iTel = col('telefone'), iNome = col('nome_completo'), iEnvio = col('envio_id');

  const envioId = String(body.envio_id || '').trim();
  const telefone = String(body.telefone || '').replace(/\D/g, '');
  const fuso = Session.getScriptTimeZone();
  const hoje = Utilities.formatDate(data, fuso, 'yyyy-MM-dd');

  for (let r = 1; r < valores.length; r++) {
    const linha = valores[r];
    if (envioId && iEnvio !== -1 && String(linha[iEnvio]) === envioId) {
      return { mesmoEnvio: true, id: linha[iId] };
    }
  }

  if (!telefone || iTel === -1 || iTs === -1) return null;
  for (let r = 1; r < valores.length; r++) {
    const linha = valores[r];
    if (String(linha[iTel]).replace(/\D/g, '') !== telefone) continue;
    const v = linha[iTs];
    const d = v instanceof Date ? v : (v ? new Date(v) : null);
    if (d && !isNaN(d.getTime()) && Utilities.formatDate(d, fuso, 'yyyy-MM-dd') === hoje) {
      return { nome: String(linha[iNome] || 'sem nome'), hora: Utilities.formatDate(d, fuso, 'HH:mm') };
    }
  }
  return null;
}

/**
 * Conta quantas fichas foram cadastradas no mesmo dia de "data" (no fuso
 * horário do projeto), incluindo a que acabou de ser gravada. Assim a
 * numeração recomeça do 1 a cada dia.
 */
function contarFichasDoDia_(sheet, data) {
  const fuso = Session.getScriptTimeZone();
  const diaAlvo = Utilities.formatDate(data, fuso, 'yyyy-MM-dd');
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const tsCol = header.indexOf('timestamp');
  if (tsCol === -1 || sheet.getLastRow() < 2) return null;

  const valores = sheet.getRange(2, tsCol + 1, sheet.getLastRow() - 1, 1).getValues();
  let total = 0;
  valores.forEach(function (linha) {
    const v = linha[0];
    const d = v instanceof Date ? v : (v ? new Date(v) : null);
    if (d && !isNaN(d.getTime()) && Utilities.formatDate(d, fuso, 'yyyy-MM-dd') === diaAlvo) total++;
  });
  return total;
}

/**
 * Monta a mensagem do Telegram (formatada em HTML), por exemplo:
 *
 *   ✝️ NOVA FICHA DE CONSOLIDAÇÃO
 *   🔢 Ficha nº 3 do dia · 19/10/2026 às 19:42
 *
 *   👤 Nome: Maria da Silva
 *   🎂 Idade: 23 anos
 *   📱 Telefone: (11) 99999-9999
 *   📍 Bairro: Centro
 *   🤝 Convidado(a) por: João Souza   (só aparece se foi convidado)
 *   ✍️ Preenchido por: Ana Paula
 *
 *   ✅ Ficha preenchida com sucesso!
 */
function montarMensagemTelegram_(dados, numeroDoDia, data) {
  const fuso = Session.getScriptTimeZone();
  const quando = Utilities.formatDate(data, fuso, "dd/MM/yyyy 'às' HH:mm");
  const linhas = [];

  linhas.push('✝️ <b>NOVA FICHA DE CONSOLIDAÇÃO</b>');
  linhas.push(numeroDoDia
    ? '🔢 <b>Ficha nº ' + numeroDoDia + ' do dia</b> · ' + quando
    : '📅 ' + quando);
  linhas.push('');
  linhas.push('👤 <b>Nome:</b> ' + htmlTelegram_(dados.nome_completo || '–'));
  if (dados.idade) linhas.push('🎂 <b>Idade:</b> ' + htmlTelegram_(dados.idade) + ' anos');
  if (dados.telefone) linhas.push('📱 <b>Telefone:</b> ' + htmlTelegram_(dados.telefone));
  if (dados.bairro) linhas.push('📍 <b>Bairro:</b> ' + htmlTelegram_(dados.bairro));
  if (dados.quem_convidou && String(dados.quem_convidou).trim()) {
    linhas.push('🤝 <b>Convidado(a) por:</b> ' + htmlTelegram_(dados.quem_convidou));
  }
  if (dados.preenchido_por) linhas.push('✍️ <b>Preenchido por:</b> ' + htmlTelegram_(dados.preenchido_por));
  linhas.push('');
  linhas.push('✅ <i>Ficha preenchida com sucesso!</i>');
  return linhas.join('\n');
}

// Escapa os caracteres especiais do modo HTML do Telegram.
function htmlTelegram_(valor) {
  return String(valor).trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function tokenTelegram_() {
  return TELEGRAM_BOT_TOKEN || PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN') || '';
}

/**
 * Envia a notificação de uma nova ficha para cada chat_id cadastrado em
 * TELEGRAM_CHAT_IDS (pessoa ou grupo), via Telegram Bot API. Cada envio é
 * independente — se um chat falhar, os outros ainda recebem a mensagem
 * normalmente.
 */
function enviarNotificacoesTelegram_(dados, numeroDoDia, data) {
  if (!TELEGRAM_NOTIFICACOES_ATIVADO) return;
  const token = tokenTelegram_();
  if (!token) return;
  if (!TELEGRAM_CHAT_IDS || TELEGRAM_CHAT_IDS.length === 0) return;

  const texto = montarMensagemTelegram_(dados, numeroDoDia, data || new Date());
  const url = 'https://api.telegram.org/bot' + token + '/sendMessage';

  TELEGRAM_CHAT_IDS.forEach(function (chatId) {
    try {
      UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/x-www-form-urlencoded',
        payload: { chat_id: String(chatId), text: texto, parse_mode: 'HTML' },
        muteHttpExceptions: true
      });
    } catch (err) {
      console.error('Erro ao notificar Telegram chat_id ' + chatId + ': ' + err);
    }
  });
}

/**
 * Rode esta função manualmente (Executar > testarNotificacaoTelegram) para
 * conferir se a configuração do Telegram está funcionando, sem precisar
 * enviar uma ficha de verdade.
 */
function testarNotificacaoTelegram() {
  enviarNotificacoesTelegram_({
    nome_completo: 'Fulano de Tal (teste)',
    idade: '25',
    telefone: '(99) 99999-9999',
    bairro: 'Centro',
    quem_convidou: 'Ciclano (teste)',
    preenchido_por: 'Beltrano (teste)'
  }, 1, new Date());
}

function atualizarRede_(body) {
  if (!body.id) {
    return jsonOutput_({ status: 'error', message: 'ID da ficha não informado.' });
  }

  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  const header = values[0];
  const idCol = header.indexOf('id');
  const redeCol = header.indexOf('encaminhado_rede');
  const categoriaCol = header.indexOf('rede_categoria');

  for (let r = 1; r < values.length; r++) {
    if (values[r][idCol] === body.id) {
      sheet.getRange(r + 1, redeCol + 1).setValue(body.encaminhado_rede || '');
      if (categoriaCol !== -1) {
        sheet.getRange(r + 1, categoriaCol + 1).setValue(body.rede_categoria || '');
      }
      return jsonOutput_({ status: 'ok' });
    }
  }

  return jsonOutput_({ status: 'error', message: 'Ficha não encontrada.' });
}

function excluirFicha_(body) {
  if (!body.id) {
    return jsonOutput_({ status: 'error', message: 'ID da ficha não informado.' });
  }

  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  const header = values[0];
  const idCol = header.indexOf('id');

  for (let r = 1; r < values.length; r++) {
    if (values[r][idCol] === body.id) {
      sheet.deleteRow(r + 1);
      return jsonOutput_({ status: 'ok' });
    }
  }

  return jsonOutput_({ status: 'error', message: 'Ficha não encontrada.' });
}

function lerFichas_() {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const header = values[0];
  const rows = values.slice(1);

  return rows
    .filter(row => row.some(cell => cell !== '')) // ignora linhas totalmente vazias
    .map(row => {
      const obj = {};
      header.forEach((col, i) => {
        let val = row[i];
        if (val instanceof Date) val = val.toISOString();
        obj[col] = val;
      });
      return obj;
    });
}

// ---------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS);
    sheet.setFrozenRows(1);
    // Coluna "timestamp" (2ª coluna) formatada como data/hora em pt-BR.
    const timestampCol = COLUMNS.indexOf('timestamp') + 1;
    sheet.getRange(2, timestampCol, sheet.getMaxRows() - 1, 1).setNumberFormat('dd/mm/yyyy hh:mm:ss');
  } else {
    adicionarColunasFaltantes_(sheet);
  }
  return sheet;
}

/**
 * Auto-atualização: se o Code.gs foi atualizado e ganhou colunas novas em
 * COLUMNS (ex: "culto", "rede_categoria") mas a planilha já existia de antes
 * e ainda não tem essas colunas no cabeçalho, elas são adicionadas
 * automaticamente no final, sem apagar nada do que já estava lá.
 */
function adicionarColunasFaltantes_(sheet) {
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const faltando = COLUMNS.filter(col => header.indexOf(col) === -1);
  if (faltando.length === 0) return;
  sheet.getRange(1, header.length + 1, 1, faltando.length).setValues([faltando]);
}

/**
 * Retorna o perfil ('administrador' ou 'gestor') correspondente à senha, ou
 * null se a senha não confere. Senha ainda não configurada = bloqueia acesso.
 */
function perfilDaSenha_(senha) {
  const usuario = usuarioDaSenha_(senha);
  return usuario ? usuario.perfil : null;
}

/**
 * Descobre quem entrou pela senha: { perfil, nome } ou null.
 *
 * Senhas principais: ADMINISTRADOR_PASSWORD e GESTOR_PASSWORD (ou ADMIN_PASSWORD,
 * nome da senha única na versão anterior, que continua valendo como Gestor).
 *
 * Usuários extras, cada um com sua senha: crie nas Propriedades do script uma
 * propriedade GESTOR_PASSWORD_<NOME> (ex: GESTOR_PASSWORD_ANNA) ou
 * ADMINISTRADOR_PASSWORD_<NOME>. Para tirar o acesso da pessoa, é só apagar
 * a propriedade dela.
 */
function usuarioDaSenha_(senha) {
  if (!senha) return null;
  const props = PropertiesService.getScriptProperties().getProperties();
  const nomeDe = chave => {
    const nome = chave.split('_PASSWORD_')[1] || '';
    return nome ? nome.charAt(0) + nome.slice(1).toLowerCase().replace(/_/g, ' ') : '';
  };

  // Administrador tem prioridade se a mesma senha estiver em dois lugares.
  if (props.ADMINISTRADOR_PASSWORD && senha === props.ADMINISTRADOR_PASSWORD) {
    return { perfil: PERFIL_ADMINISTRADOR, nome: '' };
  }
  const chaves = Object.keys(props);
  for (let i = 0; i < chaves.length; i++) {
    if (chaves[i].indexOf('ADMINISTRADOR_PASSWORD_') === 0 && props[chaves[i]] && senha === props[chaves[i]]) {
      return { perfil: PERFIL_ADMINISTRADOR, nome: nomeDe(chaves[i]) };
    }
  }
  const senhaGestor = props.GESTOR_PASSWORD || props.ADMIN_PASSWORD;
  if (senhaGestor && senha === senhaGestor) return { perfil: PERFIL_GESTOR, nome: '' };
  for (let i = 0; i < chaves.length; i++) {
    if (chaves[i].indexOf('GESTOR_PASSWORD_') === 0 && props[chaves[i]] && senha === props[chaves[i]]) {
      return { perfil: PERFIL_GESTOR, nome: nomeDe(chaves[i]) };
    }
  }
  return null;
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
