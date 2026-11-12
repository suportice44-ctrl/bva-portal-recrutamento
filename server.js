
const express = require("express");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

async function supabaseRequest(endpoint, options = {}) {
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
  if (!ADMIN_PASSWORD) {
    return res.status(503).send("Admin não configurado.");
  }

  res.setHeader("Cache-Control", "no-store");

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

app.post("/api/candidaturas", async (req, res) => {
  const { nome, idade, discord, disponibilidade, motivacao } = req.body || {};

  if (![nome, idade, discord, disponibilidade, motivacao].every(
    value => typeof value === "string" && value.trim()
  )) {
    return res.status(400).json({ error: "Preenche todos os campos." });
  }

  try {
    const response = await supabaseRequest("candidaturas", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        nome: nome.trim().slice(0, 100),
        idade: idade.trim().slice(0, 3),
        discord: discord.trim().slice(0, 100),
        disponibilidade: disponibilidade.trim().slice(0, 500),
        motivacao: motivacao.trim().slice(0, 2000),
        estado: "Recebida"
      })
    });

    if (!response.ok) {
      console.error(await response.text());
      return res.status(500).json({ error: "Erro ao guardar candidatura." });
    }

    res.json({ ok: true, message: "Candidatura recebida com sucesso." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao guardar candidatura." });
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

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: "Erro ao consultar candidaturas." });
    }

    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao consultar candidaturas." });
  }
});

app.patch("/api/admin/candidaturas/:id", adminAuth, async (req, res) => {
  const estados = ["Recebida", "Em análise", "Aceite", "Recusada"];

  if (!estados.includes(req.body?.estado)) {
    return res.status(400).json({ error: "Estado inválido." });
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
      return res.status(500).json({ error: "Erro ao atualizar candidatura." });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar candidatura." });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Portal ativo na porta ${PORT}`);
});
    
