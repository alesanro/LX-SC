//require("babel-register");
var HDWalletProvider = require("truffle-hdwallet-provider");
function getWallet(){
  try{
    return require('fs').readFileSync("./wallet.json", "utf8").trim();
  } catch(err){
    return "";
  }
}

module.exports = {
networks: {
    development: {
      host: 'localhost',
      port: 8545,
      network_id: '*', // Match any network id
      gas: 4700000
    },
    ntr1x: {
      network_id: 0x21240,
      provider: function () { new HDWalletProvider(getWallet(),'QWEpoi123','http://node2.parity.tp.ntr1x.com:8545')},
      gas: 4700000,
      gasPrice: 1000000000
    }
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  },
  migrations_directory: './migrations'
}
