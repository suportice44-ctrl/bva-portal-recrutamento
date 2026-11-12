
const express = require("express");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

app.use(express.json({ limit: "30kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

async function supabaseRequest(endpoint, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error("Configuração do Supabase em falta.");
  }

  return fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...options.headers
    }
  });
}

function adminAuth(req, res, next) {
  res.setHeader("Cache-Control", "no-store");

  if (!ADMIN_PASSWORD) {
    return res.status(503).send("Admin não configurado.");
  }

  const header = req.headers.authorization || "";

  if (!header.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="BVA Administração"');
    return res.status(401).send("Autenticação necessária.");
  }

  let supplied;

  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    supplied = decoded.slice(decoded.indexOf(":") + 1);
  } catch {
    return res.status(401).send("Acesso não autorizado.");
  }

  const a = Buffer.from(supplied);
  const b = Buffer.from(ADMIN_PASSWORD);

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    res.setHeader("WWW-Authenticate", 'Basic realm="BVA Administração"');
    return res.status(401).send("Palavra-passe incorreta.");
  }

  next();
}

function clean(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

app.post("/api/candidaturas", async (req, res) => {
  const body = req.body || {};

  const campos = {
    nome: clean(body.nome, 100),
    idade: clean(body.idade, 20),
    discord: clean(body.discord, 100),
    disponibilidade: clean(body.disponibilidade, 500),
    experiencia: clean(body.experiencia, 100),
    funcao_pretendida: clean(body.funcao_pretendida, 100),
    experiencia_detalhe: clean(body.experiencia_detalhe, 2000),
    motivacao: clean(body.motivacao, 2000),
    qualidades: clean(body.qualidades, 1500),
    compromisso: clean(body.compromisso, 1500),
    q1: clean(body.q1, 300),
    q2: clean(body.q2, 300),
    q3: clean(body.q3, 300),
    situacao_pratica: clean(body.situacao_pratica, 2000),
    conflito: clean(body.conflito, 2000)
  };

  const obrigatorios = [
    "nome",
    "idade",
    "discord",
    "disponibilidade",
    "experiencia",
    "funcao_pretendida",
    "motivacao",
    "qualidades",
    "compromisso",
    "q1",
    "q2",
    "q3",
    "situacao_pratica",
    "conflito"
  ];

  if (obrigatorios.some(campo => !campos[campo])) {
    return res.status(400).json({
      error: "Preenche todos os campos obrigatórios."
    });
  }

  try {
    const response = await supabaseRequest("candidaturas", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        ...campos,
        estado: "Recebida"
      })
    });

    if (!response.ok) {
      console.error("Erro Supabase:", response.status);
      return res.status(500).json({
        error: "Não foi possível guardar a candidatura."
      });
    }

    res.json({
      ok: true,
      message: "Candidatura recebida com sucesso."
    });
  } catch (error) {
    console.error("Erro ao guardar candidatura:", error.message);
    res.status(500).json({
      error: "Erro de ligação à base de dados."
    });
  }
});

app.get("/admin", adminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

app.get("/api/admin/candidaturas", adminAuth, async (req, res) => {
  try {
    const response = await supabaseRequest(
      "candidaturas?select=*&order=data_criacao.desc"
    );

    if (!response.ok) {
      console.error("Erro ao consultar candidaturas:", response.status);
      return res.status(500).json({
        error: "Erro ao consultar candidaturas."
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({
      error: "Erro ao consultar candidaturas."
    });
  }
});

app.patch("/api/admin/candidaturas/:id", adminAuth, async (req, res) => {
  const estados = ["Recebida", "Em análise", "Aceite", "Recusada"];

  if (!estados.includes(req.body?.estado)) {
    return res.status(400).json({ error: "Estado inválido." });
  }

  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ error: "Identificador inválido." });
  }

  try {
    const response = await supabaseRequest(
      `candidaturas?id=eq.${encodeURIComponent(req.params.id)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ estado: req.body.estado })
      }
    );

    if (!response.ok) {
      return res.status(500).json({
        error: "Erro ao atualizar candidatura."
      });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({
      error: "Erro ao atualizar candidatura."
    });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Portal ativo na porta ${PORT}`);
});
    
