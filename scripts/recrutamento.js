(function() {
    'use strict';

    const UNIDADES = [
        { id: 'spear', nome: 'Spear fighter', edificio: 'barracks', icon: 'https://dsen.innogamescdn.com/asset/af5f894f/graphic/unit/recruit/spear.webp' },
        { id: 'sword', nome: 'Swordsman', edificio: 'barracks', icon: 'https://dsen.innogamescdn.com/asset/af5f894f/graphic/unit/recruit/sword.webp' },
        { id: 'axe', nome: 'Axeman', edificio: 'barracks', icon: 'https://dsen.innogamescdn.com/asset/af5f894f/graphic/unit/recruit/axe.webp' },
        { id: 'archer', nome: 'Archer', edificio: 'barracks', icon: 'https://dsen.innogamescdn.com/asset/af5f894f/graphic/unit/recruit/archer.webp' },
        { id: 'spy', nome: 'Scout', edificio: 'stable', icon: 'https://dsen.innogamescdn.com/asset/af5f894f/graphic/unit/recruit/spy.webp' },
        { id: 'light', nome: 'Light cavalry', edificio: 'stable', icon: 'https://dsen.innogamescdn.com/asset/af5f894f/graphic/unit/recruit/light.webp' },
        { id: 'marcher', nome: 'Mounted archer', edificio: 'stable', icon: 'https://dsen.innogamescdn.com/asset/af5f894f/graphic/unit/recruit/marcher.webp' },
        { id: 'heavy', nome: 'Heavy cavalry', edificio: 'stable', icon: 'https://dsen.innogamescdn.com/asset/af5f894f/graphic/unit/recruit/heavy.webp' },
        { id: 'ram', nome: 'Ram', edificio: 'garage', icon: 'https://dsen.innogamescdn.com/asset/af5f894f/graphic/unit/recruit/ram.webp' },
        { id: 'catapult', nome: 'Catapult', edificio: 'garage', icon: 'https://dsen.innogamescdn.com/asset/af5f894f/graphic/unit/recruit/catapult.webp' }
    ];

    let config = {
        ativo: localStorage.getItem('tw_rec_ativo') === 'true',
        refreshTimeMin: parseFloat(localStorage.getItem('tw_rec_refresh_min')) || 1,
        limiteQuartel: parseInt(localStorage.getItem('tw_rec_limite_quartel')) || 5,
        limiteEstabulo: parseInt(localStorage.getItem('tw_rec_limite_estabulo')) || 2,
        limiteOficina: parseInt(localStorage.getItem('tw_rec_limite_oficina')) || 1,
        filasMaximas: parseInt(localStorage.getItem('tw_rec_filas_max')) || 1,

        metas: JSON.parse(localStorage.getItem('tw_rec_metas_unidades') || JSON.stringify({
            spear: 60, sword: 45, axe: 0, archer: 0, spy: 0, light: 0, marcher: 0, heavy: 0, ram: 0, catapult: 0
        }))
    };

    let executando = false;
    let timerRegressivo = null;
    let captchaDetectado = false;
    const tituloBaseAba = "AUTO RECRUTAMENTO";

    function estaNaTelaRecrutamento() {
        return window.location.href.includes('screen=train');
    }

    function verificarCaptcha() {
        if (document.querySelector('#botprotect_quest, #bot_check, img[src*="captcha"]') || sessionStorage.getItem('tw_captcha_desconectando')) {
            console.log("CAPTCHA detectado! Ação abortada pelo script.");
            captchaDetectado = true;
            config.ativo = false;
            salvarConfig();

            if (timerRegressivo) clearInterval(timerRegressivo);

            document.title = "⚠️ CAPTCHA DETECTADO! ⚠️";
            atualizarAcaoLog('🚨 CAPTCHA DETECTADO! Bot pausado.');
            atualizarStatusMsg('Status: <span style="color: #990000; font-weight: bold;">DESLIGADO</span>');

            const btnEl = document.getElementById('tw-btn-toggle');
            if (btnEl) {
                btnEl.innerText = 'Ligar Bot';
                btnEl.style.background = '#7d5127';
            }
            return true;
        }
        return false;
    }

    function fazendaEstaCheia() {
        const curEl = document.querySelector("#pop_current_label");
        const maxEl = document.querySelector("#pop_max_label");
        if (curEl && maxEl) {
            const atual = parseInt(curEl.innerText.replace(/\D/g, ''), 10) || 0;
            const maximo = parseInt(maxEl.innerText.replace(/\D/g, ''), 10) || 0;
            return atual >= maximo && maximo > 0;
        }
        return false;
    }

    function atualizarStatusMsg(msgHtml) {
        const statusEl = document.getElementById('tw-status-msg');
        if (statusEl) {
            statusEl.innerHTML = msgHtml;
        }
    }

    function atualizarAcaoLog(msgTexto) {
        const logEl = document.getElementById('tw-log-acao');
        if (logEl) {
            logEl.innerText = msgTexto;
        }
    }

    function iniciarContadorRegressivo(segundosTotais, acaoAoFinal) {
        if (timerRegressivo) clearInterval(timerRegressivo);

        let tempoRestante = Math.round(segundosTotais);

        const atualizarDisplay = () => {
            if (captchaDetectado) return;

            if (!config.ativo) {
                atualizarStatusMsg('Status: <span style="color: #990000; font-weight: bold;">DESLIGADO</span>');
                atualizarAcaoLog('Bot desligado.');
                document.title = tituloBaseAba;
                if (timerRegressivo) clearInterval(timerRegressivo);
                return;
            }

            if (tempoRestante >= 0) {
                document.title = `(${tempoRestante}s) ${tituloBaseAba}`;
                atualizarStatusMsg(`Status: <span style="color: #008000; font-weight: bold;">LIGADO</span> (${tempoRestante}s)`);

                if (!fazendaEstaCheia() && !executando) {
                    atualizarAcaoLog(`Aguardando refresh (${tempoRestante}s)`);
                }
            }
        };

        atualizarDisplay();

        timerRegressivo = setInterval(() => {
            if (verificarCaptcha()) return;

            tempoRestante--;
            atualizarDisplay();

            if (tempoRestante <= 0) {
                clearInterval(timerRegressivo);
                if (typeof acaoAoFinal === 'function') acaoAoFinal();
            }
        }, 1000);
    }

    function delayAleatorio(min = 400, max = 800) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function salvarConfig() {
        localStorage.setItem('tw_rec_ativo', config.ativo);
        localStorage.setItem('tw_rec_refresh_min', config.refreshTimeMin);
        localStorage.setItem('tw_rec_limite_quartel', config.limiteQuartel);
        localStorage.setItem('tw_rec_limite_estabulo', config.limiteEstabulo);
        localStorage.setItem('tw_rec_limite_oficina', config.limiteOficina);
        localStorage.setItem('tw_rec_filas_max', config.filasMaximas);
        localStorage.setItem('tw_rec_metas_unidades', JSON.stringify(config.metas));
    }

    function criarPainel() {
        if (!estaNaTelaRecrutamento()) return;
        if (document.getElementById('tw-panel-train')) return;

        const painel = document.createElement('div');
        painel.id = 'tw-panel-train';
        painel.style.cssText = `
            position: relative; margin: 10px 0 15px 0; padding: 12px; background: #e3c696;
            border: 2px solid #7d5127; color: #331900; font-family: Verdana, Arial;
            font-size: 11px; z-index: 1; box-shadow: 1px 1px 4px rgba(0,0,0,0.3);
        `;

        let inputsUnidadesHTML = '';
        UNIDADES.forEach(u => {
            const val = config.metas[u.id] || 0;
            inputsUnidadesHTML += `
                <div style="text-align: center; display: flex; flex-direction: column; align-items: center;">
                    <div style="height: 22px; display: flex; align-items: center; justify-content: center;" title="${u.nome}">
                        <img src="${u.icon}" alt="${u.nome}" style="width: 18px; height: 18px; object-fit: contain;">
                    </div>
                    <input type="number" class="tw-input-meta" data-unit="${u.id}" value="${val}" style="width: 50px; text-align: center; font-size: 11px; margin-top: 2px;">
                </div>
            `;
        });

        painel.innerHTML = `
            <div style="font-weight: bold; text-align: center; margin-bottom: 4px; font-size: 12px;">
                TribAI Bot (Starter) - Auto Recrutamento v1.0
            </div>
            <hr style="border: 0; border-top: 1px solid #7d5127; margin: 4px 0 8px 0;">

            <div id="tw-log-acao" style="background: #d4b583; padding: 6px; border: 1px solid #a27a4d; text-align: center; font-weight: bold; font-size: 11px; color: #331900; margin-bottom: 8px;">
                Iniciando...
            </div>

            <div id="tw-status-msg" style="text-align: left; font-size: 11px; margin-bottom: 8px;">
                Status: ${config.ativo ? '<span style="color: #008000; font-weight: bold;">LIGADO</span>' : '<span style="color: #990000; font-weight: bold;">DESLIGADO</span>'}
            </div>

            <div style="display: grid; grid-template-columns: repeat(10, 1fr); gap: 2px; background: #d4b583; padding: 6px; border: 1px solid #a27a4d; margin-bottom: 10px;">
                ${inputsUnidadesHTML}
            </div>

            <div style="display: grid; grid-template-columns: 1fr; gap: 4px; margin-bottom: 10px;">
                <label style="display: flex; justify-content: space-between;">
                    Tempo em Minutos para atualizar página (Refresh):
                    <input type="number" step="0.1" id="tw-input-refresh" value="${config.refreshTimeMin}" style="width: 60px; text-align: center;">
                </label>
                <label style="display: flex; justify-content: space-between;">
                    Máximo de recrutamento por ordem (Quartel):
                    <input type="number" id="tw-input-lim-quartel" value="${config.limiteQuartel}" style="width: 60px; text-align: center;">
                </label>
                <label style="display: flex; justify-content: space-between;">
                    Máximo de recrutamento por ordem (Estábulo):
                    <input type="number" id="tw-input-lim-estabulo" value="${config.limiteEstabulo}" style="width: 60px; text-align: center;">
                </label>
                <label style="display: flex; justify-content: space-between;">
                    Máximo de recrutamento por ordem (Oficina):
                    <input type="number" id="tw-input-lim-oficina" value="${config.limiteOficina}" style="width: 60px; text-align: center;">
                </label>
                <label style="display: flex; justify-content: space-between;">
                    Filas máxima de Recrutamento (cada unidade):
                    <input type="number" id="tw-input-filas-max" value="${config.filasMaximas}" style="width: 60px; text-align: center;">
                </label>
            </div>

            <div style="display: flex; gap: 8px;">
                <button id="tw-btn-toggle" style="width: 100%; padding: 6px; background: ${config.ativo ? '#990000' : '#7d5127'}; color: #fff; font-weight: bold; border: 1px solid #331900; cursor: pointer;">
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
        document.querySelectorAll('.tw-input-meta').forEach(input => {
            input.addEventListener('change', (e) => {
                const u = e.target.getAttribute('data-unit');
                config.metas[u] = parseInt(e.target.value) || 0;
                salvarConfig();
            });
        });

        const elRefresh = document.getElementById('tw-input-refresh');
        if (elRefresh) {
            elRefresh.addEventListener('change', (e) => {
                config.refreshTimeMin = parseFloat(e.target.value) || 1;
                salvarConfig();
                if (config.ativo) iniciarTimerRefreshGlobal();
            });
        }

        const elLimQuartel = document.getElementById('tw-input-lim-quartel');
        if (elLimQuartel) {
            elLimQuartel.addEventListener('change', (e) => {
                config.limiteQuartel = parseInt(e.target.value) || 5;
                salvarConfig();
            });
        }

        const elLimEstabulo = document.getElementById('tw-input-lim-estabulo');
        if (elLimEstabulo) {
            elLimEstabulo.addEventListener('change', (e) => {
                config.limiteEstabulo = parseInt(e.target.value) || 2;
                salvarConfig();
            });
        }

        const elLimOficina = document.getElementById('tw-input-lim-oficina');
        if (elLimOficina) {
            elLimOficina.addEventListener('change', (e) => {
                config.limiteOficina = parseInt(e.target.value) || 1;
                salvarConfig();
            });
        }

        const elFilasMax = document.getElementById('tw-input-filas-max');
        if (elFilasMax) {
            elFilasMax.addEventListener('change', (e) => {
                config.filasMaximas = parseInt(e.target.value) || 1;
                salvarConfig();
            });
        }

        const elBtnToggle = document.getElementById('tw-btn-toggle');
        if (elBtnToggle) {
            elBtnToggle.addEventListener('click', () => {
                if (verificarCaptcha()) return;

                config.ativo = !config.ativo;
                salvarConfig();

                const btnEl = document.getElementById('tw-btn-toggle');
                if (btnEl) {
                    btnEl.innerText = config.ativo ? 'Desligar Bot' : 'Ligar Bot';
                    btnEl.style.background = config.ativo ? '#990000' : '#7d5127';
                }

                if (config.ativo) {
                    iniciarTimerRefreshGlobal();
                    executarCicloAldeia();
                } else {
                    if (timerRegressivo) clearInterval(timerRegressivo);
                    document.title = tituloBaseAba;
                    atualizarStatusMsg('Status: <span style="color: #990000; font-weight: bold;">DESLIGADO</span>');
                    atualizarAcaoLog('Bot desligado.');
                }
            });
        }
    }

    function obterDetalhesFilasEmAndamento(unitId) {
        let contagemFilas = 0;
        let tropasEmTreinamento = 0;

        const tabelas = document.querySelectorAll('table.vis');
        tabelas.forEach(table => {
            if (table.innerText.includes('Training') || table.innerText.includes('Treinamento') || table.innerText.includes('Cancel')) {
                const linhas = table.querySelectorAll('tr');
                linhas.forEach(tr => {
                    if (tr.querySelector(`img[src*="${unitId}"]`) || tr.innerHTML.includes(unitId)) {
                        contagemFilas++;

                        const textoLinha = tr.innerText;
                        const matchQtd = textoLinha.match(/^(\d+)/) || textoLinha.match(/(\d+)\s+(?:Spear|Swordsman|Axeman|Archer|Scout|Light|Mounted|Heavy|Ram|Catapult|Lanceiro|Espadachim|Viking|Arqueiro|Batedor|Cavalaria|Arqueiro|Cavalaria|Ariet|Catapulta)/i);

                        if (matchQtd) {
                            tropasEmTreinamento += parseInt(matchQtd[1], 10);
                        } else {
                            const emTexto = textoLinha.match(/\d+/);
                            if (emTexto) tropasEmTreinamento += parseInt(emTexto[0], 10);
                        }
                    }
                });
            }
        });

        return { contagemFilas, tropasEmTreinamento };
    }

    function obterLimiteMaximoPorEdificio(edificio) {
        if (edificio === 'barracks') return config.limiteQuartel;
        if (edificio === 'stable') return config.limiteEstabulo;
        if (edificio === 'garage') return config.limiteOficina;
        return 99999;
    }

    function processarERecrutar() {
        if (verificarCaptcha()) return false;

        if (fazendaEstaCheia()) {
            atualizarAcaoLog('Fazenda cheia - aguardando população disponível');
            return false;
        }

        let preencheuAlgumInput = false;

        UNIDADES.forEach(u => {
            const unitId = u.id;
            const metaDesejada = config.metas[unitId] || 0;

            const inputTropa = document.querySelector(`#${unitId}_0`) || document.querySelector(`input[name="${unitId}"]`);
            if (!inputTropa || inputTropa.disabled) return;

            if (metaDesejada <= 0) {
                inputTropa.value = '';
                return;
            }

            const { contagemFilas, tropasEmTreinamento } = obterDetalhesFilasEmAndamento(unitId);
            if (contagemFilas >= config.filasMaximas) return;

            const linhaTabela = inputTropa.closest('tr');
            if (!linhaTabela) return;

            let totalNaAldeia = 0;
            const celulaTotal = linhaTabela.querySelector('td:nth-child(3)') || linhaTabela.querySelector('td.nowrap');
            if (celulaTotal) {
                const matchTotal = celulaTotal.innerText.match(/(\d+)\s*\/\s*(\d+)/);
                if (matchTotal) {
                    totalNaAldeia = parseInt(matchTotal[2], 10);
                } else {
                    const numeros = celulaTotal.innerText.match(/\d+/g);
                    if (numeros && numeros.length > 0) {
                        totalNaAldeia = parseInt(numeros[numeros.length - 1], 10);
                    }
                }
            }

            const totalGeralExistente = totalNaAldeia + tropasEmTreinamento;
            const quantidadeNecessaria = metaDesejada - totalGeralExistente;

            if (quantidadeNecessaria > 0) {
                let maxRecursos = 99999;
                const tdInput = inputTropa.closest('td');
                if (tdInput) {
                    const matchRec = tdInput.innerText.match(/\((\d+)\)/);
                    if (matchRec) {
                        maxRecursos = parseInt(matchRec[1], 10);
                    }
                }

                const limiteMaximoFila = obterLimiteMaximoPorEdificio(u.edificio);
                let qtdFinal = Math.min(quantidadeNecessaria, maxRecursos, limiteMaximoFila);

                if (qtdFinal > 0) {
                    inputTropa.value = qtdFinal;
                    inputTropa.dispatchEvent(new Event('input', { bubbles: true }));
                    inputTropa.dispatchEvent(new Event('change', { bubbles: true }));
                    preencheuAlgumInput = true;
                }
            } else {
                inputTropa.value = '';
            }
        });

        return preencheuAlgumInput;
    }

    function iniciarTimerRefreshGlobal() {
        if (!config.ativo || captchaDetectado) return;
        const segundosRefresh = Math.round(config.refreshTimeMin * 60);
        iniciarContadorRegressivo(segundosRefresh, () => {
            if (!verificarCaptcha()) {
                window.location.reload();
            }
        });
    }

    function executarCicloAldeia() {
        if (verificarCaptcha()) return;
        if (!config.ativo || !estaNaTelaRecrutamento() || executando) return;

        if (fazendaEstaCheia()) {
            atualizarAcaoLog('Fazenda cheia - aguardando população disponível');
            return;
        }

        executando = true;
        atualizarAcaoLog('Recrutando...');

        setTimeout(() => {
            if (verificarCaptcha()) {
                executando = false;
                return;
            }

            const preencheuCampos = processarERecrutar();

            setTimeout(() => {
                if (verificarCaptcha()) {
                    executando = false;
                    return;
                }

                const btnRecrutar = document.querySelector('#train_form > table > tbody > tr > td > input[type="submit"]') ||
                                    document.querySelector('#train_form input.btn-recruit') ||
                                    document.querySelector('#train_form input[type="submit"]');

                if (preencheuCampos && btnRecrutar) {
                    btnRecrutar.click();
                } else {
                    executando = false;
                }

            }, delayAleatorio(600, 1000));

        }, delayAleatorio(500, 900));
    }

    // Inicialização direta e tolerante a falhas do DOM
    function inicializar() {
        criarPainel();
        if (verificarCaptcha()) return;

        if (config.ativo) {
            iniciarTimerRefreshGlobal();
            setTimeout(executarCicloAldeia, 1000);
        }
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        inicializar();
    } else {
        window.addEventListener('load', inicializar);
    }
})();
