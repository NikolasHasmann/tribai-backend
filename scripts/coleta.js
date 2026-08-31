(function () {
    'use strict';

    const UNIDADES_COLETA = [
        { id: 'spear', nome: 'Spear fighter', icon: 'https://dsen.innogamescdn.com/asset/af5f894f/graphic/unit/recruit/spear.webp', carry: 25 },
        { id: 'sword', nome: 'Swordsman', icon: 'https://dsen.innogamescdn.com/asset/af5f894f/graphic/unit/recruit/sword.webp', carry: 15 },
        { id: 'axe', nome: 'Axeman', icon: 'https://dsen.innogamescdn.com/asset/af5f894f/graphic/unit/recruit/axe.webp', carry: 10 },
        { id: 'archer', nome: 'Archer', icon: 'https://dsen.innogamescdn.com/asset/af5f894f/graphic/unit/recruit/archer.webp', carry: 10 },
        { id: 'light', nome: 'Light cavalry', icon: 'https://dsen.innogamescdn.com/asset/af5f894f/graphic/unit/recruit/light.webp', carry: 80 },
        { id: 'marcher', nome: 'Mounted archer', icon: 'https://dsen.innogamescdn.com/asset/af5f894f/graphic/unit/recruit/marcher.webp', carry: 50 },
        { id: 'heavy', nome: 'Heavy cavalry', icon: 'https://dsen.innogamescdn.com/asset/af5f894f/graphic/unit/recruit/heavy.webp', carry: 50 }
    ];

    const FATORES_OPCAO = [0.10, 0.25, 0.50, 0.75];

    let unidadesMarcadas = JSON.parse(localStorage.getItem('tw_coleta_unidades') || JSON.stringify({
        spear: true, sword: true, axe: true, archer: true, light: true, marcher: true, heavy: true
    }));

    let unidadesManter = JSON.parse(localStorage.getItem('tw_coleta_manter') || JSON.stringify({
        spear: 0, sword: 0, axe: 0, archer: 0, light: 0, marcher: 0, heavy: 0
    }));

    let config = {
        ativo: localStorage.getItem('tw_coleta_ativo') === 'true',
        maxHorasColeta: parseFloat(localStorage.getItem('tw_coleta_max_horas')) || 0
    };

    let executando = false;
    let workerTimer = null;
    let inicializado = false;
    const tituloOriginalAba = document.title;

    function estaNaTelaColeta() {
        return window.location.href.includes('screen=place') && window.location.href.includes('mode=scavenge');
    }

    function delayHumano() {
        const ms = Math.floor(Math.random() * (3500 - 2000 + 1)) + 2000;
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function delayAleatorio(min = 400, max = 800) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function salvarConfig() {
        localStorage.setItem('tw_coleta_ativo', config.ativo);
        localStorage.setItem('tw_coleta_max_horas', config.maxHorasColeta);
        localStorage.setItem('tw_coleta_unidades', JSON.stringify(unidadesMarcadas));
        localStorage.setItem('tw_coleta_manter', JSON.stringify(unidadesManter));
    }

    function verificarCaptcha() {
        if (document.querySelector('#botprotect_quest, #bot_check, #bot_check_image, .bot_check, img[src*="captcha"]') || sessionStorage.getItem('tw_captcha_desconectando')) {
            console.log("CAPTCHA detectado! Ação abortada pelo script.");
            atualizarAcaoLog('🚨 CAPTCHA DETECTADO! Bot pausado.', '#8b0000');
            atualizarStatusMsg('Status: <span style="color: #990000; font-weight: bold;">DESLIGADO</span>');
            
            const btnEl = document.getElementById('tw-btn-toggle');
            if (btnEl) {
                btnEl.innerText = 'PAUSADO POR CAPTCHA';
                btnEl.style.background = '#ff0000';
                btnEl.disabled = true;
            }
            return true;
        }
        return false;
    }

    function atualizarStatusMsg(msgHtml) {
        const statusEl = document.getElementById('tw-status-msg');
        if (statusEl) {
            statusEl.innerHTML = msgHtml;
        }
    }

    function atualizarAcaoLog(msgTexto, cor = '#331900') {
        const logEl = document.getElementById('tw-log-acao');
        if (logEl) {
            logEl.innerText = msgTexto;
            logEl.style.color = cor;
        }
    }

    function iniciarContadorAntiThrottling(segundosTotais, acaoAoFinal) {
        if (workerTimer) workerTimer.terminate();

        const workerCode = `
            let targetTime = Date.now() + (${segundosTotais} * 1000);
            setInterval(() => {
                let rest = Math.round((targetTime - Date.now()) / 1000);
                postMessage(rest);
            }, 1000);
        `;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        workerTimer = new Worker(URL.createObjectURL(blob));

        workerTimer.onmessage = function (e) {
            let tempoRestante = e.data;

            if (!config.ativo) {
                document.title = tituloOriginalAba;
                atualizarStatusMsg('Status: <span style="color: #990000; font-weight: bold;">DESLIGADO</span>');
                atualizarAcaoLog('Bot desligado.', '#888');
                workerTimer.terminate();
                return;
            }

            if (tempoRestante >= 0) {
                document.title = `(${tempoRestante}s) AUTO COLETA`;
                atualizarStatusMsg(`Status: <span style="color: #008000; font-weight: bold;">LIGADO</span> (${tempoRestante}s)`);
                if (!executando) {
                    atualizarAcaoLog(`⏳ Aguardando retorno total (${tempoRestante}s restantes)`);
                }
            } else {
                workerTimer.terminate();
                if (typeof acaoAoFinal === 'function') acaoAoFinal();
            }
        };
    }

    function obterMaiorTempoRestanteColetasSegundos() {
        const cronometros = document.querySelectorAll('.scavenge-option .return-countdown');
        let maiorTempo = 0;

        cronometros.forEach(el => {
            const texto = el.innerText.trim();
            const partes = texto.split(':').map(n => parseInt(n, 10));
            let segundos = 0;

            if (partes.length === 3) {
                segundos = (partes[0] * 3600) + (partes[1] * 60) + partes[2];
            } else if (partes.length === 2) {
                segundos = (partes[0] * 60) + partes[1];
            } else if (partes.length === 1 && !isNaN(partes[0])) {
                segundos = partes[0];
            }

            if (segundos > maiorTempo) {
                maiorTempo = segundos;
            }
        });

        return maiorTempo;
    }

    function temColetaEmAndamento() {
        const coletasAtivas = document.querySelectorAll('.scavenge-option .return-countdown, .scavenge-option a.btn-cancel');
        return coletasAtivas.length > 0;
    }

    function criarPainel() {
        if (!estaNaTelaColeta()) return false;
        const container = document.querySelector('#content_value');
        if (!container) return false;

        const antigo = document.getElementById('tw-panel-scavenge');
        if (antigo) antigo.remove();

        const painel = document.createElement('div');
        painel.id = 'tw-panel-scavenge';
        painel.style.cssText = `
            position: relative; 
            margin: 10px 0 15px 0; 
            padding: 12px; 
            background: #e3c696;
            border: 2px solid #7d5127; 
            color: #331900; 
            font-family: Verdana, Arial;
            font-size: 11px; 
            z-index: 1; 
            box-shadow: 1px 1px 4px rgba(0,0,0,0.3);
            border-radius: 4px;
        `;

        let colunasUnidadesHTML = '';
        UNIDADES_COLETA.forEach(u => {
            const checked = unidadesMarcadas[u.id] !== false ? 'checked' : '';
            const manterVal = unidadesManter[u.id] || 0;
            colunasUnidadesHTML += `
                <div style="text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <div style="height: 22px; display: flex; align-items: center; justify-content: center;" title="${u.nome}">
                        <img src="${u.icon}" alt="${u.nome}" style="width: 18px; height: 18px; object-fit: contain;">
                    </div>
                    <input type="checkbox" class="tw-check-unit" data-unit="${u.id}" ${checked} style="margin-top: 2px; cursor: pointer;">
                    <input type="number" class="tw-input-manter" data-unit="${u.id}" value="${manterVal}" title="Manter na Aldeia" style="width: 42px; text-align: center; font-size: 10px; margin-top: 4px; border: 1px solid #7d5127; border-radius: 2px;">
                </div>
            `;
        });

        painel.innerHTML = `
            <div style="font-weight: bold; text-align: center; margin-bottom: 4px; font-size: 12px;">
                TribAI Bot - Auto Coleta v1.0
            </div>
            <hr style="border: 0; border-top: 1px solid #7d5127; margin: 4px 0 8px 0;">

            <div id="tw-log-acao" style="background: #d4b583; padding: 6px; border: 1px solid #a27a4d; text-align: center; font-weight: bold; font-size: 11px; color: #331900; margin-bottom: 8px; border-radius: 3px;">
                Iniciando...
            </div>

            <div id="tw-status-msg" style="text-align: left; font-size: 11px; margin-bottom: 8px;">
                Status: ${config.ativo ? '<span style="color: #008000; font-weight: bold;">LIGADO</span>' : '<span style="color: #990000; font-weight: bold;">DESLIGADO</span>'}
            </div>

            <div style="display: grid; grid-template-columns: repeat(${UNIDADES_COLETA.length}, 1fr); gap: 4px; background: #d4b583; padding: 6px; border: 1px solid #a27a4d; border-radius: 3px; margin-bottom: 10px;">
                ${colunasUnidadesHTML}
            </div>

            <div style="display: grid; grid-template-columns: 1fr; gap: 4px; margin-bottom: 10px;">
                <label style="display: flex; justify-content: space-between; align-items: center;">
                    Máximo de Horas por Coleta (0 = Sem limite):
                    <input type="number" id="tw-input-max-horas" value="${config.maxHorasColeta}" step="0.5" min="0" style="width: 60px; text-align: center; font-size: 11px; border: 1px solid #7d5127; border-radius: 2px;">
                </label>
            </div>

            <div style="display: flex; gap: 8px;">
                <button id="tw-btn-toggle" style="width: 100%; padding: 6px; background: ${config.ativo ? '#990000' : '#7d5127'}; color: #fff; font-weight: bold; border: 1px solid #331900; cursor: pointer; border-radius: 3px;">
                    ${config.ativo ? 'Desligar Bot' : 'Ligar Bot'}
                </button>
            </div>
        `;

        container.insertBefore(painel, container.firstChild);
        registrarListeners();
        return true;
    }

    function registrarListeners() {
        document.querySelectorAll('.tw-check-unit').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const u = e.target.getAttribute('data-unit');
                unidadesMarcadas[u] = e.target.checked;
                salvarConfig();
            });
        });

        document.querySelectorAll('.tw-input-manter').forEach(inp => {
            inp.addEventListener('change', (e) => {
                const u = e.target.getAttribute('data-unit');
                unidadesManter[u] = parseInt(e.target.value) || 0;
                salvarConfig();
            });
        });

        document.getElementById('tw-input-max-horas').addEventListener('change', (e) => {
            config.maxHorasColeta = parseFloat(e.target.value) || 0;
            salvarConfig();
        });

        document.getElementById('tw-btn-toggle').addEventListener('click', () => {
            if (verificarCaptcha()) return;

            config.ativo = !config.ativo;
            salvarConfig();

            const btnEl = document.getElementById('tw-btn-toggle');
            btnEl.innerText = config.ativo ? 'Desligar Bot' : 'Ligar Bot';
            btnEl.style.background = config.ativo ? '#990000' : '#7d5127';

            if (config.ativo) {
                iniciarTimerRefreshGlobal();
                executarCicloColeta();
            } else {
                if (workerTimer) workerTimer.terminate();
                document.title = tituloOriginalAba;
                atualizarStatusMsg('Status: <span style="color: #990000; font-weight: bold;">DESLIGADO</span>');
                atualizarAcaoLog('Bot desligado.', '#888');
            }
        });
    }

    function obterOpcoesDesbloqueadas() {
        return Array.from(document.querySelectorAll('.scavenge-option')).filter(opt => {
            const btn = opt.querySelector('a.btn-default');
            return btn && (btn.innerText.includes('Start') || btn.innerText.includes('Iniciar'));
        });
    }

    function lerTropasDisponiveis() {
        const tropas = {};

        UNIDADES_COLETA.forEach(u => {
            if (unidadesMarcadas[u.id] === false) {
                tropas[u.id] = 0;
                return;
            }

            const inputEl = document.querySelector(`input[name="${u.id}"]`) || document.querySelector(`.unitsInput[name="${u.id}"]`);
            if (inputEl) {
                const parent = inputEl.closest('div') || inputEl.parentElement;
                const match = parent ? parent.innerText.match(/\((\d+)\)/) : null;
                const qtdTotal = match ? parseInt(match[1], 10) : 0;
                const reserva = unidadesManter[u.id] || 0;

                tropas[u.id] = Math.max(0, qtdTotal - reserva);
            } else {
                tropas[u.id] = 0;
            }
        });

        return tropas;
    }

    function limparCamposInputs() {
        UNIDADES_COLETA.forEach(u => {
            const inputDOM = document.querySelector(`input[name="${u.id}"]`) || document.querySelector(`.unitsInput[name="${u.id}"]`);
            if (inputDOM) {
                inputDOM.value = '';
                inputDOM.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
    }

    async function enviarTodasColetas(opcoesDesbloqueadasDOM) {
        const tropasDisponiveis = lerTropasDisponiveis();

        let cargaTotalDisponivel = 0;
        UNIDADES_COLETA.forEach(u => {
            cargaTotalDisponivel += (tropasDisponiveis[u.id] || 0) * u.carry;
        });

        if (cargaTotalDisponivel <= 0) {
            atualizarAcaoLog('Nenhuma tropa disponível (descontando reservas).');
            console.log('TW Bot: Nenhuma tropa disponível após descontar a reserva.');
            iniciarTimerRefreshGlobal();
            return;
        }

        atualizarAcaoLog('🚀 Calculando alocação e enviando coletas...');

        const numOpcoes = opcoesDesbloqueadasDOM.length;
        const fatoresAtivos = FATORES_OPCAO.slice(0, numOpcoes);

        const pesosExponenciais = fatoresAtivos.map(f => Math.pow(1 / f, 1 / 0.9));
        const somaPesos = pesosExponenciais.reduce((a, b) => a + b, 0);
        const proporcoesCarga = pesosExponenciais.map(p => p / somaPesos);

        const planoEnvio = [];
        let tropasRestantes = { ...tropasDisponiveis };

        for (let i = numOpcoes - 1; i >= 0; i--) {
            let cargaAlvoOpcao = cargaTotalDisponivel * proporcoesCarga[i];

            if (config.maxHorasColeta > 0) {
                const maxSegundos = config.maxHorasColeta * 3600;
                const fatorOpcao = fatoresAtivos[i];
                const cargaMaxPermitida = Math.floor(Math.sqrt(Math.pow(maxSegundos, 1 / 0.45) / (100 * fatorOpcao)));
                if (cargaAlvoOpcao > cargaMaxPermitida) {
                    cargaAlvoOpcao = cargaMaxPermitida;
                }
            }

            let cargaAcumulada = 0;
            const alocacao = {};

            UNIDADES_COLETA.forEach(u => {
                const disponivel = tropasRestantes[u.id] || 0;
                if (disponivel <= 0) return;

                const cargaFaltando = cargaAlvoOpcao - cargaAcumulada;
                if (cargaFaltando <= 0 && i !== 0) return;

                let qtdNecessaria = Math.floor(cargaFaltando / u.carry);

                if (i === 0 && config.maxHorasColeta === 0) {
                    qtdNecessaria = disponivel;
                } else if (qtdNecessaria > disponivel) {
                    qtdNecessaria = disponivel;
                }

                if (qtdNecessaria > 0) {
                    alocacao[u.id] = qtdNecessaria;
                    cargaAcumulada += qtdNecessaria * u.carry;
                    tropasRestantes[u.id] -= qtdNecessaria;
                }
            });

            planoEnvio.unshift({
                opcaoDOM: opcoesDesbloqueadasDOM[i],
                unidades: alocacao,
                cargaCalculada: cargaAcumulada
            });
        }

        const planoOrdenadoMaiorParaMenor = [...planoEnvio].reverse();

        for (const item of planoOrdenadoMaiorParaMenor) {
            const btnEnviar = item.opcaoDOM.querySelector('a.btn-default');
            if (!btnEnviar || item.cargaCalculada <= 0) continue;

            limparCamposInputs();
            await new Promise(r => setTimeout(r, 200));

            let inseriuTropa = false;
            UNIDADES_COLETA.forEach(u => {
                const qtd = item.unidades[u.id] || 0;
                if (qtd > 0) {
                    const inputDOM = document.querySelector(`input[name="${u.id}"]`) || document.querySelector(`.unitsInput[name="${u.id}"]`);
                    if (inputDOM) {
                        inputDOM.value = qtd;
                        inputDOM.dispatchEvent(new Event('input', { bubbles: true }));
                        inputDOM.dispatchEvent(new Event('change', { bubbles: true }));
                        inseriuTropa = true;
                    }
                }
            });

            if (inseriuTropa) {
                btnEnviar.click();
                await delayHumano();
            }
        }

        iniciarTimerRefreshGlobal();
    }

    function iniciarTimerRefreshGlobal() {
        if (!config.ativo) return;

        let segundosAguardar = 60;

        if (temColetaEmAndamento()) {
            const tempoColetaLenta = obterMaiorTempoRestanteColetasSegundos();
            if (tempoColetaLenta > 0) {
                segundosAguardar = tempoColetaLenta + 5;
                console.log(`TW Bot: Refresh dinâmico ajustado para ${segundosAguardar}s.`);
            }
        }

        iniciarContadorAntiThrottling(segundosAguardar, () => {
            if (!verificarCaptcha()) {
                window.location.reload();
            }
        });
    }

    function executarCicloColeta() {
        if (verificarCaptcha()) return;
        if (!config.ativo || !estaNaTelaColeta() || executando) return;

        executando = true;

        setTimeout(async () => {
            if (verificarCaptcha()) {
                executando = false;
                return;
            }

            if (temColetaEmAndamento()) {
                atualizarAcaoLog('⚠️ Coletas em andamento. Aguardando término...');
                console.log('TW Bot: Coletas ainda em andamento. Recalculando timer...');
                iniciarTimerRefreshGlobal();
                return;
            }

            const opcoesDesbloqueadas = obterOpcoesDesbloqueadas();
            if (opcoesDesbloqueadas.length === 0) {
                atualizarAcaoLog('Nenhuma opção de coleta liberada.');
                console.log('TW Bot: Nenhuma opção liberada. Aguardando...');
                iniciarTimerRefreshGlobal();
                return;
            }

            await enviarTodasColetas(opcoesDesbloqueadas);

        }, delayAleatorio(500, 900));
    }

    function init() {
        if (inicializado) return;

        if (!criarPainel()) {
            setTimeout(init, 300);
            return;
        }

        inicializado = true;

        if (verificarCaptcha()) return;

        if (config.ativo) {
            executarCicloColeta();
        }
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        window.addEventListener('DOMContentLoaded', init);
        window.addEventListener('load', init);
    }

    const bodyObserver = new MutationObserver(() => {
        if (estaNaTelaColeta() && !document.getElementById('tw-panel-scavenge')) {
            criarPainel();
        }
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });

})();
