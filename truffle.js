const HDWalletProvider = require('truffle-hdwallet-provider');
const fs = require('fs');

let mnemonic = '';

if (fs.existsSync('secrets.json')) {
  const secrets = JSON.parse(fs.readFileSync('secrets.json', 'utf8'));
  ({ mnemonic } = secrets);
}

if (process.env.MNEMONIC) {
  mnemonic = process.env.MNEMONIC;
}

if (mnemonic.includes('candy maple cake') && process.argv[4] === 'mainnet') {
  console.log(
    'WARNING! It looks like you are trying to deploy to the Ethereum Main Network using a mnemonic',
    'that looks suscpiciously like the default ganache mnemonic. ',
    'See more here: https://github.com/trufflesuite/ganache/issues/275. Exiting...',
  );
  process.exit(1);
}

module.exports = {
  networks: {
    mainnet: {
      provider: () => new HDWalletProvider(mnemonic, 'https://mainnet.infura.io'),
      network_id: '1',
      gas: 4500000,
      gasPrice: 10000000000,
    },
    ganache: {
      provider: () => new HDWalletProvider(mnemonic, 'http://localhost:8545'),
      network_id: '*',
      gas: 6000000,
      gasPrice: 25000000000,
    },
    rinkeby: {
      provider: () => new HDWalletProvider(mnemonic, 'https://rinkeby.infura.io'),
      network_id: '*',
      gas: 4500000,
      gasPrice: 25000000000,
    },
    ropsten: {
      provider: () => new HDWalletProvider(mnemonic, 'https://ropsten.infura.io'),
      network_id: '*',
      gas: 4500000,
      gasPrice: 25000000000,
    },
    // config for solidity-coverage
    coverage: {
      host: 'localhost',
      network_id: '*',
      port: 7545, // <-- If you change this, also set the port option in .solcover.js.
      gas: 0xfffffffffff, // <-- Use this high gas value
      gasPrice: 0x01, // <-- Use this low gas price
    },
  },
};

