/* eslint-env mocha */
/* global assert contract artifacts */
const fs = require('fs');
const BN = require('bignumber.js');

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
    let bank;

    beforeEach(async () => {
      const { votingProxy, registryProxy, tokenInstance, bankInstance } = await utils.getProxies();
      voting = votingProxy;
      registry = registryProxy;
      token = tokenInstance;
      bank = bankInstance;

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
      await utils.as(voterAlice, registry.claimReward, pollID, '420');

      // Alice withdraws her voting rights
      await utils.as(voterAlice, voting.withdrawVotingRights, '500');

      const aliceExpected = aliceStartingBalance.add(aliceVoterReward);
      const aliceFinalBalance = await token.balanceOf.call(voterAlice);

      assert.strictEqual(
        aliceFinalBalance.toString(10), aliceExpected.toString(10),
        'alice should have the same balance as she started',
      );

      await utils.as(voterAlice, registry.claimInflationRewards, pollID);

      const challenge = await registry.challenges.call(pollID);
      const epochNumber = challenge[6];
      const aliceInflationReward = await bank.getEpochInflationVoterRewards(epochNumber, voterAlice);

      const aliceExpectedInflation = aliceStartingBalance.add(aliceVoterReward).add(aliceInflationReward);
      const aliceFinalBalanceInflation = await token.balanceOf.call(voterAlice);

      assert.strictEqual(
        aliceFinalBalanceInflation.toString(10), aliceExpectedInflation.toString(10),
        'alice has the wrong balance after inflation',
      );
    });

    it('should transfer the correct amount of tokens to the Registry & the voter', async () => {
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
      await utils.as(voterAlice, registry.claimReward, pollID, '420');
      // Alice withdraws her voting rights
      await utils.as(voterAlice, voting.withdrawVotingRights, '500');
      // Check Alice's balance
      const aliceExpected = aliceStartingBalance.add(aliceVoterReward);
      const aliceFinalBalance = await token.balanceOf.call(voterAlice);
      assert.strictEqual(
        aliceFinalBalance.toString(10), aliceExpected.toString(10),
        'alice should have the same balance as she started',
      );

      const epochNumber = await utils.getChallengeEpochNumber(registry, pollID);
      const epochDetails = await bank.getEpochDetails.call(epochNumber);
      assert.strictEqual(epochDetails[0].toString(), '500', 'epoch should have returned the correct number of tokens');
      assert.strictEqual(epochDetails[1].toString(), '0', 'epoch should have returned the correct inflation value');
      assert.strictEqual(epochDetails[2], false, 'epoch should have been resolved');

      // check Alice's epoch.voterTokens
      const aliceEpochVoterTokens = await bank.getEpochVoterTokens.call(epochNumber, voterAlice);
      assert.strictEqual(aliceEpochVoterTokens.toString(), '500', 'epoch should have returned the correct number of tokens');

      const registryBalanceBeforeCIR = await token.balanceOf.call(registry.address);
      // Alice claims inflation rewards
      const cirReceipt = await utils.as(voterAlice, registry.claimInflationRewards, pollID);
      // utils.logEvents('claimInflationRewards:', cirReceipt);

      const inflation = await bank.getEpochInflation.call();
      const aliceInflationReward = await bank.getEpochInflationVoterRewards.call(epochNumber, voterAlice);

      // transferred from bank -> registry -> voter
      const expectedRegistryBalanceAfterCIR = registryBalanceBeforeCIR;
      const registryBalanceAfterCIR = await token.balanceOf.call(registry.address);
      assert.strictEqual(registryBalanceAfterCIR.toString(), expectedRegistryBalanceAfterCIR.toString(),
        'bank should have transferred the correct amount of tokens to the Registry after an epoch resolution');

      const aliceExpectedInflation = aliceStartingBalance.add(aliceVoterReward).add(aliceInflationReward);
      const aliceFinalBalanceInflation = await token.balanceOf.call(voterAlice);
      assert.strictEqual(
        aliceFinalBalanceInflation.toString(10), aliceExpectedInflation.toString(10),
        'alice has the wrong balance after inflation',
      );
    });

    it('should transfer the correct amount of tokens to the Registry, multiple voters, for a single epochs', async () => {});

    it('should transfer the correct amount of tokens to the Registry, multiple voters, for multiple epochs', async () => {});
  });
});

