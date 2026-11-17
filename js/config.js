/* ============================================================
   config.js — liga o login e o banco de dados online (Firebase).
   Deixe os campos VAZIOS para usar o modo local de teste (PIN).
   Preencha com os dados do seu app da Web no Firebase:
   Configurações do projeto → Seus apps → Configuração do SDK.
   Esses valores podem ficar no código (são públicos por desenho);
   quem protege os dados são as regras do banco (firestore.rules).
   ============================================================ */
export const CLOUD = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: ''
};
