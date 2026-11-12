# Portal de Recrutamento — Bombeiros Voluntários do Algarve

Portal para uma **comunidade de simulação/roleplay no Discord**. Não é um site oficial de uma corporação de bombeiros nem presta serviços de emergência.

## Executar localmente
1. Instala Node.js (versão LTS).
2. Abre um terminal nesta pasta.
3. Executa `npm install`.
4. Executa `npm start`.
5. Abre `http://localhost:3000`.

## Publicação
O projeto pode ser ligado a um serviço de alojamento Node.js através do repositório GitHub. Define o comando de arranque como `npm start`.

## Nota sobre armazenamento
Este exemplo guarda candidaturas em `applications.json` no servidor. Em alojamentos com sistema de ficheiros temporário, os dados podem perder-se após reinícios ou novas publicações. Para utilização real, configura uma base de dados persistente antes de recolher candidaturas.
