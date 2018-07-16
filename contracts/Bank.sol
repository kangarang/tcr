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
    address public owner;

    struct Epoch {
        uint tokens;
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
}
