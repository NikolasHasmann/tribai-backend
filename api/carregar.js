import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
    // Configura os cabeçalhos CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        return res.status(200).json({ 
            status: "online", 
            mensagem: "API TribAI Backend operacional. Envie um POST para validar." 
        });
    }

    if (req.method === 'POST') {
        try {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const { license_key } = body;

            if (!license_key) {
                return res.status(400).send("Chave não fornecida.");
            }

            // Exemplo de chave temporária válida para testes
            if (license_key === 'KEY-TESTE-123') {
                return res.status(200).json({
                    status: "autorizado",
                    expiracao: "2026-12-31T23:59:59Z"
                });
            }

            return res.status(403).send("Chave inválida.");

        } catch (err) {
            return res.status(500).send("Erro no servidor.");
        }
    }

    return res.status(405).json({ erro: 'Método não permitido' });
}
