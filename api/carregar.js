// Código base entregue para o Tampermonkey
const CODIGO_SCRIPT_PRODUTO = `
    // ==UserScript==
// @name         Auto Coleta - TribAI Bot - Starter
// @namespace    http://tampermonkey.net/
// @version      1.7
// @match        *://*.tribalwars.net/*screen=place&mode=scavenge*
// @match        *://*.tribalwars.com.br/*screen=place&mode=scavenge*
// @run-at       document-end
// @grant        none
// ==/UserScript==

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

    let unidadesMarcadas = JSON.parse(localStorage.getItem('tw_coleta_unidades') || JSON.stringify({
        spear: true, sword: true, axe: true, archer: true, light: true, marcher: true, heavy: true
    }));

    let config = {
        ativo: localStorage.getItem('tw_coleta_ativo') === 'true',
        refreshTimeMin: parseFloat(localStorage.getItem('tw_coleta_refresh_min')) || 4
    };

    let executando = false;
    let timerRegressivo = null;

    function estaNaTelaColeta() {
        return window.location.href.includes('screen=place') && window.location.href.includes('mode=scavenge');
    }

    function delayAleatorio(min = 400, max = 800) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function salvarConfig() {
        localStorage.setItem('tw_coleta_ativo', config.ativo);
        localStorage.setItem('tw_coleta_refresh_min', config.refreshTimeMin);
        localStorage.setItem('tw_coleta_unidades', JSON.stringify(unidadesMarcadas));
    }

    function verificarCaptcha() {
        if (document.querySelector('#botprotect_quest, #bot_check, img[src*="captcha"]') || sessionStorage.getItem('tw_captcha_desconectando')) {
            console.log("CAPTCHA detectado! Ação abortada pelo script.");
            atualizarStatusMsg('🚨 CAPTCHA DETECTADO! Bot pausado.');
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

    function iniciarContadorRegressivo(segundosTotais, acaoAoFinal) {
        if (timerRegressivo) clearInterval(timerRegressivo);

        let tempoRestante = Math.round(segundosTotais);

        const atualizarDisplay = () => {
            if (!config.ativo) {
                atualizarStatusMsg('Status: <span style="color: #990000; font-weight: bold;">DESLIGADO</span>');
                if (timerRegressivo) clearInterval(timerRegressivo);
                return;
            }
            if (tempoRestante >= 0) {
                atualizarStatusMsg(`Status: <span style="color: #008000; font-weight: bold;">LIGADO</span> (${tempoRestante}s)`);
            }
        };

        atualizarDisplay();

        timerRegressivo = setInterval(() => {
            tempoRestante--;
            atualizarDisplay();

            if (tempoRestante <= 0) {
                clearInterval(timerRegressivo);
                if (typeof acaoAoFinal === 'function') acaoAoFinal();
            }
        }, 1000);
    }

    function criarPainel() {
        if (!estaNaTelaColeta()) return;

        document.title = 'AUTO COLETA';

        if (document.getElementById('tw-panel-scavenge')) return;

        const painel = document.createElement('div');
        painel.id = 'tw-panel-scavenge';
        painel.style.cssText = `
            position: relative; margin: 10px 0 15px 0; padding: 12px; background: #e3c696;
            border: 2px solid #7d5127; color: #331900; font-family: Verdana, Arial;
            font-size: 11px; z-index: 1; box-shadow: 1px 1px 4px rgba(0,0,0,0.3);
        `;

        let checkboxesUnidadesHTML = '';
        UNIDADES_COLETA.forEach(u => {
            const checked = unidadesMarcadas[u.id] !== false ? 'checked' : '';
            checkboxesUnidadesHTML += `
                <div style="text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <div style="height: 22px; display: flex; align-items: center; justify-content: center;" title="${u.nome}">
                        <img src="${u.icon}" alt="${u.nome}" style="width: 18px; height: 18px; object-fit: contain;">
                    </div>
                    <input type="checkbox" class="tw-check-unit" data-unit="${u.id}" ${checked} style="margin-top: 4px; cursor: pointer;">
                </div>
            `;
        });

        painel.innerHTML = `
            <div style="font-weight: bold; text-align: center; margin-bottom: 4px; border-bottom: 1px solid #7d5127; padding-bottom: 4px; font-size: 12px;">
                Auto Coleta - TribAI Bot - Starter
            </div>
            <div id="tw-status-msg" style="text-align: left; font-size: 11px; margin-bottom: 8px;">
                Status: ${config.ativo ? '<span style="color: #008000; font-weight: bold;">LIGADO</span>' : '<span style="color: #990000; font-weight: bold;">DESLIGADO</span>'}
            </div>

            <div style="display: grid; grid-template-columns: repeat(${UNIDADES_COLETA.length}, 1fr); gap: 4px; background: #d4b583; padding: 6px; border: 1px solid #a27a4d; margin-bottom: 10px;">
                ${checkboxesUnidadesHTML}
            </div>

            <div style="display: grid; grid-template-columns: 1fr; gap: 4px; margin-bottom: 10px;">
                <label style="display: flex; justify-content: space-between; align-items: center;">
                    Tempo para atualizar página (Minutos):
                    <input type="number" id="tw-input-refresh" value="${config.refreshTimeMin}" step="0.5" min="0.1" style="width: 60px; text-align: center;">
                </label>
            </div>

            <div style="display: flex; gap: 8px;">
                <button id="tw-btn-salvar" style="flex: 1; padding: 6px; background: #4CAF50; color: #fff; font-weight: bold; border: 1px solid #2e7d32; cursor: pointer;">
                    Salvar Configurações
                </button>
                <button id="tw-btn-toggle" style="flex: 1; padding: 6px; background: ${config.ativo ? '#990000' : '#7d5127'}; color: #fff; font-weight: bold; border: 1px solid #331900; cursor: pointer;">
                    ${config.ativo ? 'Desligar Bot' : 'Ligar Bot'}
                </button>
            </div>
        `;

        const container = document.querySelector('#content_value');
        if (container) {
            container.insertBefore(painel, container.firstChild);
        }

        registrarListeners();
    }

    function registrarListeners() {
        document.querySelectorAll('.tw-check-unit').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const u = e.target.getAttribute('data-unit');
                unidadesMarcadas[u] = e.target.checked;
            });
        });

        document.getElementById('tw-input-refresh').addEventListener('change', (e) => config.refreshTimeMin = parseFloat(e.target.value) || 4);

        document.getElementById('tw-btn-salvar').addEventListener('click', () => {
            salvarConfig();
            alert('Configurações salvas!');
        });

        document.getElementById('tw-btn-toggle').addEventListener('click', () => {
            config.ativo = !config.ativo;
            salvarConfig();

            const btnEl = document.getElementById('tw-btn-toggle');
            btnEl.innerText = config.ativo ? 'Desligar Bot' : 'Ligar Bot';
            btnEl.style.background = config.ativo ? '#990000' : '#7d5127';

            if (config.ativo) {
                iniciarTimerRefreshGlobal();
                executarCicloColeta();
            } else {
                if (timerRegressivo) clearInterval(timerRegressivo);
                atualizarStatusMsg('Status: <span style="color: #990000; font-weight: bold;">DESLIGADO</span>');
            }
        });
    }

    function temColetaEmAndamento() {
        const coletasAtivas = document.querySelectorAll('.scavenge-option .return-countdown, .scavenge-option a.btn-cancel');
        return coletasAtivas.length > 0;
    }

    function obterOpcoesDesbloqueadas() {
        return Array.from(document.querySelectorAll('.scavenge-option a.btn-default')).filter(btn => btn.innerText.includes('Start') || btn.innerText.includes('Iniciar'));
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
                if (match) {
                    tropas[u.id] = parseInt(match[1], 10);
                } else {
                    tropas[u.id] = 0;
                }
            } else {
                tropas[u.id] = 0;
            }
        });

        return tropas;
    }

    async function enviarTodasColetas(opcoesDisponiveis) {
        const mapRatios = [100, 50, 25, 12.5];
        const activeRatios = mapRatios.slice(0, opcoesDisponiveis.length).reverse();
        const sumRatios = activeRatios.reduce((a, b) => a + b, 0);

        const opcoesOrdenadas = [...opcoesDisponiveis].reverse();

        for (let i = 0; i < opcoesOrdenadas.length; i++) {
            const btnEnviar = opcoesOrdenadas[i];
            const tropasDisponiveis = lerTropasDisponiveis();

            let capacidadeTotalDisponivel = 0;
            UNIDADES_COLETA.forEach(u => {
                const qtd = tropasDisponiveis[u.id] || 0;
                capacidadeTotalDisponivel += qtd * u.carry;
            });

            if (capacidadeTotalDisponivel <= 0) break;

            const proporcaoAlvo = activeRatios[i] / sumRatios;
            const cargaAlvoOpcao = capacidadeTotalDisponivel * proporcaoAlvo;
            let cargaAcumulada = 0;

            UNIDADES_COLETA.forEach(u => {
                const inputDOM = document.querySelector(`input[name="${u.id}"]`) || document.querySelector(`.unitsInput[name="${u.id}"]`);
                if (!inputDOM) return;

                if (!unidadesMarcadas[u.id]) {
                    inputDOM.value = '';
                    return;
                }

                const qtdDisponivel = tropasDisponiveis[u.id] || 0;
                if (qtdDisponivel <= 0 || cargaAcumulada >= cargaAlvoOpcao) {
                    inputDOM.value = '';
                    return;
                }

                const cargaFaltando = cargaAlvoOpcao - cargaAcumulada;
                let qtdParaEnviar = Math.floor(cargaFaltando / u.carry);

                if (qtdParaEnviar > qtdDisponivel) {
                    qtdParaEnviar = qtdDisponivel;
                }

                if (qtdParaEnviar > 0) {
                    cargaAcumulada += qtdParaEnviar * u.carry;
                    inputDOM.value = qtdParaEnviar;
                    inputDOM.dispatchEvent(new Event('input', { bubbles: true }));
                    inputDOM.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                    inputDOM.value = '';
                }
            });

            if (cargaAcumulada > 0 && btnEnviar) {
                btnEnviar.click();
                await new Promise(resolve => setTimeout(resolve, delayAleatorio(700, 1100)));
            }
        }

        // Após tentar enviar as coletas, inicia a contagem para o próximo Refresh da página
        iniciarTimerRefreshGlobal();
    }

    function iniciarTimerRefreshGlobal() {
        if (!config.ativo) return;
        const segundosRefresh = Math.round(config.refreshTimeMin * 60);
        iniciarContadorRegressivo(segundosRefresh, () => {
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

            // Se existirem coletas em andamento, não tenta enviar nada e apenas aguarda o timer do Refresh
            if (temColetaEmAndamento()) {
                console.log('TW Bot: Coletas ainda em andamento nesta aldeia. Aguardando refresh...');
                iniciarTimerRefreshGlobal();
                return;
            }

            const opcoesDisponiveis = obterOpcoesDesbloqueadas();
            if (opcoesDisponiveis.length === 0) {
                console.log('TW Bot: Nenhuma opção de coleta disponível no momento. Aguardando refresh...');
                iniciarTimerRefreshGlobal();
                return;
            }

            await enviarTodasColetas(opcoesDisponiveis);

        }, delayAleatorio(500, 900));
    }

    window.addEventListener('load', () => {
        criarPainel();
        if (verificarCaptcha()) return;

        if (config.ativo) {
            executarCicloColeta();
        }
    });

})();
`;

export default function handler(req, res) {
    // Configuração dos cabeçalhos CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Responde requisições pré-voo (OPTIONS)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Resposta de teste via navegador (GET)
    if (req.method === 'GET') {
        return res.status(200).json({ 
            status: "online", 
            mensagem: "API TribAI Backend operacional. Envie um POST para validar." 
        });
    }

    // Processamento da validação de licença via Tampermonkey (POST)
    if (req.method === 'POST') {
        try {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const { license_key } = body;

            if (!license_key) {
                return res.status(400).send("Chave de licença não fornecida.");
            }

            // Exemplo de chave válida temporária para testes de conexão
            if (license_key === 'KEY-TESTE-123') {
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                return res.status(200).send(CODIGO_SCRIPT_PRODUTO);
            }

            return res.status(403).send("Licença inválida ou expirada.");

        } catch (err) {
            return res.status(500).send("Erro interno ao processar requisição.");
        }
    }

    return res.status(405).json({ erro: 'Método não permitido' });
}
