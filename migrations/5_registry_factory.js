/* global artifacts */

const RegistryFactory = artifacts.require('./RegistryFactory.sol');
const Registry = artifacts.require('./Registry.sol');
const DLL = artifacts.require('dll/DLL.sol');
const AttributeStore = artifacts.require('attrstore/AttributeStore.sol');
const ParameterizerFactory = artifacts.require('./ParameterizerFactory.sol');

module.exports = (deployer) => {
  // link libraries
  deployer.link(DLL, Registry);
  deployer.link(AttributeStore, Registry);

  return deployer.deploy(Registry).then(registry => {
    // link libraries
    deployer.link(DLL, RegistryFactory);
    deployer.link(AttributeStore, RegistryFactory);

    return deployer.deploy(RegistryFactory, ParameterizerFactory.address, registry.address);
  });
};
