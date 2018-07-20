/* eslint-env mocha */
/* global assert contract artifacts */
const Bank = artifacts.require('Bank.sol');

const utils = require('../utils.js');

contract('Bank', (accounts) => {
  describe('Function: getCurrentEpoch', () => {
    // const [applicant, challenger, voterAlice] = accounts;

    let token;
    let voting;
    let registry;
    let minDeposit;

    beforeEach(async () => {
      const { votingProxy, paramProxy, registryProxy, tokenInstance } = await utils.getProxies();
      voting = votingProxy;
      registry = registryProxy;
      token = tokenInstance;
      parameterizer = paramProxy;
      minDeposit = await parameterizer.get.call('minDeposit');

      await utils.approveProxies(accounts, token, voting, parameterizer, registry);
    });

    it('should return the correct epoch each time it is invoked', async () => {
      const bankAddress = await registry.bank.call();
      const bank = Bank.at(bankAddress);

      const e1 = await bank.getCurrentEpoch.call();
      assert.strictEqual(e1.toString(), '0', 'initial epoch should be 0');

      await utils.increaseTime(180);
      const e2 = await bank.getCurrentEpoch.call();
      assert.strictEqual(e2.toString(), '1', 'second epoch should be 1');

      const e3 = await bank.getCurrentEpoch.call();
      assert.strictEqual(e3.toString(), '1', 'epoch should still be 1 since no time has passed');

      await utils.increaseTime(10);
      const e4 = await bank.getCurrentEpoch.call();
      assert.strictEqual(e4.toString(), '1', 'epoch should still be 1 since not enough time has passed');

      await utils.increaseTime(10);
      const e5 = await bank.getCurrentEpoch.call();
      assert.strictEqual(e5.toString(), '1', 'epoch should still be 1 since not enough time has passed');

      await utils.increaseTime(160);
      const e6 = await bank.getCurrentEpoch.call();
      assert.strictEqual(e6.toString(), '2', 'epoch should be 2 since enough time has passed');
    });
  });
});

