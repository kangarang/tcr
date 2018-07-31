pragma solidity ^0.4.24;

import "tokens/eip20/EIP20Interface.sol";
import "zeppelin/math/SafeMath.sol";

contract Bank {

    // ------
    // EVENTS
    // ------

    event DEBUG(string name, uint value);

    using SafeMath for uint;

    // Global Variables
    EIP20Interface public token;
    uint public BIRTH_DATE; // set once on init
    uint public constant EPOCH_DURATION = 180; // 3 minutes (HARD)
    uint public constant INFLATION_DENOMINATOR = 10000; // HARD
    address public owner;

    struct Epoch {
        uint tokens;
        uint inflation;
        bool resolved;
        mapping(address => uint) voterTokens;
    }

    mapping(uint => Epoch) public epochs;

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    /**
    @dev            Initializer. Can only be called once.
    @notice         Sets the owner, the ERC20 token, and the BIRTH_DATE
    @param _token   The address where the ERC20 token contract is deployed
    */
    constructor(address _token) public {
        require(_token != 0 && address(token) == 0);
        owner = msg.sender;
        token = EIP20Interface(_token);
        BIRTH_DATE = now;
    }

    /**
    @dev                        Keeps tally of the total number of tokens revealed by a majority faction
    @notice                     Invoked during resolveChallenge
    @param _epochNumber         The epoch to increment total tokens
    @param _totalWinningTokens  The number of tokens revealed by a majority faction
    */
    function addChallengeWinningTokens(uint _epochNumber, uint _totalWinningTokens) public onlyOwner returns (bool success) {
        require(!epochs[_epochNumber].resolved);

        // increment epoch's total tokens (revealed by majority faction)
        epochs[_epochNumber].tokens += _totalWinningTokens;
        return true;
    }

    /**
    @dev                    Adds the number of tokens revealed by a majority faction voter
    @notice                 Invoked during claimReward
    @param _epochNumber     The epoch to increment voterTokens
    @param _voter           The address of a voter who claimed rewards during an epoch
    @param _numTokens       The number of token rewards claimed by a voter
    */
    function addVoterRewardTokens(uint _epochNumber, address _voter, uint _numTokens) public onlyOwner returns (bool success) {
        // TODO: uncommenting this throws out of gas
        // require(!epochs[_epochNumber].resolved);

        epochs[_epochNumber].voterTokens[_voter] += _numTokens;
        return true;
    }

    /**
    @dev                    Resolves an epoch, adds the appropriate inflation amount to the epoch,
                            then transfers that amount to the Registry
    @notice                 Invoked during claimInflationRewards
    @param _epochNumber     The epoch number being resolved
    */
    function resolveEpochInflationTransfer(uint _epochNumber) public onlyOwner returns (uint epochInflation) {
        // uint currentEpochNumber = getCurrentEpoch();
        // require(currentEpochNumber > _epochNumber);
        Epoch storage epoch = epochs[_epochNumber];
        require(!epoch.resolved);

        // set the epoch's resolved flag as true
        epoch.resolved = true;
        // calculate the inflation and set it
        // Bank.balance / inflation_denominator
        epoch.inflation = getEpochInflation();

        require(token.transfer(msg.sender, epoch.inflation));
        return epoch.inflation;
    }

    // -------
    // Getters
    // -------

    function getEpochInflation() public view returns (uint epochInflation) {
        return token.balanceOf(this).div(INFLATION_DENOMINATOR);
    }

    /**
    @dev                    Returns the current epoch number
    */
    function getCurrentEpoch() public view returns (uint epoch) {
        // (block.timestamp - this.birthdate) / epoch_duration
        return (now.sub(BIRTH_DATE)).div(EPOCH_DURATION);
    }

    /**
    @dev                    Returns the current details of an epoch: tokens, inflation, and whether it is resolved
    @param _epochNumber     The epoch number being examined
    */
    function getEpochDetails(uint _epochNumber) public view returns (uint tokens, uint inflation, bool resolved) {
        return (epochs[_epochNumber].tokens, epochs[_epochNumber].inflation, epochs[_epochNumber].resolved);
    }

    /**
    @dev                    Returns the number of tokens a voter voted within one epoch
    @param _epochNumber     The epoch number being examined
    @param _voter           The address of a voter who claimed rewards during an epoch
    */
    function getEpochVoterTokens(uint _epochNumber, address _voter) public view returns (uint voterTokens) {
        return epochs[_epochNumber].voterTokens[_voter];
    }

    /**
    @dev                    Returns the number of tokens an epoch will reward to a voter while the (liquid) supply
    @param _epochNumber     The epoch number being examined
    @param _voter           The address of a voter who claimed rewards during an epoch
    */
    function getEpochInflationVoterRewards(uint _epochNumber, address _voter) public view returns (uint epochInflationVoterRewards) {
        uint epochVoterTokens = getEpochVoterTokens(_epochNumber, _voter);
        // (epoch.voterTokens[msg.sender] * epoch.inflation) / epoch.tokens
        return epochVoterTokens.mul(epochs[_epochNumber].inflation).div(epochs[_epochNumber].tokens);
    }
}
