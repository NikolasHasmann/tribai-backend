(function() {
    'use strict';

    // 1. EXTRAÇÃO DINÂMICA DE JOGADOR E SERVIDORES VIA URL / GAME_DATA
    function obterDadosConta() {
        let nick = "Desconhecido";
        let mundoServidor = "BR";

        // Nickname via API nativa game_data ou DOM fallback
        if (typeof window.game_data !== 'undefined' && window.game_data.player && window.game_data.player.name) {
            nick = window.game_data.player.name;
        } else {
            const elNick = document.querySelector('#menu_row a[href*="screen=info_player"]') || document.querySelector('.menu-top-item a');
            if (elNick) nick = elNick.innerText.trim();
        }

        // Extração do Servidor e Mundo via URL (Ex: https://en157.tribalwars.net/...)
        const host = window.location.hostname;
        const matchUrl = host.match(/^([a-z]+)(\d+)\.tribalwars/i);
        if (matchUrl) {
            const pais = matchUrl[1].toUpperCase();
            const mundo = matchUrl[2];
            mundoServidor = `${pais}${mundo} (${pais})`;
        } else {
            if (typeof window.game_data !== 'undefined' && window.game_data.world) {
                mundoServidor = window.game_data.world.toUpperCase();
            }
        }

        return { nick, mundoServidor };
    }

    // 2. CONFIGURAÇÕES & ESTADO
    const dadosConta = obterDadosConta();
    let config = {
        chave: localStorage.getItem('tribai_key') || 'KEY-TESTE-123',
        autenticado: localStorage.getItem('tribai_auth') === 'true',
        ativo: localStorage.getItem('tribai_ativo') === 'true',
        expiracaoMs: parseInt(localStorage.getItem('tribai_expiracao')) || (Date.now() + (30 * 24 * 60 * 60 * 1000)),
        modulos: JSON.parse(localStorage.getItem('tribai_modulos') || JSON.stringify({
            coleta: true,
            farm: true,
            recrutamento: true,
            construcao: true
        }))
    };

    const ATALHOS = {
        coleta: '/game.php?screen=place&mode=scavenge',
        farm: '/game.php?screen=am_farm',
        recrutamento: '/game.php?screen=train',
        construcao: '/game.php?screen=main'
    };

    function salvarConfig() {
        localStorage.setItem('tribai_key', config.chave);
        localStorage.setItem('tribai_auth', config.autenticado);
        localStorage.setItem('tribai_ativo', config.ativo);
        localStorage.setItem('tribai_expiracao', config.expiracaoMs);
        localStorage.setItem('tribai_modulos', JSON.stringify(config.modulos));
    }

    function formatarTempoRestante(ms) {
        const diff = ms - Date.now();
        if (diff <= 0) return "Expirado";
        const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
        const horas = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        return `${dias}d ${horas}h restantes`;
    }

    // 3. INJEÇÃO DO ÍCONE LAUNCHER (ALINHADO À DIREITA COM AS MISSÕES)
    function criarIconeLauncher() {
        if (document.getElementById('tribai-launcher-btn')) return;

        const questBox = document.querySelector('#new_quest, .quest, #questlog');
        const bgLeft = document.querySelector('.bg_left');

        const btnLauncher = document.createElement('div');
        btnLauncher.id = 'tribai-launcher-btn';
        btnLauncher.style.cssText = `
            position: relative;
            display: block;
            margin: 6px 0 0 12px;
            cursor: pointer;
            width: 26px;
            height: 26px;
            background: #e3c696;
            border: 1px solid #7d5127;
            border-radius: 3px;
            text-align: center;
            box-shadow: inset 0 0 2px #fff, 1px 1px 3px rgba(0,0,0,0.4);
            z-index: 99;
        `;

        btnLauncher.innerHTML = `<img src="https://dsen.innogamescdn.com/asset/c5dfbf0e/graphic/buildings/garage.png" style="width: 16px; height: 16px; margin-top: 4px;">`;

        btnLauncher.addEventListener('click', () => {
            if (config.autenticado) {
                abrirModal2();
            } else {
                abrirModal1();
            }
        });

        if (questBox && questBox.parentNode) {
            questBox.parentNode.insertBefore(btnLauncher, questBox.nextSibling);
        } else if (bgLeft && bgLeft.parentNode) {
            bgLeft.parentNode.insertBefore(btnLauncher, bgLeft);
        } else {
            const leftCol = document.querySelector('#left_column') || document.querySelector('#content_value');
            if (leftCol) leftCol.insertBefore(btnLauncher, leftCol.firstChild);
        }
    }

    // 4. MODAL 1: AUTENTICAÇÃO
    function abrirModal1() {
        removerModais();

        const modal = document.createElement('div');
        modal.className = 'tribai-modal-box';
        modal.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 380px; background: #e2d1ac; border: 3px solid #603000;
            box-shadow: 0 0 20px rgba(0,0,0,0.8); z-index: 999999; font-family: Verdana, Arial;
            color: #331900; border-radius: 4px; padding: 14px; box-sizing: border-box;
        `;

        modal.innerHTML = `
            <div style="position: relative; border-bottom: 2px solid #7d5127; padding-bottom: 6px; margin-bottom: 8px;">
                <b style="font-size: 12px;">🛡️ TribAI Bot Starter - Autenticação</b>
                <a class="popup_box_close tooltip-delayed tribai-close-trigger" href="#" style="position: absolute; top: -6px; right: 0; text-decoration: none; font-size: 16px; font-weight: bold; color: #603000;">&nbsp;</a>
            </div>

            <div style="background: #f4e8c1; border: 1px solid #a2825b; padding: 8px; margin-bottom: 8px; font-size: 11px;">
                <div><b>Nick do Jogador:</b> ${dadosConta.nick}</div>
                <div><b>Mundo/Servidor:</b> ${dadosConta.mundoServidor}</div>
            </div>

            <div style="width: 100%; height: 75px; overflow: hidden; margin-bottom: 8px; border: 1px solid #7d5127; border-radius: 2px;">
                <img src="https://mmorpgbr.com.br/wp-content/uploads/2018/07/Tribal-wars-completa-15-anos-de-existencia.jpeg" style="width: 100%; height: 180px; object-fit: cover; object-position: 85% 10%;">
            </div>

            <div style="font-size: 11px; font-weight: bold; margin-bottom: 4px;">Insira sua Chave de Licença:</div>
            <input type="text" id="tribai-key-input" value="${config.chave}" style="width: 100%; padding: 6px; margin-bottom: 10px; text-align: center; border: 1px solid #7d5127; box-sizing: border-box; font-weight: bold;">

            <button id="tribai-btn-auth" style="width: 100%; padding: 8px; background: #4CAF50; color: #fff; font-weight: bold; border: 1px solid #2e7d32; cursor: pointer; font-size: 12px;">
                AUTENTICAR BOT
            </button>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.tribai-close-trigger').addEventListener('click', (e) => {
            e.preventDefault();
            removerModais();
        });

        modal.querySelector('#tribai-btn-auth').addEventListener('click', () => {
            const valKey = document.getElementById('tribai-key-input').value.trim();
            if (valKey.length > 0) {
                config.chave = valKey;
                config.autenticado = true;
                salvarConfig();
                removerModais();
                abrirModal2();
            }
        });
    }

    // 5. MODAL 2: CENTRAL DE CONTROLE
    function abrirModal2() {
        removerModais();

        const modal = document.createElement('div');
        modal.className = 'tribai-modal-box';
        modal.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 400px; background: #e2d1ac; border: 3px solid #603000;
            box-shadow: 0 0 20px rgba(0,0,0,0.8); z-index: 999999; font-family: Verdana, Arial;
            color: #331900; border-radius: 4px; padding: 14px; box-sizing: border-box;
        `;

        modal.innerHTML = `
            <div style="position: relative; border-bottom: 2px solid #7d5127; padding-bottom: 6px; margin-bottom: 8px;">
                <b style="font-size: 12px;">🟢 TribAI Engine - Central de Controle</b>
                <a class="popup_box_close tooltip-delayed tribai-close-trigger" href="#" style="position: absolute; top: -6px; right: 0; text-decoration: none; font-size: 16px; font-weight: bold; color: #603000;">&nbsp;</a>
            </div>

            <div style="width: 100%; height: 75px; overflow: hidden; margin-bottom: 8px; border: 1px solid #7d5127; border-radius: 2px;">
                <img src="https://mmorpgbr.com.br/wp-content/uploads/2018/07/Tribal-wars-completa-15-anos-de-existencia.jpeg" style="width: 100%; height: 180px; object-fit: cover; object-position: 85% 10%;">
            </div>

            <div style="background: #f4e8c1; border: 1px solid #a2825b; padding: 8px; margin-bottom: 10px; font-size: 11px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div><b>Conta:</b> ${dadosConta.nick} (${dadosConta.mundoServidor})</div>
                    <div><b>Status:</b> <span style="color: green; font-weight: bold;">ATIVO</span></div>
                    <div><b>Expira em:</b> <span style="color: #8b0000; font-weight: bold;">${formatarTempoRestante(config.expiracaoMs)}</span></div>
                </div>
                <button id="tribai-btn-trocar-chave" style="padding: 4px 6px; font-size: 10px; background: #7d5127; color: #fff; border: 1px solid #331900; cursor: pointer;">
                    Alterar Chave
                </button>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; background: #d4b583; padding: 6px 10px; border: 1px solid #a27a4d; margin-bottom: 10px;">
                <span style="font-weight: bold; font-size: 11px;">ESTADO GERAL DO BOT:</span>
                <label class="tribai-switch">
                    <input type="checkbox" id="tribai-master-toggle" ${config.ativo ? 'checked' : ''}>
                    <span class="tribai-slider"></span>
                </label>
            </div>

            <div style="font-size: 11px; font-weight: bold; margin-bottom: 6px;">GERENCIAMENTO DE MÓDULOS:</div>

            <div id="tribai-modules-list" style="display: flex; flex-direction: column; gap: 6px;">
                ${renderModuloRow('coleta', '🌾 Auto Coleta', config.modulos.coleta, ATALHOS.coleta)}
                ${renderModuloRow('farm', '⚔️ Auto Farm', config.modulos.farm, ATALHOS.farm)}
                ${renderModuloRow('recrutamento', '🛡️ Auto Recrutamento', config.modulos.recrutamento, ATALHOS.recrutamento)}
                ${renderModuloRow('construcao', '🏗️ Auto Construção', config.modulos.construcao, ATALHOS.construcao)}
            </div>

            <style>
                .tribai-switch { position: relative; display: inline-block; width: 40px; height: 20px; }
                .tribai-switch input { opacity: 0; width: 0; height: 0; }
                .tribai-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #888; transition: .3s; border-radius: 20px; border: 1px solid #331900; }
                .tribai-slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 2px; background-color: white; transition: .3s; border-radius: 50%; }
                input:checked + .tribai-slider { background-color: #4CAF50; }
                input:checked + .tribai-slider:before { transform: translateX(18px); }
            </style>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.tribai-close-trigger').addEventListener('click', (e) => {
            e.preventDefault();
            removerModais();
        });

        document.getElementById('tribai-master-toggle').addEventListener('change', (e) => {
            config.ativo = e.target.checked;
            salvarConfig();
        });

        document.getElementById('tribai-btn-trocar-chave').addEventListener('click', () => {
            config.autenticado = false;
            salvarConfig();
            abrirModal1();
        });

        ['coleta', 'farm', 'recrutamento', 'construcao'].forEach(mod => {
            const chk = document.getElementById(`tribai-chk-${mod}`);
            if (chk) {
                chk.addEventListener('change', (e) => {
                    config.modulos[mod] = e.target.checked;
                    salvarConfig();
                });
            }
        });
    }

    // Renderiza a linha de módulo com abertura em nova aba (target="_blank")
    function renderModuloRow(key, label, ativo, urlAtalho) {
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; background: #f4e8c1; padding: 6px 10px; border: 1px solid #a2825b; border-radius: 3px;">
                <span style="font-size: 11px;">${label}</span>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <label class="tribai-switch">
                        <input type="checkbox" id="tribai-chk-${key}" ${ativo ? 'checked' : ''}>
                        <span class="tribai-slider"></span>
                    </label>
                    <a href="${urlAtalho}" target="_blank" rel="noopener noreferrer" title="Abrir página do módulo em nova aba" style="text-decoration: none; font-size: 14px; line-height: 1;">↗️</a>
                </div>
            </div>
        `;
    }

    function removerModais() {
        document.querySelectorAll('.tribai-modal-box').forEach(el => el.remove());
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.keyCode === 27) {
            removerModais();
        }
    });

    criarIconeLauncher();

    // Re-tentativa de segurança caso a barra de missões do jogo demore a carregar
    setTimeout(criarIconeLauncher, 500);
    setTimeout(criarIconeLauncher, 1500);
    })();
})();
