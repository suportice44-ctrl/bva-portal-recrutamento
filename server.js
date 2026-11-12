
const express = require("express");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

const ESTADOS = ["Recebida", "Em análise", "Aceite", "Recusada"];

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
    res.setHeader(
      "WWW-Authenticate",
      'Basic realm="BVA Administração"'
    );
    return res.status(401).send("Autenticação necessária.");
  }

  let decoded;

  try {
    decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  } catch {
    return res.status(401).send("Acesso não autorizado.");
  }

  const separator = decoded.indexOf(":");

  if (separator === -1) {
    return res.status(401).send("Acesso não autorizado.");
  }

  const supplied = decoded.slice(separator + 1);
  const a = Buffer.from(supplied);
  const b = Buffer.from(ADMIN_PASSWORD);

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    res.setHeader(
      "WWW-Authenticate",
      'Basic realm="BVA Administração"'
    );
    return res.status(401).send("Palavra-passe incorreta.");
  }

  next();
}

function clean(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

// NOVA CANDIDATURA
app.post("/api/candidaturas", async (req, res) => {
  const body = req.body || {};

  const campos = {
    nome: clean(body.nome, 100),
    idade: clean(body.idade, 20),
    discord: clean(body.discord, 100),
    disponibilidade: clean(body.disponibilidade, 500),
    areas_atividade: clean(body.areas_atividade, 1000),
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
      const details = await response.text();
      console.error("Erro Supabase:", response.status, details);

      return res.status(500).json({
        error: "Não foi possível guardar a candidatura."
      });
    }

    return res.json({
      ok: true,
      message: "Candidatura recebida com sucesso."
    });

  } catch (error) {
    console.error("Erro ao guardar candidatura:", error.message);

    return res.status(500).json({
      error: "Erro de ligação à base de dados."
    });
  }
});

// PÁGINA DE ADMINISTRAÇÃO
app.get("/admin", adminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

// CONSULTAR TODAS AS CANDIDATURAS
app.get("/api/admin/candidaturas", adminAuth, async (req, res) => {
  try {
    const response = await supabaseRequest(
      "candidaturas?select=*&order=data_criacao.desc"
    );

    if (!response.ok) {
      const details = await response.text();
      console.error("Erro ao consultar candidaturas:", details);

      return res.status(500).json({
        error: "Erro ao consultar candidaturas."
      });
    }

    const data = await response.json();
    return res.json(data);

  } catch (error) {
    console.error(error.message);

    return res.status(500).json({
      error: "Erro ao consultar candidaturas."
    });
  }
});

// ATUALIZAR ESTADO E/OU NOTAS INTERNAS
app.patch(
  "/api/admin/candidaturas/:id",
  adminAuth,
  async (req, res) => {
    const id = req.params.id;
    const body = req.body || {};

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        error: "Identificador inválido."
      });
    }

    const updates = {};

    if (Object.prototype.hasOwnProperty.call(body, "estado")) {
      if (!ESTADOS.includes(body.estado)) {
        return res.status(400).json({
          error: "Estado inválido."
        });
      }

      updates.estado = body.estado;
    }

    if (
      Object.prototype.hasOwnProperty.call(body, "notas_internas")
    ) {
      if (typeof body.notas_internas !== "string") {
        return res.status(400).json({
          error: "Notas inválidas."
        });
      }

      updates.notas_internas = body.notas_internas.trim().slice(0, 5000);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: "Não existem alterações para guardar."
      });
    }

    try {
      const response = await supabaseRequest(
        `candidaturas?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: {
            Prefer: "return=representation"
          },
          body: JSON.stringify(updates)
        }
      );

      if (!response.ok) {
        const details = await response.text();
        console.error("Erro ao atualizar candidatura:", details);

        return res.status(500).json({
          error: "Erro ao atualizar candidatura."
        });
      }

      const updated = await response.json();

      if (!Array.isArray(updated) || updated.length === 0) {
        return res.status(404).json({
          error: "Candidatura não encontrada."
        });
      }

      return res.json({
        ok: true,
        message: "Candidatura atualizada com sucesso."
      });

    } catch (error) {
      console.error(error.message);

      return res.status(500).json({
        error: "Erro ao atualizar candidatura."
      });
    }
  }
);

// VERIFICAR ESTADO DO SERVIDOR
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "BVA Recrutamento"
  });
});

// INICIAR SERVIDOR
app.listen(PORT, () => {
  console.log(`Portal BVA ativo na porta ${PORT}`);
});
  
