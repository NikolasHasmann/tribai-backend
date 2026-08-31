(function() {
    'use strict';

    const ICON_BASE = 'https://dsen.innogamescdn.com/asset/af5f894f/graphic/buildings/';
    const villageId = (window.game_data && window.game_data.village) ? window.game_data.village.id : 'default';

    function checarContaPremium() {
        if (!window.game_data || !window.game_data.features) return false;
        if (window.game_data.features.Premium && window.game_data.features.Premium.active) return true;
        return document.querySelector('.manager_icon') !== null || document.querySelector('#quickbar_outer') !== null;
    }

    const temContaPremium = checarContaPremium();
    const maxFilaPermitido = temContaPremium ? 5 : 2;

    const KEY_ATIVO = `tw_build_ativo_${villageId}`;
    const KEY_REFRESH = `tw_build_refresh_${villageId}`;
    const KEY_MAX_FILA = `tw_build_max_fila_${villageId}`;
    const KEY_PRIO_FAZENDA = `tw_build_prio_fazenda_${villageId}`;
    const KEY_POP_MIN = `tw_build_pop_min_${villageId}`;
    const KEY_AUTO_FREE = `tw_build_auto_free_${villageId}`;
    const KEY_FILA_CUSTOM = `tw_build_fila_custom_${villageId}`;
    const KEY_WORLD_SETTINGS = `tw_world_settings_${villageId}`;

    const BASE_EDIFICIOS = [
        { id: 'main', nome: 'Edifício Principal', max: 30, req: {}, icon: `${ICON_BASE}main.png` },
        { id: 'wood', nome: 'Bosque', max: 30, req: {}, icon: `${ICON_BASE}wood.png` },
        { id: 'stone', nome: 'Poço de Argila', max: 30, req: {}, icon: `${ICON_BASE}stone.png` },
        { id: 'iron', nome: 'Mina de Ferro', max: 30, req: {}, icon: `${ICON_BASE}iron.png` },
        { id: 'farm', nome: 'Fazenda', max: 30, req: {}, icon: `${ICON_BASE}farm.png` },
        { id: 'storage', nome: 'Armazém', max: 30, req: {}, icon: `${ICON_BASE}storage.png` },
        { id: 'hide', nome: 'Esconderijo', max: 10, req: {}, icon: `${ICON_BASE}hide.png` },
        { id: 'place', nome: 'Praça de Armas', max: 1, req: {}, icon: `${ICON_BASE}place.png` },
        { id: 'statue', nome: 'Estátua', max: 1, req: { main: 1 }, icon: `${ICON_BASE}statue.png` },
        { id: 'wall', nome: 'Muralha', max: 20, req: { barracks: 1 }, icon: `${ICON_BASE}wall.png` },
        { id: 'barracks', nome: 'Quartel', max: 25, req: { main: 3 }, icon: `${ICON_BASE}barracks.png` },
        { id: 'market', nome: 'Mercado', max: 25, req: { main: 3, storage: 2 }, icon: `${ICON_BASE}market.png` },
        { id: 'smith', nome: 'Ferreiro', max: 20, req: { main: 5, barracks: 1 }, icon: `${ICON_BASE}smith.png` },
        { id: 'stable', nome: 'Estábulo', max: 20, req: { main: 10, barracks: 5, smith: 5 }, icon: `${ICON_BASE}stable.png` },
        { id: 'garage', nome: 'Oficina', max: 15, req: { main: 10, smith: 10 }, icon: `${ICON_BASE}garage.png` },
        { id: 'snob', nome: 'Academia', max: 3, req: { main: 20, smith: 20, market: 10 }, icon: `${ICON_BASE}snob.png` }
    ];

    let worldSettings = JSON.parse(localStorage.getItem(KEY_WORLD_SETTINGS) || JSON.stringify({
        igreja: false, paladino: true, academiaNiveis: false
    }));

    let config = {
        ativo: localStorage.getItem(KEY_ATIVO) === 'true',
        refreshTimeMin: parseFloat(localStorage.getItem(KEY_REFRESH)) || 1,
        maxFila: Math.min(parseInt(localStorage.getItem(KEY_MAX_FILA)) || maxFilaPermitido, maxFilaPermitido),
        priorizarFazenda: localStorage.getItem(KEY_PRIO_FAZENDA) === 'true',
        fazendaPopMin: parseInt(localStorage.getItem(KEY_POP_MIN)) || 100,
        autoFreeInstant: localStorage.getItem(KEY_AUTO_FREE) === 'true',
        metas: {},
        filaCustom: JSON.parse(localStorage.getItem(KEY_FILA_CUSTOM) || "[]")
    };

    let timerRegressivo = null;
    let executandoPreenchimento = false;
    let captchaDetectado = false;
    const tituloOriginalAba = document.title;

    // Função de verificação e bloqueio contra Captcha / Bot Check
    function verificarEPararSeTemCaptcha() {
        const elementoCaptcha = document.querySelector("#bot_check_image, #botprotection_quest, #bot_check, .bot_check, iframe[src*='bot']");
        if (elementoCaptcha && elementoCaptcha.offsetParent !== null) {
            captchaDetectado = true;
            config.ativo = false;
            salvarConfig();

            if (timerRegressivo) clearInterval(timerRegressivo);

            document.title = "⚠️ CAPTCHA DETECTADO! ⚠️";
            atualizarStatusMsg('<span style="color: #ff0000; font-weight: bold; font-size: 12px; background: #fff0f0; padding: 2px 5px; border: 1px solid red;">⚠️ BOT PAUSADO: CAPTCHA DETECTADO! RESOLVA NA PÁGINA ⚠️</span>');

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

    function obterEdificiosDoMundo() {
        let lista = JSON.parse(JSON.stringify(BASE_EDIFICIOS));
        if (!worldSettings.paladino) lista = lista.filter(e => e.id !== 'statue');
        const academia = lista.find(e => e.id === 'snob');
        if (academia) academia.max = worldSettings.academiaNiveis ? 3 : 1;
        if (worldSettings.igreja) {
            lista.push({ id: 'church', nome: 'Igreja', max: 3, req: { main: 5, farm: 5 }, icon: `${ICON_BASE}church.png` });
            lista.push({ id: 'church_f', nome: 'Primeira Igreja', max: 1, req: {}, icon: `${ICON_BASE}church.png` });
        }
        return lista;
    }

    function estaNaTelaPrincipal() { return window.location.href.includes('screen=main'); }
    function delayConstrucaoSeguro() { return Math.floor(Math.random() * (5500 - 4000 + 1)) + 4000; }

    function salvarConfig() {
        localStorage.setItem(KEY_ATIVO, config.ativo);
        localStorage.setItem(KEY_REFRESH, config.refreshTimeMin);
        localStorage.setItem(KEY_MAX_FILA, config.maxFila);
        localStorage.setItem(KEY_PRIO_FAZENDA, config.priorizarFazenda);
        localStorage.setItem(KEY_POP_MIN, config.fazendaPopMin);
        localStorage.setItem(KEY_AUTO_FREE, config.autoFreeInstant);
        localStorage.setItem(KEY_FILA_CUSTOM, JSON.stringify(config.filaCustom));
        localStorage.setItem(KEY_WORLD_SETTINGS, JSON.stringify(worldSettings));
    }

    function fecharPopupMissoesSeAberto() {
        if (captchaDetectado) return false;
        const popup = document.querySelector("#popup_box_quest");
        if (popup && popup.offsetParent !== null) {
            const btnFechar = document.querySelector("#popup_box_quest > a");
            if (btnFechar) {
                btnFechar.click();
                return true;
            }
        }
        return false;
    }

    function obterNivelBase(edificioId) {
        if (window.BuildingMain && window.BuildingMain.buildings && window.BuildingMain.buildings[edificioId]) {
            return parseInt(window.BuildingMain.buildings[edificioId].level, 10) || 0;
        }
        const row = document.querySelector(`#main_buildrow_${edificioId}`);
        if (!row) return 0;
        const labelEl = row.querySelector('td:first-child');
        if (labelEl) {
            const match = labelEl.innerText.match(/\((\d+)\)/);
            if (match) return parseInt(match[1], 10);
        }
        return 0;
    }

    function obterQuantidadeConstruindoNaFilaDoJogo(edificioId) {
        let qtd = 0;
        const linhasFila = document.querySelectorAll(`#buildqueue tr.buildorder_${edificioId}, #build_queue tr.buildorder_${edificioId}`);
        if (linhasFila && linhasFila.length > 0) {
            return linhasFila.length;
        }

        const filaTable = document.querySelector('#build_queue') || document.querySelector('#buildqueue');
        if (!filaTable) return 0;

        filaTable.querySelectorAll('tr').forEach(tr => {
            const img = tr.querySelector('img[src*="/graphic/buildings/"]');
            if (img && img.getAttribute('src').includes(`/${edificioId}.png`)) {
                qtd++;
                return;
            }
            const cancelBtn = tr.querySelector('a[href*="action=cancel"]');
            if (cancelBtn && (cancelBtn.href.includes(`id=${edificioId}`) || cancelBtn.href.includes(`building=${edificioId}`))) {
                qtd++;
            }
        });

        return qtd;
    }

    function obterQuantidadeFila() {
        const filaTable = document.querySelector('#build_queue') || document.querySelector('#buildqueue');
        if (!filaTable) return 0;
        const linhasConstrucao = filaTable.querySelectorAll('tr.lit.nodrag, tr.buildqueue_container, tr[class*="buildorder_"]');
        if (linhasConstrucao.length > 0) return linhasConstrucao.length;
        return filaTable.querySelectorAll('a[href*="action=cancel"]').length;
    }

    function obterNivelProjetadoNoJogo(edificioId) {
        return obterNivelBase(edificioId) + obterQuantidadeConstruindoNaFilaDoJogo(edificioId);
    }

    function obterNivelProjetadoComFilaBot(edificioId) {
        let nivelBase = obterNivelProjetadoNoJogo(edificioId);
        let contagemBot = config.filaCustom.filter(item => item.id === edificioId).length;
        return nivelBase + contagemBot;
    }

    function atendeRequisitosParaProximoNivel(edificioId) {
        const edInfo = obterEdificiosDoMundo().find(e => e.id === edificioId);
        if (!edInfo || !edInfo.req) return true;

        for (const [reqId, reqNivel] of Object.entries(edInfo.req)) {
            if (obterNivelProjetadoComFilaBot(reqId) < reqNivel) {
                return false;
            }
        }
        return true;
    }

    function recalcularMetas() {
        config.metas = {};
        obterEdificiosDoMundo().forEach(b => config.metas[b.id] = obterNivelProjetadoNoJogo(b.id));
        config.filaCustom.forEach(item => {
            if (config.metas[item.id] !== undefined) {
                config.metas[item.id] = Math.max(config.metas[item.id], item.nivel);
            }
        });
    }

    function autoSincronizarComJogo() {
        let alterado = false;
        for (let i = config.filaCustom.length - 1; i >= 0; i--) {
            const item = config.filaCustom[i];
            if (item.nivel <= obterNivelProjetadoNoJogo(item.id)) {
                config.filaCustom.splice(i, 1);
                alterado = true;
            }
        }
        recalcularMetas();
        if (alterado) salvarConfig();
        renderizarGridEdificios();
        renderizarFilaLista();
    }

    function obterPopulacaoDisponivel() {
        const curEl = document.querySelector("#pop_current_label");
        const maxEl = document.querySelector("#pop_max_label");
        if (curEl && maxEl) {
            return (parseInt(maxEl.innerText.replace(/\D/g, ''), 10) || 0) - (parseInt(curEl.innerText.replace(/\D/g, ''), 10) || 0);
        }
        return 999999;
    }

    function criarPainel() {
        if (!estaNaTelaPrincipal()) return;
        const antigo = document.getElementById('tw-panel-build');
        if (antigo) antigo.remove();
        recalcularMetas();

        const painel = document.createElement('div');
        painel.id = 'tw-panel-build';
        painel.style.cssText = `position: relative; margin: 10px 0 15px 0; padding: 12px; background: #e3c696; border: 2px solid #7d5127; color: #331900; font-family: Verdana, Arial; font-size: 11px; z-index: 1; box-shadow: 1px 1px 4px rgba(0,0,0,0.3);`;
        painel.innerHTML = `
            <div style="font-weight: bold; text-align: center; margin-bottom: 6px; font-size: 12px; border-bottom: 1px solid #7d5127; padding-bottom: 4px;">TribAI Bot (Starter) - Auto Construção v1.0</div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div id="tw-status-msg" style="font-size: 11px;">
                    Status: ${config.ativo ? '<span style="color: #008000; font-weight: bold;">LIGADO</span>' : '<span style="color: #990000; font-weight: bold;">DESLIGADO</span>'}
                </div>
            </div>
            <div id="tw-grid-edificios" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-bottom: 10px;"></div>
            <div style="background: #d4b583; padding: 6px; border: 1px solid #a27a4d; margin-bottom: 10px; display: flex; flex-direction: column; gap: 6px;">
                <label style="display: flex; align-items: center; gap: 6px; font-weight: bold; cursor: pointer;">
                    <input type="checkbox" id="tw-check-fazenda" ${config.priorizarFazenda ? 'checked' : ''}>
                    Priorizar Fazenda se Pop. Disponível <=
                    <input type="number" id="tw-input-pop-min" value="${config.fazendaPopMin}" style="width: 50px; text-align: center;">
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-weight: bold; cursor: pointer; color: #006000;">
                    <input type="checkbox" id="tw-check-auto-free" ${config.autoFreeInstant ? 'checked' : ''}>
                    Finalizar grátis imediatamente (< 3 min)
                </label>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
                <label style="display: flex; justify-content: space-between; align-items: center;">Atualizar página (min): <input type="number" step="0.1" id="tw-input-refresh" value="${config.refreshTimeMin}" style="width: 55px; text-align: center;"></label>
                <label style="display: flex; justify-content: space-between; align-items: center;">
                    Limite na fila:
                    <input type="number" id="tw-input-max-fila" value="${config.maxFila}" min="1" max="${maxFilaPermitido}" style="width: 55px; text-align: center;" title="Sem CP: máx 2 | Com CP: máx 5">
                </label>
            </div>
            <div style="margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-weight: bold;">Fila Planejada:</span>
                    <button id="tw-btn-reset-fila" style="background: #a27a4d; color: #fff; border: 1px solid #331900; font-size: 9px; cursor: pointer; padding: 2px 5px;">Resetar Fila</button>
                </div>
                <div id="tw-queue-list-container" style="background: #cbb082; padding: 4px; border: 1px solid #7d5127; max-height: 250px; overflow-y: auto;"></div>
            </div>
            <div style="display: flex; gap: 8px;">
                <button id="tw-btn-toggle" style="flex: 1; padding: 8px; background: ${config.ativo ? '#990000' : '#4CAF50'}; color: #fff; font-weight: bold; border: 1px solid #331900; cursor: pointer; font-size: 12px;">${config.ativo ? 'Desligar Bot' : 'Ligar Bot'}</button>
            </div>`;

        const container = document.querySelector('#content_value');
        if (container) container.insertBefore(painel, container.firstChild);
        renderizarGridEdificios();
        renderizarFilaLista();
        registrarListeners();
        iniciarObservadorFilaJogo();
    }

    function renderizarGridEdificios() {
        const grid = document.getElementById('tw-grid-edificios');
        if (!grid) return;
        grid.innerHTML = '';

        obterEdificiosDoMundo().forEach(b => {
            const nivelBase = obterNivelBase(b.id);
            const emFilaJogo = obterQuantidadeConstruindoNaFilaDoJogo(b.id);
            const nivelProjetadoJogo = nivelBase + emFilaJogo;
            const metaAtual = config.metas[b.id] !== undefined ? config.metas[b.id] : nivelProjetadoJogo;

            const podeMinus = metaAtual > nivelProjetadoJogo;
            const atendeReqs = atendeRequisitosParaProximoNivel(b.id);
            const podePlus = metaAtual < b.max && atendeReqs;

            let tagProducao = emFilaJogo > 0 ? `<span style="color: #b8860b; font-size: 9px;">(+${emFilaJogo})</span>` : '';
            let textoNivel = `(${nivelBase}${tagProducao})`;

            if (metaAtual > nivelProjetadoJogo) {
                textoNivel = `(${nivelBase}${tagProducao} ➜ <span style="color: #008000; font-weight: bold; background: #c2eabd; padding: 0 2px;">${metaAtual}</span>)`;
            }

            const div = document.createElement('div');
            div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: #d4b583; padding: 3px 6px; border: 1px solid #a27a4d;';
            div.innerHTML = `
                <div style="display: flex; align-items: center; gap: 4px; overflow: hidden; white-space: nowrap;">
                    <img src="${b.icon}" style="width: 16px; height: 16px;">
                    <span style="font-weight: bold; font-size: 10px;">${b.nome} ${textoNivel}</span>
                </div>
                <div style="display: flex; gap: 2px;">
                    <button class="tw-btn-lvl-minus" data-id="${b.id}" style="width: 20px; height: 18px;" ${!podeMinus ? 'disabled' : ''}>-</button>
                    <button class="tw-btn-lvl-plus" data-id="${b.id}" style="width: 20px; height: 18px;" ${!podePlus ? 'disabled' : ''}>+</button>
                </div>`;
            grid.appendChild(div);
        });

        grid.querySelectorAll('.tw-btn-lvl-plus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const ed = obterEdificiosDoMundo().find(x => x.id === id);
                const maiorNivelProjetado = obterNivelProjetadoComFilaBot(id);

                if (maiorNivelProjetado < ed.max && atendeRequisitosParaProximoNivel(id)) {
                    const novoNivelAlvo = maiorNivelProjetado + 1;
                    config.metas[id] = novoNivelAlvo;
                    config.filaCustom.push({ id, nivel: novoNivelAlvo });
                    salvarConfig();
                    renderizarGridEdificios();
                    renderizarFilaLista();
                }
            });
        });

        grid.querySelectorAll('.tw-btn-lvl-minus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const nivelProjetadoJogo = obterNivelProjetadoNoJogo(id);
                let metaAntiga = config.metas[id] !== undefined ? config.metas[id] : nivelProjetadoJogo;

                if (metaAntiga > nivelProjetadoJogo) {
                    const nivelRemovido = metaAntiga;
                    config.metas[id] = metaAntiga - 1;
                    for (let i = config.filaCustom.length - 1; i >= 0; i--) {
                        if (config.filaCustom[i].id === id && config.filaCustom[i].nivel === nivelRemovido) {
                            config.filaCustom.splice(i, 1);
                            break;
                        }
                    }
                    salvarConfig();
                    renderizarGridEdificios();
                    renderizarFilaLista();
                }
            });
        });
    }

    function renderizarFilaLista() {
        const queueContainer = document.getElementById('tw-queue-list-container');
        if (!queueContainer) return;
        queueContainer.innerHTML = '';

        if (config.filaCustom.length === 0) {
            queueContainer.innerHTML = '<div style="text-align: center; color: #555; padding: 6px; font-style: italic;">Nenhuma ordem pendente.</div>';
            return;
        }

        const table = document.createElement('table');
        table.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 10px; text-align: left;';

        const qtdFilaAtualJogo = obterQuantidadeFila();
        const maxFila = config.maxFila;

        config.filaCustom.forEach((itemData, index) => {
            const ed = obterEdificiosDoMundo().find(e => e.id === itemData.id);
            if (!ed) return;

            let statusTexto = 'Aguardando vez na fila do bot';
            let corStatus = '#555';

            if (qtdFilaAtualJogo >= maxFila) {
                statusTexto = `Aguardando vaga na fila do jogo (${qtdFilaAtualJogo}/${maxFila})`;
                corStatus = '#b8860b';
            } else if (index === 0) {
                const proximoNivelNecessario = obterNivelProjetadoNoJogo(itemData.id) + 1;
                const btnExiste = document.querySelector(`#main_buildlink_${itemData.id}_${proximoNivelNecessario}`) || document.querySelector(`#main_buildrow_${itemData.id} a.btn_build`);

                if (btnExiste && btnExiste.offsetParent !== null) {
                    statusTexto = 'Pronto para enviar ao jogo';
                    corStatus = '#008000';
                } else {
                    statusTexto = 'Aguardando recursos/população';
                    corStatus = '#990000';
                }
            } else {
                statusTexto = `Aguardando item anterior (${index}º na fila)`;
                corStatus = '#666';
            }

            const tr = document.createElement('tr');
            tr.style.cssText = `background: ${index % 2 === 0 ? '#e3c696' : '#d4b583'}; border-bottom: 1px solid #a27a4d;`;

            tr.innerHTML = `
                <td style="padding: 4px; font-weight: bold; width: 15px; vertical-align: top;">${index + 1}.</td>
                <td style="padding: 4px; vertical-align: top;">
                    <div style="display: flex; align-items: center; gap: 4px; font-weight: bold;">
                        <img src="${ed.icon}" style="width: 14px; height: 14px;"> ${ed.nome} (Nível ${itemData.nivel})
                    </div>
                    <div style="font-size: 9px; color: ${corStatus}; margin-top: 2px; font-style: italic;">↳ ${statusTexto}</div>
                </td>
                <td style="padding: 4px; text-align: right; width: 65px; vertical-align: top;">
                    <button class="tw-btn-move-up" data-index="${index}" ${index === 0 ? 'disabled' : ''}>▲</button>
                    <button class="tw-btn-move-down" data-index="${index}" ${index === config.filaCustom.length - 1 ? 'disabled' : ''}>▼</button>
                    <button class="tw-btn-remove-item" data-index="${index}" style="color: red; font-weight: bold;">X</button>
                </td>`;

            table.appendChild(tr);
        });

        queueContainer.appendChild(table);

        queueContainer.querySelectorAll('.tw-btn-move-up').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
                if (idx > 0) {
                    const temp = config.filaCustom[idx];
                    config.filaCustom[idx] = config.filaCustom[idx - 1];
                    config.filaCustom[idx - 1] = temp;
                    salvarConfig(); renderizarFilaLista(); renderizarGridEdificios();
                }
            });
        });

        queueContainer.querySelectorAll('.tw-btn-move-down').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
                if (idx < config.filaCustom.length - 1) {
                    const temp = config.filaCustom[idx];
                    config.filaCustom[idx] = config.filaCustom[idx + 1];
                    config.filaCustom[idx + 1] = temp;
                    salvarConfig(); renderizarFilaLista(); renderizarGridEdificios();
                }
            });
        });

        queueContainer.querySelectorAll('.tw-btn-remove-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
                config.filaCustom.splice(idx, 1);
                recalcularMetas(); salvarConfig(); renderizarGridEdificios(); renderizarFilaLista();
            });
        });
    }

    function registrarListeners() {
        document.getElementById('tw-btn-reset-fila').addEventListener('click', () => {
            config.filaCustom = []; recalcularMetas(); renderizarGridEdificios(); renderizarFilaLista(); salvarConfig();
        });

        document.getElementById('tw-check-fazenda').addEventListener('change', (e) => { config.priorizarFazenda = e.target.checked; salvarConfig(); });
        document.getElementById('tw-check-auto-free').addEventListener('change', (e) => { config.autoFreeInstant = e.target.checked; salvarConfig(); });

        document.getElementById('tw-input-pop-min').addEventListener('change', (e) => { config.fazendaPopMin = parseInt(e.target.value) || 0; salvarConfig(); });
        document.getElementById('tw-input-refresh').addEventListener('change', (e) => { config.refreshTimeMin = parseFloat(e.target.value) || 1; salvarConfig(); });
        document.getElementById('tw-input-max-fila').addEventListener('change', (e) => {
            let val = parseInt(e.target.value) || 2;
            config.maxFila = Math.min(val, maxFilaPermitido);
            e.target.value = config.maxFila;
            salvarConfig();
        });

        document.getElementById('tw-btn-toggle').addEventListener('click', () => {
            if (captchaDetectado) return;
            config.ativo = !config.ativo;
            salvarConfig();
            const btnEl = document.getElementById('tw-btn-toggle');
            btnEl.innerText = config.ativo ? 'Desligar Bot' : 'Ligar Bot';
            btnEl.style.background = config.ativo ? '#990000' : '#4CAF50';

            if (config.ativo) {
                iniciarTimerRefreshGlobal(); preencherFilaAteOLimite();
            } else {
                if (timerRegressivo) clearInterval(timerRegressivo);
                document.title = tituloOriginalAba;
                atualizarStatusMsg('Status: <span style="color: #990000; font-weight: bold;">DESLIGADO</span>');
            }
        });
    }

    function iniciarObservadorFilaJogo() {
        const buildQueueNode = document.querySelector('#build_queue') || document.querySelector('#buildqueue');
        if (!buildQueueNode) return;

        const observer = new MutationObserver(() => {
            if (verificarEPararSeTemCaptcha()) return;
            autoSincronizarComJogo();
            renderizarFilaLista();
        });
        observer.observe(buildQueueNode, { childList: true, subtree: true });
    }

    function atualizarStatusMsg(msgHtml) {
        const statusEl = document.getElementById('tw-status-msg');
        if (statusEl) statusEl.innerHTML = msgHtml;
    }

    // Timer com atualização visual no título da aba (document.title)
    function iniciarContadorRegressivo(segundosTotais) {
        if (timerRegressivo) clearInterval(timerRegressivo);
        let tempoRestante = Math.round(segundosTotais);

        const atualizarDisplay = () => {
            if (captchaDetectado) return;
            if (!config.ativo) {
                atualizarStatusMsg('Status: <span style="color: #990000; font-weight: bold;">DESLIGADO</span>');
                document.title = tituloOriginalAba;
                if (timerRegressivo) clearInterval(timerRegressivo);
                return;
            }
            if (tempoRestante >= 0) {
                const strTempo = `(${tempoRestante}s) AUTO CONSTRUÇÃO`;
                document.title = strTempo;
                atualizarStatusMsg(`Status: <span style="color: #008000; font-weight: bold;">LIGADO</span> (${tempoRestante}s)`);
            }
        };

        atualizarDisplay();
        timerRegressivo = setInterval(() => {
            if (verificarEPararSeTemCaptcha()) return;
            tempoRestante--;
            atualizarDisplay();
            if (tempoRestante <= 0) {
                clearInterval(timerRegressivo);
                if (config.ativo && !captchaDetectado) window.location.reload();
            }
        }, 1000);
    }

    function verificarEExecutarInstant() {
        if (captchaDetectado || !config.autoFreeInstant) return false;
        const btnFree = document.querySelector("#buildqueue a.btn-instant-free:not([style*='display: none'])") ||
                        document.querySelector("a.btn-instant-free:not([style*='display: none'])");
        if (btnFree) {
            btnFree.click();
            return true;
        }
        return false;
    }

    function dispararConstrucao(btnElement) {
        if (!btnElement || captchaDetectado) return false;

        const href = btnElement.getAttribute('href');
        if (href && href !== '#' && href.includes('action=build')) {
            window.location.href = href;
            return true;
        }

        const onclick = btnElement.getAttribute('onclick');
        if (onclick && onclick.includes('BuildingMain.build')) {
            eval(onclick);
            return true;
        }

        btnElement.click();
        return true;
    }

    function buscarBotaoConstrucaoDinamico(edificioId, nivelAlvo) {
        let btn = document.querySelector(`#main_buildlink_${edificioId}_${nivelAlvo}`);
        if (btn && btn.offsetParent !== null) return btn;

        const trRow = document.querySelector(`#main_buildrow_${edificioId}`);
        if (trRow) {
            btn = trRow.querySelector(`a.btn_build, a.main_buildlink`);
            if (btn && btn.offsetParent !== null) {
                return btn;
            }
        }
        return null;
    }

    function tentarUmCliqueConstrucao() {
        if (!config.ativo || captchaDetectado) return false;

        if (verificarEPararSeTemCaptcha()) return false;
        if (fecharPopupMissoesSeAberto()) return false;
        if (verificarEExecutarInstant()) return true;

        const qtdFilaAtualJogo = obterQuantidadeFila();
        if (qtdFilaAtualJogo >= config.maxFila) {
            atualizarStatusMsg(`Status: <span style="color: #b8860b; font-weight: bold;">Fila cheia no jogo (${qtdFilaAtualJogo}/${config.maxFila})</span>`);
            renderizarFilaLista();
            return false;
        }

        if (config.priorizarFazenda && obterPopulacaoDisponivel() <= config.fazendaPopMin) {
            const metaFazenda = config.metas['farm'] || 30;
            const proximoNivelFazenda = obterNivelProjetadoNoJogo('farm') + 1;
            if (proximoNivelFazenda <= metaFazenda) {
                const btnFazenda = buscarBotaoConstrucaoDinamico('farm', proximoNivelFazenda);
                if (btnFazenda) return dispararConstrucao(btnFazenda);
            }
        }

        if (config.filaCustom.length > 0) {
            const item = config.filaCustom[0];
            const edificioId = item.id;
            const proximoNivelRealNecessario = obterNivelProjetadoNoJogo(edificioId) + 1;

            const btnBuild = buscarBotaoConstrucaoDinamico(edificioId, proximoNivelRealNecessario);
            if (btnBuild) {
                config.filaCustom.shift();
                salvarConfig();
                renderizarFilaLista();
                renderizarGridEdificios();
                return dispararConstrucao(btnBuild);
            } else {
                const ed = obterEdificiosDoMundo().find(e => e.id === edificioId);
                atualizarStatusMsg(`Status: <span style="color: #b8860b; font-weight: bold;">Aguardando recursos/população para ${ed ? ed.nome : edificioId} (${proximoNivelRealNecessario})</span>`);
                renderizarFilaLista();
            }
        }

        return false;
    }

    function preencherFilaAteOLimite() {
        if (!config.ativo || executandoPreenchimento || captchaDetectado) return;
        executandoPreenchimento = true;

        const tentarProximaOrdem = () => {
            if (!config.ativo || captchaDetectado) {
                executandoPreenchimento = false;
                return;
            }

            if (verificarEPararSeTemCaptcha()) {
                executandoPreenchimento = false;
                return;
            }

            fecharPopupMissoesSeAberto();
            autoSincronizarComJogo();

            if (obterQuantidadeFila() < config.maxFila) {
                const construiu = tentarUmCliqueConstrucao();
                if (construiu) {
                    setTimeout(tentarProximaOrdem, delayConstrucaoSeguro());
                } else {
                    executandoPreenchimento = false;
                }
            } else {
                executandoPreenchimento = false;
            }
        };

        tentarProximaOrdem();
    }

    function iniciarTimerRefreshGlobal() {
        if (!config.ativo || captchaDetectado) return;
        iniciarContadorRegressivo(Math.round(config.refreshTimeMin * 60));
    }

    window.addEventListener('load', () => {
        criarPainel();

        if (verificarEPararSeTemCaptcha()) return;

        if (config.ativo) {
            iniciarTimerRefreshGlobal();
            setTimeout(preencherFilaAteOLimite, 2000);

            setInterval(() => {
                if (!verificarEPararSeTemCaptcha() && config.ativo) {
                    fecharPopupMissoesSeAberto();
                    verificarEExecutarInstant();
                    preencherFilaAteOLimite();
                }
            }, 3000);
        }
    });

})();
