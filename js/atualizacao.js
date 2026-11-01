// ============================================================
// ATUALIZAÇÃO AUTOMÁTICA DO SITE
// ============================================================
// Quem deixa a ficha ou o painel aberto (ex: tablet na recepção) continuaria
// usando a versão antiga até recarregar a página. Este arquivo confere de
// tempos em tempos o "versao.json" do site; se a versão publicada for outra,
// recarrega a página sozinho — mas só quando for seguro (a página decide
// isso em window.podeAtualizarAgora, para não apagar uma ficha pela metade).
//
// Ao publicar mudanças, troque a versão em versao.json e nas tags
// <meta name="versao-site"> e "?v=" de index.html e painel.html.
// ============================================================
(function () {
  const meta = document.querySelector('meta[name="versao-site"]');
  const versaoAtual = meta ? meta.content : '';
  const INTERVALO = 5 * 60 * 1000; // confere a cada 5 minutos
  const ESPERA_NOVA_TENTATIVA = 15 * 60 * 1000;
  let versaoNova = null;

  async function verificar() {
    try {
      const resp = await fetch('versao.json?t=' + Date.now(), { cache: 'no-store' });
      if (!resp.ok) return;
      const info = await resp.json();
      if (info && info.versao && info.versao !== versaoAtual) {
        versaoNova = info.versao;
        tentarAtualizar();
      }
    } catch (err) {
      // sem internet no momento: tenta de novo na próxima conferência
    }
  }

  function tentarAtualizar() {
    if (!versaoNova) return;
    if (typeof window.podeAtualizarAgora === 'function' && !window.podeAtualizarAgora()) return;

    // Evita recarregar sem parar se o servidor ainda estiver entregando a
    // página antiga (cache de alguns minutos do GitHub Pages).
    try {
      const ultima = JSON.parse(sessionStorage.getItem('atualizacao_tentada') || 'null');
      if (ultima && ultima.versao === versaoNova && Date.now() - ultima.quando < ESPERA_NOVA_TENTATIVA) return;
      sessionStorage.setItem('atualizacao_tentada', JSON.stringify({ versao: versaoNova, quando: Date.now() }));
    } catch (err) { /* sem sessionStorage: segue */ }

    // Endereço com "?v=" novo faz o navegador buscar a página e os arquivos atualizados.
    const url = new URL(window.location.href);
    url.searchParams.set('v', versaoNova);
    window.location.replace(url.toString());
  }

  // A página chama isto quando fica num momento seguro (ex: "Preencher nova ficha").
  window.tentarAtualizarSite = tentarAtualizar;

  verificar();
  setInterval(verificar, INTERVALO);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) verificar(); });
})();
