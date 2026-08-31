export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'POST') {
        try {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const { license_key, script_target } = body;

            // Validação de Licença
            if (!license_key || license_key !== 'KEY-TESTE-123') {
                return res.status(403).send("// Chave inválida");
            }

            const scriptFile = script_target || 'loader_ui.js';
            const GITHUB_USER = 'NikolasHasmann';
            const GITHUB_REPO = 'tribai-backend';
            const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Variável configurada no painel da Vercel

            if (!GITHUB_TOKEN) {
                return res.status(500).send("// Token ausente na Vercel");
            }

            // Requisição autenticada ao GitHub Privado
            const githubUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/scripts/${scriptFile}`;
            const ghResponse = await fetch(githubUrl, {
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3.raw',
                    'User-Agent': 'Vercel-App'
                }
            });

            if (!ghResponse.ok) {
                return res.status(404).send(`// Script ${scriptFile} não encontrado`);
            }

            const scriptCode = await ghResponse.text();

            // Retorno limpo como arquivo de Script
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            return res.status(200).send(scriptCode);

        } catch (err) {
            return res.status(500).send("// Erro interno no servidor");
        }
    }

    return res.status(405).send("// Método não permitido");
}
