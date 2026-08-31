export default async function handler(req, res) {
    // Configura os cabeçalhos CORS para permitir requisição do Tribal Wars
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'POST') {
        try {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const { license_key, script_target } = body;

            // 1. Validar a Chave do Usuário
            if (!license_key || license_key !== 'KEY-TESTE-123') {
                return res.status(403).send("Chave inválida ou não autorizada.");
            }

            // 2. Definir qual script buscar (Default: loader_ui.js)
            const scriptFile = script_target || 'loader_ui.js';
            
            // Configurações do Repositório Privado
            const GITHUB_USER = 'NikolasHasmann';
            const GITHUB_REPO = 'tribai-backend';
            const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Lê a variável segura da Vercel

            if (!GITHUB_TOKEN) {
                return res.status(500).send("Erro no servidor: Token do GitHub não configurado na Vercel.");
            }

            // 3. Buscar o arquivo privado via API Rest do GitHub com Autenticação
            const githubUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/scripts/${scriptFile}`;
            
            const ghResponse = await fetch(githubUrl, {
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3.raw', // Pede o conteúdo bruto em JS
                    'User-Agent': 'Vercel-Serverless-App'
                }
            });

            if (!ghResponse.ok) {
                return res.status(404).send(`Script '${scriptFile}' não encontrado no repositório privado.`);
            }

            const scriptCode = await ghResponse.text();

            // 4. Retorna o Código JS Criptografado/Autorizado para o Navegador do Cliente
            return res.status(200).json({
                status: "autorizado",
                code: scriptCode
            });

        } catch (err) {
            console.error("Erro no handler:", err);
            return res.status(500).send("Erro interno ao processar licença.");
        }
    }

    return res.status(405).json({ erro: 'Método não permitido' });
}
