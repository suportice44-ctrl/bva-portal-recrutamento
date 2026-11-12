
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "applications.json");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

function readApplications() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

app.post("/api/candidaturas", (req, res) => {
  const { nome, idade, discord, disponibilidade, motivacao } = req.body || {};

  if (!nome || !idade || !discord || !disponibilidade || !motivacao) {
    return res.status(400).json({ error: "Preenche todos os campos." });
  }

  const apps = readApplications();

  apps.push({
    id: Date.now().toString(36),
    nome: String(nome).slice(0, 100),
    idade: String(idade).slice(0, 3),
    discord: String(discord).slice(0, 100),
    disponibilidade: String(disponibilidade).slice(0, 500),
    motivacao: String(motivacao).slice(0, 2000),
    estado: "Recebida",
    data: new Date().toISOString()
  });

  fs.writeFileSync(DATA_FILE, JSON.stringify(apps, null, 2));

  res.json({
    ok: true,
    message: "Candidatura recebida com sucesso."
  });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Portal ativo na porta ${PORT}`);
});
    
