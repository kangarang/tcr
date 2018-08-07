/* eslint-env mocha */
/* global assert contract artifacts */
const fs = require('fs');
const BN = require('bignumber.js');
const Bank = artifacts.require('Bank.sol');

const config = JSON.parse(fs.readFileSync('./conf/config.json'));
const paramConfig = config.paramDefaults;

const utils = require('../utils.js');

const bigTen = number => new BN(number.toString(10), 10);

contract('Bank', (accounts) => {
  describe('Function: getEpochDetails', () => {
    const [applicant, challenger, voterAlice] = accounts;

    let token;
    let voting;
    let registry;
    let minDeposit;
    let bank;
    let epochDuration;

    beforeEach(async () => {
      const { votingProxy, paramProxy, registryProxy, tokenInstance, bankInstance } = await utils.getProxies();
      voting = votingProxy;
      registry = registryProxy;
      token = tokenInstance;
      parameterizer = paramProxy;
      bank = bankInstance;
      minDeposit = await parameterizer.get.call('minDeposit');
      epochDuration = (await bank.EPOCH_DURATION.call()).toNumber();

      await utils.approveProxies(accounts, token, voting, parameterizer, registry);
    });

    it('should return the correct epoch details before resolving an epoch', async () => {
      const listing = utils.getListingHash('epochDetails.net');
      // Apply
      await utils.as(applicant, registry.apply, listing, minDeposit, '');
      // Challenge
      const pollID = await utils.challengeAndGetPollID(listing, challenger, registry);
      // Record Alice's starting balance
      const aliceStartingBalance = await token.balanceOf.call(voterAlice);
      // Alice is so committed
      await utils.commitVote(pollID, '0', '500', '420', voterAlice, voting);
      await utils.increaseTime(paramConfig.commitStageLength + 1);
      // Alice is so revealing
      await utils.as(voterAlice, voting.revealVote, pollID, '0', '420');
      await utils.increaseTime(paramConfig.revealStageLength + 1);
      // Update status
      await utils.as(applicant, registry.updateStatus, listing);

      // Alice claims reward
      const aliceVoterReward = await registry.voterReward(voterAlice, pollID, '420');
      await utils.as(voterAlice, registry.claimReward, pollID, '420');
      // Alice withdraws her voting rights
      await utils.as(voterAlice, voting.withdrawVotingRights, '500');

      // Alice's balance should be her starting + her reward
      const aliceExpected = aliceStartingBalance.add(aliceVoterReward);
      const aliceFinalBalance = await token.balanceOf.call(voterAlice);

      assert.strictEqual(
        aliceFinalBalance.toString(10), aliceExpected.toString(10),
        'alice should have the same balance as she started',
      );

      const bankAddress = await registry.bank.call();
      const bank = Bank.at(bankAddress);

      const challenge = await registry.challenges.call(pollID);
      const epochNumber = challenge[6];

      const epochDetails = await bank.getEpochDetails.call(epochNumber);
      assert.strictEqual(epochDetails[0].toString(), '500', 'epoch should have returned the correct number of tokens');
      assert.strictEqual(epochDetails[1].toString(), '0', 'epoch should have returned the correct inflation value');
      assert.strictEqual(epochDetails[2], false, 'epoch should not have been resolved yet');
    });

    it('should return the correct epoch details after resolving an epoch', async () => {
      const listing = utils.getListingHash('epoch-deets.net');
      // Apply
      await utils.as(applicant, registry.apply, listing, minDeposit, '');
      // Challenge
      const pollID = await utils.challengeAndGetPollID(listing, challenger, registry);
      // Record Alice's starting balance
      const aliceStartingBalance = await token.balanceOf.call(voterAlice);
      // Alice is so committed
      await utils.commitVote(pollID, '0', '500', '420', voterAlice, voting);
      await utils.increaseTime(paramConfig.commitStageLength + 1);
      // Alice is so revealing
      await utils.as(voterAlice, voting.revealVote, pollID, '0', '420');
      await utils.increaseTime(paramConfig.revealStageLength + 1);
      // Update status
      await utils.as(applicant, registry.updateStatus, listing);

      // Alice claims reward
      const aliceVoterReward = await registry.voterReward(voterAlice, pollID, '420');
      await utils.as(voterAlice, registry.claimReward, pollID, '420');
      // Alice withdraws her voting rights
      await utils.as(voterAlice, voting.withdrawVotingRights, '500');

      // Alice's balance should be her starting + her reward
      const aliceExpected = aliceStartingBalance.add(aliceVoterReward);
      const aliceFinalBalance = await token.balanceOf.call(voterAlice);

      assert.strictEqual(
        aliceFinalBalance.toString(10), aliceExpected.toString(10),
        'alice should have the same balance as she started',
      );

      const epochNumber = await utils.getChallengeEpochNumber(registry, pollID);

      await utils.increaseTime(epochDuration);
      const cirReceipt = await utils.as(voterAlice, registry.claimInflationRewards, pollID);

      const aliceInflationReward = await bank.getEpochInflationVoterRewards(epochNumber, voterAlice);

      const aliceExpectedInflation = aliceStartingBalance.add(aliceVoterReward).add(aliceInflationReward);
      const aliceFinalBalanceInflation = await token.balanceOf.call(voterAlice);

      assert.strictEqual(
        aliceFinalBalanceInflation.toString(10), aliceExpectedInflation.toString(10),
        'alice has the wrong balance after inflation',
      );

      const epoch = await bank.epochs.call(epochNumber);
      assert.strictEqual(epoch[2], true, 'epoch should have been resolved');

      const epochDetails = await bank.getEpochDetails.call(epochNumber);
      assert.strictEqual(epochDetails[0].toString(), '500', 'epoch should have returned the correct number of tokens');
      assert.strictEqual(epochDetails[1].toString(), aliceInflationReward.toString(), 'epoch should have returned the correct inflation value');
      assert.strictEqual(epochDetails[2], true, 'epoch should have been resolved');
    });
  });
});
