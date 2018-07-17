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
    uint public BIRTH_DATE;            // set once on init
    uint public constant EPOCH_DURATION = 180;  // 3 minutes (HARD)
    uint public constant INFLATION_DENOMINATOR = 10000;
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

    function getCurrentEpoch() public returns (uint epoch) {
        uint CURRENT_EPOCH = (now.sub(BIRTH_DATE)).div(EPOCH_DURATION);
        emit DEBUG("getCurrentEpoch", CURRENT_EPOCH);
        return CURRENT_EPOCH;
    }

    function getEpochVoterTokens(uint _epochNumber, address _voter) public returns (uint voterTokens) {
        return epochs[_epochNumber].voterTokens[_voter];
    }

    function resolveEpochChallenge(uint _epochNumber, uint totalWinningTokens) public onlyOwner returns (bool success) {
        require(!epochs[_epochNumber].resolved);

        // increment epoch's total tokens (majority faction)
        epochs[_epochNumber].tokens += totalWinningTokens;
        emit DEBUG("epoch.tokens", epochs[_epochNumber].tokens);
        return true;
    }

    function addRevealVoterTokens(uint _epochNumber, address _voter, uint _numTokens) public returns (uint epochTokens) {
        epochs[_epochNumber].voterTokens[_voter] += _numTokens;
        return epochs[_epochNumber].tokens;
    }

    function resolveEpochInflationTransfer(uint _epochNumber) public onlyOwner returns (bool success) {
        // uint currentEpochNumber = getCurrentEpoch();
        // require(currentEpochNumber > _epochNumber);

        Epoch storage epoch = epochs[_epochNumber];
        require(!epoch.resolved);

        // set the epoch's resolved flag as true
        epoch.resolved = true;

        uint EPOCH_INFLATION = token.balanceOf(this).div(INFLATION_DENOMINATOR);

        epoch.inflation = EPOCH_INFLATION;

        emit DEBUG("EPOCH_INFLATION", EPOCH_INFLATION);
        emit DEBUG("_epochNumber", _epochNumber);

        token.transfer(msg.sender, EPOCH_INFLATION);
        return true;
    }
}
