export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'POST') {
        try {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const { license_key, script_target } = body;

            // 1. Validação da Licença
            if (!license_key || license_key !== 'KEY-TESTE-123') {
                return res.status(403).send("// Chave invalida");
            }

            const scriptFile = script_target || 'loader_ui.js';
            const GITHUB_USER = 'NikolasHasmann';
            const GITHUB_REPO = 'tribai-backend';
            const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

            if (!GITHUB_TOKEN) {
                return res.status(500).send("// Token ausente na Vercel");
            }

            // 2. Busca o arquivo direto na API do GitHub
            const githubUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/scripts/${scriptFile}`;
            const ghResponse = await fetch(githubUrl, {
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3.raw',
                    'User-Agent': 'Vercel-App'
                }
            });

            if (!ghResponse.ok) {
                return res.status(404).send(`// Script ${scriptFile} nao encontrado`);
            }

            const scriptCode = await ghResponse.text();

            // 3. Retorna o JS puro direto sem empacotar em JSON (Evita quebrar quebras de linha \n)
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            return res.status(200).send(scriptCode);

        } catch (err) {
            return res.status(500).send("// Erro interno no servidor");
        }
    }

    return res.status(405).send("// Metodo nao permitido");
}
