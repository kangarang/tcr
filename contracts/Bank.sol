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
    @dev Initializer. Can only be called once.
    @param _token The address where the ERC20 token contract is deployed
    */
    constructor(address _token) public {
        require(_token != 0 && address(token) == 0);
        owner = msg.sender;
        token = EIP20Interface(_token);
        BIRTH_DATE = now;
    }

    function resolveEpochChallenge(uint _epochNumber, uint totalWinningTokens) public onlyOwner returns (bool success) {
        require(!epochs[_epochNumber].resolved);

        // ----------------
        // The TCR also keeps a tally of
        // the total token weight revealed in majority factions for each epoch.
        // ----------------

        // increment epoch's total tokens (majority faction)
        epochs[_epochNumber].tokens += totalWinningTokens;
        return true;
    }

    function addVoterRewardTokens(uint _epochNumber, address _voter, uint _numTokens) public returns (uint epochTokens) {
        epochs[_epochNumber].voterTokens[_voter] += _numTokens;
        return epochs[_epochNumber].tokens;
    }

    function resolveEpochInflationTransfer(uint _epochNumber) public onlyOwner returns (uint epochInflation) {
        // uint currentEpochNumber = getCurrentEpoch();
        // require(currentEpochNumber > _epochNumber);
        Epoch storage epoch = epochs[_epochNumber];
        require(epoch.resolved == false);

        // set the epoch's resolved flag as true
        epoch.resolved = true;
        // calculate the inflation and set it
        // Bank.balance / inflation_denominator
        epoch.inflation = token.balanceOf(this).div(INFLATION_DENOMINATOR);

        require(token.transfer(msg.sender, epoch.inflation));
        return epoch.inflation;
    }

    // -------
    // Getters
    // -------

    function getCurrentEpoch() public view returns (uint epoch) {
        // (block.timestamp - this.birthdate) / epoch_duration
        return (now.sub(BIRTH_DATE)).div(EPOCH_DURATION);
    }

    function getEpochDetails(uint _epochNumber) public view returns (uint tokens, uint inflation, bool resolved) {
        return (epochs[_epochNumber].tokens, epochs[_epochNumber].inflation, epochs[_epochNumber].resolved);
    }
    function getEpochVoterTokens(uint _epochNumber, address _voter) public view returns (uint voterTokens) {
        return epochs[_epochNumber].voterTokens[_voter];
    }

    function getEpochInflationVoterRewards(uint _epochNumber, address _voter) public view returns (uint epochInflationVoterRewards) {
        uint epochVoterTokens = getEpochVoterTokens(_epochNumber, _voter);
        // (epoch.voterTokens[msg.sender] * epoch.inflation) / epoch.tokens
        return epochVoterTokens.mul(epochs[_epochNumber].inflation).div(epochs[_epochNumber].tokens);
    }
}
