/* eslint-env mocha */
/* global assert contract artifacts */
const fs = require('fs');
const BN = require('bignumber.js');
const Bank = artifacts.require('Bank.sol');

const config = JSON.parse(fs.readFileSync('./conf/config.json'));
const paramConfig = config.paramDefaults;

const utils = require('../utils.js');

const bigTen = number => new BN(number.toString(10), 10);

contract('Registry', (accounts) => {
  describe('Function: claimInflationRewards', () => {
    const [applicant, challenger, voterAlice] = accounts;
    const minDeposit = bigTen(paramConfig.minDeposit);

    let token;
    let voting;
    let registry;

    beforeEach(async () => {
      const { votingProxy, registryProxy, tokenInstance } = await utils.getProxies();
      voting = votingProxy;
      registry = registryProxy;
      token = tokenInstance;

      await utils.approveProxies(accounts, token, voting, false, registry);
    });

    it('should transfer the correct number of tokens once a challenge has been resolved', async () => {
      const listing = utils.getListingHash('claimthis.net');

      // Apply
      await utils.as(applicant, registry.apply, listing, minDeposit, '');
      const aliceStartingBalance = await token.balanceOf.call(voterAlice);

      // Challenge
      const pollID = await utils.challengeAndGetPollID(listing, challenger, registry);

      // Alice is so committed
      await utils.commitVote(pollID, '0', 500, '420', voterAlice, voting);
      await utils.increaseTime(paramConfig.commitStageLength + 1);

      // Alice is so revealing
      await utils.as(voterAlice, voting.revealVote, pollID, '0', '420');
      await utils.increaseTime(paramConfig.revealStageLength + 1);

      // Update status
      await utils.as(applicant, registry.updateStatus, listing);

      // Alice claims reward
      const aliceVoterReward = await registry.voterReward(voterAlice, pollID, '420');
      const crR = await utils.as(voterAlice, registry.claimReward, pollID, '420');
      utils.logEvents('claimReward', crR);

      // Alice withdraws her voting rights
      await utils.as(voterAlice, voting.withdrawVotingRights, '500');

      const aliceExpected = aliceStartingBalance.add(aliceVoterReward);
      const aliceFinalBalance = await token.balanceOf.call(voterAlice);

      assert.strictEqual(
        aliceFinalBalance.toString(10), aliceExpected.toString(10),
        'alice should have the same balance as she started',
      );

      const receipt = await utils.as(voterAlice, registry.claimInflationRewards, pollID);
      utils.logEvents('claimInflationRewards', receipt);
    });
  });
});

