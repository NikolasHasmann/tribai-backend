// Código base entregue para o Tampermonkey
const CODIGO_SCRIPT_PRODUTO = `
    console.log("🟢 [TribAI Engine] Módulos autorizados e carregados com sucesso!");
    // Lógica dos seus scripts unificados entra aqui
`;

export default function handler(req, res) {
    // Configuração dos cabeçalhos CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Responde requisições pré-voo (OPTIONS)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Resposta de teste via navegador (GET)
    if (req.method === 'GET') {
        return res.status(200).json({ 
            status: "online", 
            mensagem: "API TribAI Backend operacional. Envie um POST para validar." 
        });
    }

    // Processamento da validação de licença via Tampermonkey (POST)
    if (req.method === 'POST') {
        try {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const { license_key } = body;

            if (!license_key) {
                return res.status(400).send("Chave de licença não fornecida.");
            }

            // Exemplo de chave válida temporária para testes de conexão
            if (license_key === 'KEY-TESTE-123') {
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                return res.status(200).send(CODIGO_SCRIPT_PRODUTO);
            }

            return res.status(403).send("Licença inválida ou expirada.");

        } catch (err) {
            return res.status(500).send("Erro interno ao processar requisição.");
        }
    }

    return res.status(405).json({ erro: 'Método não permitido' });
}
