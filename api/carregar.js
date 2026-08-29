import { createClient } from '@supabase/supabase-js';
import JavaScriptObfuscator from 'javascript-obfuscator';

// Inicializa o cliente Supabase usando as credenciais do seu projeto
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// Código dos seus scripts (futuramente pode ficar em arquivos separados ou no próprio banco)
const CODIGO_SCRIPT_PRODUTO = `
    console.log("🟢 [TribAI Engine] Módulos autorizados e carregados com sucesso!");
    // AQUI ENTRARÁ A LÓGICA COMPLETA DOS SEUS 4 SCRIPTS (FARM, COLETA, RECRUTA, PP)
`;

export default async function handler(req, res) {
    // Permite chamadas de qualquer origem (CORS) para o Tampermonkey conseguir conectar
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ erro: 'Método não permitido' });
    }

    try {
        const { license_key, player_name, world } = req.body;

        if (!license_key || !player_name) {
            return res.status(400).json({ erro: 'Dados incompletos' });
        }

        // 1. Busca a licença no Supabase
        const { data: licenca, error } = await supabase
            .from('licencas')
            .select('*')
            .eq('chave_licenca', license_key)
            .single();

        if (error || !licenca) {
            return res.status(403).json({ erro: 'Licença inexistente' });
        }

        // 2. Validações de Segurança (Status, Vencimento e Nick)
        if (licenca.status !== 'ativo') {
            return res.status(403).json({ erro: 'Licença inativa ou suspensa' });
        }

        const dataAtual = new Date();
        const dataExpiracao = new Date(licenca.expira_em);

        if (dataAtual > dataExpiracao) {
            return res.status(403).json({ erro: 'Licença expirada' });
        }

        // Valida se a licença pertence a este player_name (ou vincula no primeiro uso)
        if (licenca.player_name && licenca.player_name !== player_name) {
            return res.status(403).json({ erro: 'Licença vinculada a outra conta do jogo' });
        }

        // 3. Ofuscação Dinâmica do Código
        const scriptOfuscado = JavaScriptObfuscator.obfuscate(CODIGO_SCRIPT_PRODUTO, {
            compact: true,
            controlFlowFlattening: true,
            stringArray: true,
            rotateStringArray: true,
            stringArrayEncoding: ['base64']
        }).getObfuscatedCode();

        // 4. Devolve o JavaScript pronto para execução em memória
        res.setHeader('Content-Type', 'text/plain');
        return res.status(200).send(scriptOfuscado);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ erro: 'Erro interno no servidor' });
    }
}
