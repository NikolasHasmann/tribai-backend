(function() {
    'use strict';

    const TELEGRAM_TOKEN = '8914874644:AAE-tVrbcjoHH397AUcDqOczkuDexguPlH4';
    const TELEGRAM_CHAT_ID = '8001811127';

    function enviarTelegram(msg) {
        fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: 'HTML' })
        }).catch(err => console.error('Erro Telegram:', err));
    }

    function checarEExecutarDesconexao() {
        // Elementos comuns de validação/bot-check
        const captcha = document.querySelector('#botprotect_quest, #bot_check, img[src*="captcha"], .botprotect_row');

        if (captcha) {
            // Trava para enviar notificação apenas uma vez por disparo
            if (!sessionStorage.getItem('tw_captcha_desconectando')) {
                sessionStorage.setItem('tw_captcha_desconectando', 'true');

                const conta = window.game_data ? window.game_data.player.name : 'Jogador';
                const mundo = window.game_data ? window.game_data.world : 'TW';

                // Envia aviso no Telegram
                enviarTelegram(`⚠️ <b>CAPTCHA DETECTADO!</b>\n\nConta: <b>${conta}</b>\nMundo: <b>${mundo}</b>\n\n<i>A conta foi deslogada por segurança. Resolva o CAPTCHA manualmente no navegador.</i>`);

                // Aguarda 1 segundo para garantir que o Telegram processou a requisição e faz o logout
                setTimeout(() => {
                    window.location.href = '/game.php?action=logout';
                }, 1000);
            }
        }
    }

    // Executa a checagem a cada 1.5 segundos
    setInterval(checarEExecutarDesconexao, 1500);
})();
