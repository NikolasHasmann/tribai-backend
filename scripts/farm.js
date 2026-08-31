// ==UserScript==
// @name         TW - Auto Farm Pro [Módulo 7.2.0 - Title Timer & UI Polish]
// @namespace    http://tampermonkey.net/
// @version      7.2.0
// @match        *://*.tribalwars.net/*screen=am_farm*
// @match        *://*.tribalwars.com.br/*screen=am_farm*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let config = {
        ativo: localStorage.getItem('tw_af_ativo') === 'true',
        refreshMinutos: parseFloat(localStorage.getItem('tw_af_refresh')) || 2.0,
        delayMin: parseInt(localStorage.getItem('tw_af_delay_min')) || 1500,
        delayMax: parseInt(localStorage.getItem('tw_af_delay_max')) || 2000,
        modeloVazio: localStorage.getItem('tw_af_mod_vazio') || 'A',
        modeloCheio: localStorage.getItem('tw_af_mod_cheio') || 'B',
        modeloAmarelo: localStorage.getItem('tw_af_mod_amarelo') || 'NONE',
        modeloAzul: localStorage.getItem('tw_af_mod_azul') || 'RAM',
        modeloVermelho: localStorage.getItem('tw_af_mod_vermelho') || 'NONE',
        spyAtaque: parseInt(localStorage.getItem('tw_af_spy_cnt')) || 1,
        axePorNivel: parseInt(localStorage.getItem('tw_af_axe_per_lvl')) || 2,
        ramPorNivel: parseInt(localStorage.getItem('tw_af_ram_per_lvl')) || 1,

        usarClNaMuralha: localStorage.getItem('tw_af_use_cl_wall') === 'true',
        clPorNivel: parseInt(localStorage.getItem('tw_af_cl_per_lvl')) || 1,
        maxCamposDistancia: parseFloat(localStorage.getItem('tw_af_max_dist')) || 30.0,
        maxAtaquesSimultaneos: parseInt(localStorage.getItem('tw_af_max_attacks')) || 2,
        intervaloMinAtaques: parseInt(localStorage.getItem('tw_af_min_interval')) || 15,
        listaNegraAuto: localStorage.getItem('tw_af_auto_blacklist') === 'true',

        aldeiasBloqueadas: JSON.parse(localStorage.getItem('tw_af_blocked') || '[]'),
        historicoVermelhos: JSON.parse(localStorage.getItem('tw_af_red_history') || '{}'),
        historicoAtaquesEnviados: JSON.parse(localStorage.getItem('tw_af_sent_history') || '{}')
    };

    let tempoRestante = Math.round(config.refreshMinutos * 60);
    let timerInterval = null;
    let executandoLoop = false;
    let aldeiasProcessadasNestaSessao = new Set();
    let abaAtiva = 'farm';

    function salvarConfig() {
        localStorage.setItem('tw_af_ativo', config.ativo);
        localStorage.setItem('tw_af_refresh', config.refreshMinutos);
        localStorage.setItem('tw_af_delay_min', config.delayMin);
        localStorage.setItem('tw_af_delay_max', config.delayMax);
        localStorage.setItem('tw_af_mod_vazio', config.modeloVazio);
        localStorage.setItem('tw_af_mod_cheio', config.modeloCheio);
        localStorage.setItem('tw_af_mod_amarelo', config.modeloAmarelo);
        localStorage.setItem('tw_af_mod_azul', config.modeloAzul);
        localStorage.setItem('tw_af_mod_vermelho', config.modeloVermelho);
        localStorage.setItem('tw_af_spy_cnt', config.spyAtaque);
        localStorage.setItem('tw_af_axe_per_lvl', config.axePorNivel);
        localStorage.setItem('tw_af_ram_per_lvl', config.ramPorNivel);

        localStorage.setItem('tw_af_use_cl_wall', config.usarClNaMuralha);
        localStorage.setItem('tw_af_cl_per_lvl', config.clPorNivel);
        localStorage.setItem('tw_af_max_dist', config.maxCamposDistancia);
        localStorage.setItem('tw_af_max_attacks', config.maxAtaquesSimultaneos);
        localStorage.setItem('tw_af_min_interval', config.intervaloMinAtaques);
        localStorage.setItem('tw_af_auto_blacklist', config.listaNegraAuto);

        localStorage.setItem('tw_af_blocked', JSON.stringify(config.aldeiasBloqueadas));
        localStorage.setItem('tw_af_red_history', JSON.stringify(config.historicoVermelhos));
        localStorage.setItem('tw_af_sent_history', JSON.stringify(config.historicoAtaquesEnviados));
    }

    function obterDelayAleatorio() {
        const min = Math.max(150, config.delayMin);
        const max = Math.max(min + 50, config.delayMax);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function logStatus(mensagem, cor = '#331900') {
        const logEl = document.getElementById('tw-log-display');
        if (logEl) {
            logEl.innerText = mensagem;
            logEl.style.color = cor;
        }
        console.log(`[AUTO FARM] ${mensagem}`);
    }

    // VERIFICAÇÃO DE SEGURANÇA (CAPTCHA / BOT PROTECTION)
    function verificarCaptchaNaTela() {
        const botProtection = document.querySelector('#bot_check') || document.querySelector('.bot-check') || document.querySelector('#botprotection_quest');
        if (botProtection) {
            logStatus("[ALERTA SEGURANÇA] Captcha detectado! Script pausado.", "red");
            document.title = "⚠️ CAPTCHA DETECTADO! - Tribal Wars";
            config.ativo = false;
            salvarConfig();
            return true;
        }
        return false;
    }

    // MOTOR NATIVO DO JOGO
    function obterTemplateNativo(modeloChar) {
        if (typeof window.Accountmanager === 'undefined' || !window.Accountmanager.farm || !window.Accountmanager.farm.templates) {
            return null;
        }
        const templates = window.Accountmanager.farm.templates;
        const keys = Object.keys(templates);
        if (keys.length === 0) return null;

        if (modeloChar.toLowerCase() === 'a') return templates['a'] || templates[keys[0]] || null;
        if (modeloChar.toLowerCase() === 'b') return templates['b'] || templates[keys[1]] || null;
        return null;
    }

    function obterSaldoNativoUnidade(tipo) {
        if (typeof window.Accountmanager !== 'undefined' && window.Accountmanager.farm && window.Accountmanager.farm.current_units) {
            const val = window.Accountmanager.farm.current_units[tipo];
            if (val !== undefined) return parseInt(val, 10) || 0;
        }
        const el = document.querySelector(`#units_home #${tipo}`) || document.querySelector(`#${tipo}`);
        if (el) {
            const txt = el.textContent || el.innerText || "0";
            return parseInt(txt.replace(/\D/g, ''), 10) || 0;
        }
        return 0;
    }

    function modeloTemTropasNativas(modelo) {
        if (modelo !== 'A' && modelo !== 'B') return false;
        const template = obterTemplateNativo(modelo);
        if (!template) return true;

        const tipos = ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'knight'];
        let exigiuAlgumaTropa = false;

        for (let tipo of tipos) {
            let necessario = parseInt(template[tipo], 10) || 0;
            if (necessario > 0) {
                exigiuAlgumaTropa = true;
                let disponivel = obterSaldoNativoUnidade(tipo);
                if (disponivel < necessario) return false;
            }
        }
        return exigiuAlgumaTropa;
    }

    function obterDistanciaLinha(linha) {
        const celulaDist = linha.querySelector('td:nth-child(8)');
        if (celulaDist) {
            const num = parseFloat(celulaDist.textContent.replace(',', '.').trim());
            if (!isNaN(num)) return num;
        }
        return 0;
    }

    function registrarEnvioAtaqueLocal(idAldeia) {
        const agora = Date.now();
        if (!config.historicoAtaquesEnviados[idAldeia]) {
            config.historicoAtaquesEnviados[idAldeia] = [];
        }

        config.historicoAtaquesEnviados[idAldeia].push(agora);

        const limite24h = agora - (24 * 60 * 60 * 1000);
        config.historicoAtaquesEnviados[idAldeia] = config.historicoAtaquesEnviados[idAldeia].filter(t => t > limite24h);

        salvarConfig();
    }

    function validarIntervaloEAtaquesLocais(idAldeia) {
        const historico = config.historicoAtaquesEnviados[idAldeia] || [];
        if (historico.length === 0) return true;

        const agora = Date.now();
        const ultimoEnvio = historico[historico.length - 1];
        const diferencaMinutos = (agora - ultimoEnvio) / (1000 * 60);

        if (diferencaMinutos < config.intervaloMinAtaques) {
            return false;
        }

        return true;
    }

    function aldeiaEstaEmListaNegra(idAldeia) {
        if (config.aldeiasBloqueadas.includes(idAldeia)) return true;
        if (config.listaNegraAuto && config.historicoVermelhos[idAldeia] >= 2) return true;
        return false;
    }

    function registrarResultadoVermelho(idAldeia, foiVermelho) {
        if (!config.listaNegraAuto) return;
        if (foiVermelho) {
            config.historicoVermelhos[idAldeia] = (config.historicoVermelhos[idAldeia] || 0) + 1;
            if (config.historicoVermelhos[idAldeia] >= 2 && !config.aldeiasBloqueadas.includes(idAldeia)) {
                config.aldeiasBloqueadas.push(idAldeia);
                logStatus(`[LISTA NEGRA] Aldeia ${idAldeia} bloqueada por 2x derrotas consecutivas.`, "darkred");
            }
        } else {
            delete config.historicoVermelhos[idAldeia];
        }
        salvarConfig();
    }

    function botaoEstaValidoEClicavel(btn) {
        if (!btn) return false;
        if (btn.offsetWidth === 0 || btn.offsetHeight === 0) return false;
        if (btn.classList.contains('start_locked')) return false;
        if (btn.hasAttribute('disabled') || btn.getAttribute('aria-disabled') === 'true') return false;
        if (btn.style.display === 'none') return false;
        return true;
    }

    function obterNivelMuralha(linha) {
        const celulaMuralha = linha.querySelector('td:nth-child(7)');
        if (celulaMuralha) {
            const texto = celulaMuralha.textContent.trim();
            const num = parseInt(texto, 10);
            if (!isNaN(num)) return num;
        }
        return 0;
    }

    function obterModeloParaLinha(linha) {
        const idAldeia = linha.id.replace('village_', '');

        if (aldeiaEstaEmListaNegra(idAldeia) || aldeiasProcessadasNestaSessao.has(idAldeia)) {
            return { modelo: 'NONE', idAldeia, nivelMuralha: 0 };
        }

        const dist = obterDistanciaLinha(linha);
        if (dist > 0 && dist > config.maxCamposDistancia) {
            return { modelo: 'NONE', idAldeia, nivelMuralha: 0 };
        }

        if (!validarIntervaloEAtaquesLocais(idAldeia)) {
            return { modelo: 'NONE', idAldeia, nivelMuralha: 0 };
        }

        const imgDot = linha.querySelector('img[src*="dots/"]');
        if (!imgDot) return { modelo: 'NONE', idAldeia, nivelMuralha: 0 };

        const srcDot = imgDot.src;
        const nivelMuralha = obterNivelMuralha(linha);

        if (srcDot.includes('yellow')) {
            registrarResultadoVermelho(idAldeia, false);
            return { modelo: config.modeloAmarelo, idAldeia, nivelMuralha };
        }
        if (srcDot.includes('blue')) {
            registrarResultadoVermelho(idAldeia, false);
            return { modelo: config.modeloAzul, idAldeia, nivelMuralha };
        }
        if (srcDot.includes('red')) {
            registrarResultadoVermelho(idAldeia, true);
            return { modelo: config.modeloVermelho, idAldeia, nivelMuralha };
        }

        if (srcDot.includes('green')) {
            registrarResultadoVermelho(idAldeia, false);
            const imgLoot = linha.querySelector('img[src*="max_loot/"]');
            if (imgLoot && imgLoot.src.includes('1')) {
                return { modelo: config.modeloCheio, idAldeia, nivelMuralha };
            }
            return { modelo: config.modeloVazio, idAldeia, nivelMuralha };
        }

        return { modelo: 'NONE', idAldeia, nivelMuralha: 0 };
    }

    function enviarAtaquePopupNativo(linha, idAldeia, unidades, callback) {
        if (verificarCaptchaNaTela()) return;

        const linkPraca = linha.querySelector('a[href*="screen=place"], a[onclick*="place"], img[src*="place.webp"]')?.closest('a') || linha.querySelector('img[src*="place.webp"]')?.parentElement;

        if (!linkPraca) {
            logStatus(`Praça não encontrada na aldeia ${idAldeia}.`, "darkred");
            aldeiasProcessadasNestaSessao.add(idAldeia);
            callback(false);
            return;
        }

        logStatus(`Abrindo Praça na Aldeia ${idAldeia}...`, "#004d40");
        linkPraca.click();

        let tentativas = 0;
        const checkModal = setInterval(() => {
            tentativas++;
            const inputAttack = document.querySelector('#target_attack');

            if (inputAttack && inputAttack.offsetWidth > 0) {
                clearInterval(checkModal);

                if (unidades.spy) {
                    const el = document.querySelector('#unit_input_spy');
                    if (el) el.value = unidades.spy;
                }
                if (unidades.axe) {
                    const el = document.querySelector('#unit_input_axe');
                    if (el) el.value = unidades.axe;
                }
                if (unidades.light) {
                    const el = document.querySelector('#unit_input_light');
                    if (el) el.value = unidades.light;
                }
                if (unidades.ram) {
                    const el = document.querySelector('#unit_input_ram');
                    if (el) el.value = unidades.ram;
                }

                logStatus(`Disparando ataque na Praça...`, "#1b5e20");

                setTimeout(() => {
                    inputAttack.click();

                    let tentativasConf = 0;
                    const checkConfirm = setInterval(() => {
                        tentativasConf++;
                        const btnConfirm = document.querySelector('#troop_confirm_submit');

                        if (btnConfirm && btnConfirm.offsetWidth > 0) {
                            clearInterval(checkConfirm);
                            btnConfirm.click();
                            logStatus(`[SUCESSO] Ataque enviado para Aldeia ${idAldeia}!`, "green");

                            registrarEnvioAtaqueLocal(idAldeia);
                            aldeiasProcessadasNestaSessao.add(idAldeia);
                            setTimeout(() => callback(true), obterDelayAleatorio());
                        }

                        if (tentativasConf > 15) {
                            clearInterval(checkConfirm);
                            logStatus("Falha ao confirmar o ataque.", "darkred");
                            aldeiasProcessadasNestaSessao.add(idAldeia);
                            callback(false);
                        }
                    }, 200);

                }, 300);
            }

            if (tentativas > 20) {
                clearInterval(checkModal);
                logStatus("Modal da Praça não respondeu.", "darkred");
                aldeiasProcessadasNestaSessao.add(idAldeia);
                callback(false);
            }
        }, 200);
    }

    function executarOrquestrador() {
        if (!config.ativo || executandoLoop || verificarCaptchaNaTela()) return;
        executandoLoop = true;

        const linhas = document.querySelectorAll('#plunder_list tr[id^="village_"]');

        // FASE 1: SAQUES NORMAIS (A, B)
        for (let linha of linhas) {
            const { modelo, idAldeia, nivelMuralha } = obterModeloParaLinha(linha);

            let modeloAjustado = modelo;
            if (modelo === 'RAM' && nivelMuralha === 0) {
                modeloAjustado = 'A';
            }

            if (modeloAjustado === 'A' || modeloAjustado === 'B') {
                if (!modeloTemTropasNativas(modeloAjustado)) {
                    continue;
                }

                let btn = null;
                if (modeloAjustado === 'A') btn = linha.querySelector('a.farm_icon_a');
                if (modeloAjustado === 'B') btn = linha.querySelector('a.farm_icon_b');

                if (botaoEstaValidoEClicavel(btn)) {
                    logStatus(`[FARM] Enviando Modelo ${modeloAjustado} para Aldeia ${idAldeia}...`, "#1b5e20");

                    registrarEnvioAtaqueLocal(idAldeia);
                    aldeiasProcessadasNestaSessao.add(idAldeia);
                    btn.click();

                    const delay = obterDelayAleatorio();
                    setTimeout(() => {
                        executandoLoop = false;
                        if (config.ativo) executarOrquestrador();
                    }, delay);

                    return;
                }
            }
        }

        // FASE 2: EXCEÇÕES (SPY / MURALHA)
        for (let linha of linhas) {
            const { modelo, idAldeia, nivelMuralha } = obterModeloParaLinha(linha);

            if (modelo === 'SPY' && obterSaldoNativoUnidade('spy') >= config.spyAtaque) {
                logStatus(`[EXPLORAR] Batedores para Aldeia ${idAldeia}...`, "#0288d1");
                enviarAtaquePopupNativo(linha, idAldeia, { spy: config.spyAtaque }, () => {
                    setTimeout(() => {
                        executandoLoop = false;
                        if (config.ativo) executarOrquestrador();
                    }, obterDelayAleatorio());
                });
                return;
            }

            if (modelo === 'RAM' && nivelMuralha > 0) {
                let qtdAxe = nivelMuralha * config.axePorNivel;
                let qtdRam = nivelMuralha * config.ramPorNivel;
                let qtdLight = 0;

                const saldoAxe = obterSaldoNativoUnidade('axe');
                const saldoRam = obterSaldoNativoUnidade('ram');
                const saldoLight = obterSaldoNativoUnidade('light');

                if (saldoAxe < qtdAxe && config.usarClNaMuralha) {
                    qtdLight = nivelMuralha * config.clPorNivel;
                    qtdAxe = 0;
                }

                const podeEnviarAxeOuCl = (qtdAxe > 0 && saldoAxe >= qtdAxe) || (qtdLight > 0 && saldoLight >= qtdLight);

                if (podeEnviarAxeOuCl && saldoRam >= qtdRam) {
                    logStatus(`[MURALHA NV ${nivelMuralha}] Atacando com ${qtdLight > 0 ? 'CLs' : 'Bárbaros'} + Aríetes...`, "#c62828");
                    enviarAtaquePopupNativo(linha, idAldeia, { axe: qtdAxe, light: qtdLight, ram: qtdRam, spy: config.spyAtaque }, () => {
                        setTimeout(() => {
                            executandoLoop = false;
                            if (config.ativo) executarOrquestrador();
                        }, obterDelayAleatorio());
                    });
                    return;
                }
            }
        }

        logStatus("Saques concluídos / Tropas esgotadas. Aguardando refresh...", "#331900");
        executandoLoop = false;
    }

    // TIMER COM ATUALIZAÇÃO NO TÍTULO DA ABA (document.title)
    function iniciarTimer() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (!config.ativo) {
                document.title = "AUTO FARM - Tribal Wars";
                return;
            }

            tempoRestante--;

            // Atualiza o contador na aba do navegador e no painel
            document.title = `(${tempoRestante}s) AUTO FARM - Tribal Wars`;

            const timerEl = document.getElementById('tw-timer-display');
            if (timerEl) timerEl.innerText = `(${tempoRestante}s)`;

            if (tempoRestante <= 0) {
                logStatus("Recarregando página...", "#b71c1c");
                location.reload();
            }
        }, 1000);
    }

    function renderOptions(sel) {
        return `
            <option value="A" ${sel === 'A' ? 'selected' : ''}>Modelo A</option>
            <option value="B" ${sel === 'B' ? 'selected' : ''}>Modelo B</option>
            <option value="C" ${sel === 'C' ? 'selected' : ''}>Modelo C</option>
            <option value="SPY" ${sel === 'SPY' ? 'selected' : ''}>Explorar (Batedores)</option>
            <option value="RAM" ${sel === 'RAM' ? 'selected' : ''}>Destruir Muralha (Aríetes)</option>
            <option value="NONE" ${sel === 'NONE' ? 'selected' : ''}>Ignorar</option>
        `;
    }

    function alternarAba(nomeAba) {
        abaAtiva = nomeAba;
        const abas = ['farm', 'muralha', 'edificios', 'filtros', 'mapeador'];
        abas.forEach(a => {
            const el = document.getElementById(`tw-tab-content-${a}`);
            const btn = document.getElementById(`tw-tab-btn-${a}`);
            if (el) el.style.display = a === nomeAba ? 'block' : 'none';
            if (btn) {
                btn.style.background = a === nomeAba ? '#f4e8c1' : '#c3a675';
                btn.style.fontWeight = a === nomeAba ? 'bold' : 'normal';
            }
        });
    }

    function criarPainel() {
        if (document.getElementById('tw-auto-farm-panel')) return;

        const painel = document.createElement('div');
        painel.id = 'tw-auto-farm-panel';
        painel.style.cssText = `
            position: relative; z-index: 99; margin: 10px 0; padding: 10px 12px;
            background: #e3c696; border: 2px solid #7d5127; color: #331900;
            font-family: Verdana, Arial, sans-serif; font-size: 11px;
            box-shadow: 2px 2px 5px rgba(0,0,0,0.3); width: 100%; box-sizing: border-box;
        `;

        painel.innerHTML = `
            <div style="font-weight: bold; text-align: center; margin-bottom: 6px; border-bottom: 1px solid #7d5127; padding-bottom: 4px;">
                TribAI Bot (Starter) - Auto Farm v1.0
            </div>

            <div style="background: #f4e8c1; border: 1px solid #a2825b; padding: 6px; margin-bottom: 8px; font-weight: bold; text-align: center; font-size: 10px;" id="tw-log-display">
                Aguardando inicialização...
            </div>

            <!-- NAVEGAÇÃO DE ABAS -->
            <div style="display: flex; gap: 2px; margin-bottom: 8px;">
                <button id="tw-tab-btn-farm" style="flex:1; padding: 4px; border:1px solid #7d5127; cursor:pointer;">⚔️ Farm</button>
                <button id="tw-tab-btn-muralha" style="flex:1; padding: 4px; border:1px solid #7d5127; cursor:pointer;">🛡️ Muralha</button>
                <button id="tw-tab-btn-edificios" style="flex:1; padding: 4px; border:1px solid #7d5127; cursor:pointer;">🏢 Edifícios</button>
                <button id="tw-tab-btn-filtros" style="flex:1; padding: 4px; border:1px solid #7d5127; cursor:pointer;">🎯 Filtros</button>
                <button id="tw-tab-btn-mapeador" style="flex:1; padding: 4px; border:1px solid #7d5127; cursor:pointer;">🗺️ Mapa</button>
            </div>

            <!-- ABA 1: FARM PRINCIPAL -->
            <div id="tw-tab-content-farm">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span>Status: <b id="tw-status-text" style="color: ${config.ativo ? 'green' : 'darkred'}">${config.ativo ? 'LIGADO' : 'DESLIGADO'}</b> <span id="tw-timer-display">(${tempoRestante}s)</span></span>
                </div>

                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <label>🟢 Verde (Parcial/Vazio):</label>
                    <select id="tw-sel-vazio">${renderOptions(config.modeloVazio)}</select>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <label>🟢 Verde (Saque Cheio):</label>
                    <select id="tw-sel-cheio">${renderOptions(config.modeloCheio)}</select>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <label>🟡 Amarelo (Perda Parcial):</label>
                    <select id="tw-sel-amarelo">${renderOptions(config.modeloAmarelo)}</select>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <label>🔵 Azul (Explorada):</label>
                    <select id="tw-sel-azul">${renderOptions(config.modeloAzul)}</select>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <label>🔴 Vermelho (Perda Total):</label>
                    <select id="tw-sel-vermelho">${renderOptions(config.modeloVermelho)}</select>
                </div>

                <div style="border-top: 1px solid #7d5127; padding-top: 6px; margin-top: 6px; margin-bottom: 8px;">
                    <b style="display:block; margin-bottom:4px; text-align:center;">Delays & Timer:</b>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <label>Intervalo MS (Min / Max):</label>
                        <div>
                            <input type="number" id="tw-input-delay-min" value="${config.delayMin}" style="width: 45px; text-align: center;"> -
                            <input type="number" id="tw-input-delay-max" value="${config.delayMax}" style="width: 45px; text-align: center;">
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <label>Refresh (minutos):</label>
                        <input type="number" id="tw-input-refresh" value="${config.refreshMinutos}" step="0.1" min="0.1" style="width: 55px; text-align: center;">
                    </div>
                </div>
            </div>

            <!-- ABA 2: MURALHA & EXCEÇÕES -->
            <div id="tw-tab-content-muralha" style="display:none;">
                <b style="display:block; margin-bottom:6px; text-align:center;">Tropas para Destruição de Muralha:</b>
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span>Batedores (Fixo):</span>
                    <input type="number" id="tw-in-spy" value="${config.spyAtaque}" style="width:45px; text-align:center;">
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span>Bárbaros (Por Nível):</span>
                    <input type="number" id="tw-in-axe" value="${config.axePorNivel}" style="width:45px; text-align:center;">
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span>Aríetes (Por Nível):</span>
                    <input type="number" id="tw-in-ram" value="${config.ramPorNivel}" style="width:45px; text-align:center;">
                </div>

                <div style="border-top: 1px solid #7d5127; padding-top: 6px; margin-top: 6px;">
                    <label style="display:flex; align-items:center; gap:6px; font-weight:bold; cursor:pointer;">
                        <input type="checkbox" id="tw-chk-use-cl" ${config.usarClNaMuralha ? 'checked' : ''}>
                        Enviar CLs na falta de Bárbaros
                    </label>
                    <div style="display:flex; justify-content:space-between; margin-top:4px; margin-bottom:6px;">
                        <span>CLs (Por Nível):</span>
                        <input type="number" id="tw-in-cl-lvl" value="${config.clPorNivel}" style="width:45px; text-align:center;">
                    </div>
                </div>

                <div style="border-top: 1px solid #7d5127; padding-top: 6px; margin-top: 6px;">
                    <label style="display:flex; align-items:center; gap:6px; font-weight:bold; cursor:pointer;">
                        <input type="checkbox" id="tw-chk-auto-black" ${config.listaNegraAuto ? 'checked' : ''}>
                        Lista Negra Automática (2x Perda Total)
                    </label>
                </div>
            </div>

            <!-- ABA 3: EDIFÍCIOS & CULTIVO -->
            <div id="tw-tab-content-edificios" style="display:none;">
                <b style="display:block; margin-bottom:6px; text-align:center;">Manutenção e Cultivo de Bárbaras:</b>
                <div style="background:#f4e8c1; border:1px solid #a2825b; padding:6px; font-size:10px; text-align:center; color:#555;">
                    Módulo em estrutura. Futura implementação de catapulta em edifícios e recrutamento automatizado.
                </div>
            </div>

            <!-- ABA 4: FILTROS & LIMITES -->
            <div id="tw-tab-content-filtros" style="display:none;">
                <b style="display:block; margin-bottom:6px; text-align:center;">Restrições de Envio:</b>
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span>Distância Máxima:</span>
                    <input type="number" id="tw-in-max-dist" value="${config.maxCamposDistancia}" step="1" style="width:50px; text-align:center;">
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span>Máx Ataques Simultâneos:</span>
                    <input type="number" id="tw-in-max-atq" value="${config.maxAtaquesSimultaneos}" style="width:50px; text-align:center;">
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span>Intervalo Mín. de Re-envio (min):</span>
                    <input type="number" id="tw-in-min-int" value="${config.intervaloMinAtaques}" style="width:50px; text-align:center;">
                </div>
            </div>

            <!-- ABA 5: MAPEADOR DE BÁRBARAS -->
            <div id="tw-tab-content-mapeador" style="display:none;">
                <b style="display:block; margin-bottom:6px; text-align:center;">Varredura & Exceções:</b>
                <textarea id="tw-txt-blacklist" style="width:100%; height:60px; font-size:10px; box-sizing:border-box; margin-bottom:4px;" placeholder="IDs de Aldeias bloqueadas (Ex: 12345, 67890)">${config.aldeiasBloqueadas.join(', ')}</textarea>
                <button id="tw-btn-save-blacklist" style="width:100%; padding:4px; background:#a2825b; border:1px solid #000; cursor:pointer; font-weight:bold;">Salvar Exceções</button>
            </div>

            <button id="tw-btn-toggle" style="width: 100%; padding: 6px; margin-top:8px; background: ${config.ativo ? '#990000' : '#4e721d'}; color: #fff; font-weight: bold; border: 1px solid #000; cursor: pointer;">
                ${config.ativo ? 'DESLIGAR' : 'LIGAR'}
            </button>
        `;

        const container = document.querySelector('#content_value');
        if (container) container.insertBefore(painel, container.firstChild);

        // NAVEGAÇÃO ENTRE ABAS
        document.getElementById('tw-tab-btn-farm').addEventListener('click', () => alternarAba('farm'));
        document.getElementById('tw-tab-btn-muralha').addEventListener('click', () => alternarAba('muralha'));
        document.getElementById('tw-tab-btn-edificios').addEventListener('click', () => alternarAba('edificios'));
        document.getElementById('tw-tab-btn-filtros').addEventListener('click', () => alternarAba('filtros'));
        document.getElementById('tw-tab-btn-mapeador').addEventListener('click', () => alternarAba('mapeador'));

        const atualizarSel = (key, val) => { config[key] = val; salvarConfig(); };

        // HANDLERS DA ABA 1
        document.getElementById('tw-sel-vazio').addEventListener('change', (e) => atualizarSel('modeloVazio', e.target.value));
        document.getElementById('tw-sel-cheio').addEventListener('change', (e) => atualizarSel('modeloCheio', e.target.value));
        document.getElementById('tw-sel-amarelo').addEventListener('change', (e) => atualizarSel('modeloAmarelo', e.target.value));
        document.getElementById('tw-sel-azul').addEventListener('change', (e) => atualizarSel('modeloAzul', e.target.value));
        document.getElementById('tw-sel-vermelho').addEventListener('change', (e) => atualizarSel('modeloVermelho', e.target.value));

        document.getElementById('tw-input-delay-min').addEventListener('change', (e) => atualizarSel('delayMin', parseInt(e.target.value) || 1500));
        document.getElementById('tw-input-delay-max').addEventListener('change', (e) => atualizarSel('delayMax', parseInt(e.target.value) || 2000));
        document.getElementById('tw-input-refresh').addEventListener('change', (e) => {
            const val = parseFloat(e.target.value);
            if (val > 0) {
                config.refreshMinutos = val;
                tempoRestante = Math.round(val * 60);
                salvarConfig();
            }
        });

        // HANDLERS DA ABA 2
        document.getElementById('tw-in-spy').addEventListener('change', (e) => atualizarSel('spyAtaque', parseInt(e.target.value) || 1));
        document.getElementById('tw-in-axe').addEventListener('change', (e) => atualizarSel('axePorNivel', parseInt(e.target.value) || 1));
        document.getElementById('tw-in-ram').addEventListener('change', (e) => atualizarSel('ramPorNivel', parseInt(e.target.value) || 1));
        document.getElementById('tw-chk-use-cl').addEventListener('change', (e) => atualizarSel('usarClNaMuralha', e.target.checked));
        document.getElementById('tw-in-cl-lvl').addEventListener('change', (e) => atualizarSel('clPorNivel', parseInt(e.target.value) || 1));
        document.getElementById('tw-chk-auto-black').addEventListener('change', (e) => atualizarSel('listaNegraAuto', e.target.checked));

        // HANDLERS DA ABA 4
        document.getElementById('tw-in-max-dist').addEventListener('change', (e) => atualizarSel('maxCamposDistancia', parseFloat(e.target.value) || 30.0));
        document.getElementById('tw-in-max-atq').addEventListener('change', (e) => atualizarSel('maxAtaquesSimultaneos', parseInt(e.target.value) || 2));
        document.getElementById('tw-in-min-int').addEventListener('change', (e) => atualizarSel('intervaloMinAtaques', parseInt(e.target.value) || 15));

        // HANDLERS DA ABA 5
        document.getElementById('tw-btn-save-blacklist').addEventListener('click', () => {
            const txt = document.getElementById('tw-txt-blacklist').value;
            const ids = txt.split(',').map(s => s.trim()).filter(s => s.length > 0);
            config.aldeiasBloqueadas = ids;
            salvarConfig();
            logStatus("Lista de exceções atualizada com sucesso!", "green");
        });

        document.getElementById('tw-btn-toggle').addEventListener('click', () => {
            config.ativo = !config.ativo;
            salvarConfig();
            location.reload();
        });

        alternarAba('farm');
    }

    criarPainel();
    iniciarTimer();

    if (config.ativo) {
        setTimeout(executarOrquestrador, 1000);
    } else {
        logStatus("Bot Desligado. Clique em LIGAR para iniciar.", "#888");
    }
})();
