import { createClient } from '@supabase/supabase-js';
import JavaScriptObfuscator from 'javascript-obfuscator';

// Inicializa o cliente Supabase utilizando as variáveis de ambiente
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
}

// Código dos seus scripts que será entregue e executado na memória do cliente
const CODIGO_SCRIPT_PRODUTO = `
    console.log("🟢 [TribAI Engine] Módulos autorizados e carregados com sucesso!");
    // Aqui entrará a lógica completa unificada dos seus módulos (Farm, Coleta, Recrutamento, PP)
`;

export default async function handler(req, res) {
    // Configura os cabeçalhos CORS para autorizar chamadas originadas do Tampermonkey
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Responde com sucesso a requisições de teste/pré-voo OPTIONS do navegador
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Permite fazer um teste rápido via GET abrindo a URL no navegador
    if (req.method === 'GET') {
        return res.status(200).json({ 
            status: "online", 
            mensagem: "API TribAI Backend operacional. Envie um POST para carregar os scripts." 
        });
    }

    // Processa o pedido de autorização vindo do Loader (POST)
    if (req.method === 'POST') {
        try {
            // Garante o parse do corpo da requisição
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const { license_key, player_name, world } = body;

            if (!license_key) {
                return res.status(400).send("Chave de licença não fornecida.");
            }

            // Se o Supabase estiver configurado, realiza a checagem no banco de dados
            if (supabase) {
                const { data: licenca, error } = await supabase
                    .from('licencas')
                    .select('*')
                    .eq('chave_licenca', license_key)
                    .single();

                if (error || !licenca) {
                    return res.status(403).send("Licença inexistente.");
                }

                if (licenca.status !== 'ativo') {
                    return res.status(403).send("Licença inativa ou suspensa.");
                }

                const dataAtual = new Date();
                const dataExpiracao = new Date(licenca.expira_em);

                if (dataAtual > dataExpiracao) {
                    return res.status(403).send("Licença expirada.");
                }

                if (licenca.player_name && licenca.player_name !== player_name && licenca.player_name !== 'SeuNickNoJogo') {
                    return res.status(403).send("Licença vinculada a outra conta.");
                }
            }

            // Realiza a ofuscação dinâmica do código antes de enviar ao cliente
            const scriptOfuscado = JavaScriptObfuscator.obfuscate(CODIGO_SCRIPT_PRODUTO, {
                compact: true,
                controlFlowFlattening: false,
                deadCodeInjection: false,
                stringArray: true,
                rotateStringArray: true,
                stringArrayEncoding: ['base64']
            }).getObfuscatedCode();

            // Retorna o código ofuscado como texto puro para ser avaliado pelo Loader
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            return res.status(200).send(scriptOfuscado);

        } catch (err) {
            console.error("Erro no manipulador POST:", err);
            return res.status(500).send("Erro interno ao processar licença: " + err.message);
        }
    }

    return res.status(405).json({ erro: 'Método não permitido' });
}
