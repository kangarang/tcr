/* eslint-env mocha */
/* global assert contract */
const utils = require('../utils.js');

contract('Bank', (accounts) => {
  describe('Function: getCurrentEpoch', () => {
    let token;
    let voting;
    let registry;
    let bank;
    let epochDuration;

    beforeEach(async () => {
      const {
        votingProxy, registryProxy, tokenInstance, bankInstance,
      } = await utils.getProxies();
      voting = votingProxy;
      registry = registryProxy;
      token = tokenInstance;
      bank = bankInstance;
      epochDuration = (await bank.EPOCH_DURATION.call()).toNumber();

      await utils.approveProxies(accounts, token, voting, null, registry);
    });

    it('should return the correct epoch each time it is invoked', async () => {
      const e1 = await bank.getCurrentEpoch.call();
      assert.strictEqual(e1.toString(), '0', 'initial epoch should be 0');

      await utils.increaseTime(epochDuration);
      const e2 = await bank.getCurrentEpoch.call();
      assert.strictEqual(e2.toString(), '1', 'second epoch should be 1');

      const e3 = await bank.getCurrentEpoch.call();
      assert.strictEqual(e3.toString(), '1', 'epoch should still be 1 since no time has passed');

      // incrementally increase the time NOT beyond the epochDuration
      await utils.increaseTime(10);
      const e4 = await bank.getCurrentEpoch.call();
      assert.strictEqual(e4.toString(), '1', 'epoch should still be 1 since not enough time has passed');

      await utils.increaseTime(10);
      const e5 = await bank.getCurrentEpoch.call();
      assert.strictEqual(e5.toString(), '1', 'epoch should still be 1 since not enough time has passed');

      // increase the time beyond the epochDuration
      await utils.increaseTime(epochDuration - 20);
      const e6 = await bank.getCurrentEpoch.call();
      assert.strictEqual(e6.toString(), '2', 'epoch should be 2 since enough time has passed');
    });
  });
});

