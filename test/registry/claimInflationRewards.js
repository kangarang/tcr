/* eslint-env mocha */
/* global assert contract */
const fs = require('fs');
const BN = require('bignumber.js');

const config = JSON.parse(fs.readFileSync('./conf/config.json'));
const paramConfig = config.paramDefaults;

const utils = require('../utils.js');

const bigTen = number => new BN(number.toString(10), 10);

contract('Registry', (accounts) => {
  describe('Function: claimInflationRewards', () => {
    const [applicant, challenger, voterAlice, voterBob, voterCat, voterDog] = accounts;
    const minDeposit = bigTen(paramConfig.minDeposit);

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

      await utils.increaseTime(epochDuration);
      await utils.as(voterAlice, registry.claimInflationRewards, pollID);

      const challenge = await registry.challenges.call(pollID);
      const epochNumber = challenge[6];
      const aliceInflationReward =
        await bank.getEpochInflationVoterRewards(epochNumber, voterAlice);

      const aliceExpectedInflation =
        aliceStartingBalance.add(aliceVoterReward).add(aliceInflationReward);
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
      await utils.increaseTime(epochDuration);
      await utils.as(voterAlice, registry.claimInflationRewards, pollID);

      const aliceInflationReward =
        await bank.getEpochInflationVoterRewards.call(epochNumber, voterAlice);

      // transferred from bank -> registry -> voter
      const expectedRegistryBalanceAfterCIR = registryBalanceBeforeCIR;
      const registryBalanceAfterCIR = await token.balanceOf.call(registry.address);
      assert.strictEqual(
        registryBalanceAfterCIR.toString(), expectedRegistryBalanceAfterCIR.toString(),
        'bank should have transferred the correct amount of tokens to the Registry after an epoch resolution',
      );

      const aliceExpectedInflation =
        aliceStartingBalance.add(aliceVoterReward).add(aliceInflationReward);
      const aliceFinalBalanceInflation = await token.balanceOf.call(voterAlice);
      assert.strictEqual(
        aliceFinalBalanceInflation.toString(10), aliceExpectedInflation.toString(10),
        'alice has the wrong balance after inflation',
      );
    });

    it('should transfer the correct amount of tokens to the Registry, multiple voters, for a single epoch', async () => {
      const aliceStartingBalance = await token.balanceOf.call(voterAlice);
      const bobStartingBalance = await token.balanceOf.call(voterAlice);

      const ali = {
        address: voterAlice, voteOption: '0', numTokens: '500', salt: '420',
      };
      const bob = {
        address: voterBob, voteOption: '0', numTokens: '800', salt: '421',
      };
      const cat = {
        address: voterCat, voteOption: '1', numTokens: '1000', salt: '422',
      };

      const pollID = await utils.getToClaiming({
        applicant,
        challenger,
        voters: { ali, bob, cat },
        registry,
        voting,
        minDeposit,
        listingHash: await utils.getListingHash('getClaim.in'),
      });

      // Get rewards
      const aliceVoterReward = await registry.voterReward.call(voterAlice, pollID, ali.salt);
      const bobVoterReward = await registry.voterReward.call(voterBob, pollID, '421');
      // cat did not win, expect this to throw
      await utils.expectThrow(registry.voterReward.call(voterCat, pollID, '422'), 'should not have completed because cat lost');

      // Claim rewards
      await utils.as(voterAlice, registry.claimReward, pollID, ali.salt);
      await utils.as(voterBob, registry.claimReward, pollID, '421');
      // cat did not win, expect throw
      await utils.expectThrow(utils.as(voterCat, registry.claimReward, pollID, '422'), 'should not have been able to claim reward as voterCat');

      // Withdraw voting rights
      await utils.as(voterAlice, voting.withdrawVotingRights, '500');
      await utils.as(voterBob, voting.withdrawVotingRights, '800');
      await utils.as(voterCat, voting.withdrawVotingRights, '1000');

      // get the epoch number
      const epochNumber = await utils.getChallengeEpochNumber(registry, pollID);

      // check Alice's epoch.voterTokens
      const aliceEpochVoterTokens =
        await bank.getEpochVoterTokens.call(epochNumber, voterAlice);
      assert.strictEqual(aliceEpochVoterTokens.toString(), '500', 'epoch should have returned the correct number of tokens');

      const regStartBal = await token.balanceOf.call(registry.address);

      // Claim inflation rewards
      await utils.increaseTime(epochDuration);
      await utils.as(voterAlice, registry.claimInflationRewards, pollID);
      await utils.as(voterBob, registry.claimInflationRewards, pollID);
      // cat lost, expect throw
      await utils.expectThrow(
        utils.as(voterCat, registry.claimInflationRewards, pollID),
        'should not have been able to claim inflation rewards as voterCat',
      );

      const regFinalBal = await token.balanceOf.call(registry.address);
      const expectedRegFinalBal = regStartBal;
      utils.assertEqualToOrPlusMinusOne(regFinalBal, expectedRegFinalBal, 'registry');

      // Inflation rewards balance checks
      const aliceInflationReward =
        await bank.getEpochInflationVoterRewards.call(epochNumber, voterAlice);
      const aliceExpected = aliceStartingBalance.add(aliceVoterReward).add(aliceInflationReward);
      const aliceActual = await token.balanceOf.call(voterAlice);
      // assert.strictEqual(
      //   aliceActual.toString(),
      //   aliceExpected.toString(),
      //   'alice should have to correct balance after claim inflation rewards',
      // );
      utils.assertEqualToOrPlusMinusOne(aliceActual, aliceExpected, voterAlice);

      const bobInflationReward =
        await bank.getEpochInflationVoterRewards.call(epochNumber, voterBob);
      const bobExpected = bobStartingBalance.add(bobVoterReward).add(bobInflationReward);
      const bobActual = await token.balanceOf.call(voterBob);
      utils.assertEqualToOrPlusMinusOne(bobActual, bobExpected, voterBob);

      const catInflationReward =
        await bank.getEpochInflationVoterRewards.call(epochNumber, voterCat);
      assert.strictEqual(
        catInflationReward.toString(), '0',
        'cat should not have received any inflation rewards',
      );
    });

    it('should transfer the correct amount of tokens to the Registry, multiple voters, for multiple epochs', async () => {
      const regSB = await token.balanceOf.call(registry.address);
      const aliSB = await token.balanceOf.call(voterAlice);
      const bobSB = await token.balanceOf.call(voterBob);
      const catSB = await token.balanceOf.call(voterCat);
      const dogSB = await token.balanceOf.call(voterDog);

      const ali = {
        address: voterAlice, voteOption: '0', numTokens: '500', salt: '420',
      };
      const bob = {
        address: voterBob, voteOption: '1', numTokens: '800', salt: '421',
      };
      const cat = {
        address: voterCat, voteOption: '1', numTokens: '1000', salt: '422',
      };
      const dog = {
        address: voterDog, voteOption: '1', numTokens: '30000', salt: '422',
      };

      const li1 = await utils.getListingHash('1getClaim.in');
      const li2 = await utils.getListingHash('2getClaim.in');

      const pollID1 = await utils.getToClaiming({
        applicant,
        challenger,
        voters: { ali, bob },
        registry,
        voting,
        minDeposit,
        listingHash: li1,
      });

      // Post-epoch (pollID1)
      await utils.increaseTime(epochDuration);

      const pollID2 = await utils.getToClaiming({
        applicant,
        challenger,
        voters: { cat, dog },
        registry,
        voting,
        minDeposit,
        listingHash: li2,
      });

      // get the epoch number
      const ep1 = await utils.getChallengeEpochNumber(registry, pollID1);
      const ep2 = await utils.getChallengeEpochNumber(registry, pollID2);
      assert.notEqual(ep1.toString(), ep2.toString(), 'should not be in the same epoch');

      // Get rewards
      // alice lost, expect throw
      await utils.expectThrow(registry.voterReward.call(voterAlice, pollID1, ali.salt), 'should not have completed because cat lost');
      const bobVR = await registry.voterReward.call(voterBob, pollID1, bob.salt);
      // cat and dog both won
      const catVR = await registry.voterReward.call(voterCat, pollID2, cat.salt);
      const dogVR = await registry.voterReward.call(voterDog, pollID2, dog.salt);

      // Claim rewards
      // alice did not win, expect throw
      await utils.expectThrow(utils.as(voterAlice, registry.claimReward, pollID1, ali.salt), 'should not have been able to claim reward as alice');
      await utils.as(voterBob, registry.claimReward, pollID1, bob.salt);
      await utils.as(voterCat, registry.claimReward, pollID2, cat.salt);
      await utils.as(voterDog, registry.claimReward, pollID2, dog.salt);

      // Withdraw voting rights
      await utils.as(voterAlice, voting.withdrawVotingRights, ali.numTokens);
      await utils.as(voterBob, voting.withdrawVotingRights, bob.numTokens);
      await utils.as(voterCat, voting.withdrawVotingRights, cat.numTokens);
      await utils.as(voterDog, voting.withdrawVotingRights, dog.numTokens);

      // check all winners' epoch.voterTokens
      const bobEVT = await bank.getEpochVoterTokens.call(ep1, voterBob);
      assert.strictEqual(bobEVT.toString(), bob.numTokens, 'epoch should have returned the correct number of tokens');
      const catEVT = await bank.getEpochVoterTokens.call(ep2, voterCat);
      assert.strictEqual(catEVT.toString(), cat.numTokens, 'epoch should have returned the correct number of tokens');
      const dogEVT = await bank.getEpochVoterTokens.call(ep2, voterDog);
      assert.strictEqual(dogEVT.toString(), dog.numTokens, 'epoch should have returned the correct number of tokens');

      await token.balanceOf.call(registry.address);

      // Post-epoch (pollID2)
      await utils.increaseTime(epochDuration);

      // Claim inflation rewards
      // -----------------------

      // alice lost, expect throw
      await utils.expectThrow(
        utils.as(voterAlice, registry.claimInflationRewards, pollID1),
        'should not have been able to claim inflation rewards as voterCat',
      );
      await utils.as(voterBob, registry.claimInflationRewards, pollID1);
      await utils.as(voterCat, registry.claimInflationRewards, pollID2);
      await utils.as(voterDog, registry.claimInflationRewards, pollID2);

      // Post inflation rewards balances
      // -------------------------------

      // Registry final balance
      // there's 2 listings in the registry, both with unstakedDeposits (part of registry's balance)
      const li1UD = await utils.getUnstakedDeposit(li1, registry);
      const li2UD = await utils.getUnstakedDeposit(li2, registry);
      const regExpect = regSB.add(li1UD).add(li2UD);
      const regActual = await token.balanceOf.call(registry.address);
      utils.assertEqualToOrPlusMinusOne(regActual, regExpect, 'registry');

      // alice lost, no money for her
      const aliIR =
        await bank.getEpochInflationVoterRewards.call(ep1, voterAlice);
      assert.strictEqual(
        aliIR.toString(), '0',
        'cat should not have received any inflation rewards',
      );

      const aliExpect = aliSB;
      const aliActual = await token.balanceOf.call(voterAlice);
      assert.strictEqual(
        aliActual.toString(), aliExpect.toString(),
        'alice should have the exact same balance as before',
      );

      // bob, cat, and dog all won
      const bobIR =
        await bank.getEpochInflationVoterRewards.call(ep1, voterBob);
      const bobExpect = bobSB.add(bobVR).add(bobIR);
      const bobActual = await token.balanceOf.call(voterBob);
      utils.assertEqualToOrPlusMinusOne(bobActual, bobExpect, voterBob);

      const catIR =
        await bank.getEpochInflationVoterRewards.call(ep2, voterCat);
      const catExpect = catSB.add(catVR).add(catIR);
      const catActual = await token.balanceOf.call(voterCat);
      utils.assertEqualToOrPlusMinusOne(catActual, catExpect, voterCat);

      const dogIR =
        await bank.getEpochInflationVoterRewards.call(ep2, voterDog);
      const dogExpect = dogSB.add(dogVR).add(dogIR);
      const dogActual = await token.balanceOf.call(voterDog);
      utils.assertEqualToOrPlusMinusOne(dogActual, dogExpect, voterDog);
    });
  });
});

