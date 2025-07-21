// Script para testar conectividade com diferentes servidores FusionSolar
const axios = require('axios');
const crypto = require('crypto');

const API_SERVERS = [
  'https://intl.fusionsolar.huawei.com/thirdData',
  'https://eu5.fusionsolar.huawei.com/thirdData',
  'https://ap1.fusionsolar.huawei.com/thirdData',
  'https://us1.fusionsolar.huawei.com/thirdData'
];

async function testServer(baseURL, userName, systemCode) {
  console.log(`\n🔍 Testando: ${baseURL}`);
  
  const timestamp = Date.now().toString();
  const bodyObj = {
    userName: userName,
    systemCode: systemCode
  };
  const body = JSON.stringify(bodyObj);
  const signature = crypto.createHmac('sha256', systemCode).update(body + timestamp).digest('hex');

  try {
    const response = await axios.post(`${baseURL}/login`, bodyObj, {
      headers: {
        'Content-Type': 'application/json',
        'XSRF-TOKEN': signature,
        'timeStamp': timestamp,
        'User-Agent': 'FusionSolar-Monitor/1.0'
      },
      timeout: 10000
    });

    if (response.data.success) {
      console.log(`✅ SUCESSO: ${baseURL}`);
      console.log(`   Token recebido: ${response.data.data ? response.data.data.substring(0, 20) + '...' : 'Token válido'}`);
      return baseURL;
    } else {
      console.log(`❌ FALHA: ${baseURL}`);
      console.log(`   Código: ${response.data.failCode}`);
      console.log(`   Dados: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    console.log(`❌ ERRO: ${baseURL}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Dados: ${JSON.stringify(error.response.data)}`);
    } else {
      console.log(`   Erro: ${error.message}`);
    }
  }
  
  return null;
}

async function findWorkingServer() {
  // Substitua pelos seus dados reais
  const userName = 'SoltechAPI';
  const systemCode = 'Wapsolar10*';
  
  if (userName === 'SEU_USUARIO_AQUI') {
    console.log('❗ Por favor, edite este arquivo e substitua userName e systemCode pelos seus dados reais');
    return;
  }

  console.log('🚀 Testando conectividade com servidores FusionSolar...');
  console.log(`👤 Usuário: ${userName}`);
  console.log(`🔑 System Code: ${systemCode.substring(0, 8)}...`);

  for (const server of API_SERVERS) {
    const result = await testServer(server, userName, systemCode);
    if (result) {
      console.log(`\n🎉 SERVIDOR FUNCIONANDO: ${result}`);
      console.log('Use este URL no seu arquivo main.js');
      return;
    }
  }

  console.log('\n❌ Nenhum servidor funcionou. Verifique:');
  console.log('1. Suas credenciais estão corretas?');
  console.log('2. Sua conta FusionSolar está ativa?');
  console.log('3. A API está habilitada na sua conta?');
  console.log('4. Sua conexão de internet está funcionando?');
}

// Executar o teste
findWorkingServer().catch(console.error);