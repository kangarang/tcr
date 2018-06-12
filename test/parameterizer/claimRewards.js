/* eslint-env mocha */
/* global artifacts assert contract */
const Parameterizer = artifacts.require('./Parameterizer.sol');
const Token = artifacts.require('EIP20.sol');

const fs = require('fs');
const BN = require('bn.js');
const utils = require('../utils');

const config = JSON.parse(fs.readFileSync('./conf/config.json'));
const paramConfig = config.paramDefaults;

const bigTen = number => new BN(number.toString(10), 10);

contract('Parameterizer', (accounts) => {
  describe('Function: claimRewards', () => {
    const [proposer, challenger, voterAlice] = accounts;

    it('should give the correct number of tokens to a voter on the winning side.', async () => {
      const parameterizer = await Parameterizer.deployed();
      const token = Token.at(await parameterizer.token.call());
      const voting = await utils.getVoting();

      const voterAliceStartingBalance = await token.balanceOf.call(voterAlice);

      // propose reparam
      const proposalReceipt = await utils.as(proposer, parameterizer.proposeReparameterization, 'voteQuorum', '51');
      const { propID } = proposalReceipt.logs[0].args;

      // challenge reparam
      const challengeReceipt =
        await utils.as(challenger, parameterizer.challengeReparameterization, propID);
      const { challengeID } = challengeReceipt.logs[0].args;

      // commit vote
      await utils.commitVote(challengeID, '1', '10', '420', voterAlice);
      await utils.increaseTime(paramConfig.pCommitStageLength + 1);

      // reveal vote
      await utils.as(voterAlice, voting.revealVote, challengeID, '1', '420');
      await utils.increaseTime(paramConfig.pRevealStageLength + 1);

      // process reparam
      await parameterizer.processProposal(propID);

      // array args
      const challengeIDs = [challengeID];
      const salts = ['420'];

      // multi claimRewards, arrays as inputs
      await utils.as(voterAlice, parameterizer.claimRewards, challengeIDs, salts);
      await utils.as(voterAlice, voting.withdrawVotingRights, '10');

      // state assertion
      const voterAliceFinalBalance = await token.balanceOf.call(voterAlice);
      // expected = starting balance + voterReward
      const voterAliceExpected = voterAliceStartingBalance.add(utils.multiplyByPercentage(
        paramConfig.pMinDeposit,
        bigTen(100).sub(bigTen(paramConfig.pDispensationPct)),
      ));
      assert.strictEqual(
        voterAliceFinalBalance.toString(10), voterAliceExpected.toString(10),
        'A voterAlice\'s token balance is not as expected after claiming a reward',
      );
    });

    it('should transfer an array of 3 rewards once a challenge has been resolved', async () => {
      const parameterizer = await Parameterizer.deployed();
      const token = Token.at(await parameterizer.token.call());
      const voting = await utils.getVoting();

      const voterAliceStartingBalance = await token.balanceOf.call(voterAlice);

      // propose reparams
      const proposalReceipt1 = await utils.as(proposer, parameterizer.proposeReparameterization, 'pVoteQuorum', '51');
      const proposalReceipt2 = await utils.as(proposer, parameterizer.proposeReparameterization, 'commitStageLen', '601');
      const proposalReceipt3 = await utils.as(proposer, parameterizer.proposeReparameterization, 'applyStageLen', '601');

      const propID1 = proposalReceipt1.logs[0].args.propID;
      const propID2 = proposalReceipt2.logs[0].args.propID;
      const propID3 = proposalReceipt3.logs[0].args.propID;

      // challenge reparams
      const challengeReceipt1 =
        await utils.as(challenger, parameterizer.challengeReparameterization, propID1);
      const challengeReceipt2 =
        await utils.as(challenger, parameterizer.challengeReparameterization, propID2);
      const challengeReceipt3 =
        await utils.as(challenger, parameterizer.challengeReparameterization, propID3);

      const challengeID1 = challengeReceipt1.logs[0].args.challengeID;
      const challengeID2 = challengeReceipt2.logs[0].args.challengeID;
      const challengeID3 = challengeReceipt3.logs[0].args.challengeID;

      // commit votes
      await utils.commitVote(challengeID1, '1', '10', '420', voterAlice);
      await utils.commitVote(challengeID2, '1', '10', '420', voterAlice);
      await utils.commitVote(challengeID3, '1', '10', '420', voterAlice);
      await utils.increaseTime(paramConfig.pCommitStageLength + 1);

      // reveal votes
      await utils.as(voterAlice, voting.revealVote, challengeID1, '1', '420');
      await utils.as(voterAlice, voting.revealVote, challengeID2, '1', '420');
      await utils.as(voterAlice, voting.revealVote, challengeID3, '1', '420');
      await utils.increaseTime(paramConfig.pRevealStageLength + 1);

      // process reparams
      await parameterizer.processProposal(propID1);
      await parameterizer.processProposal(propID2);
      await parameterizer.processProposal(propID3);

      // array args
      const challengeIDs = [challengeID1, challengeID2, challengeID3];
      const salts = ['420', '420', '420'];

      // multi claimRewards, arrays as inputs
      await utils.as(voterAlice, parameterizer.claimRewards, challengeIDs, salts);
      await utils.as(voterAlice, voting.withdrawVotingRights, '30');

      // state assertion
      const voterAliceFinalBalance = await token.balanceOf.call(voterAlice);
      // expected = starting balance + voterReward x3
      const voterAliceExpected = voterAliceStartingBalance
        .add(utils.multiplyByPercentage(
          paramConfig.pMinDeposit,
          bigTen(100).sub(bigTen(paramConfig.pDispensationPct)),
        ))
        .add(utils.multiplyByPercentage(
          paramConfig.pMinDeposit,
          bigTen(100).sub(bigTen(paramConfig.pDispensationPct)),
        ))
        .add(utils.multiplyByPercentage(
          paramConfig.pMinDeposit,
          bigTen(100).sub(bigTen(paramConfig.pDispensationPct)),
        ));
      assert.strictEqual(
        voterAliceFinalBalance.toString(10), voterAliceExpected.toString(10),
        'A voterAlice\'s token balance is not as expected after claiming a reward',
      );
    });
  });
});

